import { describe, it, expect, vi } from "vitest";
import { fetchAppointments, createAppointment, updateAppointmentStatus, deleteAppointment } from "../lib/appointmentApi";

const { mockSupabase, getMockCaregiverId } = await vi.hoisted(async () => {
  const { createMockSupabase } = await import("./mockSupabase");
  const fixtures = await import("./fixtures");
  const mockSup = createMockSupabase({
    appointment: [
      {
        appointment_id: "appt-1",
        patient_id: "pat-1",
        doctor_name: "Dr. Meenakshi Sundaram",
        specialty: "Neurology",
        location: "Apollo Hospital",
        appointment_time: new Date(Date.now() + 86400000).toISOString(),
        notes: "Cognitive check",
        status: "upcoming",
      },
    ],
    time_event: [],
    caregiver: structuredClone(fixtures.caregivers),
    patient: structuredClone(fixtures.patients),
  });
  return {
    mockSupabase: mockSup,
    getMockCaregiverId: () => fixtures.CURRENT_CAREGIVER_ID,
  };
});

vi.mock("../lib/supabaseClient", () => ({
  supabase: mockSupabase,
  getCaregiverId: getMockCaregiverId,
}));

describe("Appointment Module Tests", () => {
  it("fetches appointments for a patient", async () => {
    const list = await fetchAppointments("pat-1");
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list[0].doctor_name).toBe("Dr. Meenakshi Sundaram");
  });

  it("creates a new appointment and validates required fields", async () => {
    await expect(createAppointment("", { doctor_name: "Dr. Test" })).rejects.toThrow();

    const created = await createAppointment("pat-1", {
      doctor_name: "Dr. Ramanathan",
      specialty: "Geriatrics",
      location: "Fortis Malar",
      appointment_time: new Date().toISOString(),
      notes: "Blood pressure review",
    });

    expect(created.doctor_name).toBe("Dr. Ramanathan");
    expect(created.status).toBe("upcoming");
  });

  it("updates appointment status to completed", async () => {
    const updated = await updateAppointmentStatus("appt-1", "completed", "pat-1", "Dr. Meenakshi");
    expect(updated.status).toBe("completed");
  });

  it("deletes an appointment", async () => {
    const res = await deleteAppointment("appt-1");
    expect(res).toBe(true);
  });
});
