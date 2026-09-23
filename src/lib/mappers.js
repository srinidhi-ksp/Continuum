// Small, pure helpers used to turn raw Supabase rows into the exact shape
// the pages already expect. Keeping this mapping in one place means a page
// never has to know or care whether its data came from Supabase, a mock
// array, or anything else.

export function computeAge(dob) {
  if (!dob) return null;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;
  const diffMs = Date.now() - birth.getTime();
  return Math.floor(diffMs / (365.25 * 24 * 3600 * 1000));
}

export function relativeTime(dateString) {
  if (!dateString) return "No activity yet";
  const then = new Date(dateString).getTime();
  if (Number.isNaN(then)) return "No activity yet";
  const diffMin = Math.round((Date.now() - then) / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr${diffHr > 1 ? "s" : ""} ago`;
  const diffDay = Math.round(diffHr / 24);
  return `${diffDay} day${diffDay > 1 ? "s" : ""} ago`;
}

export function formatClockTime(timeStr) {
  // "20:00:00" -> "08:00 PM"
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = ((h + 11) % 12) + 1;
  return `${String(hour12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${period}`;
}

export function deriveFrequencyLabel(scheduleCount) {
  if (scheduleCount <= 0) return "As needed";
  if (scheduleCount === 1) return "Once daily";
  if (scheduleCount === 2) return "Twice daily";
  return `${scheduleCount}x daily`;
}

export function mapMedicationRow(row, schedules = []) {
  const sortedTimes = [...schedules]
    .sort((a, b) => (a.time_of_day || "").localeCompare(b.time_of_day || ""))
    .map((s) => formatClockTime(s.time_of_day));

  return {
    id: row.medication_id,
    name: row.medicine_name,
    brand: row.brand || "",
    dosage: row.dosage || "",
    frequency: row.frequency || deriveFrequencyLabel(schedules.length),
    scheduledTime: sortedTimes.join(", "),
    startDate: row.start_date || "",
    endDate: row.end_date || "",
    purpose: row.purpose || row.instruction || "",
    active: !!row.active,
  };
}

// extras carries everything that needs a separate query (care circle size,
// latest coordination metric, emergency contact, today's completion, etc.)
// so this function stays a plain, testable mapper with no fetching in it.
export function mapPatientRow(row, extras = {}) {
  const {
    caregiverCount = 0,
    careCircleActive = false,
    latestMetric = null,
    medsTaken = 0,
    medsTotal = 0,
    careCompletion = 0,
    lastActivityAt = null,
    emergencyContact = null,
    carePlan = [],
  } = extras;

  return {
    id: row.patient_id,
    name: row.full_name,
    dob: row.dob,
    age: computeAge(row.dob),
    gender: row.gender,
    condition: row.condition_type,
    status: latestMetric?.risk_level === "elevated" ? "Attention" : "Stable",
    careCompletion,
    medication: `${medsTaken} / ${medsTotal}`,
    lastActivity: relativeTime(lastActivityAt),
    phone: row.phone || "",
    bloodGroup: row.blood_group || "",
    allergies: row.allergies || "",
    emergencyContact: emergencyContact?.name || "Not added",
    relationship: emergencyContact?.relation || "Not added",
    emergencyPhone: emergencyContact?.phone || "",
    notes: row.medical_notes || "No notes added.",
    careCircleActive,
    caregiverCount,
    carePlan,
  };
}

// Human labels for the daily_care_log.type enum-ish values, used by the
// Dashboard activity feed and anywhere else that renders a log entry.
export const CARE_LOG_LABELS = {
  medication: "Medication taken",
  meal: "Meal logged",
  sleep: "Sleep logged",
  mobility: "Mobility logged",
  symptom: "Symptom observed",
  mood: "Mood observed",
  note: "Note added",
};

export function careLogTitle(log) {
  return CARE_LOG_LABELS[log.type] || "Care activity logged";
}
