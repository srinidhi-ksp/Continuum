// src/data/timelineData.js
// Mock data for the Timeline page + Dashboard "Recent Activity" card.
// Mirrors `time_event` + `timeline_commend`.

export const timelineEvents = [
  {
    id: "66666666-6666-6666-6666-666666666601",
    patientId: "22222222-2222-2222-2222-222222222201",
    type: "medication",
    icon: "pill",
    title: "Medication taken",
    subtitle: "Donepezil 10mg",
    actor: "Priya",
    actorId: "11111111-1111-1111-1111-111111111102",
    time: "8:05 PM",
    createdAt: "2026-08-18T20:05:00+05:30",
    status: "done",
    comments: [
      {
        id: "77777777-7777-7777-7777-777777777701",
        author: "Srinidhi",
        text: "Confirmed with Priya — taken on time, no side effects noted.",
        time: "8:10 PM",
      },
    ],
  },
  {
    id: "66666666-6666-6666-6666-666666666602",
    patientId: "22222222-2222-2222-2222-222222222201",
    type: "meal",
    icon: "meal",
    title: "Dinner completed",
    subtitle: "Meal logged successfully",
    actor: "Arun",
    actorId: "11111111-1111-1111-1111-111111111103",
    time: "7:30 PM",
    createdAt: "2026-08-18T19:30:00+05:30",
    status: "done",
    comments: [],
  },
  {
    id: "66666666-6666-6666-6666-666666666603",
    patientId: "22222222-2222-2222-2222-222222222201",
    type: "sleep",
    icon: "moon",
    title: "Sleep logged",
    subtitle: "7 hours 20 minutes",
    actor: "Priya",
    actorId: "11111111-1111-1111-1111-111111111102",
    time: "7:10 AM",
    createdAt: "2026-08-18T07:10:00+05:30",
    status: "done",
    comments: [],
  },
  {
    id: "66666666-6666-6666-6666-666666666604",
    patientId: "22222222-2222-2222-2222-222222222202",
    type: "medication",
    icon: "pill",
    title: "Missed medication log",
    subtitle: "Levodopa/Carbidopa 100mg/25mg — afternoon dose",
    actor: "Srinidhi",
    actorId: "11111111-1111-1111-1111-111111111101",
    time: "2:15 PM",
    createdAt: "2026-08-18T14:15:00+05:30",
    status: "flagged",
    comments: [
      {
        id: "77777777-7777-7777-7777-777777777702",
        author: "Srinidhi",
        text: "Flagged for Lavanya to log afternoon dose — following up by call.",
        time: "2:20 PM",
      },
    ],
  },
];

export const getTimelineForPatient = (patientId) =>
  timelineEvents
    .filter((e) => e.patientId === patientId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

// Convenience: just the most recent 3, for the Dashboard "Recent Activity" card
export const getRecentActivity = (patientId, count = 3) =>
  getTimelineForPatient(patientId).slice(0, count);