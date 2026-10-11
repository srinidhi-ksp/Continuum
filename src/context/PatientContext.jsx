import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";
import { mapPatientRow } from "../lib/mappers";
import { fetchCareCircleMembers } from "../lib/careCircleApi";
import { fetchMedications } from "../lib/medicationApi";
import { fetchDailyCareLogs } from "../lib/dailyCareApi";
import { useAuth } from "./AuthContext";

const PatientContext = createContext(null);

export function PatientProvider({ children }) {
  const { user } = useAuth();
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

  // ── Every patient linked to the authenticated caregiver ─────────────
  const loadPatients = useCallback(async () => {
    const activeCaregiverId = user?.id;

    // Don't attempt to load if no real caregiver is authenticated
    // (the default hardcoded ID starts with "11111111" for dev/testing only)
    if (!activeCaregiverId) {
      setPatients([]);
      setCurrentPatientId(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLoadError(null);
    try {
      const { data: links, error: linkError } = await supabase
        .from("caregiver_pat")
        .select("patient_id")
        .eq("caregiver_id", activeCaregiverId)
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
              supabase
                .from("caregiver_pat")
                .select("caregiver_id")
                .eq("patient_id", row.patient_id)
                .is("removed_at", null),
              supabase
                .from("coordination_metric")
                .select("*")
                .eq("patient_id", row.patient_id)
                .order("predicted_at", { ascending: false })
                .limit(1),
              supabase
                .from("emergency_contact")
                .select("*")
                .eq("patient_id", row.patient_id)
                .order("priority", { ascending: true })
                .limit(1),
              supabase
                .from("medication")
                .select("medication_id, active")
                .eq("patient_id", row.patient_id),
              supabase
                .from("daily_care_log")
                .select("created_at")
                .eq("patient_id", row.patient_id)
                .order("created_at", { ascending: false })
                .limit(1),
              supabase
                .from("daily_care_log")
                .select("log_id", { count: "exact", head: true })
                .eq("patient_id", row.patient_id)
                .eq("type", "medication")
                .gte("created_at", todayStart.toISOString()),
              supabase
                .from("daily_care_log")
                .select("log_id", { count: "exact", head: true })
                .eq("patient_id", row.patient_id)
                .gte("created_at", todayStart.toISOString()),
            ]);

          const activeMeds = (meds.data || []).filter((m) => m.active);
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
  }, [user?.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadPatients();
  }, [loadPatients]);

  // ── Care circle, medications, logs, reminders, coordination score ──────
  const loadPatientDetail = useCallback(async (patientId) => {
    if (!patientId) return;
    setIsDetailLoading(true);
    try {
      const [members, medRowsMapped, logRows, metricRes] = await Promise.all([
        fetchCareCircleMembers(patientId),
        fetchMedications(patientId),
        fetchDailyCareLogs(patientId, 30),
        supabase
          .from("coordination_metric")
          .select("*")
          .eq("patient_id", patientId)
          .order("predicted_at", { ascending: false })
          .limit(1),
      ]);

      setCareCircle(members);

      setMedicationsByPatient((prev) => ({
        ...prev,
        [patientId]: medRowsMapped,
      }));

      setLogsByPatient((prev) => ({ ...prev, [patientId]: logRows }));

      // Build reminders list
      const today = new Date();
      const reminders = [];
      medRowsMapped
        .filter((m) => m.active)
        .forEach((m) => {
          const times = m.scheduledTime ? m.scheduledTime.split(",") : ["08:00 AM"];
          times.forEach((timeStr, idx) => {
            const cleanTime = timeStr.trim() || "08:00 AM";
            const taken = logRows.find(
              (l) =>
                (l.type === "medication" || l.type === "Medication") &&
                new Date(l.created_at).toDateString() === today.toDateString() &&
                (l.notes?.includes(m.name) || l.quantity?.includes(m.name))
            );

            reminders.push({
              id: `${m.id}-${idx}`,
              title: m.name,
              subtitle: `Medication · ${m.dosage}`,
              time: cleanTime,
              status: taken ? "completed" : "upcoming",
              sortKey: idx,
            });
          });
        });
      setRemindersByPatient((prev) => ({ ...prev, [patientId]: reminders }));

      setCoordinationMetric(metricRes.data?.[0] || null);
    } catch (err) {
      console.error("[PatientContext] Failed to load patient detail:", err);
    } finally {
      setIsDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (currentPatientId) loadPatientDetail(currentPatientId);
  }, [currentPatientId, loadPatientDetail]);

  const currentPatient = patients.find((p) => p.id === currentPatientId) ?? patients[0] ?? null;
  const currentMedications = medicationsByPatient[currentPatientId] ?? [];
  const currentLogs = logsByPatient[currentPatientId] ?? [];
  const todaysReminders = remindersByPatient[currentPatientId] ?? [];

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
        reloadPatientDetail: () => currentPatientId && loadPatientDetail(currentPatientId),
      }}
    >
      {children}
    </PatientContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePatient() {
  const ctx = useContext(PatientContext);
  if (!ctx) throw new Error("usePatient must be used inside <PatientProvider>");
  return ctx;
}
