import { supabase } from "./supabaseClient";

const WINDOW_DAYS = 7;
const LATE_THRESHOLD_MINUTES = 30;

function bounded(value, max) {
  return Math.min(max, Math.max(0, value));
}

export function computeLiveStrainAndScore(features, circleSize = 2) {
  if (!features) return { strainIndex: 30, score: 70, riskLevel: "moderate", factors: {} };

  // 1. Missed / overdue tasks (25%)
  const missedOverdue = (features.missed_tasks || 0) + (features.overdue_tasks || 0);
  const missedFactor = bounded((missedOverdue / 4) * 100, 100);

  // 2. Care workload (20%)
  const tasksPerDay = features.tasks_per_day || 0;
  const workloadFactor = bounded((tasksPerDay / 8) * 100, 100);

  // 3. Night interruptions (15%)
  const nightInt = features.night_interruptions || 0;
  const nightFactor = bounded((nightInt / 3) * 100, 100);

  // 4. Sleep disruption (15%)
  let sleepFactor = 30;
  let sleepUnavailable = false;
  if (features.avg_sleep_hours != null) {
    if (features.avg_sleep_hours >= 7.5) sleepFactor = 0;
    else if (features.avg_sleep_hours >= 7.0) sleepFactor = 20;
    else if (features.avg_sleep_hours >= 6.0) sleepFactor = 50;
    else sleepFactor = bounded(((8.0 - features.avg_sleep_hours) / 4) * 100, 100);
  } else {
    sleepUnavailable = true;
  }

  // 5. Task imbalance (15%)
  const expectedShare = circleSize > 0 ? 1 / circleSize : 0.5;
  const actualShare = features.task_share != null ? features.task_share : expectedShare;
  const imbalanceDiff = Math.max(0, actualShare - expectedShare);
  const imbalanceFactor = bounded((imbalanceDiff / Math.max(0.1, 1 - expectedShare)) * 100, 100);

  // 6. Late logging (10%)
  const lateLogs = features.late_logs || 0;
  const lateFactor = bounded((lateLogs / 4) * 100, 100);

  const strainIndex = Math.round(
    0.25 * missedFactor +
    0.20 * workloadFactor +
    0.15 * nightFactor +
    0.15 * sleepFactor +
    0.15 * imbalanceFactor +
    0.10 * lateFactor
  );

  const score = Math.max(0, Math.min(100, 100 - strainIndex));
  const riskLevel = score >= 75 ? "low" : score >= 50 ? "moderate" : "elevated";

  return {
    strainIndex,
    score,
    riskLevel,
    factors: {
      missedOverdue: Math.round(missedFactor),
      workload: Math.round(workloadFactor),
      nightInterruptions: Math.round(nightFactor),
      sleepDisruption: sleepUnavailable ? "Unavailable" : Math.round(sleepFactor),
      taskImbalance: Math.round(imbalanceFactor),
      lateLogging: Math.round(lateFactor),
    },
  };
}

function localDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function scheduleDateTime(date, timeOfDay) {
  const [hours = "0", minutes = "0", seconds = "0"] = (timeOfDay || "00:00:00").split(":");
  const scheduledAt = new Date(date);
  scheduledAt.setHours(Number(hours), Number(minutes), Number(seconds), 0);
  return scheduledAt;
}

function isNightTime(date) {
  const hour = date.getHours();
  return hour >= 22 || hour < 6;
}

function logMentionsMedication(log, medicationName) {
  const searchableText = `${log.quantity || ""} ${log.notes || ""}`.toLowerCase();
  return searchableText.includes((medicationName || "").toLowerCase());
}

function aggregateMedicationTasks({ medications, schedules, logs, now }) {
  const schedulesByMedication = new Map();
  for (const schedule of schedules) {
    const bucket = schedulesByMedication.get(schedule.medication_id) || [];
    bucket.push(schedule);
    schedulesByMedication.set(schedule.medication_id, bucket);
  }

  const medicationLogs = logs.filter((log) => (log.type || "").toLowerCase() === "medication");
  const occurrences = [];
  const firstDay = new Date(now);
  firstDay.setHours(0, 0, 0, 0);
  firstDay.setDate(firstDay.getDate() - (WINDOW_DAYS - 1));

  for (const medication of medications) {
    if (!medication.active) continue;
    const medicationSchedules = schedulesByMedication.get(medication.medication_id) || [];
    for (let dayOffset = 0; dayOffset < WINDOW_DAYS; dayOffset += 1) {
      const day = new Date(firstDay);
      day.setDate(firstDay.getDate() + dayOffset);
      const dayKey = localDateKey(day);
      if (medication.start_date && dayKey < medication.start_date) continue;
      if (medication.end_date && dayKey > medication.end_date) continue;

      for (const schedule of medicationSchedules) {
        const scheduledAt = scheduleDateTime(day, schedule.time_of_day);
        if (scheduledAt <= now) occurrences.push({ medication, scheduledAt, dayKey });
      }
    }
  }

  occurrences.sort((a, b) => a.scheduledAt - b.scheduledAt);
  const usedLogIds = new Set();
  let missedTasks = 0;
  let lateLogs = 0;

  for (const occurrence of occurrences) {
    const match = medicationLogs
      .filter((log) =>
        !usedLogIds.has(log.log_id) &&
        localDateKey(new Date(log.created_at)) === occurrence.dayKey &&
        logMentionsMedication(log, occurrence.medication.medicine_name)
      )
      .sort((a, b) =>
        Math.abs(new Date(a.created_at) - occurrence.scheduledAt) -
        Math.abs(new Date(b.created_at) - occurrence.scheduledAt)
      )[0];

    if (!match) {
      missedTasks += 1;
      continue;
    }

    usedLogIds.add(match.log_id);
    const deltaMinutes = (new Date(match.created_at) - occurrence.scheduledAt) / 60000;
    if (deltaMinutes > LATE_THRESHOLD_MINUTES) lateLogs += 1;
  }

  return {
    tasks_per_day: bounded(occurrences.length / WINDOW_DAYS, 30),
    missed_tasks: bounded(missedTasks, 30),
    late_logs: bounded(lateLogs, 20),
  };
}

export async function aggregateCoordinationFeatures({ patientId, caregiverId, now = new Date() }) {
  if (!patientId || !caregiverId) throw new Error("patientId and caregiverId are required.");

  const since = new Date(now);
  since.setDate(since.getDate() - (WINDOW_DAYS - 1));
  since.setHours(0, 0, 0, 0);
  const sinceIso = since.toISOString();

  const medicationResult = await supabase
    .from("medication")
    .select("medication_id, medicine_name, active, start_date, end_date")
    .eq("patient_id", patientId)
    .eq("active", true);
  if (medicationResult.error) throw medicationResult.error;

  const medications = medicationResult.data || [];
  const medicationIds = medications.map((medication) => medication.medication_id);
  const [scheduleResult, logResult, circleResult, notificationResult, scenarioResult] = await Promise.all([
    medicationIds.length
      ? supabase.from("medication_schedule").select("schedule_id, medication_id, time_of_day").in("medication_id", medicationIds)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("daily_care_log")
      .select("log_id, caregiver_id, type, quantity, notes, sleep_hours, created_at")
      .eq("patient_id", patientId)
      .gte("created_at", sinceIso)
      .lte("created_at", now.toISOString()),
    supabase
      .from("caregiver_pat")
      .select("caregiver_id")
      .eq("patient_id", patientId)
      .eq("status", "active"),
    supabase
      .from("notification")
      .select("notification_id", { count: "exact", head: true })
      .eq("caregiver_id", caregiverId)
      .gte("created_at", sinceIso),
    supabase
      .from("scenario_attempt")
      .select("attempt_id", { count: "exact", head: true })
      .eq("caregiver_id", caregiverId)
      .gte("attempted_at", sinceIso),
  ]);

  for (const result of [scheduleResult, logResult, circleResult, notificationResult]) {
    if (result.error) throw result.error;
  }

  const logs = logResult.data || [];
  const medicationFeatures = aggregateMedicationTasks({
    medications,
    schedules: scheduleResult.data || [],
    logs,
    now,
  });
  const { data: sleepRows, error: sleepError } = await supabase.from("caregiver_sleep_log")
    .select("hours, sleep_date").eq("caregiver_id", caregiverId)
    .gte("sleep_date", since.toISOString().slice(0, 10));
  if (sleepError) throw sleepError;
  const sleepLogs = logs.filter((log) => (log.type || "").toLowerCase() === "sleep");
  const sleepHours = (sleepRows || []).map((log) => Number(log.hours)).filter(Number.isFinite);
  const circleSize = (circleResult.data || []).length;
  const caregiverLogCount = logs.filter((log) => log.caregiver_id === caregiverId).length;
  const taskShare = logs.length
    ? caregiverLogCount / logs.length
    : circleSize
      ? 1 / circleSize
      : 0;

  return {
    ...medicationFeatures,
    night_interruptions: bounded(
      sleepLogs.filter((log) => isNightTime(new Date(log.created_at))).length,
      15
    ),
    avg_sleep_hours: sleepHours.length
      ? bounded(sleepHours.reduce((sum, hours) => sum + hours, 0) / sleepHours.length, 14)
      : 7.0,
    task_share: bounded(taskShare, 1),
    notifications_received: bounded(notificationResult.count || 0, 50),
    scenario_attempts: bounded(scenarioResult?.count || 0, 50),
  };
}

export async function recalculateCoordinationScore({ patientId, caregiverId, accessToken }) {
  if (!accessToken) throw new Error("Your session expired. Log in again before recalculating the score.");
  if (!patientId || !caregiverId) throw new Error("Select a patient and ensure your caregiver profile is loaded.");
  const backendUrl = (import.meta.env.VITE_BACKEND_URL || "http://localhost:8000").replace(/\/$/, "");
  const features = await aggregateCoordinationFeatures({ patientId, caregiverId });
  let response;
  try {
    response = await fetch(`${backendUrl}/ml/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ ...features, patient_id: patientId, caregiver_id: caregiverId }),
    });
  } catch (err) {
    if (err.message?.includes("Failed to fetch") || err.name === "TypeError") {
      throw new Error(`Cannot reach the Score service at ${backendUrl}. Make sure the backend server is running.`, { cause: err });
    }
    throw err;
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || data.message || `Score service returned ${response.status}.`);
  const numericScore = typeof data.score === "number" ? data.score : typeof data.coordination_score === "number" ? data.coordination_score : null;
  if (numericScore === null) throw new Error("Score service response did not include a numeric score.");
  return { ...data, score: numericScore };
}
