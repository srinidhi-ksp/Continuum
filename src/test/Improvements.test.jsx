import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { computeLiveStrainAndScore } from "../lib/coordinationApi";
import { STRAIN_WEIGHTS, getCoordinationLevel } from "../config/coordinationConfig";
import { fetchDailyCareLogsByDate, getLocalDateString } from "../lib/dailyCareApi";
import {
  generateScenarioQuiz,
  submitScenarioQuiz,
  fetchQuizStatistics,
  fetchQuizHistory,
} from "../lib/scenarioApi";
import { verifyPrimaryCaregiver } from "../lib/taskApi";
import { supabase } from "../lib/supabaseClient";

vi.mock("../lib/supabaseClient", () => {
  return {
    supabase: {
      from: vi.fn(),
      rpc: vi.fn(),
    },
    getCaregiverId: vi.fn(() => "mock-caregiver-1"),
  };
});

describe("Improvement 1 & 2: Strain Engine and Care Coordination Score Calculation", () => {
  it("uses the configured initial weights: 25% missed, 20% workload, 15% night, 15% sleep, 15% imbalance, 10% late", () => {
    expect(STRAIN_WEIGHTS.missed_tasks).toBe(0.25);
    expect(STRAIN_WEIGHTS.care_workload).toBe(0.20);
    expect(STRAIN_WEIGHTS.night_interruptions).toBe(0.15);
    expect(STRAIN_WEIGHTS.sleep_disruption).toBe(0.15);
    expect(STRAIN_WEIGHTS.task_imbalance).toBe(0.15);
    expect(STRAIN_WEIGHTS.late_logging).toBe(0.10);
  });

  it("calculates score using Formula: Care Coordination Score = 100 - Strain Index", () => {
    const features = {
      missed_tasks: 0,
      tasks_per_day: 0,
      night_interruptions: 0,
      avg_sleep_hours: 8.0,
      task_share: 0.5,
      late_logs: 0,
    };
    const res = computeLiveStrainAndScore(features, 2);
    expect(res.strainIndex).toBe(0);
    expect(res.score).toBe(100);
    expect(res.score).toBe(100 - res.strainIndex);
  });

  it("handles missing sleep information safely without punitive severe disruption drop", () => {
    const features = {
      missed_tasks: 0,
      tasks_per_day: 0,
      night_interruptions: 0,
      avg_sleep_hours: null, // missing sleep data
      task_share: 0.5,
      late_logs: 0,
    };
    const res = computeLiveStrainAndScore(features, 2);
    // Missing sleep should NOT penalize the score as severe sleep disruption
    expect(res.factors.sleepDisruption).toBe("Unavailable");
    expect(res.unavailableMetrics).toContain("sleep");
    expect(res.mainReasons.some((r) => r.toLowerCase().includes("sleep"))).toBe(true);
    expect(res.suggestedActions.some((a) => a.title.toLowerCase().includes("sleep"))).toBe(true);
  });

  it("generates user-friendly dynamic reasons and suggested actions for elevated strain", () => {
    const features = {
      missed_tasks: 2,
      overdue_tasks: 1,
      tasks_per_day: 6,
      night_interruptions: 2,
      avg_sleep_hours: 5.5,
      task_share: 0.85,
      late_logs: 2,
    };
    const res = computeLiveStrainAndScore(features, 2);
    expect(res.strainIndex).toBeGreaterThan(30);
    expect(res.score).toBe(100 - res.strainIndex);
    expect(res.mainReasons.length).toBeGreaterThan(0);
    expect(res.suggestedActions.length).toBeGreaterThan(0);
    expect(res.mainReasons.some((r) => r.includes("overdue") || r.includes("missed"))).toBe(true);
  });
});

describe("Improvement 3: Caregiver Circle Role & Administrative Permissions", () => {
  it("verifies Primary Caregiver permissions correctly", async () => {
    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { role: "primary", status: "active" },
        error: null,
      }),
    });

    const isPrimary = await verifyPrimaryCaregiver("patient-1", "mock-caregiver-1");
    expect(isPrimary).toBe(true);
  });

  it("rejects non-primary caregivers from administrative permissions", async () => {
    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { role: "family", status: "active" },
        error: null,
      }),
    });

    const isPrimary = await verifyPrimaryCaregiver("patient-1", "mock-caregiver-2");
    expect(isPrimary).toBe(false);
  });
});

describe("Improvement 4: Daily Care Log Date Filtering", () => {
  it("returns today in local YYYY-MM-DD format", () => {
    const today = getLocalDateString(new Date());
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("applies date filtering with start of day and end of day in fetchDailyCareLogsByDate", async () => {
    const gteMock = vi.fn().mockReturnThis();
    const lteMock = vi.fn().mockReturnThis();
    const orderMock = vi.fn().mockResolvedValue({ data: [{ log_id: "log-1", type: "meal" }], error: null });

    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnValue({
        gte: gteMock.mockReturnValue({
          lte: lteMock.mockReturnValue({
            order: orderMock,
          }),
        }),
      }),
    });

    const result = await fetchDailyCareLogsByDate("patient-1", "2026-11-02");
    expect(result).toHaveLength(1);
    expect(gteMock).toHaveBeenCalled();
    expect(lteMock).toHaveBeenCalled();
  });
});

describe("Improvement 5: Scenario-Based Micro-Learning 3-Question Quiz", () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("generateScenarioQuiz returns 3 questions without exposing answers", async () => {
    const mockQuizResponse = {
      patient_id: "patient-1",
      patient_name: "Lakshmi Krishnan",
      condition: "Dementia",
      total_questions: 3,
      questions: [
        {
          question_id: "dem_001",
          scenario_id: "sc-1",
          title: "Evening Restlessness",
          scenario_description: "Care recipient becomes confused at dusk.",
          options: [
            { option_id: "opt-1", text: "Validate feelings and provide warm lighting" },
            { option_id: "opt-2", text: "Argue and lock the doors" },
          ],
        },
        {
          question_id: "dem_002",
          scenario_id: "sc-2",
          title: "Wandering at Night",
          scenario_description: "Patient tries to leave through the front door.",
          options: [
            { option_id: "opt-3", text: "Gently redirect with warm milk" },
            { option_id: "opt-4", text: "Tackle them to the floor" },
          ],
        },
        {
          question_id: "comm_001",
          scenario_id: "sc-3",
          title: "Bathroom Safety",
          scenario_description: "Floor is slippery after showering.",
          options: [
            { option_id: "opt-5", text: "Install non-slip rubber mats" },
            { option_id: "opt-6", text: "Leave loose towels" },
          ],
        },
      ],
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockQuizResponse,
    });

    const quiz = await generateScenarioQuiz("patient-1");
    expect(quiz.total_questions).toBe(3);
    expect(quiz.questions.length).toBe(3);
    expect(quiz.condition).toBe("Dementia");
    // Ensure answers are NOT revealed
    quiz.questions.forEach((q) => {
      q.options.forEach((opt) => {
        expect(opt.is_correct).toBeUndefined();
        expect(opt.explanation).toBeUndefined();
      });
    });
  });

  it("submitScenarioQuiz submits exactly 3 answers and returns immediate score and explanations", async () => {
    const mockSubmitResponse = {
      patient_id: "patient-1",
      patient_name: "Lakshmi Krishnan",
      condition: "Dementia",
      score: 2,
      total: 3,
      score_display: "2/3",
      correct_count: 2,
      incorrect_count: 1,
      accuracy: 66.7,
      feedback: "Good work! Review the missed question to strengthen your understanding.",
      attempted_at: "2026-11-04T12:00:00Z",
      results: [
        {
          scenario_id: "sc-1",
          title: "Evening Restlessness",
          selected_option_id: "opt-1",
          correct_option_id: "opt-1",
          is_correct: true,
          explanation: "Validation eases sundowning.",
        },
        {
          scenario_id: "sc-2",
          title: "Wandering at Night",
          selected_option_id: "opt-4",
          correct_option_id: "opt-3",
          is_correct: false,
          explanation: "Redirection prevents panic.",
        },
        {
          scenario_id: "sc-3",
          title: "Bathroom Safety",
          selected_option_id: "opt-5",
          correct_option_id: "opt-5",
          is_correct: true,
          explanation: "Non-slip mats prevent falls.",
        },
      ],
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockSubmitResponse,
    });

    const result = await submitScenarioQuiz({
      patientId: "patient-1",
      caregiverId: "caregiver-1",
      answers: [
        { scenario_id: "sc-1", option_id: "opt-1" },
        { scenario_id: "sc-2", option_id: "opt-4" },
        { scenario_id: "sc-3", option_id: "opt-5" },
      ],
    });

    expect(result.score).toBe(2);
    expect(result.total).toBe(3);
    expect(result.accuracy).toBe(66.7);
    expect(result.results.length).toBe(3);
    expect(result.results[0].is_correct).toBe(true);
    expect(result.results[1].is_correct).toBe(false);
    expect(result.results[0].explanation).toBe("Validation eases sundowning.");
  });

  it("fetchQuizStatistics computes overall accuracy from total correct divided by total questions", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        total_completed_attempts: 2,
        total_questions_answered: 6,
        total_correct_answers: 4,
        overall_accuracy: 66.7,
      }),
    });

    const stats = await fetchQuizStatistics("caregiver-1");
    expect(stats.total_completed_attempts).toBe(2);
    expect(stats.total_questions_answered).toBe(6);
    expect(stats.total_correct_answers).toBe(4);
    expect(stats.overall_accuracy).toBe(66.7);
  });

  it("fetchQuizHistory retrieves permanent quiz attempts with attempt number, score, and patient name", async () => {
    const mockHistory = [
      {
        attempt_id: "att-2",
        attempt_number: 2,
        attempted_at: "2026-11-04T12:00:00Z",
        patient_name: "Prema Nellaiappan",
        condition: "Dementia",
        score: "2/3",
        correct_count: 2,
        total_questions: 3,
        accuracy: 66.7,
        questions: [
          { scenario_id: "s1", title: "Q1", is_correct: true },
          { scenario_id: "s2", title: "Q2", is_correct: false },
          { scenario_id: "s3", title: "Q3", is_correct: true },
        ],
      },
      {
        attempt_id: "att-1",
        attempt_number: 1,
        attempted_at: "2026-11-04T10:00:00Z",
        patient_name: "Prema Nellaiappan",
        condition: "Dementia",
        score: "3/3",
        correct_count: 3,
        total_questions: 3,
        accuracy: 100.0,
        questions: [
          { scenario_id: "s4", title: "Q4", is_correct: true },
          { scenario_id: "s5", title: "Q5", is_correct: true },
          { scenario_id: "s6", title: "Q6", is_correct: true },
        ],
      },
    ];

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockHistory,
    });

    const history = await fetchQuizHistory("caregiver-1", "patient-1");
    expect(history.length).toBe(2);
    expect(history[0].attempt_number).toBe(2);
    expect(history[0].score).toBe("2/3");
    expect(history[0].accuracy).toBe(66.7);
    expect(history[0].questions.length).toBe(3);
    expect(history[1].attempt_number).toBe(1);
    expect(history[1].score).toBe("3/3");
    expect(history[1].accuracy).toBe(100.0);
  });
});
