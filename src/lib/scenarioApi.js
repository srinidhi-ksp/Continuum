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

export async function saveAttempt({ scenarioId, optionId, caregiverId }) {
  const cgId = caregiverId || getCaregiverId();
  if (!cgId || !scenarioId || !optionId) {
    throw new Error("caregiverId, scenarioId, and optionId are required.");
  }
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user || user.id !== cgId) {
    throw new Error("The signed-in account does not match this scenario attempt.");
  }

  const { data, error } = await supabase
    .from("scenario_attempt")
    .insert({
      scenario_id: scenarioId,
      option_id: optionId,
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
  const { generateScenarioWithAuth } = await import("./aiApi");
  return generateScenarioWithAuth(patientId);
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
