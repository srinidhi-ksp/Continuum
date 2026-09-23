// Fixtures mirror continuum_seed.sql exactly (same ids/values) so this
// smoke test exercises the same two-patient, two-risk-level scenario the
// real Supabase project has, not an imaginary one.

export const CURRENT_CAREGIVER_ID = "11111111-1111-1111-1111-111111111101";

export const caregivers = [
  { caregiver_id: "11111111-1111-1111-1111-111111111101", full_name: "Srinidhi Ravi", email: "srinidhi@continuum.app", phone: "+91 98765 43210", profile_image: null },
  { caregiver_id: "11111111-1111-1111-1111-111111111102", full_name: "Priya Krishnan", email: "priya.krishnan@gmail.com", phone: "+91 90000 11122", profile_image: null },
  { caregiver_id: "11111111-1111-1111-1111-111111111103", full_name: "Arun Krishnan", email: "arun.krishnan@gmail.com", phone: "+91 90000 33344", profile_image: null },
];

export let patients = [
  {
    patient_id: "22222222-2222-2222-2222-222222222201",
    full_name: "Lakshmi Krishnan",
    dob: "1954-03-12",
    gender: "Female",
    condition_type: "Dementia",
    blood_group: "B+",
    allergies: "Penicillin",
    phone: "+91 98765 43210",
    medical_notes: "Mild cognitive decline.",
  },
  {
    patient_id: "22222222-2222-2222-2222-222222222202",
    full_name: "Ramesh Iyer",
    dob: "1958-07-04",
    gender: "Male",
    condition_type: "Parkinson's Disease",
    blood_group: "O+",
    allergies: "None known",
    phone: "+91 90000 55667",
    medical_notes: "Elevated fall risk.",
  },
];

export let caregiverPat = [
  { caregiver_id: "11111111-1111-1111-1111-111111111101", patient_id: "22222222-2222-2222-2222-222222222201", role: "primary", joining_at: "2026-05-20", removed_at: null },
  { caregiver_id: "11111111-1111-1111-1111-111111111102", patient_id: "22222222-2222-2222-2222-222222222201", role: "family", joining_at: "2026-05-30", removed_at: null },
  { caregiver_id: "11111111-1111-1111-1111-111111111103", patient_id: "22222222-2222-2222-2222-222222222201", role: "family", joining_at: "2026-05-30", removed_at: null },
  { caregiver_id: "11111111-1111-1111-1111-111111111101", patient_id: "22222222-2222-2222-2222-222222222202", role: "primary", joining_at: "2026-06-19", removed_at: null },
];

export let emergencyContacts = [
  { contact_id: "33333333-3333-3333-3333-333333333301", patient_id: "22222222-2222-2222-2222-222222222201", name: "Priya Krishnan", relation: "Daughter", phone: "+91 90000 11122", priority: 1 },
  { contact_id: "33333333-3333-3333-3333-333333333303", patient_id: "22222222-2222-2222-2222-222222222202", name: "Lavanya Iyer", relation: "Wife", phone: "+91 90000 99887", priority: 1 },
];

export let medications = [
  { medication_id: "44444444-4444-4444-4444-444444444401", patient_id: "22222222-2222-2222-2222-222222222201", medicine_name: "Donepezil", brand: "Aricept", dosage: "10mg", instruction: "Take after dinner", purpose: "Cognitive symptom management in Dementia", frequency: "Once daily", start_date: "2026-01-10", end_date: null, active: true },
  { medication_id: "44444444-4444-4444-4444-444444444402", patient_id: "22222222-2222-2222-2222-222222222202", medicine_name: "Levodopa/Carbidopa", brand: "Sinemet", dosage: "100mg/25mg", instruction: "Take with food", purpose: "Motor symptom control", frequency: "3x daily", start_date: "2026-03-01", end_date: null, active: true },
];

export let medicationSchedules = [
  { schedule_id: "55555555-5555-5555-5555-555555555501", medication_id: "44444444-4444-4444-4444-444444444401", time_of_day: "20:00:00" },
  { schedule_id: "55555555-5555-5555-5555-555555555502", medication_id: "44444444-4444-4444-4444-444444444402", time_of_day: "08:00:00" },
  { schedule_id: "55555555-5555-5555-5555-555555555503", medication_id: "44444444-4444-4444-4444-444444444402", time_of_day: "14:00:00" },
  { schedule_id: "55555555-5555-5555-5555-555555555504", medication_id: "44444444-4444-4444-4444-444444444402", time_of_day: "20:00:00" },
];

export let dailyCareLogs = [
  { log_id: "99999999-9999-9999-9999-999999999901", patient_id: "22222222-2222-2222-2222-222222222201", caregiver_id: "11111111-1111-1111-1111-111111111103", type: "meal", quantity: "Full portion", symptoms: null, notes: "Ate well.", sleep_hours: null, created_at: new Date().toISOString() },
  { log_id: "99999999-9999-9999-9999-999999999902", patient_id: "22222222-2222-2222-2222-222222222201", caregiver_id: "11111111-1111-1111-1111-111111111102", type: "sleep", quantity: null, symptoms: null, notes: "Restful night.", sleep_hours: 7.3, created_at: new Date().toISOString() },
];

export let coordinationMetrics = [
  { metric_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01", caregiver_id: "11111111-1111-1111-1111-111111111101", patient_id: "22222222-2222-2222-2222-222222222201", score: 78, risk_level: "moderate", recommendation: "Care coordination looks manageable today.", predicted_at: new Date().toISOString() },
  { metric_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02", caregiver_id: "11111111-1111-1111-1111-111111111101", patient_id: "22222222-2222-2222-2222-222222222202", score: 42, risk_level: "elevated", recommendation: "Workload is elevated — consider redistributing tasks.", predicted_at: new Date().toISOString() },
];

export function resetFixtures() {
  // vitest re-imports the module fresh per test file by default, but this
  // is here in case a test needs to reset mutated arrays (inserts) mid-file.
}
