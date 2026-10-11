import { supabase, getCaregiverId } from "./supabaseClient";
import { mapMedicationRow } from "./mappers";

function parseTimeToSqlTime(timeStr) {
  if (!timeStr) return "08:00:00";
  const str = timeStr.trim().toUpperCase();
  const isPM = str.includes("PM");
  const isAM = str.includes("AM");
  const cleaned = str.replace(/[^\d:]/g, "");
  let [hStr, mStr = "00"] = cleaned.split(":");
  let h = parseInt(hStr || "8", 10);
  if (isPM && h < 12) h += 12;
  if (isAM && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${String(mStr).padStart(2, "0")}:00`;
}

export async function fetchMedications(patientId) {
  if (!patientId) return [];

  const { data: medRows, error: medError } = await supabase
    .from("medication")
    .select("*")
    .eq("patient_id", patientId)
    .order("start_date", { ascending: false });

  if (medError) {
    console.error("[medicationApi] Failed to fetch medications:", medError);
    throw medError;
  }

  const medIds = (medRows || []).map((m) => m.medication_id);
  let schedulesByMed = {};

  if (medIds.length > 0) {
    const { data: scheduleRows, error: schedError } = await supabase
      .from("medication_schedule")
      .select("*")
      .in("medication_id", medIds);

    if (schedError) {
      console.warn("[medicationApi] Failed to fetch medication schedules:", schedError.message);
    } else {
      schedulesByMed = (scheduleRows || []).reduce((acc, s) => {
        (acc[s.medication_id] ??= []).push(s);
        return acc;
      }, {});
    }
  }

  return (medRows || []).map((m) =>
    mapMedicationRow(m, schedulesByMed[m.medication_id] || [])
  );
}

export async function createMedication(form) {
  const caregiverId = getCaregiverId();
  if (!form.patientId) {
    throw new Error("patientId is required to create a medication.");
  }
  if (!form.name || !form.dosage) {
    throw new Error("Medicine name and dosage are required.");
  }

  const payload = {
    patient_id: form.patientId,
    medicine_name: form.name,
    brand: form.brand || null,
    dosage: form.dosage,
    instruction: form.purpose || form.instruction || null,
    purpose: form.purpose || null,
    frequency: form.frequency || "Once daily",
    start_date: form.startDate || new Date().toISOString().split("T")[0],
    end_date: form.endDate || null,
    active: form.active !== undefined ? !!form.active : true,
  };

  const { data: medRow, error: medError } = await supabase
    .from("medication")
    .insert(payload)
    .select()
    .single();

  if (medError) {
    console.error("[medicationApi] Failed to insert medication:", medError);
    throw medError;
  }

  // Insert schedule time
  const timeSql = parseTimeToSqlTime(form.scheduledTime || "08:00 AM");
  const { error: schedError } = await supabase
    .from("medication_schedule")
    .insert({
      medication_id: medRow.medication_id,
      time_of_day: timeSql,
    });

  if (schedError) {
    console.warn("[medicationApi] Failed to insert schedule:", schedError.message);
  }

  // Create timeline event
  await supabase.from("time_event").insert({
    patient_id: form.patientId,
    caregiver_id: caregiverId,
    title: `Medication Prescribed: ${medRow.medicine_name} ${medRow.dosage}`,
    event_type: "medication",
    created_at: new Date().toISOString(),
  });

  return mapMedicationRow(medRow, [{ time_of_day: timeSql }]);
}

export async function updateMedication(medicationId, form) {
  const payload = {
    medicine_name: form.name,
    brand: form.brand || null,
    dosage: form.dosage,
    instruction: form.purpose || form.instruction || null,
    purpose: form.purpose || null,
    frequency: form.frequency,
    start_date: form.startDate || null,
    end_date: form.endDate || null,
    active: form.active !== undefined ? !!form.active : true,
  };

  const { error: medError } = await supabase
    .from("medication")
    .update(payload)
    .eq("medication_id", medicationId);

  if (medError) throw medError;

  if (form.scheduledTime) {
    const timeSql = parseTimeToSqlTime(form.scheduledTime);
    // Delete existing schedules and re-insert
    await supabase.from("medication_schedule").delete().eq("medication_id", medicationId);
    await supabase.from("medication_schedule").insert({
      medication_id: medicationId,
      time_of_day: timeSql,
    });
  }
}

export async function toggleMedicationActive(medicationId, active) {
  const { error } = await supabase
    .from("medication")
    .update({ active: !!active })
    .eq("medication_id", medicationId);

  if (error) {
    console.error("[medicationApi] Failed to toggle medication active status:", error);
    throw error;
  }
}

export async function logMedicationDose({
  patientId,
  caregiverId,
  medicationId,
  medName,
  medDosage,
  status = "Taken",
  notes = "",
}) {
  const cgId = caregiverId || getCaregiverId();
  const now = new Date().toISOString();

  if (medicationId) {
    try {
      await supabase.from("medication_log").insert({
        medication_id: medicationId,
        patient_id: patientId,
        caregiver_id: cgId,
        status,
        notes,
      });
    } catch {
      console.warn("[medicationApi] medication_log table may not exist yet — skipping log insert.");
    }
  }

  // 1. Create time_event
  const eventTitle = `Medicine ${status}: ${medName || "Medication"} ${medDosage || ""}`.trim();
  const { data: eventRow } = await supabase
    .from("time_event")
    .insert({
      patient_id: patientId,
      caregiver_id: cgId,
      title: eventTitle,
      event_type: "medication",
      created_at: now,
    })
    .select()
    .single();

  // 2. Create daily_care_log entry
  const { data: logRow, error: logError } = await supabase
    .from("daily_care_log")
    .insert({
      patient_id: patientId,
      caregiver_id: cgId,
      event_id: eventRow?.event_id || null,
      type: "medication",
      quantity: `${medName} ${medDosage || ""}`.trim(),
      symptoms: null,
      notes: notes || `Status: ${status}`,
      created_at: now,
    })
    .select()
    .single();

  if (logError) throw logError;

  return { log: logRow, event: eventRow };
}
