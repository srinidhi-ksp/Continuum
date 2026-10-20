import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity, Check, Clock3, Droplets, Heart, Moon, Pill,
  Plus, ScrollText, Smile, Thermometer, Utensils,
} from "lucide-react";
import { usePatient } from "../context/PatientContext";
import { createDailyCareLog, fetchDailyCareLogs } from "../lib/dailyCareApi";
import "../styles/dailyCare.css";

const CARE_TYPES = [
  { value: "Food", label: "Food", icon: Utensils },
  { value: "Water", label: "Water", icon: Droplets },
  { value: "Sleep", label: "Sleep", icon: Moon },
  { value: "Medication", label: "Medication", icon: Pill },
  { value: "Mood", label: "Mood", icon: Smile },
  { value: "Symptom", label: "Symptom", icon: Thermometer },
  { value: "General Note", label: "Note", icon: ScrollText },
];

const MOODS = ["Happy", "Calm", "Anxious", "Sad", "Agitated", "Confused", "Restless"];
const SEVERITIES = ["Mild", "Moderate", "Severe"];
const FOOD_UNITS = ["pieces", "grams", "ml", "cups", "bowls", "plates"];
const WATER_UNITS = ["ml", "glasses", "litres"];
const MEDICATION_STATUSES = ["Taken", "Skipped", "Not Taken"];

const CATEGORY_ALIASES = {
  food: "Food", meal: "Food", water: "Water", sleep: "Sleep",
  medication: "Medication", mood: "Mood", symptom: "Symptom",
  note: "General Note", "general note": "General Note", mobility: "Mobility",
};

function mapCareLog(log) {
  const category = CATEGORY_ALIASES[String(log.type || "").toLowerCase()] || "General Note";
  const quantity = log.quantity || "";
  let title = quantity || "Care activity recorded";
  let status = "";
  let statusClass = "";

  if (category === "Sleep" && log.sleep_hours != null) {
    const totalMinutes = Math.round(Number(log.sleep_hours) * 60);
    title = `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`;
  } else if (category === "Symptom" && log.symptoms) {
    const match = String(log.symptoms).match(/^(.*?)(?:\s*\((Mild|Moderate|Severe)\))?$/i);
    title = match?.[1] || log.symptoms;
    status = match?.[2] || "";
    statusClass = status.toLowerCase();
  } else if (category === "Medication") {
    const match = String(log.notes || "").match(/(?:status:\s*)?(Taken|Skipped|Not Taken)/i);
    status = match?.[1] || "";
    statusClass = status.toLowerCase().replaceAll(" ", "-");
  } else if (category === "Mood" && log.quantity) {
    title = `Mood: ${log.quantity}`;
  } else if (category === "General Note") {
    title = "Care note";
  }

  return {
    id: log.log_id || log.id,
    category,
    title,
    status,
    statusClass,
    notes: log.notes || "",
    createdAt: log.created_at,
    caregiver: log.caregiver?.full_name || "Caregiver",
    icon: CARE_TYPES.find((item) => item.value === category)?.icon || Activity,
  };
}

function isToday(dateValue) {
  if (!dateValue) return false;
  const date = new Date(dateValue);
  const today = new Date();
  return date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth()
    && date.getDate() === today.getDate();
}

function CareField({ label, required = false, children }) {
  return (
    <label className="care-field">
      <span>{label}{required && <span className="care-required"> *</span>}</span>
      {children}
    </label>
  );
}

export default function DailyCare() {
  const {
    currentPatient, currentMedications, currentLogs, setCurrentLogs,
    reloadPatientDetail, isDetailLoading,
  } = usePatient();
  const [careType, setCareType] = useState("Food");
  const [form, setForm] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [hasMore, setHasMore] = useState(true);

  const activeMeds = useMemo(
    () => currentMedications.filter((med) => med.active),
    [currentMedications],
  );
  const logs = useMemo(
    () => currentLogs.map(mapCareLog),
    [currentLogs],
  );
  const todaysLogs = useMemo(
    () => logs.filter((log) => isToday(log.createdAt)),
    [logs],
  );

  const updateField = (name, value) => setForm((previous) => ({ ...previous, [name]: value }));
  const changeCareType = (value) => {
    setCareType(value);
    setForm({});
    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!currentPatient?.id) {
      setError("Select a patient before recording care.");
      return;
    }

    const entry = { patientId: currentPatient.id, type: careType, notes: form.notes?.trim() || "" };
    if (careType === "Food") {
      if (!form.foodItem?.trim()) return setError("Enter the food or drink provided.");
      if (form.quantity && Number(form.quantity) <= 0) return setError("Quantity must be greater than zero.");
      Object.assign(entry, { foodItem: form.foodItem.trim(), quantity: form.quantity || "", unit: form.unit || "pieces" });
    } else if (careType === "Water") {
      if (!form.quantity || Number(form.quantity) <= 0) return setError("Enter a volume greater than zero.");
      Object.assign(entry, { quantity: form.quantity, unit: form.unit || "ml" });
    } else if (careType === "Sleep") {
      const hours = Number(form.hours || 0);
      const minutes = Number(form.minutes || 0);
      if (hours < 0 || hours > 24 || minutes < 0 || minutes > 59 || (hours === 0 && minutes === 0)) {
        return setError("Enter a valid sleep duration greater than zero.");
      }
      Object.assign(entry, { hours, minutes, wakeTime: form.wakeTime || "" });
    } else if (careType === "Medication") {
      if (!form.medId) return setError("Select a medication.");
      const medication = activeMeds.find((item) => item.id === form.medId);
      if (!medication) return setError("That medication is no longer active. Refresh and try again.");
      Object.assign(entry, {
        medicationId: medication.id,
        medName: medication.name,
        medDosage: medication.dosage,
        medStatus: form.medStatus || "Taken",
      });
    } else if (careType === "Mood") {
      if (!form.mood) return setError("Choose a mood.");
      Object.assign(entry, { mood: form.mood });
    } else if (careType === "Symptom") {
      if (!form.symptom?.trim()) return setError("Describe the symptom.");
      Object.assign(entry, { symptom: form.symptom.trim(), severity: form.severity || "Mild" });
    } else if (!entry.notes) {
      return setError("Write a note before saving.");
    }

    setSubmitting(true);
    try {
      const { log } = await createDailyCareLog(entry);
      setCurrentLogs((previous) => [log, ...(previous || []).filter((item) => item.log_id !== log.log_id)]);
      setForm({});
      setNotice("Care activity saved.");
      await reloadPatientDetail?.();
    } catch (saveError) {
      console.error("[DailyCare] Failed to save care log:", saveError);
      setError(`Couldn't save this care activity: ${saveError.message || "Please try again."}`);
    } finally {
      setSubmitting(false);
    }
  };

  const loadOlder = async () => {
    if (!currentPatient?.id || loadingOlder) return;
    setLoadingOlder(true);
    setError("");
    try {
      const olderLogs = await fetchDailyCareLogs(currentPatient.id, 30, currentLogs.length);
      setCurrentLogs((previous) => [...previous, ...olderLogs]);
      setHasMore(olderLogs.length === 30);
    } catch (loadError) {
      console.error("[DailyCare] Failed to load older logs:", loadError);
      setError(`Couldn't load older care logs: ${loadError.message || "Please try again."}`);
    } finally {
      setLoadingOlder(false);
    }
  };

  if (!currentPatient) return null;

  const SelectedIcon = CARE_TYPES.find((item) => item.value === careType)?.icon || Activity;

  return (
    <div className="daily-care-page">
      <header className="care-page-heading">
        <div>
          <p className="care-eyebrow">Care journal</p>
          <h1>Daily care</h1>
          <p>Small moments, thoughtfully recorded for {currentPatient.name.split(" ")[0]}.</p>
        </div>
        <Link to="/timeline" className="care-timeline-link"><Clock3 size={16} /> View timeline</Link>
      </header>

      <section className="care-patient-strip">
        <div className="care-patient-avatar">{currentPatient.name.charAt(0)}</div>
        <div className="care-patient-copy">
          <span className="care-eyebrow">Current patient</span>
          <h2>{currentPatient.name}</h2>
          <p>{currentPatient.age ? `${currentPatient.age} years` : "Age not provided"}{currentPatient.condition ? ` · ${currentPatient.condition}` : ""}</p>
        </div>
        <Link to="/patient" className="care-patient-link">Patient profile <span aria-hidden="true">→</span></Link>
      </section>

      <div className="care-content-grid">
        <section className="care-form-card">
          <div className="care-section-heading">
            <div className="care-heading-icon"><Plus size={18} /></div>
            <div><h2>Record an activity</h2><p>Choose a care type to see the relevant details.</p></div>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <CareField label="Care type" required>
              <select value={careType} onChange={(event) => changeCareType(event.target.value)}>
                {CARE_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </CareField>

            {careType === "Food" && (
              <>
                <CareField label="Food or drink" required>
                  <input value={form.foodItem || ""} onChange={(event) => updateField("foodItem", event.target.value)} placeholder="e.g. rice and vegetables" />
                </CareField>
                <div className="care-field-row">
                  <CareField label="Quantity">
                    <input type="number" min="0.1" step="any" value={form.quantity || ""} onChange={(event) => updateField("quantity", event.target.value)} placeholder="Optional" />
                  </CareField>
                  <CareField label="Unit">
                    <select value={form.unit || "pieces"} onChange={(event) => updateField("unit", event.target.value)}>
                      {FOOD_UNITS.map((unit) => <option key={unit}>{unit}</option>)}
                    </select>
                  </CareField>
                </div>
              </>
            )}

            {careType === "Water" && (
              <div className="care-field-row">
                <CareField label="Volume" required>
                  <input type="number" min="1" step="any" value={form.quantity || ""} onChange={(event) => updateField("quantity", event.target.value)} placeholder="250" />
                </CareField>
                <CareField label="Unit">
                  <select value={form.unit || "ml"} onChange={(event) => updateField("unit", event.target.value)}>
                    {WATER_UNITS.map((unit) => <option key={unit}>{unit}</option>)}
                  </select>
                </CareField>
              </div>
            )}

            {careType === "Sleep" && (
              <>
                <div className="care-field-row">
                  <CareField label="Hours">
                    <input type="number" min="0" max="24" value={form.hours || ""} onChange={(event) => updateField("hours", event.target.value)} placeholder="0" />
                  </CareField>
                  <CareField label="Minutes">
                    <input type="number" min="0" max="59" value={form.minutes || ""} onChange={(event) => updateField("minutes", event.target.value)} placeholder="0" />
                  </CareField>
                </div>
                <CareField label="Wake-up time">
                  <input type="time" value={form.wakeTime || ""} onChange={(event) => updateField("wakeTime", event.target.value)} />
                </CareField>
              </>
            )}

            {careType === "Medication" && (
              activeMeds.length ? (
                <>
                  <CareField label="Medication" required>
                    <select value={form.medId || ""} onChange={(event) => updateField("medId", event.target.value)}>
                      <option value="">Choose a medication</option>
                      {activeMeds.map((medication) => <option key={medication.id} value={medication.id}>{medication.name} · {medication.dosage}</option>)}
                    </select>
                  </CareField>
                  <CareField label="Dose status" required>
                    <select value={form.medStatus || "Taken"} onChange={(event) => updateField("medStatus", event.target.value)}>
                      {MEDICATION_STATUSES.map((status) => <option key={status}>{status}</option>)}
                    </select>
                  </CareField>
                </>
              ) : (
                <div className="care-inline-empty"><Pill size={18} /><span>No active medication is available. Add one on the <Link to="/medications">Medications page</Link>.</span></div>
              )
            )}

            {careType === "Mood" && (
              <CareField label="Observed mood" required>
                <select value={form.mood || ""} onChange={(event) => updateField("mood", event.target.value)}>
                  <option value="">Choose a mood</option>
                  {MOODS.map((mood) => <option key={mood}>{mood}</option>)}
                </select>
              </CareField>
            )}

            {careType === "Symptom" && (
              <>
                <CareField label="Symptom" required>
                  <input value={form.symptom || ""} onChange={(event) => updateField("symptom", event.target.value)} placeholder="Describe what you noticed" />
                </CareField>
                <CareField label="Severity">
                  <select value={form.severity || "Mild"} onChange={(event) => updateField("severity", event.target.value)}>
                    {SEVERITIES.map((severity) => <option key={severity}>{severity}</option>)}
                  </select>
                </CareField>
              </>
            )}

            {careType === "General Note" && (
              <CareField label="Note" required>
                <textarea value={form.notes || ""} onChange={(event) => updateField("notes", event.target.value)} placeholder="Write an observation to share with the care circle." rows={4} />
              </CareField>
            )}

            {careType !== "General Note" && (
              <CareField label={careType === "Mood" ? "Observation (optional)" : "Notes (optional)"}>
                <textarea value={form.notes || ""} onChange={(event) => updateField("notes", event.target.value)} placeholder="Add helpful context for the care team." rows={3} />
              </CareField>
            )}

            {error && <p className="care-feedback care-feedback--error" role="alert">{error}</p>}
            {notice && <p className="care-feedback care-feedback--success" role="status"><Check size={15} /> {notice}</p>}

            <button className="care-submit" type="submit" disabled={submitting || (careType === "Medication" && activeMeds.length === 0)}>
              {submitting ? <><span className="care-spinner" /> Saving activity…</> : <><SelectedIcon size={17} /> Save care activity</>}
            </button>
          </form>
        </section>

        <div className="care-activity-column">
          <section className="care-stats-section">
            <div className="care-section-heading care-section-heading--compact">
              <div><p className="care-eyebrow">Today at a glance</p><h2>Activity summary</h2></div>
              <span className="care-today-date">{new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(new Date())}</span>
            </div>
            <div className="care-stats-grid">
              {CARE_TYPES.map(({ value, label, icon: Icon }) => {
                const category = value === "General Note" ? value : value;
                const count = todaysLogs.filter((log) => log.category === category).length;
                return (
                  <div className="care-stat-card" key={value}>
                    <span className="care-stat-icon"><Icon size={17} /></span>
                    <strong>{count}</strong>
                    <span>{label}</span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="care-logs-card">
            <div className="care-logs-heading">
              <div><h2>Recent care logs</h2><p>Latest activities recorded for {currentPatient.name.split(" ")[0]}.</p></div>
              <span className="care-log-count">{logs.length} entries</span>
            </div>

            {isDetailLoading && logs.length === 0 ? (
              <div className="care-log-skeletons" aria-label="Loading care logs">
                {[0, 1, 2].map((item) => <div className="care-log-skeleton" key={item} />)}
              </div>
            ) : logs.length === 0 ? (
              <div className="care-empty-state">
                <div><Heart size={22} /></div>
                <h3>Your care journal starts here</h3>
                <p>Record a meal, medication, or small observation to keep everyone in the loop.</p>
              </div>
            ) : (
              <div className="care-log-list">
                {logs.map((log) => {
                  const Icon = log.icon;
                  const timestamp = log.createdAt ? new Date(log.createdAt) : null;
                  return (
                    <article className="care-log-item" key={log.id}>
                      <div className={`care-log-icon care-log-icon--${log.category.toLowerCase().replaceAll(" ", "-")}`}><Icon size={17} /></div>
                      <div className="care-log-body">
                        <div className="care-log-topline">
                          <span className="care-log-category">{log.category === "General Note" ? "Note" : log.category}</span>
                          {timestamp && (
                            <time dateTime={timestamp.toISOString()}>
                              {isToday(timestamp)
                                ? new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(timestamp)
                                : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(timestamp)}
                            </time>
                          )}
                        </div>
                        <div className="care-log-title">
                          <strong>{log.title}</strong>
                          {log.status && <span className={`care-status-badge care-status-badge--${log.statusClass}`}>{log.status}</span>}
                        </div>
                        {log.notes && <p className="care-log-notes">{log.notes}</p>}
                        <span className="care-log-caregiver">Added by {log.caregiver}</span>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
            {hasMore && logs.length >= 30 && (
              <button className="care-load-more" onClick={loadOlder} disabled={loadingOlder}>
                {loadingOlder ? "Loading…" : "Load older logs"}
              </button>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
