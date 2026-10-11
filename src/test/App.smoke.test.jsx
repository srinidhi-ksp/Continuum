import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMockSupabase } from "./mockSupabase";
import * as fixtures from "./fixtures";

// Intercept the one module every data-touching file imports through, so
// PatientContext, patientApi, and anything else that talks to Supabase all
// transparently hit our in-memory fixtures instead of a real project.
vi.mock("../lib/supabaseClient", () => {
  const mock = createMockSupabase({
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
  let activeId = fixtures.CURRENT_CAREGIVER_ID;
  return {
    supabase: mock,
    CURRENT_CAREGIVER_ID: fixtures.CURRENT_CAREGIVER_ID,
    getCaregiverId: () => activeId,
    setCurrentCaregiverId: (id) => { if (id) activeId = id; },
  };
});

// App.jsx renders <BrowserRouter> itself, which reads the real URL — reset
// it before each test so navigation from a previous test doesn't leak in.
beforeEach(() => {
  window.history.pushState({}, "", "/");
});

async function renderApp() {
  const { default: App } = await import("../App");
  return render(<App />);
}

describe("Dashboard + Patient integration", () => {
  it("loads the current patient's real data onto the Dashboard", async () => {
    await renderApp();

    // RequireAuth renders null while session restores, then shows the Dashboard.
    // Wait for the first patient name to confirm data loaded correctly.
    await waitFor(() => expect(screen.getByText("Lakshmi Krishnan")).toBeInTheDocument());

    // Coordination score for Lakshmi's fixture row is 78, moderate — this
    // loads in a second, separate effect after currentPatientId is set,
    // so it needs its own wait, not just the patient name's.
    await waitFor(() => expect(screen.getByText("78")).toBeInTheDocument());
    expect(screen.getByText(/moderate risk/i)).toBeInTheDocument();

    // Care circle should show all 3 linked caregivers' initials.
    expect(screen.getByText("3 caregivers")).toBeInTheDocument();

    // Recent activity should reflect real daily_care_log fixture rows,
    // not hardcoded mock text.
    expect(screen.getByText("Meal logged")).toBeInTheDocument();
    expect(screen.getByText("Sleep logged")).toBeInTheDocument();
  });

  it("navigates to Patient, shows both patients, and switching updates the Dashboard", async () => {
    const user = userEvent.setup();
    await renderApp();

    await waitFor(() => expect(screen.getByText("Lakshmi Krishnan")).toBeInTheDocument());

    await user.click(screen.getByRole("link", { name: /patient/i }));

    await waitFor(() => expect(screen.getByRole("heading", { name: "Patients" })).toBeInTheDocument());
    expect(screen.getByText("2 patients")).toBeInTheDocument();

    const rameshCard = screen.getByText("Ramesh Iyer").closest(".wt-patient-card");
    expect(rameshCard).toBeTruthy();
    // Ramesh's fixture coordination score is 42/elevated, so the card
    // should reflect "Attention" status, not the default "Stable".
    expect(within(rameshCard).getByText("Attention")).toBeInTheDocument();

    await user.click(within(rameshCard).getByRole("button", { name: /switch/i }));

    // switchPatient() navigates back to "/" — Dashboard should now show
    // Ramesh, proving context propagated the switch correctly.
    await waitFor(() => expect(screen.getByText("Ramesh Iyer")).toBeInTheDocument());
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText(/elevated risk/i)).toBeInTheDocument();
  });

  it("adding a patient on the Patient page makes them appear on the Dashboard", async () => {
    const user = userEvent.setup();
    await renderApp();

    await waitFor(() => expect(screen.getByText("Lakshmi Krishnan")).toBeInTheDocument());
    await user.click(screen.getByRole("link", { name: /patient/i }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Patients" })).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /add patient/i }));

    await user.type(screen.getByPlaceholderText("Enter patient name"), "Kavitha Menon");
    await user.type(screen.getByPlaceholderText("Example: Dementia"), "Mild Stroke Recovery");
    const dobInput = document.querySelector('input[name="dob"]');
    await user.type(dobInput, "1962-11-02");

    await user.click(screen.getByRole("button", { name: /^save patient$/i }));

    // Success modal proves the mocked insert + caregiver_pat link + reload
    // all completed without throwing. Scope to the modal specifically —
    // the patient grid behind it also now shows "Kavitha Menon" once
    // reloadPatients() ran, so an unscoped query would match both.
    await waitFor(() =>
      expect(screen.getByText("Patient Created Successfully")).toBeInTheDocument()
    );
    const successModal = screen.getByText("Patient Created Successfully").closest(".wt-modal");
    expect(within(successModal).getByText("Kavitha Menon")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /do this later/i }));

    // createPatient() already set her as the current patient — Dashboard
    // should reflect that the moment we navigate there.
    await user.click(screen.getByRole("link", { name: "Dashboard" }));
    await waitFor(() => expect(screen.getByText("Kavitha Menon")).toBeInTheDocument());
    expect(screen.getByText(/mild stroke recovery/i)).toBeInTheDocument();
  });
});
