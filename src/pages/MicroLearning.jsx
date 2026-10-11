/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from "react";
import { BookOpen, CheckCircle, XCircle, Flame, ChevronRight, Sparkles, Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { usePatient } from "../context/PatientContext";
import {
  fetchScenarios,
  fetchScenarioWithOptions,
  fetchAttempts,
  saveAttempt,
  calculateStreak,
  generateScenario,
} from "../lib/scenarioApi";

const DIFFICULTY_COLORS = {
  easy: { bg: "var(--success-bg)", text: "var(--success)" },
  medium: { bg: "var(--warning-bg)", text: "var(--warning)" },
  hard: { bg: "var(--danger-bg)", text: "var(--danger)" },
};

const CATEGORY_LABELS = {
  dementia_care: "Dementia Care",
  parkinson_care: "Parkinson's Care",
  medication_safety: "Medication Safety",
  emotional_support: "Emotional Support",
  fall_prevention: "Fall Prevention",
};

export default function MicroLearning() {
  const { user } = useAuth();
  const caregiverId = user?.id;
  const { patients } = usePatient();

  const [scenarios, setScenarios] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Active scenario player
  const [activeScenario, setActiveScenario] = useState(null); // { card, options }
  const [selectedOption, setSelectedOption] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  // AI generation
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");
  // Default to the first patient in the context list
  const [selectedPatientId, setSelectedPatientId] = useState(null);

  // Sync selectedPatientId whenever patients list resolves
  useEffect(() => {
    if (!selectedPatientId && patients.length > 0) {
      setSelectedPatientId(patients[0].id);
    }
  }, [patients, selectedPatientId]);

  useEffect(() => {
    if (!caregiverId) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    Promise.all([fetchScenarios(), fetchAttempts(caregiverId)])
      .then(([scens, atts]) => {
        if (cancelled) return;
        setScenarios(scens);
        setAttempts(atts);
        setStreak(calculateStreak(atts));
      })
      .catch((e) => { if (!cancelled) setError(e.message || "Failed to load scenarios."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [caregiverId]);

  async function openScenario(scenarioId) {
    setError("");
    setSubmitted(false);
    setSelectedOption(null);
    try {
      const data = await fetchScenarioWithOptions(scenarioId);
      setActiveScenario(data);
    } catch (e) {
      setError(e.message || "Failed to load scenario.");
    }
  }

  async function handleGenerateScenario() {
    if (!selectedPatientId) {
      setGenerateError("Please select a patient first.");
      return;
    }
    setGenerating(true);
    setGenerateError("");
    try {
      const data = await generateScenario(selectedPatientId);
      // Persist in local list so the newly generated card appears in the list
      setScenarios((prev) => [data.card, ...prev]);
      // Open the quiz modal immediately
      setSubmitted(false);
      setSelectedOption(null);
      setActiveScenario(data);
    } catch (e) {
      setGenerateError(e.message || "Failed to generate scenario. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSubmit() {
    if (!selectedOption || !activeScenario) return;
    setSaving(true);
    try {
      await saveAttempt({
        scenarioId: activeScenario.card.scenario_id,
        optionId: selectedOption.option_id,
        isCorrect: selectedOption.is_correct,
        caregiverId,
      });
      setSubmitted(true);
      // Refresh attempts and streak
      const atts = await fetchAttempts(caregiverId);
      setAttempts(atts);
      setStreak(calculateStreak(atts));
    } catch (e) {
      setError(e.message || "Failed to save your answer.");
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    setActiveScenario(null);
    setSelectedOption(null);
    setSubmitted(false);
  }

  // Stats
  const totalAttempts = attempts.length;
  const correctAttempts = attempts.filter((a) => a.is_correct).length;
  const completedIds = new Set(attempts.map((a) => a.scenario_id));
  const progressPct = scenarios.length > 0 ? Math.round((completedIds.size / scenarios.length) * 100) : 0;

  if (loading) {
    return (
      <div className="wt-page">
        <p className="wt-empty">Loading scenarios…</p>
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
              display: "flex", alignItems: "center", gap: 6,
              background: "var(--warning-bg)", border: "1px solid var(--warning)",
              borderRadius: "var(--radius-full)", padding: "6px 14px",
              fontSize: 13, fontWeight: 700, color: "var(--warning)",
            }}
          >
            <Flame size={15} />
            {streak} day streak
          </div>
        )}
      </div>

      {error && (
        <div style={{ background: "var(--danger-bg)", border: "1px solid var(--danger)", borderRadius: "var(--radius-sm)", padding: "10px 14px", fontSize: 13, color: "var(--danger)", marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* ── Stats row ── */}
      <div className="wt-grid" style={{ marginBottom: 24 }}>
        <div className="wt-card">
          <p className="wt-eyebrow">Progress</p>
          <p className="wt-card__big">{completedIds.size}<span className="wt-card__big-unit">/{scenarios.length}</span></p>
          <p className="wt-card__label">scenarios completed</p>
          <div className="wt-progress" style={{ marginTop: 10 }}>
            <div className="wt-progress__track">
              <div className="wt-progress__fill" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        </div>
        <div className="wt-card">
          <p className="wt-eyebrow">Accuracy</p>
          <p className="wt-card__big">
            {totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 0}
            <span className="wt-card__big-unit">%</span>
          </p>
          <p className="wt-card__label">{correctAttempts} correct of {totalAttempts} attempts</p>
        </div>
      </div>

      {/* ── AI Scenario Generator ── */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)",
          padding: "16px 20px",
          marginBottom: 24,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Sparkles size={16} color="var(--primary)" />
          <p style={{ fontWeight: 700, fontSize: 14, margin: 0 }}>Generate AI Scenario</p>
        </div>
        <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>
          Create a personalised scenario based on your patient's condition and recent care activity.
        </p>

        {generateError && (
          <div style={{ background: "var(--danger-bg)", border: "1px solid var(--danger)", borderRadius: "var(--radius-sm)", padding: "8px 12px", fontSize: 12, color: "var(--danger)" }}>
            {generateError}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {patients.length > 1 && (
            <select
              value={selectedPatientId || ""}
              onChange={(e) => setSelectedPatientId(e.target.value)}
              style={{
                fontSize: 13, padding: "7px 10px",
                border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
                background: "var(--background)", color: "var(--text-primary)",
                flex: "1 1 180px",
              }}
            >
              {patients.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
          {patients.length === 1 && (
            <span style={{ fontSize: 13, color: "var(--text-secondary)", fontStyle: "italic" }}>
              for {patients[0].name}
            </span>
          )}

          <button
            className="wt-btn wt-btn--primary"
            onClick={handleGenerateScenario}
            disabled={generating || !selectedPatientId}
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            {generating ? (
              <>
                <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
                Generating…
              </>
            ) : (
              <>
                <Sparkles size={14} />
                {patients.length > 0
                  ? `Generate for ${patients.find((p) => p.id === selectedPatientId)?.name ?? "Patient"}`
                  : "Generate Scenario"}
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Scenario list ── */}
      {scenarios.length === 0 ? (
        <p className="wt-empty">No scenarios available yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {scenarios.map((sc) => {
            const isCompleted = completedIds.has(sc.scenario_id);
            const diff = DIFFICULTY_COLORS[sc.difficulty] || DIFFICULTY_COLORS.medium;
            const catLabel = CATEGORY_LABELS[sc.category] || sc.category;

            return (
              <div
                key={sc.scenario_id}
                style={{
                  background: "var(--surface)",
                  border: `1px solid ${isCompleted ? "var(--success)" : "var(--border)"}`,
                  borderRadius: "var(--radius-md)",
                  padding: "16px 20px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 14,
                  cursor: "pointer",
                  transition: "box-shadow 0.15s",
                }}
                onClick={() => openScenario(sc.scenario_id)}
              >
                <div
                  style={{
                    width: 36, height: 36, borderRadius: "var(--radius-sm)",
                    background: isCompleted ? "var(--success-bg)" : "var(--background)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0, color: isCompleted ? "var(--success)" : "var(--text-faint)",
                  }}
                >
                  {isCompleted ? <CheckCircle size={20} /> : <BookOpen size={20} />}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                    <p style={{ fontWeight: 700, fontSize: 14, margin: 0 }}>{sc.title}</p>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "2px 8px",
                      borderRadius: "var(--radius-full)",
                      background: diff.bg, color: diff.text, textTransform: "capitalize",
                    }}>
                      {sc.difficulty}
                    </span>
                    {sc.is_ai_generated && (
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: "2px 8px",
                        borderRadius: "var(--radius-full)",
                        background: "var(--primary-soft)", color: "var(--primary)",
                        display: "flex", alignItems: "center", gap: 3,
                      }}>
                        <Sparkles size={9} /> AI
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>{catLabel}</p>
                </div>

                <ChevronRight size={16} color="var(--text-faint)" style={{ marginTop: 2, flexShrink: 0 }} />
              </div>
            );
          })}
        </div>
      )}

      {/* ── Scenario Player Modal ── */}
      {activeScenario && (
        <div
          className="wt-modal-overlay"
          onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) handleClose(); }}
        >
          <div className="wt-modal" style={{ maxWidth: 580 }}>
            <div className="wt-modal-header">
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                  <p className="wt-eyebrow">{CATEGORY_LABELS[activeScenario.card.category] || activeScenario.card.category}</p>
                  {activeScenario.card.is_ai_generated && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "1px 7px",
                      borderRadius: "var(--radius-full)",
                      background: "var(--primary-soft)", color: "var(--primary)",
                      display: "flex", alignItems: "center", gap: 3,
                    }}>
                      <Sparkles size={9} /> AI Generated
                    </span>
                  )}
                </div>
                <h2>{activeScenario.card.title}</h2>
              </div>
              <button className="wt-modal-close" onClick={handleClose}>×</button>
            </div>

            {/* Scenario text */}
            <div style={{
              background: "var(--surface-warm)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              padding: "14px 16px",
              fontSize: 14,
              lineHeight: 1.6,
              color: "var(--text-primary)",
              marginBottom: 20,
            }}>
              {activeScenario.card.scenario_text}
            </div>

            {/* Options */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
              {activeScenario.options.map((opt) => {
                let borderColor = "var(--border)";
                let bg = "var(--surface)";
                let textColor = "var(--text-primary)";

                if (submitted) {
                  if (opt.is_correct) { borderColor = "var(--success)"; bg = "var(--success-bg)"; textColor = "var(--success)"; }
                  else if (selectedOption?.option_id === opt.option_id && !opt.is_correct) {
                    borderColor = "var(--danger)"; bg = "var(--danger-bg)"; textColor = "var(--danger)";
                  }
                } else if (selectedOption?.option_id === opt.option_id) {
                  borderColor = "var(--primary)"; bg = "var(--primary-soft)";
                }

                return (
                  <button
                    key={opt.option_id}
                    disabled={submitted}
                    onClick={() => !submitted && setSelectedOption(opt)}
                    style={{
                      width: "100%", textAlign: "left",
                      padding: "12px 14px",
                      border: `2px solid ${borderColor}`,
                      borderRadius: "var(--radius-sm)",
                      background: bg, color: textColor,
                      cursor: submitted ? "default" : "pointer",
                      fontSize: 13, fontWeight: 500,
                      transition: "0.15s",
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                    }}
                  >
                    <span>{opt.option_text}</span>
                    {submitted && opt.is_correct && <CheckCircle size={16} color="var(--success)" />}
                    {submitted && selectedOption?.option_id === opt.option_id && !opt.is_correct && (
                      <XCircle size={16} color="var(--danger)" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Explanation — shown after submission */}
            {submitted && selectedOption && (
              <div
                style={{
                  background: selectedOption.is_correct ? "var(--success-bg)" : "var(--warning-bg)",
                  border: `1px solid ${selectedOption.is_correct ? "var(--success)" : "var(--warning)"}`,
                  borderRadius: "var(--radius-sm)",
                  padding: "12px 14px",
                  fontSize: 13,
                  color: "var(--text-primary)",
                  marginBottom: 20,
                }}
              >
                <p style={{ fontWeight: 700, marginBottom: 4, color: selectedOption.is_correct ? "var(--success)" : "var(--warning)" }}>
                  {selectedOption.is_correct ? "✓ Correct" : "✗ Incorrect"}
                </p>
                <p style={{ margin: 0 }}>
                  {activeScenario.options.find((o) => o.is_correct)?.explanation || selectedOption.explanation}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="wt-modal-actions">
              {!submitted ? (
                <>
                  <button className="wt-btn wt-btn--ghost" onClick={handleClose}>Cancel</button>
                  <button
                    className="wt-btn wt-btn--primary"
                    onClick={handleSubmit}
                    disabled={!selectedOption || saving}
                  >
                    {saving ? "Saving…" : "Submit Answer"}
                  </button>
                </>
              ) : (
                <button className="wt-btn wt-btn--primary" onClick={handleClose} style={{ width: "100%" }}>
                  Done
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Spinner keyframe (inline) */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
