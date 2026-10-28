// Appointment access mapped to the current Supabase schema.
import { supabase, getCaregiverId } from "./supabaseClient";
import { logTimelineEvent } from "./timelineApi";

function mapAppointment(row) {
  if (!row) return row;
  const date = row.appointment_date ? new Date(row.appointment_date) : null;
  // Grace window of 2 minutes so newly created appointments at current time are upcoming
  const isUpcoming = date && date.getTime() >= Date.now() - 120000;
  return {
    ...row,
    appointment_time: row.appointment_date,
    location: row.hospital || "",
    specialty: "",
    status: row.status || (isUpcoming ? "upcoming" : "completed"),
  };
}

export async function fetchAppointments(patientId) {
  if (!patientId) return [];
  const { data, error } = await supabase.from("appointment").select("*")
    .eq("patient_id", patientId).order("appointment_date", { ascending: true });
  if (error) throw error;
  return (data || []).map(mapAppointment);
}

export async function createAppointment(patientId, appointmentData) {
  if (!patientId) throw new Error("Patient ID is required");
  if (!appointmentData.doctor_name?.trim()) throw new Error("Doctor name is required");
  const dateValue = appointmentData.appointment_date || appointmentData.appointment_time;
  if (!dateValue) throw new Error("Appointment date and time are required");
  const payload = {
    patient_id: patientId,
    created_by: getCaregiverId(),
    doctor_name: appointmentData.doctor_name.trim(),
    hospital: (appointmentData.hospital || appointmentData.location || "").trim() || null,
    appointment_date: new Date(dateValue).toISOString(),
    notes: appointmentData.notes?.trim() || null,
  };
  const { data, error } = await supabase.from("appointment").insert(payload).select("*").single();
  if (error) throw error;
  try {
    await logTimelineEvent({
      patient_id: patientId,
      caregiver_id: getCaregiverId(),
      title: `Appointment scheduled with ${payload.doctor_name}${payload.hospital ? ` at ${payload.hospital}` : ""}`,
      event_type: "appointment",
    });
  } catch (timelineError) {
    console.warn("[appointmentApi] Appointment saved but timeline event failed:", timelineError);
  }
  return mapAppointment(data);
}

export async function updateAppointmentStatus(appointmentId, status) {
  try {
    const { data, error } = await supabase.from("appointment").update({ status }).eq("appointment_id", appointmentId).select("*").single();
    if (!error && data) return mapAppointment(data);
  } catch {
    // fallback if status column is not present
  }
  return { appointment_id: appointmentId, status };
}

export async function deleteAppointment(appointmentId) {
  const { error } = await supabase.from("appointment").delete().eq("appointment_id", appointmentId);
  if (error) throw error;
  return true;
}
