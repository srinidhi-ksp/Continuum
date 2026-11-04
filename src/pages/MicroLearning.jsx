/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback } from "react";
import {
  CheckCircle,
  XCircle,
  Flame,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Loader2,
  HelpCircle,
  RotateCcw,
  Award,
  Calendar,
  Eye,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { usePatient } from "../context/PatientContext";
import {
  fetchAttempts,
  calculateStreak,
  generateScenarioQuiz,
  submitScenarioQuiz,
  fetchQuizStatistics,
  fetchQuizHistory,
} from "../lib/scenarioApi";

export default function MicroLearning() {
  const { caregiverProfile } = useAuth();
  const caregiverId = caregiverProfile?.caregiver_id;
  const { patients } = usePatient();

  const [attempts, setAttempts] = useState([]);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Quiz statistics and history
  const [stats, setStats] = useState({
    total_completed_attempts: 0,
    total_questions_answered: 0,
    total_correct_answers: 0,
    overall_accuracy: 0,
  });
  const [history, setHistory] = useState([]);
  const [viewingAttempt, setViewingAttempt] = useState(null); // Selected attempt for viewing details

  // Active Quiz State (3 questions per attempt)
  const [activeQuiz, setActiveQuiz] = useState(null); // { patient_id, patient_name, condition, questions: [] }
  const [currentQIndex, setCurrentQIndex] = useState(0); // 0, 1, 2
  const [quizAnswers, setQuizAnswers] = useState({}); // { [scenario_id]: option_id }
  const [quizResult, setQuizResult] = useState(null); // Submit response
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quizError, setQuizError] = useState("");

  // Quiz generation
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState(null);

  // Sync selectedPatientId whenever patients list resolves
  useEffect(() => {
    if (!selectedPatientId && patients.length > 0) {
      setSelectedPatientId(patients[0].id);
    }
  }, [patients, selectedPatientId]);

  const loadData = useCallback(async (cgId, patId) => {
    if (!cgId) return;
    try {
      const [atts, qStats, qHist] = await Promise.all([
        fetchAttempts(cgId),
        fetchQuizStatistics(cgId, patId),
        fetchQuizHistory(cgId, patId),
      ]);
      setAttempts(atts || []);
      setStreak(calculateStreak(atts || []));
      setStats(qStats || {
        total_completed_attempts: 0,
        total_questions_answered: 0,
        total_correct_answers: 0,
        overall_accuracy: 0,
      });
      setHistory(qHist || []);
    } catch (err) {
      console.warn("[MicroLearning] Failed to load statistics:", err);
    }
  }, []);

  useEffect(() => {
    if (!caregiverId) return;
    let cancelled = false;
    setLoading(true);
    setError("");

    loadData(caregiverId, selectedPatientId)
      .catch((e) => {
        if (!cancelled) setError(e.message || "Failed to load learning data.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [caregiverId, selectedPatientId, loadData]);

  // ── Start 3-Question Scenario Quiz ──
  async function handleStartQuiz() {
    if (!selectedPatientId) {
      setGenerateError("Please select a patient first.");
      return;
    }
    setGenerating(true);
    setGenerateError("");
    setQuizError("");
    setQuizResult(null);
    setQuizAnswers({});
    setCurrentQIndex(0);

    try {
      const quizData = await generateScenarioQuiz(selectedPatientId);
      if (!quizData || !quizData.questions || quizData.questions.length < 3) {
        throw new Error("Unable to retrieve 3 questions for this patient. Please try again.");
      }
      setActiveQuiz(quizData);
    } catch (e) {
      setGenerateError(e.message || "Failed to generate scenario quiz. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  // ── Select an answer for current question ──
  function handleSelectOption(scenarioId, optionId) {
    if (quizResult || isSubmitting) return;
    setQuizAnswers((prev) => ({
      ...prev,
      [scenarioId]: optionId,
    }));
  }

  // ── Submit all 3 answers ──
  async function handleSubmitQuiz() {
    if (!activeQuiz || !activeQuiz.questions) return;

    // Verify all 3 questions answered
    const unanswered = activeQuiz.questions.some((q) => !quizAnswers[q.scenario_id]);
    if (unanswered) {
      setQuizError("Please answer all 3 questions before submitting.");
      return;
    }

    setIsSubmitting(true);
    setQuizError("");

    try {
      const answersPayload = activeQuiz.questions.map((q) => ({
        scenario_id: q.scenario_id,
        option_id: quizAnswers[q.scenario_id],
      }));

      const result = await submitScenarioQuiz({
        patientId: activeQuiz.patient_id,
        caregiverId,
        answers: answersPayload,
      });

      setQuizResult(result);

      // Immediately refresh stats and attempt history
      if (caregiverId) {
        await loadData(caregiverId, selectedPatientId);
      }
    } catch (err) {
      setQuizError(err.message || "Failed to submit quiz. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleCloseModal() {
    setActiveQuiz(null);
    setQuizResult(null);
    setQuizAnswers({});
    setCurrentQIndex(0);
    setQuizError("");
    if (caregiverId) {
      loadData(caregiverId, selectedPatientId);
    }
  }

  const selectedPatient = patients.find((p) => p.id === selectedPatientId) || patients[0];
  const currentQuestion = activeQuiz?.questions?.[currentQIndex];
  const isLastQuestion = currentQIndex === 2;
  const currentAnswerSelected = currentQuestion ? Boolean(quizAnswers[currentQuestion.scenario_id]) : false;
  const allQuestionsAnswered = activeQuiz?.questions?.every((q) => quizAnswers[q.scenario_id]);

  if (loading) {
    return (
      <div className="wt-page">
        <p className="wt-empty">Loading caregiving scenarios…</p>
      </div>
    );
  }

  return (
    <div className="wt-page">
      {/* ── Header ── */}
      <div className="wt-patient-page__header">
        <div>
          <h1>Micro Learning</h1>
          <p>Scenario-based learning for better caregiving.</p>
        </div>
        {streak > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "var(--warning-bg)",
              border: "1px solid var(--warning)",
              borderRadius: "var(--radius-full)",
              padding: "6px 14px",
              fontSize: 13,
              fontWeight: 700,
              color: "var(--warning)",
            }}
          >
            <Flame size={15} />
            {streak} day streak
          </div>
        )}
      </div>

      {error && (
        <div
          style={{
            background: "var(--danger-bg)",
            border: "1px solid var(--danger)",
            borderRadius: "var(--radius-sm)",
            padding: "10px 14px",
            fontSize: 13,
            color: "var(--danger)",
            marginBottom: 16,
          }}
        >
          {error}
        </div>
      )}

      {/* ── Stats Row ── */}
      <div className="wt-grid" style={{ marginBottom: 24 }}>
        <div className="wt-card">
          <p className="wt-eyebrow">Progress</p>
          <p className="wt-card__big">
            {stats.total_completed_attempts}
            <span className="wt-card__big-unit"> quizzes</span>
          </p>
          <p className="wt-card__label">
            {stats.total_questions_answered} questions answered in completed attempts
          </p>
          <div className="wt-progress" style={{ marginTop: 10 }}>
            <div className="wt-progress__track">
              <div
                className="wt-progress__fill"
                style={{ width: `${Math.min(100, stats.total_completed_attempts * 10)}%` }}
              />
            </div>
          </div>
        </div>

        <div className="wt-card">
          <p className="wt-eyebrow">Accuracy</p>
          <p className="wt-card__big">
            {stats.overall_accuracy}
            <span className="wt-card__big-unit">%</span>
          </p>
          <p className="wt-card__label">
            {stats.total_correct_answers} correct of {stats.total_questions_answered} questions
          </p>
        </div>
      </div>

      {/* ── Scenario Quiz Generator Card ── */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)",
          padding: "20px 24px",
          marginBottom: 28,
          display: "flex",
          flexDirection: "column",
          gap: 14,
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Sparkles size={18} color="var(--primary)" />
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
            Generate Scenario Quiz (3 Questions)
          </h3>
        </div>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>
          Personalised, condition-specific caregiving scenarios tailored to your patient. Complete 3 questions to receive immediate scoring and practical takeaways.
        </p>

        {generateError && (
          <div
            style={{
              background: "var(--danger-bg)",
              border: "1px solid var(--danger)",
              borderRadius: "var(--radius-sm)",
              padding: "8px 12px",
              fontSize: 12,
              color: "var(--danger)",
            }}
          >
            {generateError}
          </div>
        )}

        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginTop: 4 }}>
          {patients.length > 1 && (
            <select
              value={selectedPatientId || ""}
              onChange={(e) => setSelectedPatientId(e.target.value)}
              style={{
                fontSize: 13,
                padding: "9px 12px",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                background: "var(--background)",
                color: "var(--text-primary)",
                flex: "1 1 200px",
                maxWidth: 280,
              }}
            >
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.condition ? `(${p.condition})` : ""}
                </option>
              ))}
            </select>
          )}

          {patients.length === 1 && (
            <span style={{ fontSize: 13, color: "var(--text-secondary)", fontStyle: "italic" }}>
              Patient: <strong>{patients[0].name}</strong> {patients[0].condition ? `· ${patients[0].condition}` : ""}
            </span>
          )}

          <button
            className="wt-btn wt-btn--primary"
            onClick={handleStartQuiz}
            disabled={generating || !selectedPatientId}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", fontSize: 13 }}
          >
            {generating ? (
              <>
                <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
                Selecting Scenarios…
              </>
            ) : (
              <>
                <Sparkles size={16} />
                Generate Quiz for {selectedPatient?.name ?? "Patient"}
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Attempt History Section ── */}
      <section style={{ marginBottom: 30 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Recent Quiz Attempt History</h3>
            <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--text-secondary)" }}>
              Permanent records of completed 3-question condition-specific quizzes retrieved from Supabase.
            </p>
          </div>
          <span className="wt-pill wt-pill--neutral" style={{ fontSize: 12, fontWeight: 700 }}>
            {history.length} recorded
          </span>
        </div>

        {history.length === 0 ? (
          <div
            style={{
              background: "var(--surface)",
              border: "1px dashed var(--border)",
              borderRadius: "var(--radius-md)",
              padding: "36px 20px",
              textAlign: "center",
              color: "var(--text-faint)",
            }}
          >
            <HelpCircle size={32} style={{ margin: "0 auto 10px", display: "block", opacity: 0.6 }} />
            <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
              No quiz attempts recorded yet.
            </p>
            <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--text-secondary)" }}>
              Select your patient and click &quot;Generate Quiz&quot; above to practice your first caregiving scenario attempt!
            </p>
          </div>
        ) : (
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              overflow: "hidden",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "left" }}>
                <thead>
                  <tr
                    style={{
                      borderBottom: "1px solid var(--border)",
                      background: "var(--surface-warm)",
                      color: "var(--text-secondary)",
                      fontSize: 11,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      fontWeight: 700,
                    }}
                  >
                    <th style={{ padding: "12px 16px" }}>Attempt</th>
                    <th style={{ padding: "12px 16px" }}>Patient</th>
                    <th style={{ padding: "12px 16px" }}>Condition</th>
                    <th style={{ padding: "12px 16px" }}>Date &amp; Time</th>
                    <th style={{ padding: "12px 16px" }}>Score</th>
                    <th style={{ padding: "12px 16px" }}>Accuracy</th>
                    <th style={{ padding: "12px 16px", textAlign: "right" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((att, idx) => {
                    const formattedDate = att.attempted_at
                      ? new Date(att.attempted_at).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "Recent";

                    const isPerfect = att.accuracy === 100;
                    const isGood = att.accuracy >= 66;
                    const attemptLabel = att.attempt_number ? `#${att.attempt_number}` : `#${history.length - idx}`;

                    return (
                      <tr
                        key={att.attempt_id || idx}
                        style={{
                          borderBottom: idx === history.length - 1 ? "none" : "1px solid var(--border)",
                          transition: "background 0.15s ease",
                        }}
                      >
                        <td style={{ padding: "14px 16px", fontWeight: 700 }}>
                          <span
                            className="wt-pill wt-pill--neutral"
                            style={{ fontWeight: 800, fontSize: 12, padding: "4px 8px" }}
                          >
                            {attemptLabel}
                          </span>
                        </td>
                        <td style={{ padding: "14px 16px", fontWeight: 600 }}>
                          {att.patient_name || "Care Recipient"}
                        </td>
                        <td style={{ padding: "14px 16px" }}>
                          <span className="wt-pill wt-pill--neutral" style={{ fontSize: 11, textTransform: "capitalize" }}>
                            {att.condition || "Caregiving"}
                          </span>
                        </td>
                        <td style={{ padding: "14px 16px", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <Calendar size={13} style={{ opacity: 0.7 }} />
                            <span>{formattedDate}</span>
                          </div>
                        </td>
                        <td style={{ padding: "14px 16px" }}>
                          <span style={{ fontWeight: 700, fontSize: 14 }}>{att.score}</span>
                          <span style={{ fontSize: 11, color: "var(--text-secondary)", marginLeft: 6 }}>
                            ({att.correct_count} of {att.total_questions} correct)
                          </span>
                        </td>
                        <td style={{ padding: "14px 16px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontWeight: 700, color: isPerfect ? "var(--success)" : "var(--text-primary)" }}>
                              {att.accuracy}%
                            </span>
                            <span
                              className={`wt-pill wt-pill--${isPerfect ? "success" : isGood ? "primary" : "warning"}`}
                              style={{ fontSize: 10, textTransform: "capitalize" }}
                            >
                              {isPerfect ? "Excellent" : isGood ? "Good Work" : "Review Needed"}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: "14px 16px", textAlign: "right" }}>
                          <button
                            type="button"
                            className="wt-btn wt-btn--ghost"
                            onClick={() => setViewingAttempt(att)}
                            style={{
                              padding: "6px 12px",
                              fontSize: 12,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <Eye size={14} /> View Details
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* ── View Past Attempt Details Modal ── */}
      {viewingAttempt && (
        <div
          className="wt-modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setViewingAttempt(null);
          }}
        >
          <div className="wt-modal" style={{ maxWidth: 650, maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
            <div className="wt-modal-header" style={{ paddingBottom: 14 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                  <span className="wt-pill wt-pill--neutral" style={{ fontSize: 11, fontWeight: 700 }}>
                    Attempt {viewingAttempt.attempt_number ? `#${viewingAttempt.attempt_number}` : ""}
                  </span>
                  <span className="wt-pill wt-pill--neutral" style={{ fontSize: 11, textTransform: "capitalize" }}>
                    {viewingAttempt.condition}
                  </span>
                  <span
                    className={`wt-pill wt-pill--${viewingAttempt.accuracy >= 100 ? "success" : viewingAttempt.accuracy >= 66 ? "primary" : "warning"}`}
                    style={{ fontSize: 11 }}
                  >
                    Score: {viewingAttempt.score} ({viewingAttempt.accuracy}%)
                  </span>
                </div>
                <h2 style={{ margin: 0, fontSize: 18 }}>
                  Attempt Review · {viewingAttempt.patient_name}
                </h2>
              </div>
              <button className="wt-modal-close" onClick={() => setViewingAttempt(null)}>
                ×
              </button>
            </div>

            <div style={{ overflowY: "auto", flex: 1, padding: "16px 0" }}>
              <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--text-secondary)" }}>
                Completed on {viewingAttempt.attempted_at ? new Date(viewingAttempt.attempted_at).toLocaleString("en-IN") : "Recent"}
              </p>

              {(!viewingAttempt.questions || viewingAttempt.questions.length === 0) ? (
                <div style={{ textAlign: "center", padding: "20px", color: "var(--text-faint)" }}>
                  Detailed per-question breakdown is only stored for completed multi-question quizzes.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {viewingAttempt.questions.map((q, qIdx) => (
                    <div
                      key={q.scenario_id || qIdx}
                      style={{
                        background: "var(--surface)",
                        border: `1.5px solid ${q.is_correct ? "var(--success)" : "var(--danger)"}`,
                        borderRadius: "var(--radius-md)",
                        padding: "16px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: 14 }}>
                          {qIdx + 1}. {q.title}
                        </span>
                        <span
                          className={`wt-pill wt-pill--${q.is_correct ? "success" : "danger"}`}
                          style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}
                        >
                          {q.is_correct ? <CheckCircle size={12} /> : <XCircle size={12} />}
                          {q.is_correct ? "Correct (+1)" : "Incorrect (0)"}
                        </span>
                      </div>

                      {q.scenario_description && (
                        <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 10px", lineHeight: 1.5 }}>
                          {q.scenario_description}
                        </p>
                      )}

                      <div style={{ fontSize: 13, marginBottom: 8 }}>
                        <span style={{ color: "var(--text-faint)" }}>Caregiver Choice: </span>
                        <span style={{ fontWeight: 600, color: q.is_correct ? "var(--success)" : "var(--danger)" }}>
                          {q.selected_option_text || "Option selected"}
                        </span>
                      </div>

                      {!q.is_correct && q.correct_option_text && (
                        <div style={{ fontSize: 13, marginBottom: 8 }}>
                          <span style={{ color: "var(--text-faint)" }}>Recommended Choice: </span>
                          <span style={{ fontWeight: 600, color: "var(--success)" }}>
                            {q.correct_option_text}
                          </span>
                        </div>
                      )}

                      {q.explanation && (
                        <div
                          style={{
                            background: "var(--background)",
                            border: "1px solid var(--border)",
                            borderRadius: "var(--radius-sm)",
                            padding: "10px 12px",
                            fontSize: 12,
                            color: "var(--text-secondary)",
                            lineHeight: 1.5,
                            marginTop: 8,
                          }}
                        >
                          <strong>💡 Key Caregiving Takeaway:</strong> {q.explanation}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div
              className="wt-modal-actions"
              style={{
                paddingTop: 14,
                borderTop: "1px solid var(--border)",
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
              <button
                type="button"
                className="wt-btn wt-btn--primary"
                onClick={() => setViewingAttempt(null)}
                style={{ minWidth: 100 }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Interactive 3-Question Quiz Modal ── */}
      {activeQuiz && (
        <div
          className="wt-modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !isSubmitting) handleCloseModal();
          }}
        >
          <div className="wt-modal" style={{ maxWidth: 620, maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
            {/* Modal Header */}
            <div className="wt-modal-header" style={{ paddingBottom: 14 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                  <span className="wt-pill wt-pill--neutral" style={{ fontSize: 11, fontWeight: 700 }}>
                    {activeQuiz.condition}
                  </span>
                  {!quizResult && (
                    <span
                      className="wt-pill"
                      style={{
                        background: "var(--primary-soft)",
                        color: "var(--primary)",
                        fontWeight: 700,
                        fontSize: 11,
                      }}
                    >
                      Question {currentQIndex + 1} of 3
                    </span>
                  )}
                </div>
                <h2 style={{ margin: 0, fontSize: 18 }}>
                  {quizResult ? "Quiz Results & Feedback" : currentQuestion?.title}
                </h2>
              </div>
              <button className="wt-modal-close" onClick={handleCloseModal} disabled={isSubmitting}>
                ×
              </button>
            </div>

            {/* Stepper Progress Bar (Shown while answering) */}
            {!quizResult && (
              <div style={{ display: "flex", gap: 8, padding: "0 0 16px", borderBottom: "1px solid var(--border)" }}>
                {[0, 1, 2].map((idx) => {
                  const q = activeQuiz.questions[idx];
                  const answered = Boolean(quizAnswers[q?.scenario_id]);
                  const isCurrent = idx === currentQIndex;

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setCurrentQIndex(idx)}
                      style={{
                        flex: 1,
                        height: 8,
                        borderRadius: 4,
                        border: "none",
                        cursor: "pointer",
                        background: isCurrent
                          ? "var(--primary)"
                          : answered
                          ? "var(--success)"
                          : "var(--border)",
                        transition: "background 0.2s",
                      }}
                      title={`Jump to Question ${idx + 1}`}
                    />
                  );
                })}
              </div>
            )}

            {/* Modal Scrollable Body */}
            <div style={{ overflowY: "auto", flex: 1, padding: "16px 0" }}>
              {quizError && (
                <div
                  style={{
                    background: "var(--danger-bg)",
                    border: "1px solid var(--danger)",
                    borderRadius: "var(--radius-sm)",
                    padding: "10px 14px",
                    fontSize: 13,
                    color: "var(--danger)",
                    marginBottom: 16,
                  }}
                >
                  {quizError}
                </div>
              )}

              {/* ── QUESTION VIEW ── */}
              {!quizResult && currentQuestion && (
                <div>
                  {/* Scenario text */}
                  <div
                    style={{
                      background: "var(--surface-warm)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-sm)",
                      padding: "16px",
                      fontSize: 14,
                      lineHeight: 1.6,
                      color: "var(--text-primary)",
                      marginBottom: 20,
                    }}
                  >
                    <p style={{ margin: 0, fontWeight: 500 }}>{currentQuestion.scenario_description}</p>
                  </div>

                  {/* Options */}
                  <p className="wt-eyebrow" style={{ marginBottom: 10 }}>
                    Select the safest and most supportive response:
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {currentQuestion.options.map((opt) => {
                      const isSelected = quizAnswers[currentQuestion.scenario_id] === opt.option_id;

                      return (
                        <button
                          key={opt.option_id}
                          type="button"
                          onClick={() => handleSelectOption(currentQuestion.scenario_id, opt.option_id)}
                          style={{
                            width: "100%",
                            textAlign: "left",
                            padding: "14px 16px",
                            border: `2px solid ${isSelected ? "var(--primary)" : "var(--border)"}`,
                            borderRadius: "var(--radius-sm)",
                            background: isSelected ? "var(--primary-soft)" : "var(--surface)",
                            color: "var(--text-primary)",
                            cursor: "pointer",
                            fontSize: 13,
                            fontWeight: isSelected ? 600 : 500,
                            lineHeight: 1.4,
                            transition: "all 0.15s ease",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 12,
                          }}
                        >
                          <span>{opt.text}</span>
                          <span
                            style={{
                              width: 18,
                              height: 18,
                              borderRadius: "50%",
                              border: `2px solid ${isSelected ? "var(--primary)" : "var(--border-strong)"}`,
                              background: isSelected ? "var(--primary)" : "transparent",
                              flexShrink: 0,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            {isSelected && (
                              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff" }} />
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── RESULT VIEW (Immediately after submission) ── */}
              {quizResult && (
                <div>
                  {/* Score & Encouragement Card */}
                  <div
                    style={{
                      background: "var(--surface-warm)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-md)",
                      padding: "20px 24px",
                      marginBottom: 24,
                      textAlign: "center",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <Award size={24} color="var(--primary)" />
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        Caregiver Assessment Result
                      </span>
                    </div>

                    <h1 style={{ fontSize: 36, fontWeight: 800, margin: "4px 0", color: "var(--text-primary)" }}>
                      {quizResult.score} / {quizResult.total}
                    </h1>

                    <div style={{ display: "flex", justifyContent: "center", gap: 16, fontSize: 13, color: "var(--text-secondary)", marginBottom: 14 }}>
                      <span><strong>Accuracy:</strong> {quizResult.accuracy}%</span>
                      <span>•</span>
                      <span><strong>Patient:</strong> {quizResult.patient_name}</span>
                      <span>•</span>
                      <span><strong>Condition:</strong> {quizResult.condition}</span>
                    </div>

                    <div
                      style={{
                        background: quizResult.score === 3 ? "var(--success-bg)" : quizResult.score >= 2 ? "var(--primary-soft)" : "var(--warning-bg)",
                        border: `1px solid ${quizResult.score === 3 ? "var(--success)" : quizResult.score >= 2 ? "var(--primary)" : "var(--warning)"}`,
                        borderRadius: "var(--radius-sm)",
                        padding: "12px 16px",
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--text-primary)",
                      }}
                    >
                      {quizResult.feedback}
                    </div>
                  </div>

                  {/* Detailed Question Review */}
                  <h4 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 700 }}>
                    Detailed Question Review & Explanations:
                  </h4>

                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {quizResult.results.map((item, idx) => (
                      <div
                        key={item.scenario_id || idx}
                        style={{
                          background: "var(--surface)",
                          border: `1.5px solid ${item.is_correct ? "var(--success)" : "var(--danger)"}`,
                          borderRadius: "var(--radius-md)",
                          padding: "16px",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
                          <span style={{ fontWeight: 700, fontSize: 14 }}>
                            {idx + 1}. {item.title}
                          </span>
                          <span
                            className={`wt-pill wt-pill--${item.is_correct ? "success" : "danger"}`}
                            style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}
                          >
                            {item.is_correct ? <CheckCircle size={12} /> : <XCircle size={12} />}
                            {item.is_correct ? "Correct (+1)" : "Incorrect (0)"}
                          </span>
                        </div>

                        <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 10px", lineHeight: 1.5 }}>
                          {item.scenario_description}
                        </p>

                        <div style={{ fontSize: 13, marginBottom: 8 }}>
                          <span style={{ color: "var(--text-faint)" }}>Your choice: </span>
                          <span style={{ fontWeight: 600, color: item.is_correct ? "var(--success)" : "var(--danger)" }}>
                            {item.selected_option_text}
                          </span>
                        </div>

                        {!item.is_correct && item.correct_option_text && (
                          <div style={{ fontSize: 13, marginBottom: 8 }}>
                            <span style={{ color: "var(--text-faint)" }}>Correct response: </span>
                            <span style={{ fontWeight: 600, color: "var(--success)" }}>
                              {item.correct_option_text}
                            </span>
                          </div>
                        )}

                        {item.explanation && (
                          <div
                            style={{
                              background: "var(--background)",
                              border: "1px solid var(--border)",
                              borderRadius: "var(--radius-sm)",
                              padding: "10px 12px",
                              fontSize: 12,
                              color: "var(--text-secondary)",
                              lineHeight: 1.5,
                              marginTop: 8,
                            }}
                          >
                            <strong>💡 Key Caregiving Takeaway:</strong> {item.explanation}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions Footer */}
            <div
              className="wt-modal-actions"
              style={{
                paddingTop: 16,
                borderTop: "1px solid var(--border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              {!quizResult ? (
                <>
                  <div>
                    {currentQIndex > 0 ? (
                      <button
                        type="button"
                        className="wt-btn wt-btn--ghost"
                        onClick={() => setCurrentQIndex((prev) => prev - 1)}
                        style={{ display: "flex", alignItems: "center", gap: 6 }}
                      >
                        <ChevronLeft size={16} /> Back
                      </button>
                    ) : (
                      <button type="button" className="wt-btn wt-btn--ghost" onClick={handleCloseModal}>
                        Cancel
                      </button>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: 10 }}>
                    {!isLastQuestion ? (
                      <button
                        type="button"
                        className="wt-btn wt-btn--primary"
                        onClick={() => setCurrentQIndex((prev) => prev + 1)}
                        disabled={!currentAnswerSelected}
                        style={{ display: "flex", alignItems: "center", gap: 6 }}
                      >
                        Next Question <ChevronRight size={16} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="wt-btn wt-btn--primary"
                        onClick={handleSubmitQuiz}
                        disabled={!allQuestionsAnswered || isSubmitting}
                        style={{ display: "flex", alignItems: "center", gap: 6 }}
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
                            Evaluating Answers…
                          </>
                        ) : (
                          <>
                            <CheckCircle size={16} /> Submit Answers
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <div style={{ display: "flex", justifyContent: "space-between", width: "100%", gap: 12 }}>
                  <button
                    type="button"
                    className="wt-btn wt-btn--ghost"
                    onClick={handleStartQuiz}
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <RotateCcw size={15} /> Try Again
                  </button>

                  <button
                    type="button"
                    className="wt-btn wt-btn--primary"
                    onClick={handleCloseModal}
                    style={{ minWidth: 120 }}
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Inline animation keyframe for spinner */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
