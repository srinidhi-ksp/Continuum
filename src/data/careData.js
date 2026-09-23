// src/data/careData.js
// Mock data for the Daily Care page + Dashboard "Today's Care" /
// "Care Coordination" cards. Mirrors `daily_care_log`, `medication`,
// `medication_schedule`, and `coordination_metric`.

export const medications = [
  {
    id: "44444444-4444-4444-4444-444444444401",
    patientId: "22222222-2222-2222-2222-222222222201",
    name: "Donepezil",
    dosage: "10mg",
    instruction: "Take after dinner, once daily",
    active: true,
    schedule: [{ timeOfDay: "20:00", daysOfWeek: [0, 1, 2, 3, 4, 5, 6] }],
  },
  {
    id: "44444444-4444-4444-4444-444444444402",
    patientId: "22222222-2222-2222-2222-222222222202",
    name: "Levodopa/Carbidopa",
    dosage: "100mg/25mg",
    instruction: "Take with food, three times daily",
    active: true,
    schedule: [
      { timeOfDay: "08:00", daysOfWeek: [0, 1, 2, 3, 4, 5, 6] },
      { timeOfDay: "14:00", daysOfWeek: [0, 1, 2, 3, 4, 5, 6] },
      { timeOfDay: "20:00", daysOfWeek: [0, 1, 2, 3, 4, 5, 6] },
    ],
  },
];

// "Today's reminders" list — mix of completed / upcoming / missed
export const todaysReminders = [
  {
    id: "r-lakshmi-01",
    patientId: "22222222-2222-2222-2222-222222222201",
    title: "Donepezil",
    subtitle: "Medication · 10mg",
    type: "medication",
    time: "8:00 PM",
    status: "upcoming",
  },
  {
    id: "r-lakshmi-02",
    patientId: "22222222-2222-2222-2222-222222222201",
    title: "Lunch",
    subtitle: "Meal · Completed",
    type: "meal",
    time: "1:00 PM",
    status: "completed",
  },
  {
    id: "r-lakshmi-03",
    patientId: "22222222-2222-2222-2222-222222222201",
    title: "Evening walk",
    subtitle: "Mobility · 15 minutes",
    type: "mobility",
    time: "6:30 PM",
    status: "upcoming",
  },
  {
    id: "r-ramesh-01",
    patientId: "22222222-2222-2222-2222-222222222202",
    title: "Levodopa/Carbidopa",
    subtitle: "Medication · 100mg/25mg",
    type: "medication",
    time: "2:00 PM",
    status: "missed",
  },
  {
    id: "r-ramesh-02",
    patientId: "22222222-2222-2222-2222-222222222202",
    title: "Physiotherapy check-in",
    subtitle: "Mobility · 20 minutes",
    type: "mobility",
    time: "5:00 PM",
    status: "upcoming",
  },
];

export const getRemindersForPatient = (patientId) => {
  const list = todaysReminders.filter((r) => r.patientId === patientId);
  return {
    reminders: list,
    total: list.length,
    completed: list.filter((r) => r.status === "completed").length,
    upcoming: list.filter((r) => r.status === "upcoming").length,
    missed: list.filter((r) => r.status === "missed").length,
  };
};

// Daily care log entries (meals, sleep, symptoms)
export const dailyCareLogs = [
  {
    id: "99999999-9999-9999-9999-999999999901",
    patientId: "22222222-2222-2222-2222-222222222201",
    caregiverId: "11111111-1111-1111-1111-111111111103",
    type: "meal",
    quantity: "Full portion",
    symptoms: null,
    notes: "Ate rice, sambar, and vegetables without assistance",
    sleepHours: null,
    createdAt: "2026-08-18T19:30:00+05:30",
  },
  {
    id: "99999999-9999-9999-9999-999999999902",
    patientId: "22222222-2222-2222-2222-222222222201",
    caregiverId: "11111111-1111-1111-1111-111111111102",
    type: "sleep",
    quantity: null,
    symptoms: null,
    notes: "Restful night, no wandering episodes",
    sleepHours: 7.3,
    createdAt: "2026-08-18T07:10:00+05:30",
  },
  {
    id: "99999999-9999-9999-9999-999999999903",
    patientId: "22222222-2222-2222-2222-222222222202",
    caregiverId: "11111111-1111-1111-1111-111111111101",
    type: "medication",
    quantity: null,
    symptoms: "Increased hand tremor",
    notes: "Afternoon dose missed — Ramesh was asleep, will re-dose per doctor guidance",
    sleepHours: null,
    createdAt: "2026-08-18T14:15:00+05:30",
  },
];

// Care Coordination Score — one entry per patient (drives the ring + AI insight)
export const coordinationMetrics = [
  {
    id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01",
    patientId: "22222222-2222-2222-2222-222222222201",
    caregiverId: "11111111-1111-1111-1111-111111111101",
    score: 78,
    riskLevel: "moderate",
    recommendation: "Your care coordination looks manageable today.",
    aiInsight: {
      title: "Care Pattern",
      message:
        "Your care activity has been consistent today. Medication and meal entries were logged on time.",
      tag: "3 care activities completed",
    },
    predictedAt: "2026-08-18T20:10:00+05:30",
  },
  {
    id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02",
    patientId: "22222222-2222-2222-2222-222222222202",
    caregiverId: "11111111-1111-1111-1111-111111111101",
    score: 42,
    riskLevel: "elevated",
    recommendation:
      "Workload is elevated — consider redistributing tasks among caregivers.",
    aiInsight: {
      title: "Priority Now",
      message:
        "Your dashboard has been simplified because your coordination workload is currently elevated.",
      tag: "Redistribution suggested",
      priorityTasks: [
        { icon: "medication", label: "Medication", detail: "Due in 20m" },
        { icon: "log", label: "Missed log", detail: "Log now" },
        { icon: "team", label: "Redistribution", detail: "Suggested" },
      ],
    },
    predictedAt: "2026-08-18T14:16:00+05:30",
  },
];

export const getCoordinationMetricForPatient = (patientId) =>
  coordinationMetrics.find((m) => m.patientId === patientId);