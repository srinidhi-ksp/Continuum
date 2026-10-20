import { supabase, getCaregiverId } from "./supabaseClient";

export async function fetchDailyCareLogs(patientId, limit = 50, offset = 0) {
  if (!patientId) return [];

  const { data, error } = await supabase
    .from("daily_care_log")
    .select("*, caregiver:caregiver_id ( full_name )")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

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
  const caregiverId = entry.caregiverId || getCaregiverId();
  if (!entry.patientId) {
    throw new Error("patientId is required to create a daily care log.");
  }
  if (!caregiverId) {
    throw new Error("Authenticated caregiverId is required.");
  }

  const now = new Date().toISOString();

  // 1. Create corresponding timeline event first
  const eventTitle = deriveEventTitle(entry.type, entry);
  let logType = (entry.type || "note").toLowerCase();
  if (logType === "food") logType = "meal";
  if (logType === "general note") logType = "note";
  const eventType = logType;

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

  const eventId = eventRow?.event_id || null;

  // 2. Prepare daily_care_log payload
  let sleepHours = entry.sleepHours != null ? Number(entry.sleepHours) : null;
  if (sleepHours == null && (entry.hours != null || entry.minutes != null)) {
    sleepHours = Number(entry.hours || 0) + Number(entry.minutes || 0) / 60;
  }

  let quantity = entry.quantity || null;
  if (entry.foodItem) {
    quantity = `${entry.foodItem}${entry.quantity ? ` · ${entry.quantity} ${entry.unit || "pieces"}` : ""}`;
  } else if (logType === "water" && entry.quantity) {
    quantity = `${entry.quantity} ${entry.unit || "ml"}`;
  } else if (logType === "mood") {
    quantity = entry.mood || null;
  } else if (logType === "medication") {
    quantity = `${entry.medName || "Medication"} ${entry.medDosage || ""}`.trim();
  }

  let symptoms = entry.symptoms || entry.symptom || null;
  if (entry.severity && symptoms) {
    symptoms = `${symptoms} (${entry.severity})`;
  }

  const payload = {
    patient_id: entry.patientId,
    caregiver_id: caregiverId,
    event_id: eventId,
    type: logType,
    quantity: quantity,
    symptoms: symptoms,
    notes: logType === "medication"
      ? [entry.medStatus || "Taken", entry.notes].filter(Boolean).join(" · ")
      : entry.notes || null,
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

  if (logType === "medication" && entry.medicationId) {
    const { error: medicationLogError } = await supabase
      .from("medication_log")
      .insert({
        medication_id: entry.medicationId,
        patient_id: entry.patientId,
        caregiver_id: caregiverId,
        status: entry.medStatus || "Taken",
        notes: entry.notes || null,
        created_at: now,
      });
    if (medicationLogError) {
      console.error("[dailyCareApi] Failed to insert medication dose log:", medicationLogError);
      throw medicationLogError;
    }
  }

  return { log: logRow, event: eventRow };
}
