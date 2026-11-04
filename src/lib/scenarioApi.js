import { supabase, getCaregiverId } from "./supabaseClient";

// ── Scenario Cards ────────────────────────────────────────────────────────────
export async function fetchScenarios() {
  const { data, error } = await supabase
    .from("scenario_card")
    .select("*")
    .order("category");

  if (error) {
    console.error("[scenarioApi] fetch scenarios failed:", error);
    throw error;
  }
  return data || [];
}

export async function fetchScenarioWithOptions(scenarioId) {
  const [cardRes, optionsRes] = await Promise.all([
    supabase.from("scenario_card").select("*").eq("scenario_id", scenarioId).single(),
    supabase.from("scenario_option").select("*").eq("scenario_id", scenarioId),
  ]);

  if (cardRes.error) throw cardRes.error;
  return { card: cardRes.data, options: optionsRes.data || [] };
}

// ── Attempts ─────────────────────────────────────────────────────────────────
export async function fetchAttempts(caregiverId) {
  const cgId = caregiverId || getCaregiverId();
  if (!cgId) return [];

  const { data, error } = await supabase
    .from("scenario_attempt")
    .select("*")
    .eq("caregiver_id", cgId)
    .order("attempted_at", { ascending: false });

  if (error) {
    console.error("[scenarioApi] fetch attempts failed:", error);
    throw error;
  }
  return data || [];
}

export async function saveAttempt({ scenarioId, optionId, isCorrect, caregiverId }) {
  const cgId = getCaregiverId() || caregiverId;
  if (!cgId || !scenarioId || !optionId) {
    throw new Error("caregiverId, scenarioId, and optionId are required.");
  }

  const { data, error } = await supabase
    .from("scenario_attempt")
    .insert({
      caregiver_id: cgId,
      scenario_id: scenarioId,
      option_id: optionId,
      is_correct: !!isCorrect,
      attempted_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error("[scenarioApi] save attempt failed:", error);
    throw error;
  }
  return data;
}

// ── AI Scenario Generation ────────────────────────────────────────────────────
/**
 * Call the server-side endpoint to generate a patient-specific scenario.
 * The LLM key never leaves the server — we only send the patient_id.
 *
 * Returns { card, options } matching the existing fetchScenarioWithOptions shape
 * so the quiz UI can render it without any changes.
 */
export async function generateScenario(patientId) {
  if (!patientId) throw new Error("patientId is required to generate a scenario.");

  const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || "http://localhost:8000").replace(/\/$/, "");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000); // 60 s — LLM may be slow

  try {
    const res = await fetch(`${BACKEND_URL}/ai/assistant/generate-scenario`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patient_id: patientId }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(
        `Backend returned ${res.status}: ${detail || res.statusText}`
      );
    }

    const data = await res.json();
    // data = { card: ScenarioCardOut, options: ScenarioOptionOut[] }
    return data;
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error("Scenario generation timed out. Please try again.", { cause: err });
    }
    if (
      err.message?.includes("Failed to fetch") ||
      err.message?.includes("NetworkError")
    ) {
      throw new Error(
        `Cannot reach the backend at ${BACKEND_URL}. ` +
          "Make sure the FastAPI server is running.",
        { cause: err }
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ── Scenario-Based Micro-Learning Quiz (3 Questions Per Attempt) ──────────────

/**
 * Generate a condition-specific 3-question quiz for the selected patient.
 */
export async function generateScenarioQuiz(patientId) {
  if (!patientId) throw new Error("patientId is required to generate a scenario quiz.");

  const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || "http://localhost:8000").replace(/\/$/, "");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);

  try {
    const res = await fetch(`${BACKEND_URL}/api/scenarios/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patient_id: patientId }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Backend returned ${res.status}: ${detail || res.statusText}`);
    }

    return await res.json();
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error("Quiz generation timed out. Please try again.", { cause: err });
    }
    // Fallback: If backend is unreachable, assemble 3 questions from existing Supabase scenario_card table
    try {
      const { data: cards } = await supabase.from("scenario_card").select("*").limit(10);
      if (cards && cards.length >= 3) {
        const picked = cards.slice(0, 3);
        const questions = await Promise.all(
          picked.map(async (c) => {
            const { data: opts } = await supabase.from("scenario_option").select("*").eq("scenario_id", c.scenario_id);
            return {
              question_id: c.scenario_id,
              scenario_id: c.scenario_id,
              title: c.title,
              scenario_description: c.scenario_text,
              category: c.category || "common_care",
              difficulty: c.difficulty || "medium",
              options: (opts || []).map((o) => ({ option_id: o.option_id, text: o.option_text })),
            };
          })
        );
        return {
          patient_id: patientId,
          patient_name: "Care Recipient",
          condition: "Caregiver Support",
          total_questions: 3,
          questions,
        };
      }
    } catch {
      // Ignore fallback error
    }

    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Submit the 3 answered questions for evaluation and persistence.
 */
export async function submitScenarioQuiz({ patientId, caregiverId, answers }) {
  if (!patientId || !answers || answers.length !== 3) {
    throw new Error("patientId and exactly 3 answers are required to submit quiz.");
  }
  const cgId = caregiverId || getCaregiverId();

  const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || "http://localhost:8000").replace(/\/$/, "");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);

  try {
    const res = await fetch(`${BACKEND_URL}/api/scenarios/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patient_id: patientId,
        caregiver_id: cgId,
        answers,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Backend returned ${res.status}: ${detail || res.statusText}`);
    }

    return await res.json();
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error("Quiz submission timed out. Please try again.", { cause: err });
    }

    // Fallback: If backend is unreachable, evaluate against Supabase directly and save attempts
    try {
      let correctCount = 0;
      const evaluated = [];
      const timestamp = new Date().toISOString();

      let patientName = "Care Recipient";
      let patientCondition = "Caregiver Support";
      if (patientId) {
        const { data: pat } = await supabase.from("patient").select("full_name, condition_type").eq("patient_id", patientId).maybeSingle();
        if (pat) {
          patientName = pat.full_name || patientName;
          patientCondition = pat.condition_type || patientCondition;
        }
      }

      for (const a of answers) {
        const { data: opt } = await supabase.from("scenario_option").select("*").eq("option_id", a.option_id).maybeSingle();
        const { data: card } = await supabase.from("scenario_card").select("*").eq("scenario_id", a.scenario_id).maybeSingle();
        const { data: correctOpt } = await supabase.from("scenario_option").select("*").eq("scenario_id", a.scenario_id).eq("is_correct", true).maybeSingle();

        const isCorr = Boolean(opt?.is_correct);
        if (isCorr) correctCount++;

        evaluated.push({
          scenario_id: a.scenario_id,
          title: card?.title || "Care Scenario",
          scenario_description: card?.scenario_text || "",
          selected_option_id: a.option_id,
          selected_option_text: opt?.option_text || "",
          correct_option_id: correctOpt?.option_id || "",
          correct_option_text: correctOpt?.option_text || "",
          is_correct: isCorr,
          explanation: correctOpt?.explanation || opt?.explanation || "Review scenario guidance.",
        });
      }

      // Save attempt directly to Supabase scenario_attempt table in a single batch
      if (cgId) {
        const rowsToInsert = answers.map((a, idx) => ({
          caregiver_id: cgId,
          scenario_id: a.scenario_id,
          option_id: a.option_id,
          is_correct: evaluated[idx]?.is_correct ?? false,
          attempted_at: timestamp,
        }));
        const { error: insErr } = await supabase.from("scenario_attempt").insert(rowsToInsert);
        if (insErr) {
          console.error("[scenarioApi] Failed to insert attempts into Supabase:", insErr);
          throw new Error(`Database error while saving quiz attempt: ${insErr.message}`);
        }
      }

      const score = correctCount;
      const total = evaluated.length;
      const accuracy = total > 0 ? Math.round((score / total) * 1000) / 10 : 0.0;
      let feedback = "Good work! Review the missed question to strengthen your understanding.";
      if (score === 3) feedback = "Excellent! You demonstrated good caregiving knowledge.";
      else if (score === 1) feedback = "Keep learning! Review the explanations and try again.";
      else if (score === 0) feedback = "Don't worry. Learn from the scenarios and try another attempt.";

      return {
        patient_id: patientId,
        patient_name: patientName,
        condition: patientCondition,
        score,
        total,
        score_display: `${score}/${total}`,
        correct_count: score,
        incorrect_count: total - score,
        accuracy,
        feedback,
        attempted_at: timestamp,
        results: evaluated,
      };
    } catch (fallbackErr) {
      console.error("[scenarioApi] Supabase fallback submission failed:", fallbackErr);
      throw fallbackErr;
    }
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch learning dashboard statistics.
 * Supports optional patientId filtering to provide patient-specific metrics.
 */
export async function fetchQuizStatistics(caregiverId, patientId = null) {
  const cgId = caregiverId || getCaregiverId();
  if (!cgId) {
    return {
      total_completed_attempts: 0,
      total_questions_answered: 0,
      total_correct_answers: 0,
      overall_accuracy: 0.0,
    };
  }

  const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || "http://localhost:8000").replace(/\/$/, "");
  const queryParam = patientId ? `&patient_id=${encodeURIComponent(patientId)}` : "";
  try {
    const res = await fetch(`${BACKEND_URL}/api/scenarios/statistics?caregiver_id=${cgId}${queryParam}`);
    if (res.ok) return await res.json();
  } catch {
    // Non-fatal, proceed to direct Supabase fallback
  }

  // Fallback: Calculate from direct Supabase history
  try {
    const history = await fetchQuizHistory(cgId, patientId);
    const totalQuizzes = history.length;
    const totalQuestions = history.reduce((sum, h) => sum + (h.total_questions || 3), 0);
    const totalCorrect = history.reduce((sum, h) => sum + (h.correct_count || 0), 0);
    const accuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 1000) / 10 : 0.0;

    return {
      total_completed_attempts: totalQuizzes,
      total_questions_answered: totalQuestions,
      total_correct_answers: totalCorrect,
      overall_accuracy: accuracy,
    };
  } catch (err) {
    console.warn("[scenarioApi] Supabase fallback statistics failed:", err);
    return {
      total_completed_attempts: 0,
      total_questions_answered: 0,
      total_correct_answers: 0,
      overall_accuracy: 0.0,
    };
  }
}

/**
 * Fetch attempt history list.
 * Supports optional patientId filtering and includes detailed question breakdowns.
 */
export async function fetchQuizHistory(caregiverId, patientId = null) {
  const cgId = caregiverId || getCaregiverId();
  if (!cgId) return [];

  const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || "http://localhost:8000").replace(/\/$/, "");
  const queryParam = patientId ? `&patient_id=${encodeURIComponent(patientId)}` : "";
  try {
    const res = await fetch(`${BACKEND_URL}/api/scenarios/history?caregiver_id=${cgId}${queryParam}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) return data;
    }
  } catch {
    // Non-fatal, proceed to direct Supabase fallback
  }

  // Fallback direct from Supabase
  try {
    // 1. Get caregiver's patients
    const { data: cpRows } = await supabase
      .from("caregiver_pat")
      .select("patient_id, patient:patient_id ( patient_id, full_name, condition_type )")
      .eq("caregiver_id", cgId);

    const patientMap = {};
    for (const r of cpRows || []) {
      const p = r.patient;
      if (p?.patient_id) {
        patientMap[p.patient_id] = p;
      }
    }

    // 2. Query scenario attempts with card & option joins
    const { data: attempts, error: attError } = await supabase
      .from("scenario_attempt")
      .select(
        "attempt_id, scenario_id, option_id, is_correct, attempted_at, scenario:scenario_id ( scenario_id, title, scenario_text, category, difficulty ), option:option_id ( option_id, option_text, explanation, is_correct )"
      )
      .eq("caregiver_id", cgId)
      .order("attempted_at", { ascending: false });

    if (attError || !attempts || attempts.length === 0) return [];

    // 3. Group rows within 15 seconds into 3-question attempts
    const groups = [];
    let currentGroup = [];
    let currentTime = null;

    for (const row of attempts) {
      const rowTime = row.attempted_at ? new Date(row.attempted_at).getTime() : null;
      if (currentTime === null) {
        currentTime = rowTime;
        currentGroup = [row];
      } else if (rowTime && currentTime && Math.abs(currentTime - rowTime) <= 15000 && currentGroup.length < 3) {
        currentGroup.push(row);
      } else {
        if (currentGroup.length > 0) groups.push(currentGroup);
        currentTime = rowTime;
        currentGroup = [row];
      }
    }
    if (currentGroup.length > 0) groups.push(currentGroup);

    // Keep completed 3-question quiz attempts
    const quizGroups = groups.filter((g) => g.length === 3);
    const totalQuizzes = quizGroups.length;

    const history = [];
    for (let idx = 0; idx < quizGroups.length; idx++) {
      const grp = quizGroups[idx];
      const attNum = totalQuizzes - idx;
      const correctCnt = grp.filter((r) => r.is_correct === true).length;
      const totCnt = grp.length;
      const accPct = Math.round((correctCnt / totCnt) * 1000) / 10;

      // Identify condition from scenario category
      let conditionLabel = "General Care";
      let matchedPatient = null;

      for (const r of grp) {
        const cat = (r.scenario?.category || "").toLowerCase();
        if (cat.includes("dementia")) {
          conditionLabel = "Dementia";
          break;
        } else if (cat.includes("stroke")) {
          conditionLabel = "Stroke";
          break;
        } else if (cat.includes("diabet")) {
          conditionLabel = "Diabetes";
          break;
        } else if (cat.includes("parkinson")) {
          conditionLabel = "Parkinson's Disease";
          break;
        }
      }

      // Match to patient
      for (const p of Object.values(patientMap)) {
        const c = (p.condition_type || "").toLowerCase();
        if (c.includes(conditionLabel.toLowerCase()) || (conditionLabel === "Dementia" && c.includes("alzheim"))) {
          matchedPatient = p;
          break;
        }
      }

      if (!matchedPatient && patientId && patientMap[patientId]) {
        matchedPatient = patientMap[patientId];
      } else if (!matchedPatient && Object.keys(patientMap).length > 0) {
        matchedPatient = Object.values(patientMap)[0];
      }

      const patName = matchedPatient?.full_name || "Care Recipient";
      const patId = matchedPatient?.patient_id || null;

      // Apply patient filter if specified
      if (patientId && patId && patId !== patientId) {
        continue;
      }

      const qDetails = grp.map((r) => ({
        scenario_id: r.scenario_id,
        title: r.scenario?.title || "Care Scenario",
        scenario_description: r.scenario?.scenario_text || "",
        selected_option_id: r.option_id,
        selected_option_text: r.option?.option_text || "",
        correct_option_text: r.option?.is_correct ? r.option?.option_text : "",
        is_correct: Boolean(r.is_correct),
        explanation: r.option?.explanation || "",
      }));

      history.push({
        attempt_id: grp[0].attempt_id,
        attempt_number: attNum,
        attempted_at: grp[0].attempted_at,
        patient_id: patId,
        patient_name: patName,
        condition: conditionLabel,
        score: `${correctCnt}/${totCnt}`,
        correct_count: correctCnt,
        total_questions: totCnt,
        accuracy: accPct,
        questions: qDetails,
      });
    }

    return history;
  } catch (err) {
    console.warn("[scenarioApi] Supabase fallback history failed:", err);
    return [];
  }
}

// ── Streak calculation ────────────────────────────────────────────────────────
// Returns the number of consecutive calendar days (ending today) the caregiver
// has completed at least one scenario. Uses attempt timestamps from Supabase —
// no extra table required.
export function calculateStreak(attempts) {
  if (!attempts || attempts.length === 0) return 0;

  // Use local date strings to avoid UTC timezone mismatch (e.g. IST +5:30)
  function localDateStr(d) {
    const dt = new Date(d);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const day = String(dt.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  const days = new Set(attempts.map((a) => localDateStr(a.attempted_at)));

  let streak = 0;
  const today = new Date();

  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = localDateStr(d);
    if (days.has(key)) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}
