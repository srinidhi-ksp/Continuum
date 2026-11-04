import { supabase, getCaregiverId } from "./supabaseClient";

export function getLocalDateString(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Fetch daily care logs for a specific calendar date in local timezone.
 * Applies backend timestamp filtering so only that date's logs are returned.
 */
export async function fetchDailyCareLogsByDate(patientId, dateStr) {
  if (!patientId || !dateStr) return [];

  // Parse YYYY-MM-DD in local time
  const parts = dateStr.split("-").map(Number);
  const year = parts[0];
  const month = parts[1] - 1;
  const day = parts[2];

  const startOfDay = new Date(year, month, day, 0, 0, 0, 0);
  const endOfDay = new Date(year, month, day, 23, 59, 59, 999);

  const { data, error } = await supabase
    .from("daily_care_log")
    .select("*, caregiver:caregiver_id ( full_name )")
    .eq("patient_id", patientId)
    .gte("created_at", startOfDay.toISOString())
    .lte("created_at", endOfDay.toISOString())
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[dailyCareApi] Failed to fetch daily care logs for date:", error);
    throw error;
  }
  return data || [];
}

export async function fetchDailyCareLogs(patientId, limit = 50) {
  if (!patientId) return [];

  const { data, error } = await supabase
    .from("daily_care_log")
    .select("*, caregiver:caregiver_id ( full_name )")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[dailyCareApi] Failed to fetch daily care logs:", error);
    throw error;
  }
  return data || [];
}

function deriveEventTitle(type, details) {
  const norm = (type || "").toLowerCase();
  if (norm === "food" || norm === "meal") {
    return details.foodItem ? `Meal logged: ${details.foodItem}` : "Meal logged";
  }
  if (norm === "water") {
    return details.quantity ? `Water logged (${details.quantity} ${details.unit || "ml"})` : "Water logged";
  }
  if (norm === "sleep") {
    return details.sleepHours ? `Sleep logged (${details.sleepHours} hrs)` : "Sleep logged";
  }
  if (norm === "medication") {
    return details.medName ? `Medication: ${details.medName} (${details.medStatus || "Taken"})` : "Medication logged";
  }
  if (norm === "mood") {
    return details.mood ? `Mood observed: ${details.mood}` : "Mood observed";
  }
  if (norm === "symptom") {
    return details.symptom ? `Symptom observed: ${details.symptom}` : "Symptom observed";
  }
  return "Care activity logged";
}

export async function createDailyCareLog(entry) {
  // Inserts must use caregiver_id from the loaded profile, never from form state
  const caregiverId = getCaregiverId() || entry.caregiverId;
  if (!entry.patientId) {
    throw new Error("patientId is required to create a daily care log.");
  }
  if (!caregiverId) {
    throw new Error("Authenticated caregiverId is required.");
  }

  const now = new Date().toISOString();

  // 1. Create corresponding timeline event first
  const eventTitle = deriveEventTitle(entry.type, entry);
  const eventType = (entry.type || "note").toLowerCase();

  const { data: eventRow, error: eventError } = await supabase
    .from("time_event")
    .insert({
      patient_id: entry.patientId,
      caregiver_id: caregiverId,
      title: eventTitle,
      event_type: eventType,
      created_at: now,
    })
    .select()
    .single();

  if (eventError) {
    console.warn("[dailyCareApi] Failed to insert time_event row:", eventError.message);
  }


  // 2. Prepare daily_care_log payload
  let sleepHours = entry.sleepHours != null ? Number(entry.sleepHours) : null;
  if (sleepHours == null && (entry.hours || entry.minutes)) {
    sleepHours = Number(entry.hours || 0) + Number(entry.minutes || 0) / 60;
  }

  let logType = (entry.type || "note").toLowerCase();
  if (logType === "food") logType = "meal";
  if (logType === "general note") logType = "note";

  let quantity = entry.quantity || null;
  if (entry.foodItem) {
    quantity = `${entry.foodItem}${entry.quantity ? ` · ${entry.quantity} ${entry.unit || "pieces"}` : ""}`;
  } else if (entry.type === "Water" && entry.quantity) {
    quantity = `${entry.quantity} ${entry.unit || "ml"}`;
  }

  let symptoms = entry.symptoms || entry.symptom || null;
  if (entry.severity && symptoms) {
    symptoms = `${symptoms} (${entry.severity})`;
  }

  const payload = {
    patient_id: entry.patientId,
    caregiver_id: caregiverId,
    type: logType,
    quantity: quantity,
    symptoms: symptoms,
    notes: entry.notes || null,
    sleep_hours: sleepHours,
    created_at: now,
  };

  const { data: logRow, error: logError } = await supabase
    .from("daily_care_log")
    .insert(payload)
    .select()
    .single();

  if (logError) {
    console.error("[dailyCareApi] Failed to insert daily_care_log row:", logError);
    throw logError;
  }

  return { log: { ...logRow, event_id: eventRow?.event_id }, event: eventRow };
}
