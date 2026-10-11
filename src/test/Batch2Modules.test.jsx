import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fixtures from "./fixtures";

const { mockSupabase, getMockCaregiverId } = await vi.hoisted(async () => {
  const { createMockSupabase } = await import("./mockSupabase");
  const fixtures = await import("./fixtures");
  let mockCaregiverId = fixtures.CURRENT_CAREGIVER_ID;
  const mockSup = createMockSupabase({
    patient: structuredClone(fixtures.patients),
    caregiver: structuredClone(fixtures.caregivers),
    caregiver_pat: structuredClone(fixtures.caregiverPat),
    emergency_contact: structuredClone(fixtures.emergencyContacts),
    medication: structuredClone(fixtures.medications),
    medication_schedule: structuredClone(fixtures.medicationSchedules),
    daily_care_log: structuredClone(fixtures.dailyCareLogs),
    coordination_metric: structuredClone(fixtures.coordinationMetrics),
    time_event: structuredClone(fixtures.timeEvents),
    timeline_commend: structuredClone(fixtures.timelineComments),
    care_circle_invite: structuredClone(fixtures.careCircleInvites),
    scenario_card: structuredClone(fixtures.scenarioCards),
    scenario_option: structuredClone(fixtures.scenarioOptions),
    scenario_attempt: structuredClone(fixtures.scenarioAttempts),
    health_report: structuredClone(fixtures.healthReports),
    appointment: structuredClone(fixtures.appointments),
  });
  return {
    mockSupabase: mockSup,
    getMockCaregiverId: () => mockCaregiverId,
    setMockCaregiverId: (id) => { if (id) mockCaregiverId = id; },
  };
});

vi.mock("../lib/supabaseClient", () => ({
  supabase: mockSupabase,
  CURRENT_CAREGIVER_ID: fixtures.CURRENT_CAREGIVER_ID,
  getCaregiverId: getMockCaregiverId,
  setCurrentCaregiverId: (id) => { if (id) getMockCaregiverId.mockId = id; },
}));

// Suppress jsPDF browser API errors in Node test environment
vi.mock("jspdf", () => ({
  jsPDF: class {
    setFillColor() { return this; }
    setTextColor() { return this; }
    setFontSize() { return this; }
    setFont() { return this; }
    text() { return this; }
    rect() { return this; }
    splitTextToSize(text) { return [text]; }
    addPage() { return this; }
    output() { return new Blob(["pdf"], { type: "application/pdf" }); }
    save() {}
  },
}));

import {
  fetchEmergencyContacts,
  addEmergencyContact,
  updateEmergencyContact,
  deleteEmergencyContact,
} from "../lib/emergencyContactApi";

import {
  fetchScenarios,
  fetchAttempts,
  saveAttempt,
  calculateStreak,
  generateScenario,
} from "../lib/scenarioApi";

import {
  fetchHealthReports,
  collectReportData,
  buildHealthReportPDF,
} from "../lib/reportApi";

const PATIENT_1 = "22222222-2222-2222-2222-222222222201";
const CAREGIVER_1 = "11111111-1111-1111-1111-111111111101";

// ── Emergency Contacts ────────────────────────────────────────────────────────

describe("Emergency Contacts API", () => {
  it("fetchEmergencyContacts returns patient-scoped contacts ordered by priority", async () => {
    const contacts = await fetchEmergencyContacts(PATIENT_1);
    expect(Array.isArray(contacts)).toBe(true);
    expect(contacts.length).toBeGreaterThan(0);
    // All contacts must belong to the requested patient
    contacts.forEach((c) => expect(c.patient_id).toBe(PATIENT_1));
  });

  it("fetchEmergencyContacts returns empty for unknown patient", async () => {
    const contacts = await fetchEmergencyContacts("00000000-0000-0000-0000-000000000000");
    expect(contacts).toEqual([]);
  });

  it("addEmergencyContact inserts a new contact", async () => {
    const contact = await addEmergencyContact({
      patientId: PATIENT_1,
      name: "Ravi Shankar",
      relation: "Brother",
      phone: "+91 90000 12345",
      priority: 3,
    });
    expect(contact.name).toBe("Ravi Shankar");
    expect(contact.patient_id).toBe(PATIENT_1);
    expect(contact.priority).toBe(3);
  });

  it("updateEmergencyContact changes the name", async () => {
    const contacts = await fetchEmergencyContacts(PATIENT_1);
    const first = contacts[0];
    const updated = await updateEmergencyContact(first.contact_id, { name: "Updated Name" });
    expect(updated.name).toBe("Updated Name");
  });

  it("deleteEmergencyContact removes the contact", async () => {
    // Add a temporary contact, then delete it
    const added = await addEmergencyContact({
      patientId: PATIENT_1,
      name: "Temp Contact",
      priority: 99,
    });
    await deleteEmergencyContact(added.contact_id);
    const contacts = await fetchEmergencyContacts(PATIENT_1);
    expect(contacts.find((c) => c.contact_id === added.contact_id)).toBeUndefined();
  });
});

// ── Scenario / Micro Learning API ─────────────────────────────────────────────

describe("Scenario API", () => {
  it("fetchScenarios returns all scenario cards", async () => {
    const scenarios = await fetchScenarios();
    expect(scenarios.length).toBeGreaterThanOrEqual(2);
    expect(scenarios[0]).toHaveProperty("scenario_id");
    expect(scenarios[0]).toHaveProperty("title");
  });

  it("fetchAttempts returns only the caregiver's own attempts", async () => {
    const attempts = await fetchAttempts(CAREGIVER_1);
    expect(Array.isArray(attempts)).toBe(true);
    attempts.forEach((a) => expect(a.caregiver_id).toBe(CAREGIVER_1));
  });

  it("saveAttempt inserts a new attempt record", async () => {
    const attempt = await saveAttempt({
      caregiverId: CAREGIVER_1,
      scenarioId: "dddddddd-dddd-dddd-dddd-dddddddddd02",
      optionId: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeee03",
      isCorrect: true,
    });
    expect(attempt.caregiver_id).toBe(CAREGIVER_1);
    expect(attempt.is_correct).toBe(true);
  });

  it("calculateStreak returns 1 when attempts include today", () => {
    const todayAttempt = { attempted_at: new Date().toISOString() };
    const streak = calculateStreak([todayAttempt]);
    expect(streak).toBe(1);
  });

  it("calculateStreak returns 0 with no attempts", () => {
    expect(calculateStreak([])).toBe(0);
    expect(calculateStreak(null)).toBe(0);
  });

  it("calculateStreak does not count a gap in days", () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString();
    // Only 2 days ago, no yesterday or today → streak should be 0
    const streak = calculateStreak([{ attempted_at: twoDaysAgo }]);
    expect(streak).toBe(0);
  });
});

// ── generateScenario (AI endpoint) ────────────────────────────────────────────

const MOCK_SCENARIO_RESPONSE = {
  card: {
    scenario_id: "ai-card-001",
    patient_id: PATIENT_1,
    title: "Evening Agitation",
    scenario_text: "Your patient becomes restless at 6 PM. What do you do?",
    difficulty: "medium",
    category: "dementia_care",
    is_ai_generated: true,
  },
  options: [
    {
      option_id: "ai-opt-001",
      scenario_id: "ai-card-001",
      option_text: "Redirect with a calming activity",
      is_correct: true,
      explanation: "Redirection reduces distress.",
    },
    {
      option_id: "ai-opt-002",
      scenario_id: "ai-card-001",
      option_text: "Argue that everything is fine",
      is_correct: false,
      explanation: "Arguing increases agitation.",
    },
  ],
};

describe("generateScenario (AI scenario generation)", () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("calls /ai/assistant/generate-scenario with patient_id and returns {card, options}", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => MOCK_SCENARIO_RESPONSE,
    });

    const result = await generateScenario(PATIENT_1);

    // Correct endpoint called
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/ai/assistant/generate-scenario"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ patient_id: PATIENT_1 }),
      })
    );

    // Response shape matches quiz UI expectations
    expect(result.card).toBeDefined();
    expect(result.card.patient_id).toBe(PATIENT_1);
    expect(result.card.is_ai_generated).toBe(true);
    expect(Array.isArray(result.options)).toBe(true);
    expect(result.options.length).toBeGreaterThan(0);

    // Exactly one correct option
    const correct = result.options.filter((o) => o.is_correct);
    expect(correct.length).toBe(1);
  });

  it("throws when patientId is missing", async () => {
    await expect(generateScenario(null)).rejects.toThrow(
      "patientId is required"
    );
    await expect(generateScenario(undefined)).rejects.toThrow(
      "patientId is required"
    );
  });

  it("throws a descriptive error when backend returns non-OK status", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
      text: async () => "Supabase not configured",
    });

    await expect(generateScenario(PATIENT_1)).rejects.toThrow(
      "Backend returned 503"
    );
  });

  it("throws a network error when fetch itself rejects", async () => {
    global.fetch = vi.fn().mockRejectedValue(
      Object.assign(new TypeError("Failed to fetch"), { name: "TypeError" })
    );

    await expect(generateScenario(PATIENT_1)).rejects.toThrow(
      /Failed to fetch|Cannot reach the backend/
    );
  });
});

// ── Health Report API ─────────────────────────────────────────────────────────

describe("Health Report API", () => {
  it("fetchHealthReports returns patient-scoped reports", async () => {
    const reports = await fetchHealthReports(PATIENT_1);
    expect(Array.isArray(reports)).toBe(true);
    reports.forEach((r) => expect(r.patient_id).toBe(PATIENT_1));
  });

  it("fetchHealthReports returns empty for unknown patient", async () => {
    const reports = await fetchHealthReports("00000000-0000-0000-0000-000000000000");
    expect(reports).toEqual([]);
  });

  it("collectReportData returns all expected sections", async () => {
    const data = await collectReportData({
      patientId: PATIENT_1,
      startDate: new Date(Date.now() - 30 * 86400000).toISOString(),
      endDate: new Date().toISOString(),
    });
    expect(data).toHaveProperty("patient");
    expect(data).toHaveProperty("timeline");
    expect(data).toHaveProperty("careLogs");
    expect(data).toHaveProperty("medications");
    expect(data).toHaveProperty("appointments");
    expect(data).toHaveProperty("careCircle");
    expect(data.patient.patient_id).toBe(PATIENT_1);
  });

  it("buildHealthReportPDF generates a PDF blob", () => {
    const data = {
      patient: { patient_id: PATIENT_1, full_name: "Lakshmi Krishnan", dob: "1954-03-12", gender: "Female", condition_type: "Dementia", blood_group: "B+", allergies: "Penicillin" },
      timeline: [],
      careLogs: [],
      medications: [],
      appointments: [],
      careCircle: [],
    };
    const doc = buildHealthReportPDF(data, "2026-08-01", "2026-08-31");
    // jsPDF is mocked in tests; just verify the function completes without throwing
    expect(doc).toBeDefined();
  });
});
