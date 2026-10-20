// Small, focused write functions for the Patient page. Kept out of the
// component so the JSX handlers stay short, and so Medications/Daily Care
// can follow the same pattern (call a named function here, not scatter
// raw supabase.from(...) calls through page components) when they get
// their own passes.

import { supabase } from "./supabaseClient";

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
    time_zone: form.timeZone || null,
  };
}

// The database trigger creates the authenticated creator's primary membership
// atomically with the patient row.
export async function createPatient(form) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) throw new Error("Sign in before creating a patient.");
  if (form.caregiverId && form.caregiverId !== session.user.id) {
    throw new Error("The selected caregiver does not match the signed-in account.");
  }

  const { data: patientRow, error: patientError } = await supabase
    .from("patient")
    .insert(patientPayloadFromForm(form))
    .select()
    .single();
  if (patientError) throw patientError;

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
