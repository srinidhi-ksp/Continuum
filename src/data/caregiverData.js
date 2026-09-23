// src/data/caregiverData.js
// Mock caregiver records — mirrors the `caregiver` + `caregiver_pat` tables.

export const caregivers = [
  {
    id: "11111111-1111-1111-1111-111111111101",
    name: "Srinidhi Ravi",
    avatarInitial: "S",
    email: "srinidhi@continuum.app",
    phone: "+91 98765 43210",
    role: "primary",
    isCurrentUser: true,
  },
  {
    id: "11111111-1111-1111-1111-111111111102",
    name: "Priya Krishnan",
    avatarInitial: "P",
    email: "priya.krishnan@gmail.com",
    phone: "+91 90000 11122",
    role: "family",
    isCurrentUser: false,
  },
  {
    id: "11111111-1111-1111-1111-111111111103",
    name: "Arun Krishnan",
    avatarInitial: "A",
    email: "arun.krishnan@gmail.com",
    phone: "+91 90000 33344",
    role: "family",
    isCurrentUser: false,
  },
];

export const currentCaregiver = caregivers.find((c) => c.isCurrentUser);

export const getCaregiverById = (id) => caregivers.find((c) => c.id === id);

// caregiver_pat — who is in which patient's care circle
export const careCircleMemberships = [
  {
    caregiverId: "11111111-1111-1111-1111-111111111101",
    patientId: "22222222-2222-2222-2222-222222222201",
    role: "primary",
    joinedAt: "2026-05-20T00:00:00+05:30",
  },
  {
    caregiverId: "11111111-1111-1111-1111-111111111102",
    patientId: "22222222-2222-2222-2222-222222222201",
    role: "family",
    joinedAt: "2026-05-30T00:00:00+05:30",
  },
  {
    caregiverId: "11111111-1111-1111-1111-111111111103",
    patientId: "22222222-2222-2222-2222-222222222201",
    role: "family",
    joinedAt: "2026-05-30T00:00:00+05:30",
  },
  {
    caregiverId: "11111111-1111-1111-1111-111111111101",
    patientId: "22222222-2222-2222-2222-222222222202",
    role: "primary",
    joinedAt: "2026-06-19T00:00:00+05:30",
  },
];

// Care circle for a given patient, resolved to full caregiver objects
export const getCareCircleForPatient = (patientId) =>
  careCircleMemberships
    .filter((m) => m.patientId === patientId)
    .map((m) => ({ ...getCaregiverById(m.caregiverId), circleRole: m.role, joinedAt: m.joinedAt }));