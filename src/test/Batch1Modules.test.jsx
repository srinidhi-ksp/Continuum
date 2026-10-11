import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fixtures from "./fixtures";

const { mockSupabase, getMockCaregiverId, setMockCaregiverId } = await vi.hoisted(async () => {
  const { createMockSupabase } = await import("./mockSupabase");
  const fixtures = await import("./fixtures");
  let mockCaregiverId = "11111111-1111-1111-1111-111111111101";
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
  setCurrentCaregiverId: setMockCaregiverId,
}));

import { signUpCaregiver, signInCaregiver, signOutCaregiver } from "../lib/authApi";
import { createInvitation, getInvitationByToken, acceptInvitation } from "../lib/invitationApi";
import {
  fetchCareCircleMembers,
  assignMemberResponsibilities,
  updateMemberAlertPriority,
  routeAlert,
} from "../lib/careCircleApi";
import { createDailyCareLog, fetchDailyCareLogs } from "../lib/dailyCareApi";
import {
  fetchMedications,
  createMedication,
  toggleMedicationActive,
  logMedicationDose,
} from "../lib/medicationApi";
import { fetchTimelineEvents, addTimelineComment } from "../lib/timelineApi";

describe("Batch 1 Modules Integration & API Unit Tests", () => {
  beforeEach(() => {
    setMockCaregiverId(fixtures.CURRENT_CAREGIVER_ID);
  });

  describe("1. Authentication (Registration + Login)", () => {
    it("should register a new caregiver account and profile", async () => {
      const res = await signUpCaregiver({
        email: "newcaregiver@continuum.app",
        password: "Password123!",
        fullName: "Ananya Sharma",
        phone: "+91 99999 88888",
      });

      expect(res.user).toBeTruthy();
      expect(res.caregiver).toBeTruthy();
      expect(res.caregiver.full_name).toBe("Ananya Sharma");
      expect(res.caregiver.email).toBe("newcaregiver@continuum.app");
    });

    it("should sign in an existing caregiver and restore session", async () => {
      const res = await signInCaregiver({
        email: "srinidhi@continuum.app",
        password: "Password123!",
      });

      expect(res.user).toBeTruthy();
      expect(res.caregiver).toBeTruthy();
      expect(res.caregiver.full_name).toBe("Srinidhi Ravi");
    });

    it("should sign out successfully", async () => {
      await expect(signOutCaregiver()).resolves.not.toThrow();
    });
  });

  describe("2. Care Circle & Invitation Flow", () => {
    it("should generate a secure invitation link without exposing patient data in URL", async () => {
      const inv = await createInvitation({
        patientId: "22222222-2222-2222-2222-222222222201",
        invitedBy: fixtures.CURRENT_CAREGIVER_ID,
        relationship: "Daughter",
        role: "family",
      });

      expect(inv.token).toBeTruthy();
      expect(inv.shareableUrl).toContain("/join?token=");
      expect(inv.shareableUrl).not.toContain("22222222-2222-2222-2222-222222222201");
    });

    it("should validate an existing invitation token", async () => {
      const inv = await getInvitationByToken("valid-test-token-123");
      expect(inv).toBeTruthy();
      expect(inv.isValid).toBe(true);
      expect(inv.patient_id).toBe("22222222-2222-2222-2222-222222222201");
    });

    it("should accept invitation and join care circle without creating duplicate patient", async () => {
      const newCgId = "11111111-1111-1111-1111-111111111999";
      const initialPatientCount = mockSupabase._tables.patient.length;

      const res = await acceptInvitation("valid-test-token-123", newCgId);
      expect(res.patientId).toBe("22222222-2222-2222-2222-222222222201");

      expect(mockSupabase._tables.patient.length).toBe(initialPatientCount);

      const link = mockSupabase._tables.caregiver_pat.find(
        (l) => l.caregiver_id === newCgId && l.patient_id === "22222222-2222-2222-2222-222222222201"
      );
      expect(link).toBeTruthy();
    });

    it("should fetch care circle members with roles and relationships", async () => {
      const members = await fetchCareCircleMembers("22222222-2222-2222-2222-222222222201");
      expect(members.length).toBeGreaterThan(0);
      expect(members[0]).toHaveProperty("name");
      expect(members[0]).toHaveProperty("role");
      expect(members[0]).toHaveProperty("relationship");
    });
  });

  describe("3. Task Assignment & Alert Priority Routing", () => {
    it("should assign responsibilities to a care circle member", async () => {
      await assignMemberResponsibilities(
        "22222222-2222-2222-2222-222222222201",
        "11111111-1111-1111-1111-111111111102",
        ["Medication", "Night Care"]
      );

      const members = await fetchCareCircleMembers("22222222-2222-2222-2222-222222222201");
      const priya = members.find((m) => m.id === "11111111-1111-1111-1111-111111111102");
      expect(priya.assignedResponsibilities).toEqual(["Medication", "Night Care"]);
    });

    it("should update alert priority and route elevated alerts in priority order", async () => {
      await updateMemberAlertPriority(
        "22222222-2222-2222-2222-222222222201",
        "11111111-1111-1111-1111-111111111101",
        1,
        "all"
      );

      const result = await routeAlert("22222222-2222-2222-2222-222222222201", {
        title: "High Risk Fall Alert",
        severity: "elevated",
      });

      expect(result.routedTo.length).toBeGreaterThan(0);
      expect(result.routedTo[0].priority).toBeLessThanOrEqual(result.routedTo[1]?.priority ?? 99);
    });
  });

  describe("4. Daily Care → Timeline Creation", () => {
    it("should create a daily_care_log row AND corresponding time_event row", async () => {
      const res = await createDailyCareLog({
        patientId: "22222222-2222-2222-2222-222222222201",
        type: "Food",
        foodItem: "Idli and Sambhar",
        quantity: "2",
        unit: "pieces",
        notes: "Ate full portion",
      });

      expect(res.log).toBeTruthy();
      expect(res.event).toBeTruthy();
      expect(res.log.type).toBe("meal");
      expect(res.log.event_id).toBe(res.event.event_id);
    });

    it("should fetch daily care logs for patient", async () => {
      const logs = await fetchDailyCareLogs("22222222-2222-2222-2222-222222222201");
      expect(logs.length).toBeGreaterThan(0);
    });
  });

  describe("5. Medication CRUD & Dose Logging", () => {
    it("should create a new medication and schedule", async () => {
      const newMed = await createMedication({
        patientId: "22222222-2222-2222-2222-222222222201",
        name: "Memantine",
        brand: "Namenda",
        dosage: "5mg",
        frequency: "Once daily",
        scheduledTime: "09:00 AM",
        purpose: "Memory support",
      });

      expect(newMed).toBeTruthy();
      expect(newMed.name).toBe("Memantine");
      expect(newMed.active).toBe(true);
    });

    it("should toggle medication active state without deleting historical data", async () => {
      await toggleMedicationActive("44444444-4444-4444-4444-444444444401", false);
      const meds = await fetchMedications("22222222-2222-2222-2222-222222222201");
      const donepezil = meds.find((m) => m.id === "44444444-4444-4444-4444-444444444401");
      expect(donepezil.active).toBe(false);
    });

    it("should log medication dose taken and create timeline event", async () => {
      const res = await logMedicationDose({
        patientId: "22222222-2222-2222-2222-222222222201",
        medicationId: "44444444-4444-4444-4444-444444444401",
        medName: "Donepezil",
        medDosage: "10mg",
        status: "Taken",
        notes: "Taken after dinner",
      });

      expect(res.log).toBeTruthy();
      expect(res.event).toBeTruthy();
      expect(res.event.title).toContain("Medicine Taken: Donepezil 10mg");
    });
  });

  describe("6. Timeline Fetching & Comment Posting", () => {
    it("should fetch patient timeline events", async () => {
      const events = await fetchTimelineEvents("22222222-2222-2222-2222-222222222201");
      expect(events.length).toBeGreaterThan(0);
      expect(events[0]).toHaveProperty("time");
      expect(events[0]).toHaveProperty("title");
    });

    it("should add a comment to a timeline event", async () => {
      const comment = await addTimelineComment(
        "66666666-6666-6666-6666-666666666601",
        "Patient took dose with water, feeling fine.",
        fixtures.CURRENT_CAREGIVER_ID
      );

      expect(comment).toBeTruthy();
      expect(comment.text).toBe("Patient took dose with water, feeling fine.");
    });
  });
});
