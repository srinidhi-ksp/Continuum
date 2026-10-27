// Small, focused write functions for the Patient page. Kept out of the
// component so the JSX handlers stay short, and so Medications/Daily Care
// can follow the same pattern (call a named function here, not scatter
// raw supabase.from(...) calls through page components) when they get
// their own passes.

import { supabase, getCaregiverId } from "./supabaseClient";

function patientPayloadFromForm(form) {
  return {
    full_name: form.name,
    dob: form.dob || null,
    gender: form.gender || null,
    condition_type: form.condition,
    blood_group: form.bloodGroup || null,
    allergies: form.allergies || null,
    phone: form.phone || null,
    medical_notes: form.notes || null,
  };
}

// Creates the patient, links them to the current caregiver as "primary",
// and adds their emergency contact if one was entered. It first attempts
// the atomic SECURITY DEFINER RPC create_patient, avoiding RLS race conditions.
// If the RPC is not available, it securely falls back to direct table inserts.
export async function createPatient(form) {
  const caregiverId = form.caregiverId || getCaregiverId();
  if (!caregiverId) throw new Error("No authenticated caregiver ID available.");

  let patientRow = null;

  // 1. Try atomic create_patient RPC (creates patient & caregiver_pat in single transaction)
  try {
    if (typeof supabase?.rpc === "function") {
      const { data: rpcData, error: rpcError } = await supabase.rpc("create_patient", {
      p_full_name: form.name?.trim(),
      p_dob: form.dob || null,
      p_gender: form.gender || null,
      p_condition_type: form.condition || null,
      p_time_zone: "Asia/Kolkata",
      p_blood_group: form.bloodGroup || null,
      p_allergies: form.allergies || null,
      p_medical_notes: form.notes || null,
      p_relationship: form.relationship || "Primary caregiver",
    });

    if (!rpcError && rpcData) {
      if (typeof rpcData === "string") {
        const { data: fetched, error: fetchErr } = await supabase
          .from("patient")
          .select("*")
          .eq("patient_id", rpcData)
          .single();
        if (!fetchErr && fetched) {
          patientRow = fetched;
        } else {
          patientRow = { patient_id: rpcData, ...patientPayloadFromForm(form), created_by: caregiverId };
        }
      } else {
        patientRow = rpcData;
      }
    }
  }
} catch (rpcEx) {
    console.warn("[patientApi] create_patient RPC failed, attempting direct insert:", rpcEx);
  }

  // 2. Direct table insert fallback if RPC was not used
  if (!patientRow) {
    const { data: directPatient, error: patientError } = await supabase
      .from("patient")
      .insert({ ...patientPayloadFromForm(form), created_by: caregiverId })
      .select()
      .single();
    if (patientError) throw patientError;
    patientRow = directPatient;

    const { error: linkError } = await supabase.from("caregiver_pat").insert({
      caregiver_id: caregiverId,
      patient_id: patientRow.patient_id,
      role: "primary",
      status: "active",
      relationship: form.relationship || "Primary caregiver",
      assigned_responsibilities: ["All care responsibilities"],
    });

    if (linkError) {
      await supabase.from("patient").delete().eq("patient_id", patientRow.patient_id);
      throw linkError;
    }
  }

  if (form.emergencyContact) {
    try {
      await upsertEmergencyContact(patientRow.patient_id, form);
    } catch (contactErr) {
      console.warn("[patientApi] Emergency contact save warning:", contactErr);
    }
  }

  return patientRow;
}

export async function updatePatient(patientId, form) {
  const { error: patientError } = await supabase
    .from("patient")
    .update(patientPayloadFromForm(form))
    .eq("patient_id", patientId);
  if (patientError) throw patientError;

  if (form.emergencyContact) {
    await upsertEmergencyContact(patientId, form);
  }
}

// Keeps this to a single "priority 1" contact per patient, matching what
// the Add/Edit Patient form actually collects (one name/relation/phone).
// The emergency_contact table supports several per patient — extending
// the form to add more is a small follow-up, not a schema change.
export async function upsertEmergencyContact(patientId, form) {
  const { data: existing, error: findError } = await supabase
    .from("emergency_contact")
    .select("contact_id")
    .eq("patient_id", patientId)
    .order("priority", { ascending: true })
    .limit(1);
  if (findError) throw findError;

  const payload = {
    patient_id: patientId,
    name: form.emergencyContact,
    relation: form.relationship || null,
    phone: form.emergencyPhone || null,
    priority: 1,
  };

  if (existing?.[0]) {
    const { error } = await supabase
      .from("emergency_contact")
      .update(payload)
      .eq("contact_id", existing[0].contact_id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("emergency_contact").insert(payload);
    if (error) throw error;
  }
}
