import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase, CURRENT_CAREGIVER_ID } from "../lib/supabaseClient";
import { mapPatientRow, mapMedicationRow, formatClockTime } from "../lib/mappers";

const PatientContext = createContext(null);

export function PatientProvider({ children }) {
  const [patients, setPatients] = useState([]);
  const [currentPatientId, setCurrentPatientId] = useState(null);

  const [careCircle, setCareCircle] = useState([]);
  const [medicationsByPatient, setMedicationsByPatient] = useState({});
  const [logsByPatient, setLogsByPatient] = useState({});
  const [remindersByPatient, setRemindersByPatient] = useState({});
  const [coordinationMetric, setCoordinationMetric] = useState(null);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  // ── Every patient in this caregiver's care circle, with dashboard-card
  //    summary fields (completion %, medication count, last activity) ──────
  const loadPatients = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const { data: links, error: linkError } = await supabase
        .from("caregiver_pat")
        .select("patient_id")
        .eq("caregiver_id", CURRENT_CAREGIVER_ID)
        .is("removed_at", null);
      if (linkError) throw linkError;

      const patientIds = [...new Set((links || []).map((l) => l.patient_id))];
      if (patientIds.length === 0) {
        setPatients([]);
        setCurrentPatientId(null);
        return;
      }

      const { data: patientRows, error: patientError } = await supabase
        .from("patient")
        .select("*")
        .in("patient_id", patientIds);
      if (patientError) throw patientError;

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const summarised = await Promise.all(
        (patientRows || []).map(async (row) => {
          const [circle, metric, contact, meds, latestLog, takenToday, loggedToday] =
            await Promise.all([
              supabase.from("caregiver_pat").select("caregiver_id").eq("patient_id", row.patient_id).is("removed_at", null),
              supabase.from("coordination_metric").select("*").eq("patient_id", row.patient_id).order("predicted_at", { ascending: false }).limit(1),
              supabase.from("emergency_contact").select("*").eq("patient_id", row.patient_id).order("priority", { ascending: true }).limit(1),
              supabase.from("medication").select("medication_id, active").eq("patient_id", row.patient_id),
              supabase.from("daily_care_log").select("created_at").eq("patient_id", row.patient_id).order("created_at", { ascending: false }).limit(1),
              supabase.from("daily_care_log").select("log_id", { count: "exact", head: true }).eq("patient_id", row.patient_id).eq("type", "medication").gte("created_at", todayStart.toISOString()),
              supabase.from("daily_care_log").select("log_id", { count: "exact", head: true }).eq("patient_id", row.patient_id).gte("created_at", todayStart.toISOString()),
            ]);

          const activeMeds = (meds.data || []).filter((m) => m.active);
          // Heuristic: 5 standard daily categories (medication, food, water,
          // sleep, mood) — completion is how many distinct log entries exist
          // today out of that baseline. Good enough until there's a real
          // per-day task list table.
          const careCompletion = Math.min(100, Math.round(((loggedToday.count || 0) / 5) * 100));

          return mapPatientRow(row, {
            caregiverCount: (circle.data || []).length,
            careCircleActive: (circle.data || []).length > 0,
            latestMetric: metric.data?.[0] || null,
            emergencyContact: contact.data?.[0]
              ? { name: contact.data[0].name, relation: contact.data[0].relation, phone: contact.data[0].phone }
              : null,
            medsTaken: takenToday.count || 0,
            medsTotal: activeMeds.length,
            careCompletion,
            lastActivityAt: latestLog.data?.[0]?.created_at || null,
          });
        })
      );

      setPatients(summarised);
      setCurrentPatientId((prev) =>
        prev && summarised.some((p) => p.id === prev) ? prev : summarised[0]?.id ?? null
      );
    } catch (err) {
      console.error("[PatientContext] Failed to load patients:", err);
      setLoadError(err.message || "Failed to load patients from Supabase");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Standard fetch-on-mount pattern; this project has no data-fetching
    // library (React Query/SWR) yet, so effect + setState is the working
    // approach for now. Same pattern already existed in DailyCare.jsx
    // before this change — worth revisiting project-wide later.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadPatients();
  }, [loadPatients]);

  // ── Care circle, medications, logs, reminders, coordination score for
  //    whichever patient is currently selected ─────────────────────────────
  const loadPatientDetail = useCallback(async (patientId) => {
    if (!patientId) return;
    setIsDetailLoading(true);
    try {
      const [circleRes, medRes, logRes, metricRes] = await Promise.all([
        supabase
          .from("caregiver_pat")
          .select("role, joining_at, caregiver:caregiver_id ( caregiver_id, full_name, email, phone, profile_image )")
          .eq("patient_id", patientId)
          .is("removed_at", null),
        supabase.from("medication").select("*").eq("patient_id", patientId).order("start_date", { ascending: false }),
        supabase
          .from("daily_care_log")
          .select("*, caregiver:caregiver_id ( full_name )")
          .eq("patient_id", patientId)
          .order("created_at", { ascending: false })
          .limit(30),
        supabase.from("coordination_metric").select("*").eq("patient_id", patientId).order("predicted_at", { ascending: false }).limit(1),
      ]);

      if (circleRes.error) throw circleRes.error;
      if (medRes.error) throw medRes.error;
      if (logRes.error) throw logRes.error;
      if (metricRes.error) throw metricRes.error;

      setCareCircle(
        (circleRes.data || []).map((r) => ({
          id: r.caregiver.caregiver_id,
          name: r.caregiver.full_name,
          role: r.role,
          joinedAt: r.joining_at,
        }))
      );

      const medRows = medRes.data || [];
      const medIds = medRows.map((m) => m.medication_id);
      let schedulesByMed = {};
      if (medIds.length) {
        const { data: scheduleRows, error: scheduleError } = await supabase
          .from("medication_schedule")
          .select("*")
          .in("medication_id", medIds);
        if (scheduleError) throw scheduleError;
        schedulesByMed = (scheduleRows || []).reduce((acc, s) => {
          (acc[s.medication_id] ??= []).push(s);
          return acc;
        }, {});
      }

      setMedicationsByPatient((prev) => ({
        ...prev,
        [patientId]: medRows.map((m) => mapMedicationRow(m, schedulesByMed[m.medication_id] || [])),
      }));

      const logRows = logRes.data || [];
      setLogsByPatient((prev) => ({ ...prev, [patientId]: logRows }));

      // Build today's reminder list straight from each active medication's
      // schedule, cross-checked against today's logged doses.
      const today = new Date();
      const reminders = [];
      medRows
        .filter((m) => m.active)
        .forEach((m) => {
          (schedulesByMed[m.medication_id] || []).forEach((s) => {
            const [h, mnt] = (s.time_of_day || "00:00").split(":").map(Number);
            const schedDate = new Date(today);
            schedDate.setHours(h, mnt, 0, 0);

            const taken = logRows.find(
              (l) =>
                l.type === "medication" &&
                new Date(l.created_at).toDateString() === today.toDateString() &&
                Math.abs(new Date(l.created_at).getTime() - schedDate.getTime()) < 3 * 3600 * 1000
            );

            reminders.push({
              id: `${m.medication_id}-${s.schedule_id}`,
              title: m.medicine_name,
              subtitle: `Medication · ${m.dosage}`,
              time: formatClockTime(s.time_of_day),
              status: taken ? "completed" : Date.now() > schedDate.getTime() ? "missed" : "upcoming",
              sortKey: schedDate.getTime(),
            });
          });
        });
      reminders.sort((a, b) => a.sortKey - b.sortKey);
      setRemindersByPatient((prev) => ({ ...prev, [patientId]: reminders }));

      setCoordinationMetric(metricRes.data?.[0] || null);
    } catch (err) {
      console.error("[PatientContext] Failed to load patient detail:", err);
    } finally {
      setIsDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- see note above
    if (currentPatientId) loadPatientDetail(currentPatientId);
  }, [currentPatientId, loadPatientDetail]);

  const currentPatient = patients.find((p) => p.id === currentPatientId) ?? patients[0] ?? null;
  const currentMedications = medicationsByPatient[currentPatientId] ?? [];
  const currentLogs = logsByPatient[currentPatientId] ?? [];
  const todaysReminders = remindersByPatient[currentPatientId] ?? [];

  // NOTE on writes: reads above come straight from Supabase. Add/Edit flows
  // (Add Patient, Add Medication, Add Daily Care) still only update this
  // local state for now — they don't INSERT into Supabase yet. That's
  // intentional scoping: each of those pages gets its own pass to wire
  // writes + validation + optimistic updates properly, rather than bolting
  // it on here. Until then, anything added will reset on page reload.
  const setCurrentMedications = (medsOrFn) =>
    setMedicationsByPatient((prev) => ({
      ...prev,
      [currentPatientId]: typeof medsOrFn === "function" ? medsOrFn(prev[currentPatientId] ?? []) : medsOrFn,
    }));

  const setCurrentLogs = (logsOrFn) =>
    setLogsByPatient((prev) => ({
      ...prev,
      [currentPatientId]: typeof logsOrFn === "function" ? logsOrFn(prev[currentPatientId] ?? []) : logsOrFn,
    }));

  return (
    <PatientContext.Provider
      value={{
        patients,
        setPatients,
        currentPatient,
        currentPatientId,
        setCurrentPatientId,
        currentMedications,
        setCurrentMedications,
        currentLogs,
        setCurrentLogs,
        todaysReminders,
        careCircle,
        coordinationMetric,
        isLoading,
        isDetailLoading,
        loadError,
        reloadPatients: loadPatients,
      }}
    >
      {children}
    </PatientContext.Provider>
  );
}

// Standard context pattern: exporting the Provider and its matching hook
// from the same file is the recommended shape here — HMR purity isn't
// worth splitting this into two files.
// eslint-disable-next-line react-refresh/only-export-components
export function usePatient() {
  const ctx = useContext(PatientContext);
  if (!ctx) throw new Error("usePatient must be used inside <PatientProvider>");
  return ctx;
}
