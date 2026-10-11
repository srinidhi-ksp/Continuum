import { supabase } from "./supabaseClient";

export async function fetchEmergencyContacts(patientId) {
  if (!patientId) return [];
  const { data, error } = await supabase
    .from("emergency_contact")
    .select("*")
    .eq("patient_id", patientId)
    .order("priority", { ascending: true });

  if (error) {
    console.error("[emergencyContactApi] fetch failed:", error);
    throw error;
  }
  return data || [];
}

export async function addEmergencyContact({ patientId, name, relation, phone, priority }) {
  if (!patientId || !name) throw new Error("patientId and name are required.");

  const { data, error } = await supabase
    .from("emergency_contact")
    .insert({ patient_id: patientId, name, relation: relation || null, phone: phone || null, priority: priority ?? 1 })
    .select()
    .single();

  if (error) {
    console.error("[emergencyContactApi] add failed:", error);
    throw error;
  }
  return data;
}

export async function updateEmergencyContact(contactId, { name, relation, phone, priority }) {
  const payload = {};
  if (name !== undefined) payload.name = name;
  if (relation !== undefined) payload.relation = relation;
  if (phone !== undefined) payload.phone = phone;
  if (priority !== undefined) payload.priority = priority;

  const { data, error } = await supabase
    .from("emergency_contact")
    .update(payload)
    .eq("contact_id", contactId)
    .select()
    .single();

  if (error) {
    console.error("[emergencyContactApi] update failed:", error);
    throw error;
  }
  return data;
}

export async function deleteEmergencyContact(contactId) {
  const { error } = await supabase
    .from("emergency_contact")
    .delete()
    .eq("contact_id", contactId);

  if (error) {
    console.error("[emergencyContactApi] delete failed:", error);
    throw error;
  }
}
