// src/data/patientData.js
// Mock patient records — mirrors the `patient` + `caregiver_pat` tables in Supabase.
// Same UUIDs as continuum_seed.sql, so swapping this for a live Supabase
// query later is a drop-in replacement.

export const patients = [
  {
    id: "22222222-2222-2222-2222-222222222201",
    name: "Lakshmi Krishnan",
    avatarInitial: "L",
    dob: "1954-03-12",
    age: 72,
    gender: "Female",
    conditionType: "Dementia",
    bloodGroup: "B+",
    allergies: "Penicillin",
    medicalNotes:
      "Mild cognitive decline. Needs medication reminders and daily supervision.",
    careCircleActive: true,
    caregiverCount: 3,
    lastActivityMinutesAgo: 8,
    emergencyContacts: [
      {
        id: "33333333-3333-3333-3333-333333333301",
        name: "Priya Krishnan",
        relation: "Daughter",
        phone: "+91 90000 11122",
        priority: 1,
      },
      {
        id: "33333333-3333-3333-3333-333333333302",
        name: "Dr. Meenakshi Sundaram",
        relation: "Neurologist",
        phone: "+91 44 2345 6789",
        priority: 2,
      },
    ],
  },
  {
    id: "22222222-2222-2222-2222-222222222202",
    name: "Ramesh Iyer",
    avatarInitial: "R",
    dob: "1958-07-04",
    age: 68,
    gender: "Male",
    conditionType: "Parkinson's Disease",
    bloodGroup: "O+",
    allergies: "None known",
    medicalNotes:
      "Tremors affecting mobility. Elevated fall risk; coordination workload currently high.",
    careCircleActive: true,
    caregiverCount: 1,
    lastActivityMinutesAgo: 45,
    emergencyContacts: [
      {
        id: "33333333-3333-3333-3333-333333333303",
        name: "Lavanya Iyer",
        relation: "Wife",
        phone: "+91 90000 99887",
        priority: 1,
      },
    ],
  },
];

// The patient shown on Dashboard/Patient/Daily Care/Timeline by default
export const currentPatient = patients[0];

export const getPatientById = (id) => patients.find((p) => p.id === id);