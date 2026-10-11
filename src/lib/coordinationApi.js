import { supabase } from "./supabaseClient";

const WINDOW_DAYS = 7;
const LATE_THRESHOLD_MINUTES = 30;

function bounded(value, max) {
  return Math.min(max, Math.max(0, value));
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
  const [scheduleResult, logResult, circleResult, notificationResult, attemptsResult] = await Promise.all([
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
      .is("removed_at", null),
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

  for (const result of [scheduleResult, logResult, circleResult, notificationResult, attemptsResult]) {
    if (result.error) throw result.error;
  }

  const logs = logResult.data || [];
  const medicationFeatures = aggregateMedicationTasks({
    medications,
    schedules: scheduleResult.data || [],
    logs,
    now,
  });
  const sleepLogs = logs.filter((log) => (log.type || "").toLowerCase() === "sleep");
  const sleepHours = sleepLogs.map((log) => Number(log.sleep_hours)).filter(Number.isFinite);
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
    avg_sleep_hours: bounded(
      sleepHours.length ? sleepHours.reduce((sum, hours) => sum + hours, 0) / sleepHours.length : 0,
      14
    ),
    task_share: bounded(taskShare, 1),
    notifications_received: bounded(notificationResult.count || 0, 50),
    scenario_attempts: bounded(attemptsResult.count || 0, 50),
  };
}

export async function recalculateCoordinationScore({ patientId, caregiverId, accessToken }) {
  if (!accessToken) throw new Error("A signed-in Supabase session is required.");
  const features = await aggregateCoordinationFeatures({ patientId, caregiverId });
  const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
  const response = await fetch(`${backendUrl}/ml/predict`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ ...features, patient_id: patientId, caregiver_id: caregiverId }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Score recalculation failed (${response.status}): ${detail || response.statusText}`);
  }
  return response.json();
}