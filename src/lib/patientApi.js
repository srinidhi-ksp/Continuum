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
// and adds their emergency contact if one was entered. The caregiverId
// is resolved at call-time via getCaregiverId() so it always uses the
// authenticated user's UUID — not the hardcoded module-level constant.
export async function createPatient(form) {
  const caregiverId = form.caregiverId || getCaregiverId();
  if (!caregiverId) throw new Error("No authenticated caregiver ID available.");

  const { data: patientRow, error: patientError } = await supabase
    .from("patient")
    .insert({ ...patientPayloadFromForm(form), created_by: caregiverId })
    .select()
    .single();
  if (patientError) throw patientError;

  // Build the link payload with only the guaranteed base columns.
  // The extended columns (relationship, status) are added by migration_v2.sql;
  // if that migration hasn't been applied yet, we skip them gracefully.
  const { error: linkError } = await supabase.from("caregiver_pat").insert({
    caregiver_id: caregiverId,
    patient_id: patientRow.patient_id,
    role: "primary",
    status: "active",
    relationship: form.relationship || null,
  });
  if (linkError) {
    await supabase.from("patient").delete().eq("patient_id", patientRow.patient_id);
    throw linkError;
  }

  if (form.emergencyContact) {
    await upsertEmergencyContact(patientRow.patient_id, form);
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
