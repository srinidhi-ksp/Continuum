/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from "react";
import { FileText, Download, Calendar, RefreshCw } from "lucide-react";
import { usePatient } from "../context/PatientContext";
import {
  fetchHealthReports,
  generateHealthReport,
  generateWeeklyReport,
} from "../lib/reportApi";

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

export default function Reports() {
  const { currentPatient } = usePatient();
  const [reports, setReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");
  const [genSuccess, setGenSuccess] = useState("");

  // Health report form
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [activeTab, setActiveTab] = useState("health");

  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!currentPatient) return;
    let cancelled = false;
    setLoadingReports(true);
    fetchHealthReports(currentPatient.id)
      .then((data) => { if (!cancelled) setReports(data); })
      .catch(() => { /* non-fatal */ })
      .finally(() => { if (!cancelled) setLoadingReports(false); });
    return () => { cancelled = true; };
  }, [currentPatient, refreshKey]);

  async function handleGenerateHealth() {
    if (!currentPatient) return;
    if (!startDate || !endDate) { setGenError("Please select a date range."); return; }
    setGenError("");
    setGenSuccess("");
    setGenerating(true);
    try {
      await generateHealthReport({ patient: currentPatient, startDate, endDate });
      setGenSuccess("Health report downloaded. Record saved.");
      setRefreshKey((k) => k + 1);
    } catch (e) {
      setGenError(e.message || "Report generation failed.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleGenerateWeekly() {
    if (!currentPatient) return;
    setGenError("");
    setGenSuccess("");
    setGenerating(true);
    try {
      await generateWeeklyReport({ patient: currentPatient });
      setGenSuccess("Weekly coordination report downloaded. Record saved.");
      setRefreshKey((k) => k + 1);
    } catch (e) {
      setGenError(e.message || "Report generation failed.");
    } finally {
      setGenerating(false);
    }
  }

  if (!currentPatient) {
    return (
      <div className="wt-page">
        <p className="wt-empty">No patient selected.</p>
      </div>
    );
  }

  const tabStyle = (tab) => ({
    padding: "8px 18px",
    borderRadius: "var(--radius-sm)",
    border: "none",
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer",
    background: activeTab === tab ? "var(--primary)" : "transparent",
    color: activeTab === tab ? "white" : "var(--text-secondary)",
    transition: "0.15s",
  });

  const inp = {
    padding: "9px 12px",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
    fontSize: 13,
    background: "var(--surface)",
    color: "var(--text-primary)",
    outline: "none",
  };

  return (
    <div className="wt-page">
      {/* ── Header ── */}
      <div className="wt-patient-page__header">
        <div>
          <h1>Reports</h1>
          <p>Generate and download care reports for <strong>{currentPatient.name}</strong>.</p>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: "flex", gap: 6, marginBottom: 24, background: "var(--background)", padding: 4, borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", width: "fit-content" }}>
        <button style={tabStyle("health")} onClick={() => setActiveTab("health")}>Health Report</button>
        <button style={tabStyle("weekly")} onClick={() => setActiveTab("weekly")}>Weekly Coordination</button>
        <button style={tabStyle("history")} onClick={() => setActiveTab("history")}>Report History</button>
      </div>

      {genError && (
        <div style={{ background: "var(--danger-bg)", border: "1px solid var(--danger)", borderRadius: "var(--radius-sm)", padding: "10px 14px", fontSize: 13, color: "var(--danger)", marginBottom: 16 }}>
          {genError}
        </div>
      )}
      {genSuccess && (
        <div style={{ background: "var(--success-bg)", border: "1px solid var(--success)", borderRadius: "var(--radius-sm)", padding: "10px 14px", fontSize: 13, color: "var(--success)", marginBottom: 16 }}>
          {genSuccess}
        </div>
      )}

      {/* ── Health Report Tab ── */}
      {activeTab === "health" && (
        <div className="wt-panel" style={{ maxWidth: 600 }}>
          <div className="wt-panel__header">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <FileText size={18} color="var(--primary)" />
              <div>
                <p className="wt-eyebrow">Generate</p>
                <h3>Patient Health Report</h3>
              </div>
            </div>
          </div>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20 }}>
            Compiles recorded Timeline events, Daily Care logs, Medications, and Appointments into a PDF. Contains recorded caregiving activity only — no medical diagnoses.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 5 }}>
                <Calendar size={11} style={{ marginRight: 4, verticalAlign: "middle" }} />From
              </label>
              <input style={inp} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 5 }}>
                <Calendar size={11} style={{ marginRight: 4, verticalAlign: "middle" }} />To
              </label>
              <input style={inp} type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>

          <div style={{ background: "var(--surface-warm)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "10px 14px", fontSize: 12, color: "var(--text-secondary)", marginBottom: 20 }}>
            <strong>Included:</strong> Patient info · Care circle · Active medications · Appointments · Daily care logs · Timeline events · Care notes
            <br />
            <strong>Not included:</strong> Medical diagnoses · Clinical assessments · Treatment recommendations
          </div>

          <button
            className="wt-btn wt-btn--primary"
            onClick={handleGenerateHealth}
            disabled={generating}
            style={{ display: "flex", alignItems: "center", gap: 8 }}
          >
            {generating ? <RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Download size={14} />}
            {generating ? "Generating…" : "Generate & Download PDF"}
          </button>
        </div>
      )}

      {/* ── Weekly Coordination Tab ── */}
      {activeTab === "weekly" && (
        <div className="wt-panel" style={{ maxWidth: 600 }}>
          <div className="wt-panel__header">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <RefreshCw size={18} color="var(--primary)" />
              <div>
                <p className="wt-eyebrow">Generate</p>
                <h3>Weekly Coordination Report</h3>
              </div>
            </div>
          </div>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20 }}>
            Covers the last 7 days. Includes coordination score trend, care activity summary, task distribution across the Care Circle, and ML-generated coordination recommendations.
          </p>

          <div style={{ background: "var(--surface-warm)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "10px 14px", fontSize: 12, color: "var(--text-secondary)", marginBottom: 20 }}>
            <strong>Recorded data:</strong> Coordination scores · Daily care logs · Task distribution by caregiver
            <br />
            <strong>ML-generated guidance (clearly labelled):</strong> Coordination recommendations — not medical advice
          </div>

          <button
            className="wt-btn wt-btn--primary"
            onClick={handleGenerateWeekly}
            disabled={generating}
            style={{ display: "flex", alignItems: "center", gap: 8 }}
          >
            {generating ? <RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Download size={14} />}
            {generating ? "Generating…" : "Generate Last 7 Days"}
          </button>
        </div>
      )}

      {/* ── Report History Tab ── */}
      {activeTab === "history" && (
        <div className="wt-panel">
          <div className="wt-panel__header">
            <div>
              <p className="wt-eyebrow">Previous</p>
              <h3>Report History</h3>
            </div>
            <button className="wt-btn wt-btn--ghost wt-btn--sm" onClick={() => setRefreshKey((k) => k + 1)}>
              <RefreshCw size={13} style={{ marginRight: 4 }} />Refresh
            </button>
          </div>

          {loadingReports ? (
            <p className="wt-empty">Loading reports…</p>
          ) : reports.length === 0 ? (
            <p className="wt-empty">No reports generated yet for {currentPatient.name}.</p>
          ) : (
            <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
              {reports.map((r) => (
                <li
                  key={r.report_id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 14px",
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-sm)",
                  }}
                >
                  <FileText size={18} color="var(--primary)" style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 600, fontSize: 13, margin: 0 }}>
                      {currentPatient.name} · {formatDate(r.generated_at)}
                    </p>
                    <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>
                      Generated by {r.generator?.full_name || "Caregiver"}
                    </p>
                  </div>
                  {r.file_url ? (
                    <a
                      href={r.file_url}
                      target="_blank"
                      rel="noreferrer"
                      className="wt-btn wt-btn--ghost wt-btn--sm"
                      style={{ display: "flex", alignItems: "center", gap: 4 }}
                    >
                      <Download size={13} /> Download
                    </a>
                  ) : (
                    <span style={{ fontSize: 12, color: "var(--text-faint)" }}>Link unavailable</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
