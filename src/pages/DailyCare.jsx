import { useState } from "react";
import { usePatient } from "../context/PatientContext";
import { createDailyCareLog } from "../lib/dailyCareApi";
import VoiceInputButton from "../components/VoiceInputButton";

const CARE_TYPES = ["Food", "Water", "Sleep", "Medication", "Mood", "Symptom", "General Note"];

const CARE_ICONS = {
  Food: "🍴", Water: "💧", Sleep: "🌙", Medication: "💊",
  Mood: "🙂", Symptom: "⚠️", "General Note": "📝",
};

const MOODS = ["Happy", "Calm", "Anxious", "Sad", "Agitated", "Confused", "Restless"];
const SEVERITIES = ["Mild", "Moderate", "Severe"];
const FOOD_UNITS = ["pieces", "grams", "ml", "cups", "bowls", "plates"];
const WATER_UNITS = ["ml", "glasses", "litres"];

export default function DailyCare() {
  const { currentPatient, currentMedications, currentLogs, setCurrentLogs, reloadPatientDetail } = usePatient();
  const [careType, setCareType] = useState("Food");
  const [form, setForm] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const handleCareTypeChange = (newType) => {
    setCareType(newType);
    setForm({});
  };

  const activeMeds = currentMedications.filter(m => m.active);

  const f = (name, val) => setForm(p => ({ ...p, [name]: val }));

  const handleAddLog = async (e) => {
    e.preventDefault();
    if (!currentPatient?.id) { alert("Please select a patient."); return; }

    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    let entry = { patientId: currentPatient.id, type: careType, time: now, addedBy: "You" };

    if (careType === "Food") {
      if (!form.foodItem) { alert("Please enter the food item."); return; }
      entry = { ...entry, foodItem: form.foodItem, quantity: form.quantity || "", unit: form.unit || "pieces", notes: form.notes || "" };
    } else if (careType === "Water") {
      if (!form.quantity) { alert("Please enter quantity."); return; }
      entry = { ...entry, quantity: form.quantity, unit: form.unit || "ml", notes: form.notes || "" };
    } else if (careType === "Sleep") {
      if (!form.hours && !form.minutes) { alert("Please enter sleep duration."); return; }
      entry = { ...entry, hours: form.hours || "0", minutes: form.minutes || "0", wakeTime: form.wakeTime || "", notes: form.notes || "" };
    } else if (careType === "Medication") {
      if (!form.medId) { alert("Please select a medication."); return; }
      const med = activeMeds.find(m => m.id === form.medId);
      entry = { ...entry, medId: form.medId, medName: med?.name || "", medDosage: med?.dosage || "", medStatus: form.medStatus || "Taken", scheduledTime: med?.scheduledTime || "", notes: form.notes || "" };
    } else if (careType === "Mood") {
      if (!form.mood) { alert("Please select a mood."); return; }
      entry = { ...entry, mood: form.mood, notes: form.notes || "" };
    } else if (careType === "Symptom") {
      if (!form.symptom) { alert("Please describe the symptom."); return; }
      entry = { ...entry, symptom: form.symptom, severity: form.severity || "Mild", notes: form.notes || "" };
    } else {
      if (!form.notes) { alert("Please enter a note."); return; }
      entry = { ...entry, notes: form.notes };
    }

    setSubmitting(true);
    try {
      await createDailyCareLog(entry);
      setCurrentLogs(prev => [{ ...entry, id: Date.now() }, ...(prev || [])]);
      setForm({});
      if (reloadPatientDetail) reloadPatientDetail();
    } catch (err) {
      console.error("[DailyCare] Failed to save care log:", err);
      alert("Failed to save care log to Supabase: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const getLogTitle = (log) => {
    if (log.type === "Food") return `${log.foodItem}${log.quantity ? ` · ${log.quantity} ${log.unit}` : ""}`;
    if (log.type === "Water") return `${log.quantity} ${log.unit}`;
    if (log.type === "Sleep") return `${log.hours || 0}h ${log.minutes || 0}m`;
    if (log.type === "Medication") return `${log.medName} ${log.medDosage}`;
    if (log.type === "Mood") return log.mood;
    if (log.type === "Symptom") return log.symptom;
    return "Note";
  };

  const getLogBadge = (log) => {
    if (log.type === "Medication") return log.medStatus === "Taken" ? { text: "Taken", color: "#1a9a5c", bg: "#e8f8f0" } : log.medStatus === "Skipped" ? { text: "Skipped", color: "#d45c5c", bg: "#fff0f0" } : { text: "Not Taken", color: "#b97a18", bg: "#fff5df" };
    if (log.type === "Symptom") return { text: log.severity, color: log.severity === "Severe" ? "#d45c5c" : log.severity === "Moderate" ? "#b97a18" : "#1a9a5c", bg: log.severity === "Severe" ? "#fff0f0" : log.severity === "Moderate" ? "#fff5df" : "#e8f8f0" };
    return null;
  };

  const getIcon = (type) => CARE_ICONS[type] || "📝";

  return (
    <div className="daily-care-page">
      <style>{`
        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          font-family: Arial, Helvetica, sans-serif;
          background: #f7f8fc;
          color: #17233c;
        }

        .daily-care-page {
          min-height: 100vh;
          background: #f7f8fc;
        }

        /* TOP HEADER */

        .top-header {
          height: 70px;
          background: white;
          border-bottom: 1px solid #e5e7ef;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 32px;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 18px;
          font-weight: 700;
          letter-spacing: 1px;
        }

        .brand-icon {
          width: 34px;
          height: 34px;
          border-radius: 9px;
          background: #5b57d9;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 20px;
        }

        .header-icon {
          font-size: 21px;
          color: #697386;
        }

        .caregiver {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .avatar {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: #5b57d9;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
        }

        .caregiver-name {
          font-size: 14px;
          font-weight: 600;
        }

        .caregiver-role {
          font-size: 12px;
          color: #7b8495;
          margin-top: 2px;
        }

        /* MAIN */

        .main-content {
          max-width: 1120px;
          margin: 0 auto;
          padding: 38px 30px 60px;
        }

        .page-heading {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-bottom: 25px;
        }

        .small-title {
          font-size: 12px;
          color: #747c8e;
          letter-spacing: 1px;
          font-weight: 600;
          margin-bottom: 7px;
        }

        .page-title {
          margin: 0;
          font-size: 30px;
          font-weight: 700;
        }

        .page-description {
          margin-top: 7px;
          color: #697386;
          font-size: 14px;
        }

        /* PATIENT CARD */

        .patient-card {
          background: white;
          border: 1px solid #e2e5ed;
          border-radius: 16px;
          padding: 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 25px;
        }

        .patient-info {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .patient-avatar {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background: #eeeefe;
          color: #5b57d9;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          font-weight: 600;
        }

        .patient-name {
          font-size: 17px;
          font-weight: 700;
          margin-bottom: 5px;
        }

        .patient-details {
          font-size: 13px;
          color: #697386;
        }

        .active-status {
          color: #21a366;
          font-weight: 600;
          margin-left: 8px;
        }

        .view-patient {
          color: #5b57d9;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
        }

        /* TWO COLUMN */

        .content-grid {
          display: grid;
          grid-template-columns: 390px 1fr;
          gap: 24px;
          align-items: start;
        }

        /* FORM CARD */

        .form-card {
          background: white;
          border: 1px solid #e2e5ed;
          border-radius: 16px;
          padding: 24px;
        }

        .card-title {
          margin: 0;
          font-size: 19px;
          font-weight: 700;
        }

        .card-subtitle {
          color: #7a8394;
          font-size: 13px;
          margin-top: 6px;
          margin-bottom: 22px;
        }

        .form-group {
          margin-bottom: 17px;
        }

        .form-label {
          display: block;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 7px;
        }

        .required {
          color: #e25555;
        }

        .form-input,
        .form-select,
        .form-textarea {
          width: 100%;
          border: 1px solid #dfe3eb;
          border-radius: 9px;
          padding: 11px 12px;
          font-size: 14px;
          outline: none;
          background: white;
          color: #26324a;
        }

        .form-input:focus,
        .form-select:focus,
        .form-textarea:focus {
          border-color: #5b57d9;
          box-shadow: 0 0 0 2px rgba(91, 87, 217, 0.08);
        }

        .form-textarea {
          min-height: 80px;
          resize: vertical;
        }

        .add-button {
          width: 100%;
          border: none;
          background: #5b57d9;
          color: white;
          padding: 12px;
          border-radius: 9px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          margin-top: 4px;
        }

        .add-button:hover {
          background: #4e4ac6;
        }

        /* SUMMARY */

        .summary-row {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 8px;
          margin-bottom: 20px;
        }

        .summary-box {
          background: white;
          border: 1px solid #e2e5ed;
          border-radius: 12px;
          padding: 13px;
          text-align: center;
        }

        .summary-icon {
          font-size: 19px;
        }

        .summary-number {
          font-size: 18px;
          font-weight: 700;
          margin-top: 5px;
        }

        .summary-label {
          font-size: 11px;
          color: #7b8495;
          margin-top: 3px;
        }

        /* LOG CARD */

        .logs-card {
          background: white;
          border: 1px solid #e2e5ed;
          border-radius: 16px;
          padding: 24px;
        }

        .logs-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 22px;
        }

        .logs-count {
          color: #7b8495;
          font-size: 13px;
        }

        .log-item {
          display: grid;
          grid-template-columns: 65px 48px 1fr;
          gap: 15px;
          padding: 18px 0;
          border-bottom: 1px solid #edf0f4;
        }

        .log-item:last-child {
          border-bottom: none;
        }

        .log-time {
          font-size: 12px;
          color: #737c8d;
          padding-top: 7px;
        }

        .log-icon {
          width: 42px;
          height: 42px;
          border-radius: 11px;
          background: #f0efff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 19px;
        }

        .log-main {
          min-width: 0;
        }

        .log-type {
          font-size: 11px;
          color: #747c8e;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          font-weight: 600;
        }

        .log-title {
          font-size: 16px;
          font-weight: 700;
          margin-top: 4px;
        }

        .log-quantity {
          font-size: 13px;
          color: #5f697c;
          margin-top: 6px;
        }

        .log-details {
          background: #f8f9fc;
          border-radius: 9px;
          padding: 10px;
          margin-top: 10px;
          font-size: 12px;
          color: #657084;
        }

        .log-added {
          margin-top: 9px;
          font-size: 12px;
          color: #858d9c;
        }

        .log-added strong {
          color: #303a4f;
        }

        .empty-state {
          text-align: center;
          padding: 50px 20px;
          color: #7b8495;
        }

        /* RESPONSIVE */

        @media (max-width: 900px) {
          .content-grid {
            grid-template-columns: 1fr;
          }

          .summary-row {
            grid-template-columns: repeat(3, 1fr);
          }
        }

        @media (max-width: 600px) {
          .top-header {
            padding: 0 15px;
          }

          .caregiver-name,
          .caregiver-role {
            display: none;
          }

          .main-content {
            padding: 25px 15px 40px;
          }

          .page-heading {
            display: block;
          }

          .patient-card {
            align-items: flex-start;
          }

          .view-patient {
            display: none;
          }

          .summary-row {
            grid-template-columns: repeat(2, 1fr);
          }

          .log-item {
            grid-template-columns: 55px 42px 1fr;
            gap: 8px;
          }
        }
      `}</style>

      {/* MAIN CONTENT — no redundant internal header; layout already provides Sidebar + Navbar */}
      <main className="main-content">

        {/* PAGE TITLE */}
        <div className="page-heading">
          <div>
            <div className="small-title">DAILY CARE</div>

            <h1 className="page-title">
              Daily Care Log
            </h1>

            <div className="page-description">
              Record and monitor {currentPatient?.name || "the patient"}'s daily care activities.
            </div>
          </div>
        </div>

        {/* PATIENT */}
        <div className="patient-card">
          <div className="patient-info">

            <div className="patient-avatar">
              {(currentPatient?.name || "P").charAt(0)}
            </div>

            <div>
              <div className="patient-name">
                {currentPatient?.name || "No Patient Selected"}
              </div>

              <div className="patient-details">
                {currentPatient?.age ? `${currentPatient.age} years` : "Age not specified"}
                <span> • </span>
                {currentPatient?.condition || "Condition not specified"}

                <span className="active-status">
                  ● {currentPatient ? "Care circle active" : "No active circle"}
                </span>
              </div>
            </div>

          </div>

          <div className="view-patient">
            View Patient →
          </div>
        </div>

        {/* CONTENT */}
        <div className="content-grid">

          {/* ADD CARE LOG */}
          <section className="form-card">

            <h2 className="card-title">
              Add Daily Care
            </h2>

            <p className="card-subtitle">
              Record a new care activity for today.
            </p>

            <form onSubmit={handleAddLog}>

              {/* CARE TYPE */}
              <div className="form-group">
                <label className="form-label">Care Type <span className="required">*</span></label>
                <select className="form-select" value={careType} onChange={(e) => handleCareTypeChange(e.target.value)}>
                  {CARE_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>

              {/* FOOD */}
              {careType === "Food" && (
                <>
                  <div className="form-group">
                    <label className="form-label">Food Item <span className="required">*</span></label>
                    <input className="form-input" placeholder="e.g. Idli, Rice, Banana" value={form.foodItem || ""} onChange={e => f("foodItem", e.target.value)} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div className="form-group">
                      <label className="form-label">Quantity</label>
                      <input className="form-input" type="number" placeholder="2" value={form.quantity || ""} onChange={e => f("quantity", e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Unit</label>
                      <select className="form-select" value={form.unit || "pieces"} onChange={e => f("unit", e.target.value)}>
                        {FOOD_UNITS.map(u => <option key={u}>{u}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="form-group">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <label className="form-label" style={{ margin: 0 }}>Notes</label>
                      <VoiceInputButton currentText={form.notes || ""} onTranscript={text => f("notes", text)} />
                    </div>
                    <textarea className="form-textarea" placeholder="Any observations..." value={form.notes || ""} onChange={e => f("notes", e.target.value)} />
                  </div>
                </>
              )}

              {/* WATER */}
              {careType === "Water" && (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div className="form-group">
                      <label className="form-label">Quantity <span className="required">*</span></label>
                      <input className="form-input" type="number" placeholder="250" value={form.quantity || ""} onChange={e => f("quantity", e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Unit</label>
                      <select className="form-select" value={form.unit || "ml"} onChange={e => f("unit", e.target.value)}>
                        {WATER_UNITS.map(u => <option key={u}>{u}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="form-group">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <label className="form-label" style={{ margin: 0 }}>Notes</label>
                      <VoiceInputButton currentText={form.notes || ""} onTranscript={text => f("notes", text)} />
                    </div>
                    <input className="form-input" placeholder="Optional observation" value={form.notes || ""} onChange={e => f("notes", e.target.value)} />
                  </div>
                </>
              )}

              {/* SLEEP */}
              {careType === "Sleep" && (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div className="form-group">
                      <label className="form-label">Hours</label>
                      <input className="form-input" type="number" placeholder="7" min="0" max="24" value={form.hours || ""} onChange={e => f("hours", e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Minutes</label>
                      <input className="form-input" type="number" placeholder="30" min="0" max="59" value={form.minutes || ""} onChange={e => f("minutes", e.target.value)} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Wake-up Time</label>
                    <input className="form-input" type="time" value={form.wakeTime || ""} onChange={e => f("wakeTime", e.target.value)} />
                  </div>
                  <div className="form-group">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <label className="form-label" style={{ margin: 0 }}>Notes</label>
                      <VoiceInputButton currentText={form.notes || ""} onTranscript={text => f("notes", text)} />
                    </div>
                    <textarea className="form-textarea" placeholder="Any sleep observations..." value={form.notes || ""} onChange={e => f("notes", e.target.value)} />
                  </div>
                </>
              )}

              {/* MEDICATION */}
              {careType === "Medication" && (
                <>
                  {activeMeds.length === 0 ? (
                    <div style={{ background: "#fff5df", border: "1px solid #f5d98a", borderRadius: 9, padding: "12px 14px", fontSize: 13, color: "#b97a18", marginBottom: 12 }}>
                      No active medications found. Add medications in the Medications page first.
                    </div>
                  ) : (
                    <div className="form-group">
                      <label className="form-label">Select Medication <span className="required">*</span></label>
                      <select className="form-select" value={form.medId || ""} onChange={e => f("medId", e.target.value)}>
                        <option value="">— Choose medication —</option>
                        {activeMeds.map(m => (
                          <option key={m.id} value={m.id}>{m.name} {m.dosage} · {m.scheduledTime}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="form-group">
                    <label className="form-label">Status <span className="required">*</span></label>
                    <select className="form-select" value={form.medStatus || "Taken"} onChange={e => f("medStatus", e.target.value)}>
                      <option>Taken</option>
                      <option>Not Taken</option>
                      <option>Skipped</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <label className="form-label" style={{ margin: 0 }}>Notes</label>
                      <VoiceInputButton currentText={form.notes || ""} onTranscript={text => f("notes", text)} />
                    </div>
                    <textarea className="form-textarea" placeholder="Any observations about this medication..." value={form.notes || ""} onChange={e => f("notes", e.target.value)} />
                  </div>
                </>
              )}

              {/* MOOD */}
              {careType === "Mood" && (
                <>
                  <div className="form-group">
                    <label className="form-label">Mood <span className="required">*</span></label>
                    <select className="form-select" value={form.mood || ""} onChange={e => f("mood", e.target.value)}>
                      <option value="">— Select mood —</option>
                      {MOODS.map(m => <option key={m}>{m}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <label className="form-label" style={{ margin: 0 }}>Observation / Notes</label>
                      <VoiceInputButton currentText={form.notes || ""} onTranscript={text => f("notes", text)} />
                    </div>
                    <textarea className="form-textarea" placeholder="Describe the patient's mood or behaviour..." value={form.notes || ""} onChange={e => f("notes", e.target.value)} />
                  </div>
                </>
              )}

              {/* SYMPTOM */}
              {careType === "Symptom" && (
                <>
                  <div className="form-group">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <label className="form-label" style={{ margin: 0 }}>Symptom <span className="required">*</span></label>
                      <VoiceInputButton currentText={form.symptom || ""} onTranscript={text => f("symptom", text)} />
                    </div>
                    <input className="form-input" placeholder="e.g. Dizziness, headache, confusion" value={form.symptom || ""} onChange={e => f("symptom", e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Severity</label>
                    <select className="form-select" value={form.severity || "Mild"} onChange={e => f("severity", e.target.value)}>
                      {SEVERITIES.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <label className="form-label" style={{ margin: 0 }}>Notes</label>
                      <VoiceInputButton currentText={form.notes || ""} onTranscript={text => f("notes", text)} />
                    </div>
                    <textarea className="form-textarea" placeholder="Describe in detail..." value={form.notes || ""} onChange={e => f("notes", e.target.value)} />
                  </div>
                </>
              )}

              {/* GENERAL NOTE */}
              {careType === "General Note" && (
                <div className="form-group">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <label className="form-label" style={{ margin: 0 }}>Note <span className="required">*</span></label>
                    <VoiceInputButton currentText={form.notes || ""} onTranscript={text => f("notes", text)} />
                  </div>
                  <textarea className="form-textarea" style={{ minHeight: 100 }} placeholder="Write your observation or note..." value={form.notes || ""} onChange={e => f("notes", e.target.value)} />
                </div>
              )}

              <button className="add-button" type="submit" disabled={submitting}>
                {submitting ? "Saving..." : "+ Add Care Log"}
              </button>

            </form>
          </section>

          {/* RIGHT SIDE */}
          <section>

            {/* SUMMARY */}
            <div className="summary-row">

              {CARE_TYPES.map((type) => {
                const count = currentLogs.filter(log => log.type === type).length;
                return (
                  <div className="summary-box" key={type}>
                    <div className="summary-icon">{getIcon(type)}</div>
                    <div className="summary-number">{count}</div>
                    <div className="summary-label" style={{ fontSize: 10 }}>{type}</div>
                  </div>
                );
              })}

            </div>

            {/* LOGS */}
            <div className="logs-card">

              <div className="logs-header">

                <div>
                  <h2 className="card-title">
                    Today's Care Logs
                  </h2>

                  <div className="card-subtitle">
                    Recent activities recorded for the patient.
                  </div>
                </div>

                <div className="logs-count">
                  {currentLogs.length} entries
                </div>

              </div>

              {currentLogs.length === 0 ? (
                <div className="empty-state">No care logs recorded yet for today.</div>
              ) : (
                currentLogs.map((log) => {
                  const badge = getLogBadge(log);
                  return (
                    <div className="log-item" key={log.id}>
                      <div className="log-time">{log.time}</div>
                      <div className="log-icon">{getIcon(log.type)}</div>
                      <div className="log-main">
                        <div className="log-type">{log.type}</div>
                        <div className="log-title" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          {getLogTitle(log)}
                          {badge && (
                            <span style={{ fontSize: 10, fontWeight: 700, color: badge.color, background: badge.bg, borderRadius: 20, padding: "2px 8px" }}>
                              {badge.text}
                            </span>
                          )}
                        </div>
                        {log.type === "Medication" && log.scheduledTime && (
                          <div className="log-quantity">Scheduled: {log.scheduledTime}</div>
                        )}
                        {log.type === "Sleep" && (
                          <div className="log-quantity">{log.hours}h {log.minutes}m{log.wakeTime ? ` · Wake: ${log.wakeTime}` : ""}</div>
                        )}
                        {log.notes ? (
                          <div className="log-details">{log.notes}</div>
                        ) : null}
                        <div className="log-added">Added by <strong>{log.addedBy}</strong></div>
                      </div>
                    </div>
                  );
                })
              )}

            </div>

          </section>

        </div>

      </main>
    </div>
  );
}