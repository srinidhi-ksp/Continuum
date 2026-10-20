import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, Clock3, Pill, Search, UserRound, X } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { usePatient } from "../context/PatientContext";

function makeResult(type, row, patient, title, detail, path) {
  return {
    id: row.patient_id || row.log_id || row.event_id || row.medication_id || row.id,
    type,
    patientId: patient.id,
    patientName: patient.name,
    title,
    detail,
    path,
  };
}

export default function GlobalSearch({ onClose }) {
  const { patients, setCurrentPatientId } = usePatient();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  const patientById = useMemo(
    () => new Map(patients.map((patient) => [patient.id, patient])),
    [patients],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) return undefined;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      const patientIds = [...patientById.keys()];
      if (!patientIds.length) {
        setResults([]);
        setLoading(false);
        return;
      }

      const pattern = `%${term.replace(/[%_]/g, "\\$&")}%`;
      try {
        const [logsByQuantity, logsByNotes, logsBySymptoms, medications, events, responsibilities] = await Promise.all([
          supabase.from("daily_care_log")
            .select("log_id, patient_id, type, quantity, notes, created_at")
            .in("patient_id", patientIds)
            .ilike("quantity", pattern)
            .order("created_at", { ascending: false })
            .limit(8)
            .abortSignal(controller.signal),
          supabase.from("daily_care_log")
            .select("log_id, patient_id, type, quantity, notes, created_at")
            .in("patient_id", patientIds)
            .ilike("notes", pattern)
            .order("created_at", { ascending: false })
            .limit(8)
            .abortSignal(controller.signal),
          supabase.from("daily_care_log")
            .select("log_id, patient_id, type, quantity, notes, created_at")
            .in("patient_id", patientIds)
            .ilike("symptoms", pattern)
            .order("created_at", { ascending: false })
            .limit(8)
            .abortSignal(controller.signal),
          supabase.from("medication")
            .select("medication_id, patient_id, medicine_name, dosage, purpose")
            .in("patient_id", patientIds)
            .ilike("medicine_name", pattern)
            .limit(8)
            .abortSignal(controller.signal),
          supabase.from("time_event")
            .select("event_id, patient_id, title, event_type, created_at")
            .in("patient_id", patientIds)
            .ilike("title", pattern)
            .order("created_at", { ascending: false })
            .limit(8)
            .abortSignal(controller.signal),
          supabase.from("caregiver_pat")
            .select("patient_id, caregiver_id, assigned_responsibilities, caregiver:caregiver_id ( full_name )")
            .in("patient_id", patientIds)
            .abortSignal(controller.signal),
        ]);
        if (controller.signal.aborted) return;
        const firstError = logsByQuantity.error || logsByNotes.error || logsBySymptoms.error
          || medications.error || events.error || responsibilities.error;
        if (firstError) throw firstError;

        const patientResults = patients
          .filter((patient) => `${patient.name} ${patient.condition}`.toLowerCase().includes(term.toLowerCase()))
          .slice(0, 5)
          .map((patient) => makeResult("Patients", patient, patient, patient.name, patient.condition || "Patient profile", "/patient"));
        const logRows = [
          ...(logsByQuantity.data || []),
          ...(logsByNotes.data || []),
          ...(logsBySymptoms.data || []),
        ]
          .filter((row, index, rows) => rows.findIndex((item) => item.log_id === row.log_id) === index);
        const careLogResults = logRows
          .map((row) => {
            const patient = patientById.get(row.patient_id);
            return patient && makeResult(
              "Care logs",
              row,
              patient,
              row.quantity || row.notes || `${row.type || "Care"} activity`,
              `${row.type || "Care"} · ${patient.name}`,
              "/daily-care",
            );
          })
          .filter(Boolean);
        const medicationResults = (medications.data || [])
          .map((row) => {
            const patient = patientById.get(row.patient_id);
            return patient && makeResult(
              "Medications",
              row,
              patient,
              row.medicine_name,
              [row.dosage, row.purpose, patient.name].filter(Boolean).join(" · "),
              "/medications",
            );
          })
          .filter(Boolean);
        const timelineResults = (events.data || [])
          .map((row) => {
            const patient = patientById.get(row.patient_id);
            return patient && makeResult(
              "Timeline",
              row,
              patient,
              row.title,
              `${row.event_type || "Activity"} · ${patient.name}`,
              "/timeline",
            );
          })
          .filter(Boolean);
        const responsibilityResults = (responsibilities.data || [])
          .flatMap((row) => {
            const patient = patientById.get(row.patient_id);
            return (row.assigned_responsibilities || [])
              .filter((responsibility) => responsibility.toLowerCase().includes(term.toLowerCase()))
              .map((responsibility, index) => patient && makeResult(
                "Care responsibilities",
                { id: `${row.patient_id}-${row.caregiver_id}-${index}` },
                patient,
                responsibility,
                `${row.caregiver?.full_name || "Caregiver"} · ${patient.name}`,
                "/care-circle",
              ))
              .filter(Boolean);
          });

        setResults([
          ...patientResults,
          ...careLogResults,
          ...medicationResults,
          ...timelineResults,
          ...responsibilityResults,
        ]);
      } catch (searchError) {
        if (!controller.signal.aborted) {
          console.error("[GlobalSearch] Search request failed:", searchError);
          setError(`Search couldn't complete: ${searchError.message || "Please try again."}`);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, patientById, patients]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const groupedResults = results.reduce((groups, result) => {
    (groups[result.type] ||= []).push(result);
    return groups;
  }, {});

  const icons = {
    Patients: UserRound,
    "Care logs": Activity,
    Medications: Pill,
    Timeline: Clock3,
    "Care responsibilities": UserRound,
  };

  const openResult = (result) => {
    setCurrentPatientId(result.patientId);
    navigate(result.path);
    onClose();
  };

  return (
    <div className="global-search-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="global-search-dialog" role="dialog" aria-modal="true" aria-label="Search Continuum">
        <div className="global-search-input-wrap">
          <Search size={19} aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              const value = event.target.value;
              setQuery(value);
              if (value.trim().length < 2) {
                setResults([]);
                setError("");
                setLoading(false);
              }
            }}
            placeholder="Search patients, care logs, medications, timeline…"
            aria-label="Search patients, care logs, medications, and timeline"
          />
          <button type="button" className="global-search-close" onClick={onClose} aria-label="Close search">
            <X size={17} />
          </button>
        </div>

        <div className="global-search-content" aria-live="polite">
          {query.trim().length < 2 ? (
            <div className="global-search-hint">Search across the patients and care records you can access.</div>
          ) : loading ? (
            <div className="global-search-state"><span className="care-spinner" /> Searching care records…</div>
          ) : error ? (
            <div className="global-search-state global-search-state--error" role="alert">{error}</div>
          ) : results.length === 0 ? (
            <div className="global-search-state">No matching patients or care records found.</div>
          ) : (
            Object.entries(groupedResults).map(([group, items]) => {
              const Icon = icons[group] || Search;
              return (
                <div className="global-search-group" key={group}>
                  <h2>{group}</h2>
                  {items.map((result) => (
                    <button className="global-search-result" key={`${group}-${result.id}`} onClick={() => openResult(result)}>
                      <span className="global-search-result-icon"><Icon size={17} /></span>
                      <span className="global-search-result-copy">
                        <strong>{result.title}</strong>
                        <span>{result.detail}</span>
                      </span>
                    </button>
                  ))}
                </div>
              );
            })
          )}
          {query.trim().length >= 2 && !loading && !error && (
            <p className="global-search-scope">Results are limited to your accessible patients and their records.</p>
          )}
        </div>
      </section>
    </div>
  );
}
