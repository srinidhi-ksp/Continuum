-- =====================================================================
-- CONTINUUM — 04 COMPREHENSIVE SEED (CLEAN & ROBUST)
-- Two care circles: Prema Nellaiappan (Dementia) + Naresh Iyer (Stroke)
-- 12 days of realistic daily care logs, tasks, appointments
-- Southern India healthcare scenario
--
-- AUTHENTICATION RULES:
-- * NO PASSWORDS ARE HARDCODED OR OVERWRITTEN. Auth owns passwords.
-- * Caregiver profiles are cleanly linked to auth.users if already registered.
-- * Safe to re-run: cleanly deletes both patients' prior demo records first.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

begin;

-- =====================================================================
-- 0. CAREGIVERS SETUP & AUTH LINKING
-- =====================================================================
-- Auto-confirm any already registered auth users so they can log in
-- without email confirmation delays, while PRESERVING their real passwords.
update auth.users
set email_confirmed_at = coalesce(email_confirmed_at, now()),
    updated_at = now()
where lower(email) in (
  'shanmugasundarisri006@gmail.com', 'srinidhiksp050@gmail.com', 'srini3d4548@gmail.com',
  'shreyaabalas@gmail.com', 'fjbegining@gmail.com', '96ramya96@gmail.com'
);

-- Insert or link profiles in public.caregiver
insert into public.caregiver (auth_user_id, full_name, email, phone, language, created_at, updated_at)
values
  ((select id from auth.users where lower(email) = 'shanmugasundarisri006@gmail.com' limit 1),
   'Shanmuga Sundari', 'shanmugasundarisri006@gmail.com', '+91 99945 10170', 'ta', now(), now()),
  ((select id from auth.users where lower(email) = 'srinidhiksp050@gmail.com' limit 1),
   'Srinidhi Krishnamoorthy', 'srinidhiksp050@gmail.com', '+91 63802 16617', 'en', now(), now()),
  ((select id from auth.users where lower(email) = 'srini3d4548@gmail.com' limit 1),
   'Nithesh Kumar', 'srini3d4548@gmail.com', '+91 98765 01234', 'ta', now(), now()),
  ((select id from auth.users where lower(email) = 'shreyaabalas@gmail.com' limit 1),
   'Shreyaa Bala', 'shreyaabalas@gmail.com', '+91 89259 00617', 'en', now(), now()),
  ((select id from auth.users where lower(email) = 'fjbegining@gmail.com' limit 1),
   'Sarvesh', 'fjbegining@gmail.com', '+91 91234 56780', 'en', now(), now()),
  ((select id from auth.users where lower(email) = '96ramya96@gmail.com' limit 1),
   'Ramya', '96ramya96@gmail.com', '+91 90123 45678', 'en', now(), now())
on conflict (email) do update set
  auth_user_id = coalesce(excluded.auth_user_id, public.caregiver.auth_user_id),
  full_name = excluded.full_name,
  phone = excluded.phone,
  language = excluded.language,
  updated_at = now();

-- Clean prior demo records for both patient IDs safely
do $$
declare
  v_p1 uuid := '33333333-3333-3333-3333-333333333301';
  v_p1_old uuid := '33333333-3333-4333-8333-333333333301';
  v_p2 uuid := '33333333-3333-3333-3333-333333333302';
begin
  delete from public.care_task where patient_id in (v_p1, v_p1_old, v_p2);
  delete from public.daily_care_log where patient_id in (v_p1, v_p1_old, v_p2);
  delete from public.timeline_commend where event_id in
    (select event_id from public.time_event where patient_id in (v_p1, v_p1_old, v_p2));
  delete from public.time_event where patient_id in (v_p1, v_p1_old, v_p2);
  delete from public.coordination_metric where patient_id in (v_p1, v_p1_old, v_p2);
  delete from public.appointment where patient_id in (v_p1, v_p1_old, v_p2);
  delete from public.health_report where patient_id in (v_p1, v_p1_old, v_p2);
  delete from public.emergency_contact where patient_id in (v_p1, v_p1_old, v_p2);
  delete from public.caregiver_pat where patient_id in (v_p1, v_p1_old, v_p2);
  
  delete from public.medication_schedule_day_of_week where schedule_id in (
    select ms.schedule_id from public.medication_schedule ms
    join public.medication m on ms.medication_id = m.medication_id
    where m.patient_id in (v_p1, v_p1_old, v_p2)
  );
  delete from public.medication_schedule where medication_id in (
    select medication_id from public.medication where patient_id in (v_p1, v_p1_old, v_p2)
  );
  delete from public.medication where patient_id in (v_p1, v_p1_old, v_p2);
  delete from public.patient where patient_id in (v_p1, v_p1_old, v_p2);

  delete from public.caregiver_sleep_log where caregiver_id in (
    select caregiver_id from public.caregiver where lower(email) in (
      'shanmugasundarisri006@gmail.com', 'srinidhiksp050@gmail.com', 'srini3d4548@gmail.com',
      'shreyaabalas@gmail.com', 'fjbegining@gmail.com', '96ramya96@gmail.com'
    )
  );
  delete from public.notification where caregiver_id in (
    select caregiver_id from public.caregiver where lower(email) in (
      'shanmugasundarisri006@gmail.com', 'srinidhiksp050@gmail.com', 'srini3d4548@gmail.com',
      'shreyaabalas@gmail.com', 'fjbegining@gmail.com', '96ramya96@gmail.com'
    )
  );
end $$;

-- =====================================================================
-- CIRCLE 1: PREMA NELLAIAPPAN (Dementia)
-- =====================================================================

-- 1. PATIENT: Prema Nellaiappan (DOB 5-Apr-1978, age 46, Dementia)
insert into patient (patient_id, full_name, dob, gender, condition_type, time_zone, blood_group, allergies, phone, medical_notes, created_by) values
('33333333-3333-3333-3333-333333333301', 'Prema Nellaiappan', '1978-04-05', 'Female', 'Dementia', 'Asia/Kolkata', 'O+', 'Penicillin', '+91 98765 43210',
 'Mild cognitive decline with early dementia. Needs medication reminders, supervision during meals, and daily activity engagement. No history of falls but reduced mobility.',
 (select caregiver_id from caregiver where lower(email) = 'shanmugasundarisri006@gmail.com'));

-- 2. CIRCLE MEMBERSHIP
insert into caregiver_pat (caregiver_id, patient_id, role, status, relationship, alert_preference, alert_priority, assigned_responsibilities, joining_at) values
((select caregiver_id from caregiver where lower(email) = 'shanmugasundarisri006@gmail.com'),
 '33333333-3333-3333-3333-333333333301', 'primary', 'active', 'Daughter', 'all', 1, '{care coordination,appointments,medication management}', now() - interval '45 days'),
((select caregiver_id from caregiver where lower(email) = 'srinidhiksp050@gmail.com'),
 '33333333-3333-3333-3333-333333333301', 'family', 'active', 'Granddaughter', 'important', 2, '{meals,evening care,sleep supervision}', now() - interval '40 days'),
((select caregiver_id from caregiver where lower(email) = 'srini3d4548@gmail.com'),
 '33333333-3333-3333-3333-333333333301', 'external', 'active', 'External Caregiver', 'important', 3, '{daytime supervision,activity engagement,daily logs}', now() - interval '35 days');

-- 3. EMERGENCY CONTACTS
insert into emergency_contact (patient_id, name, relation, phone, priority) values
('33333333-3333-3333-3333-333333333301', 'Shanmuga Sundari', 'Daughter', '+91 99945 10170', 1),
('33333333-3333-3333-3333-333333333301', 'Dr. Meenakshi Sundaram', 'Neurologist', '+91 44 2345 6789', 2),
('33333333-3333-3333-3333-333333333301', 'Apollo Hospitals Main', 'Hospital', '+91 44 2829 3333', 3);

-- 4. MEDICATIONS (Dementia regimen: Aricept + Memantine + Vitamin B12)
insert into medication (medication_id, patient_id, medicine_name, brand, dosage, instruction, purpose, frequency, start_date, active) values
('44444444-4444-4444-4444-444444444401', '33333333-3333-3333-3333-333333333301', 'Donepezil', 'Aricept', '10mg', 'Take after dinner with water', 'Cognitive symptom management', 'Once daily', current_date - 90, true),
('44444444-4444-4444-4444-444444444402', '33333333-3333-3333-3333-333333333301', 'Memantine', 'Admenta', '10mg', 'Take after breakfast with water', 'Cognitive symptom management', 'Once daily', current_date - 75, true),
('44444444-4444-4444-4444-444444444403', '33333333-3333-3333-3333-333333333301', 'Vitamin B12', 'B-Complex', '1000mcg', 'Oral tablet, once daily', 'Nutritional support', 'Once daily', current_date - 60, true);

insert into medication_schedule (schedule_id, medication_id, time_of_day) values
('55555555-5555-5555-5555-555555555501', '44444444-4444-4444-4444-444444444401', '20:30'),
('55555555-5555-5555-5555-555555555502', '44444444-4444-4444-4444-444444444402', '08:00'),
('55555555-5555-5555-5555-555555555503', '44444444-4444-4444-4444-444444444403', '12:00');

insert into medication_schedule_day_of_week (schedule_id, day_of_week)
select s.schedule_id, d from medication_schedule s, generate_series(0,6) d
where s.schedule_id in ('55555555-5555-5555-5555-555555555501','55555555-5555-5555-5555-555555555502','55555555-5555-5555-5555-555555555503');

-- 5. APPOINTMENTS (Recent + upcoming)
insert into appointment (patient_id, created_by, doctor_name, hospital, appointment_date, notes) values
('33333333-3333-3333-3333-333333333301', (select caregiver_id from caregiver where lower(email) = 'shanmugasundarisri006@gmail.com'),
 'Dr. Meenakshi Sundaram', 'Apollo Hospitals, Chennai', current_date + interval '2 days' + time '10:30', 'Quarterly neurology review. Bring medication log and observation notes.'),
('33333333-3333-3333-3333-333333333301', (select caregiver_id from caregiver where lower(email) = 'shanmugasundarisri006@gmail.com'),
 'Dr. Divya Sharma', 'Apollo Hospitals, Chennai', current_date + interval '10 days' + time '14:00', 'Routine check-up. Assess sleep and mood changes.');

-- 6. HEALTH REPORTS
insert into health_report (patient_id, generated_by, file_url, generated_at) values
('33333333-3333-3333-3333-333333333301', (select caregiver_id from caregiver where lower(email) = 'shanmugasundarisri006@gmail.com'),
 'https://storage.continuum.app/reports/prema-nellaiappan-nov-2026.pdf', now() - interval '8 days'),
('33333333-3333-3333-3333-333333333301', (select caregiver_id from caregiver where lower(email) = 'shanmugasundarisri006@gmail.com'),
 'https://storage.continuum.app/reports/prema-cognitive-assessment-nov-2026.pdf', now() - interval '2 days');

-- 7. 12 DAYS OF CARE LOGS (realistic Dementia routine)
do $$
declare
  v_pat uuid := '33333333-3333-3333-3333-333333333301';
  v_main uuid := (select caregiver_id from caregiver where lower(email) = 'shanmugasundarisri006@gmail.com');
  v_fam uuid := (select caregiver_id from caregiver where lower(email) = 'srinidhiksp050@gmail.com');
  v_ext uuid := (select caregiver_id from caregiver where lower(email) = 'srini3d4548@gmail.com');
  d int;
begin
  for d in 0..11 loop
    insert into time_event (patient_id, caregiver_id, title, event_type, created_at)
    values (v_pat, v_ext, 'Morning hygiene and breakfast prep', 'daily_log', current_date - d + time '07:15');
    
    insert into daily_care_log (patient_id, caregiver_id, type, quantity, notes, created_at)
    values (v_pat, v_ext, 'meal', 'Full portion', 'Idli with sambar and coconut chutney. Good appetite, ate independently.', 
            current_date - d + time '08:00');
    
    insert into time_event (patient_id, caregiver_id, title, event_type, created_at)
    values (v_pat, v_ext, 'Morning medications given', 'medication', current_date - d + time '08:35');
    insert into daily_care_log (patient_id, caregiver_id, type, notes, created_at)
    values (v_pat, v_ext, 'medication', 'Memantine 10mg and Vitamin B12 given with water. No side effects noted.', 
            current_date - d + time '08:35');
    
    insert into time_event (patient_id, caregiver_id, title, event_type, created_at)
    values (v_pat, v_ext, 'Activity engagement - music and reading', 'daily_log', current_date - d + time '10:30');
    insert into daily_care_log (patient_id, caregiver_id, type, notes, created_at)
    values (v_pat, v_ext, 'activity', 'Listened to classical music (Carnatic) for 30 mins. Recognized some songs. Seemed calm and engaged.', 
            current_date - d + time '10:30');
    
    insert into daily_care_log (patient_id, caregiver_id, type, quantity, notes, created_at)
    values (v_pat, case when d % 3 = 0 then v_fam else v_main end, 'meal', 'Full portion', 
            case when d % 2 = 0 then 'Rice, dhal, vegetable curry, rasam. Assisted eating, needed reminders.'
                 else 'Dosa with sambar. Good intake, ate 90% of meal.' end, 
            current_date - d + time '13:00');
    
    insert into daily_care_log (patient_id, caregiver_id, type, sleep_hours, notes, created_at)
    values (v_pat, case when d % 3 = 0 then v_fam else v_main end, 'sleep', 
            2.0 + (random() * 0.5)::numeric(3,1), 'Afternoon rest taken. Quiet sleep, no disturbances.', 
            current_date - d + time '16:00');
    
    insert into daily_care_log (patient_id, caregiver_id, type, quantity, notes, created_at)
    values (v_pat, v_fam, 'meal', 'Small portion', 'Tea with biscuits and fruit (banana). Ate willingly.', 
            current_date - d + time '17:00');
    
    if d % 2 = 0 then
      insert into time_event (patient_id, caregiver_id, title, event_type, created_at)
      values (v_pat, v_ext, 'Evening walk (15 minutes)', 'daily_log', current_date - d + time '17:30');
      insert into daily_care_log (patient_id, caregiver_id, type, notes, created_at)
      values (v_pat, v_ext, 'activity', 'Gentle walk in the neighborhood with supervision. Cooperative, good engagement.', 
              current_date - d + time '17:35');
    else
      insert into daily_care_log (patient_id, caregiver_id, type, notes, created_at)
      values (v_pat, v_ext, 'activity', 'Rest day. Sitting in garden, gentle stretching. Mood calm.', 
              current_date - d + time '17:30');
    end if;
    
    insert into daily_care_log (patient_id, caregiver_id, type, quantity, notes, created_at)
    values (v_pat, v_fam, 'meal', 'Full portion', 'Chapati, spinach curry, yogurt. Needed some reminders to continue eating. Ate 80%.', 
            current_date - d + time '19:00');
    
    insert into time_event (patient_id, caregiver_id, title, event_type, created_at)
    values (v_pat, v_fam, 'Evening medication', 'medication', current_date - d + time '20:30');
    insert into daily_care_log (patient_id, caregiver_id, type, notes, created_at)
    values (v_pat, v_fam, 'medication', 'Aricept 10mg given after dinner. Swallowed easily. Settled for the night.', 
            current_date - d + time '20:32');
    
    insert into daily_care_log (patient_id, caregiver_id, type, sleep_hours, symptoms, notes, created_at)
    values (v_pat, v_main, 'sleep', 
            case when d % 3 = 0 then 5.5 else 6.5 end, 
            case when d % 4 = 0 then 'Night restlessness, woke at 2:30 AM' else null end,
            case when d % 4 = 0 then 'Woke at 2:30 AM, confused about time. Reassured and helped back to bed. Fell asleep again.'
                 else 'Good sleep throughout the night. No disturbances reported.' end, 
            current_date - d + time '22:00');
  end loop;
end $$;

-- 8. CARE TASKS for Prema
do $$
declare
  v_pat uuid := '33333333-3333-3333-3333-333333333301';
  v_main uuid := (select caregiver_id from caregiver where lower(email) = 'shanmugasundarisri006@gmail.com');
  v_fam uuid := (select caregiver_id from caregiver where lower(email) = 'srinidhiksp050@gmail.com');
  v_ext uuid := (select caregiver_id from caregiver where lower(email) = 'srini3d4548@gmail.com');
begin
  insert into care_task (patient_id, title, description, category, priority, assigned_to, assigned_by, due_at, status, is_essential, grace_minutes) values
  (v_pat, 'Morning medication (Memantine)', 'Give Memantine 10mg after breakfast', 'medication', 'high', v_ext, v_main, current_date + time '08:30', 'pending', true, 15),
  (v_pat, 'Evening medication (Aricept)', 'Give Aricept 10mg after dinner', 'medication', 'high', v_fam, v_main, current_date + time '20:30', 'pending', true, 15),
  (v_pat, 'Breakfast preparation and supervision', 'Prepare breakfast, assist eating if needed', 'meal', 'normal', v_ext, v_main, current_date + time '08:00', 'pending', false, 30),
  (v_pat, 'Lunch preparation and supervision', 'Prepare lunch, remind to eat', 'meal', 'normal', v_fam, v_main, current_date + time '13:00', 'pending', false, 30),
  (v_pat, 'Afternoon activity engagement', 'Play music, read, or simple conversation (30-45 mins)', 'activity', 'normal', v_ext, v_main, current_date + time '15:00', 'pending', false, 45),
  (v_pat, 'Evening walk', 'Supervised walk for 15-20 minutes', 'activity', 'normal', v_ext, v_main, current_date + time '17:30', 'pending', false, 20),
  (v_pat, 'Night hygiene and sleep preparation', 'Help with bathroom, change clothes, prepare for bed', 'daily_log', 'normal', v_fam, v_main, current_date + time '21:00', 'pending', false, 45),
  (v_pat, 'Weekly appointment follow-up', 'Call hospital to confirm appointment on ' || (current_date + interval '2 days')::text, 'appointment', 'high', v_main, v_main, current_date + interval '1 day' + time '10:00', 'pending', false, 60);
end $$;

-- =====================================================================
-- CIRCLE 2: NARESH IYER (Stroke)
-- =====================================================================

-- 1. PATIENT: Naresh Iyer (DOB 8-Nov-1954, age 71, Stroke)
insert into patient (patient_id, full_name, dob, gender, condition_type, time_zone, blood_group, allergies, phone, medical_notes, created_by) values
('33333333-3333-3333-3333-333333333302', 'Naresh Iyer', '1954-11-08', 'Male', 'Stroke', 'Asia/Kolkata', 'A+', 'Shellfish', '+91 90000 55667',
 'Ischemic stroke 18 months ago. Recovered well with physiotherapy. Left side weakness improving. Blood pressure controlled on medication. Mobility: walking with walker, requires supervision for stairs.',
 (select caregiver_id from caregiver where lower(email) = 'shreyaabalas@gmail.com'));

-- 2. CIRCLE MEMBERSHIP
insert into caregiver_pat (caregiver_id, patient_id, role, status, relationship, alert_preference, alert_priority, assigned_responsibilities, joining_at) values
((select caregiver_id from caregiver where lower(email) = 'shreyaabalas@gmail.com'),
 '33333333-3333-3333-3333-333333333302', 'primary', 'active', 'Granddaughter', 'all', 1, '{care coordination,medication,appointments,health monitoring}', now() - interval '50 days'),
((select caregiver_id from caregiver where lower(email) = 'fjbegining@gmail.com'),
 '33333333-3333-3333-3333-333333333302', 'family', 'active', 'Grandson', 'important', 2, '{meals,physiotherapy support,mobility assistance}', now() - interval '45 days'),
((select caregiver_id from caregiver where lower(email) = '96ramya96@gmail.com'),
 '33333333-3333-3333-3333-333333333302', 'family', 'active', 'Sibling', 'important', 3, '{evening care,sleep supervision,health monitoring}', now() - interval '40 days');

-- 3. EMERGENCY CONTACTS
insert into emergency_contact (patient_id, name, relation, phone, priority) values
('33333333-3333-3333-3333-333333333302', 'Shreyaa Bala', 'Granddaughter', '+91 89259 00617', 1),
('33333333-3333-3333-3333-333333333302', 'Dr. Rajesh Kumar', 'Neurologist', '+91 44 4357 8000', 2),
('33333333-3333-3333-3333-333333333302', 'Fortis Malar Hospital', 'Hospital', '+91 44 4287 8888', 3);

-- 4. MEDICATIONS (Stroke regimen: Aspirin, Clopidogrel, Atorvastatin, Lisinopril)
insert into medication (medication_id, patient_id, medicine_name, brand, dosage, instruction, purpose, frequency, start_date, active) values
('44444444-4444-4444-4444-444444444404', '33333333-3333-3333-3333-333333333302', 'Aspirin', 'Buffasprin', '75mg', 'Take after breakfast', 'Blood clot prevention', 'Once daily', current_date - 120, true),
('44444444-4444-4444-4444-444444444405', '33333333-3333-3333-3333-333333333302', 'Clopidogrel', 'Plavix', '75mg', 'Take after breakfast', 'Blood clot prevention', 'Once daily', current_date - 120, true),
('44444444-4444-4444-4444-444444444406', '33333333-3333-3333-3333-333333333302', 'Atorvastatin', 'Lipitor', '40mg', 'Take at night', 'Cholesterol management', 'Once daily', current_date - 100, true),
('44444444-4444-4444-4444-444444444407', '33333333-3333-3333-3333-333333333302', 'Lisinopril', 'Lisinopril', '5mg', 'Take after breakfast', 'Blood pressure control', 'Once daily', current_date - 95, true);

insert into medication_schedule (schedule_id, medication_id, time_of_day) values
('55555555-5555-5555-5555-555555555504', '44444444-4444-4444-4444-444444444404', '08:00'),
('55555555-5555-5555-5555-555555555505', '44444444-4444-4444-4444-444444444405', '08:15'),
('55555555-5555-5555-5555-555555555506', '44444444-4444-4444-4444-444444444406', '21:00'),
('55555555-5555-5555-5555-555555555507', '44444444-4444-4444-4444-444444444407', '08:30');

insert into medication_schedule_day_of_week (schedule_id, day_of_week)
select s.schedule_id, d from medication_schedule s, generate_series(0,6) d
where s.schedule_id in ('55555555-5555-5555-5555-555555555504','55555555-5555-5555-5555-555555555505','55555555-5555-5555-5555-555555555506','55555555-5555-5555-5555-555555555507');

-- 5. APPOINTMENTS
insert into appointment (patient_id, created_by, doctor_name, hospital, appointment_date, notes) values
('33333333-3333-3333-3333-333333333302', (select caregiver_id from caregiver where lower(email) = 'shreyaabalas@gmail.com'),
 'Dr. Rajesh Kumar', 'Fortis Malar, Chennai', current_date + interval '5 days' + time '11:00', 'Neurology follow-up. Check motor recovery and pain management. Review medications.'),
('33333333-3333-3333-3333-333333333302', (select caregiver_id from caregiver where lower(email) = 'shreyaabalas@gmail.com'),
 'Dr. Pooja Singh', 'Fortis Malar, Chennai', current_date + interval '8 days' + time '14:30', 'Physiotherapy assessment. Evaluate left side strength and walking ability.');

-- 6. HEALTH REPORTS
insert into health_report (patient_id, generated_by, file_url, generated_at) values
('33333333-3333-3333-3333-333333333302', (select caregiver_id from caregiver where lower(email) = 'shreyaabalas@gmail.com'),
 'https://storage.continuum.app/reports/naresh-iyer-stroke-recovery-nov-2026.pdf', now() - interval '10 days'),
('33333333-3333-3333-3333-333333333302', (select caregiver_id from caregiver where lower(email) = 'shreyaabalas@gmail.com'),
 'https://storage.continuum.app/reports/naresh-blood-pressure-log-nov-2026.pdf', now() - interval '5 days');

-- 7. 12 DAYS OF CARE LOGS (realistic Stroke recovery routine)
do $$
declare
  v_pat uuid := '33333333-3333-3333-3333-333333333302';
  v_main uuid := (select caregiver_id from caregiver where lower(email) = 'shreyaabalas@gmail.com');
  v_fam1 uuid := (select caregiver_id from caregiver where lower(email) = 'fjbegining@gmail.com');
  v_fam2 uuid := (select caregiver_id from caregiver where lower(email) = '96ramya96@gmail.com');
  d int;
begin
  for d in 0..11 loop
    insert into daily_care_log (patient_id, caregiver_id, type, notes, created_at)
    values (v_pat, v_fam1, 'activity', 'Bath taken with assistance. Left side support provided. Clean clothes changed.', 
            current_date - d + time '07:30');
    
    insert into daily_care_log (patient_id, caregiver_id, type, quantity, notes, created_at)
    values (v_pat, v_fam1, 'meal', 'Full portion', 'Idli with sambar and egg. Good appetite, independent eating. Blood pressure pre-meal: 128/82 mmHg.', 
            current_date - d + time '08:00');
    
    insert into time_event (patient_id, caregiver_id, title, event_type, created_at)
    values (v_pat, v_fam1, 'Morning medications', 'medication', current_date - d + time '08:20');
    insert into daily_care_log (patient_id, caregiver_id, type, notes, created_at)
    values (v_pat, v_fam1, 'medication', 'Aspirin, Clopidogrel, Lisinopril given. Swallowed well. No side effects.', 
            current_date - d + time '08:20');
    
    insert into time_event (patient_id, caregiver_id, title, event_type, created_at)
    values (v_pat, v_fam1, 'Physiotherapy exercises', 'daily_log', current_date - d + time '09:45');
    insert into daily_care_log (patient_id, caregiver_id, type, notes, created_at)
    values (v_pat, v_fam1, 'activity', 
            'PT exercises: left arm flexion/extension (10 reps), left leg lifts (8 reps), balance training with walker (5 mins). No pain reported. Grip strength improving on left side.', 
            current_date - d + time '10:00');
    
    insert into daily_care_log (patient_id, caregiver_id, type, notes, created_at)
    values (v_pat, v_fam1, 'activity', 'Walking practice with walker, 50 meters achieved. Good balance. One episode of slight loss of balance, immediately supported. Spirits good.',
            current_date - d + time '10:45');
    
    insert into daily_care_log (patient_id, caregiver_id, type, quantity, notes, created_at)
    values (v_pat, case when d % 2 = 0 then v_fam2 else v_main end, 'meal', 'Full portion', 
            case when d % 3 = 0 then 'Rice, sambar, fish curry, vegetable. Independent eating. Finished meal in 30 mins.'
                 else 'Dosa with sambhar and chutney. Required minimal assistance. Ate 85%.' end, 
            current_date - d + time '13:00');
    
    insert into daily_care_log (patient_id, caregiver_id, type, sleep_hours, notes, created_at)
    values (v_pat, v_main, 'sleep', 1.5 + (random() * 0.5)::numeric(3,1), 'Afternoon nap taken. Quiet sleep. No disturbances.', 
            current_date - d + time '15:30');
    
    insert into daily_care_log (patient_id, caregiver_id, type, quantity, notes, created_at)
    values (v_pat, v_fam2, 'meal', 'Small portion', 'Tea with biscuits and apple. Ate willingly.', 
            current_date - d + time '17:00');
    
    if d % 2 = 0 then
      insert into daily_care_log (patient_id, caregiver_id, type, notes, created_at)
      values (v_pat, v_fam1, 'activity', 'Evening walk in garden with walker. 60 meters covered. Good balance. Engaged in conversation. No pain.', 
              current_date - d + time '17:45');
    else
      insert into daily_care_log (patient_id, caregiver_id, type, notes, created_at)
      values (v_pat, v_fam1, 'activity', 'Seated exercises: arm stretches, neck movements, deep breathing. 15 minutes. No discomfort.', 
              current_date - d + time '17:30');
    end if;
    
    insert into daily_care_log (patient_id, caregiver_id, type, quantity, notes, created_at)
    values (v_pat, v_fam2, 'meal', 'Full portion', 'Chapati, spinach, dal, curd. Independent eating. Finished 90%.', 
            current_date - d + time '19:00');
    
    insert into time_event (patient_id, caregiver_id, title, event_type, created_at)
    values (v_pat, v_fam2, 'Evening medication', 'medication', current_date - d + time '21:00');
    insert into daily_care_log (patient_id, caregiver_id, type, notes, created_at)
    values (v_pat, v_fam2, 'medication', 'Atorvastatin 40mg taken. Evening blood pressure: 126/80 mmHg. Good control.', 
            current_date - d + time '21:00');
    
    insert into daily_care_log (patient_id, caregiver_id, type, sleep_hours, symptoms, notes, created_at)
    values (v_pat, v_main, 'sleep', 
            case when d % 3 = 0 then 6.0 else 7.0 end, 
            case when d % 5 = 0 then 'Left arm pain (mild, 3/10)' else null end,
            case when d % 5 = 0 then 'Woke at 3:00 AM with mild left arm pain. Took position change, pain subsided. Fell back asleep.'
                 else 'Good sleep throughout. No disturbances. Woke refreshed.' end, 
            current_date - d + time '22:00');
  end loop;
end $$;

-- 8. CARE TASKS for Naresh
do $$
declare
  v_pat uuid := '33333333-3333-3333-3333-333333333302';
  v_main uuid := (select caregiver_id from caregiver where lower(email) = 'shreyaabalas@gmail.com');
  v_fam1 uuid := (select caregiver_id from caregiver where lower(email) = 'fjbegining@gmail.com');
  v_fam2 uuid := (select caregiver_id from caregiver where lower(email) = '96ramya96@gmail.com');
begin
  insert into care_task (patient_id, title, description, category, priority, assigned_to, assigned_by, due_at, status, is_essential, grace_minutes) values
  (v_pat, 'Morning medications (Aspirin, Clopidogrel, Lisinopril)', 'Give all morning meds after breakfast', 'medication', 'high', v_fam1, v_main, current_date + time '08:15', 'pending', true, 15),
  (v_pat, 'Evening medication (Atorvastatin)', 'Give before bedtime', 'medication', 'high', v_fam2, v_main, current_date + time '21:00', 'pending', true, 15),
  (v_pat, 'Physiotherapy exercises (30 mins)', 'Arm flexion, leg lifts, balance training with walker', 'activity', 'high', v_fam1, v_main, current_date + time '09:30', 'pending', false, 30),
  (v_pat, 'Morning walking practice (with walker)', 'Supervised walking, minimum 50 meters', 'activity', 'normal', v_fam1, v_main, current_date + time '10:30', 'pending', false, 20),
  (v_pat, 'Blood pressure monitoring', 'Check BP in morning, afternoon, evening. Record readings.', 'daily_log', 'normal', v_main, v_main, current_date + time '08:00', 'pending', false, 30),
  (v_pat, 'Bath and hygiene assistance', 'Help with daily bath, clean clothes', 'daily_log', 'normal', v_fam1, v_main, current_date + time '07:30', 'pending', false, 45),
  (v_pat, 'Meal supervision and assistance', 'Prepare meals, assist with eating if needed', 'meal', 'normal', v_fam1, v_main, current_date + time '13:00', 'pending', false, 30),
  (v_pat, 'Doctor appointment coordination', 'Confirm neurology appointment on ' || (current_date + interval '5 days')::text || ', arrange transportation', 'appointment', 'high', v_main, v_main, current_date + interval '2 days' + time '10:00', 'pending', false, 60);
end $$;

-- 9. COORDINATION METRICS
insert into coordination_metric (caregiver_id, patient_id, score, risk_level, recommendation, strain_index, workload_level, window_start, window_end, features, predicted_at) values
-- Prema's circle
((select caregiver_id from caregiver where lower(email) = 'shanmugasundarisri006@gmail.com'), 
 '33333333-3333-3333-3333-333333333301', 72, 'moderate', 
 'Coordination is manageable. Continue current task distribution. Monitor night sleep trends.', 
 45.5, 'moderate', now() - interval '7 days', now(), 
 '{"tasks_share":0.40,"overdue":1,"night_interruptions":1,"avg_sleep_hours":6.2}'::jsonb, now()),

((select caregiver_id from caregiver where lower(email) = 'srinidhiksp050@gmail.com'), 
 '33333333-3333-3333-3333-333333333301', 78, 'low', 
 'Good balance. Evening care well-handled. Workload sustainable.', 
 28.0, 'low', now() - interval '7 days', now(), 
 '{"tasks_share":0.30,"overdue":0,"avg_sleep_hours":7.5}'::jsonb, now()),

((select caregiver_id from caregiver where lower(email) = 'srini3d4548@gmail.com'), 
 '33333333-3333-3333-3333-333333333301', 75, 'moderate', 
 'Daytime supervision going well. Monitor for overload in future if caseload increases.', 
 35.0, 'low', now() - interval '7 days', now(), 
 '{"tasks_share":0.30,"overdue":0,"avg_sleep_hours":6.8}'::jsonb, now()),

-- Naresh's circle
((select caregiver_id from caregiver where lower(email) = 'shreyaabalas@gmail.com'), 
 '33333333-3333-3333-3333-333333333302', 68, 'moderate', 
 'Coordinating stroke recovery well. PT schedule consistent. Monitor caregiver burnout.', 
 52.0, 'moderate', now() - interval '7 days', now(), 
 '{"tasks_share":0.45,"overdue":0,"night_monitoring":2,"avg_sleep_hours":5.8}'::jsonb, now()),

((select caregiver_id from caregiver where lower(email) = 'fjbegining@gmail.com'), 
 '33333333-3333-3333-3333-333333333302', 80, 'low', 
 'PT and daily care managed excellently. Good energy levels.', 
 22.0, 'low', now() - interval '7 days', now(), 
 '{"tasks_share":0.35,"overdue":0,"avg_sleep_hours":7.8}'::jsonb, now()),

((select caregiver_id from caregiver where lower(email) = '96ramya96@gmail.com'), 
 '33333333-3333-3333-3333-333333333302', 76, 'low', 
 'Evening care smooth. Good support to grandson.', 
 30.0, 'low', now() - interval '7 days', now(), 
 '{"tasks_share":0.20,"overdue":0,"avg_sleep_hours":7.2}'::jsonb, now());

-- 10. CAREGIVER SLEEP LOGS
insert into caregiver_sleep_log (caregiver_id, sleep_date, hours) values
((select caregiver_id from caregiver where lower(email) = 'shanmugasundarisri006@gmail.com'), current_date - 1, 6.0),
((select caregiver_id from caregiver where lower(email) = 'shanmugasundarisri006@gmail.com'), current_date - 2, 5.5),
((select caregiver_id from caregiver where lower(email) = 'shanmugasundarisri006@gmail.com'), current_date - 3, 6.5),
((select caregiver_id from caregiver where lower(email) = 'shanmugasundarisri006@gmail.com'), current_date - 4, 5.0),
((select caregiver_id from caregiver where lower(email) = 'shanmugasundarisri006@gmail.com'), current_date - 5, 6.0),
((select caregiver_id from caregiver where lower(email) = 'shanmugasundarisri006@gmail.com'), current_date - 6, 5.5),

((select caregiver_id from caregiver where lower(email) = 'srinidhiksp050@gmail.com'), current_date - 1, 7.5),
((select caregiver_id from caregiver where lower(email) = 'srinidhiksp050@gmail.com'), current_date - 2, 7.0),
((select caregiver_id from caregiver where lower(email) = 'srinidhiksp050@gmail.com'), current_date - 3, 7.5),
((select caregiver_id from caregiver where lower(email) = 'srinidhiksp050@gmail.com'), current_date - 4, 8.0),
((select caregiver_id from caregiver where lower(email) = 'srinidhiksp050@gmail.com'), current_date - 5, 7.0),

((select caregiver_id from caregiver where lower(email) = 'shreyaabalas@gmail.com'), current_date - 1, 5.5),
((select caregiver_id from caregiver where lower(email) = 'shreyaabalas@gmail.com'), current_date - 2, 6.0),
((select caregiver_id from caregiver where lower(email) = 'shreyaabalas@gmail.com'), current_date - 3, 5.0),
((select caregiver_id from caregiver where lower(email) = 'shreyaabalas@gmail.com'), current_date - 4, 6.0),
((select caregiver_id from caregiver where lower(email) = 'shreyaabalas@gmail.com'), current_date - 5, 5.5),

((select caregiver_id from caregiver where lower(email) = 'fjbegining@gmail.com'), current_date - 1, 8.0),
((select caregiver_id from caregiver where lower(email) = 'fjbegining@gmail.com'), current_date - 2, 7.5),
((select caregiver_id from caregiver where lower(email) = 'fjbegining@gmail.com'), current_date - 3, 8.0),
((select caregiver_id from caregiver where lower(email) = 'fjbegining@gmail.com'), current_date - 4, 7.0);

-- 11. NOTIFICATIONS
insert into notification (caregiver_id, title, message, type, is_read) values
((select caregiver_id from caregiver where lower(email) = 'shanmugasundarisri006@gmail.com'), 
 'Appointment reminder', 'Neurology appointment for Prema on ' || (current_date + interval '2 days')::text || ' at 10:30 AM. Confirm transportation.', 'reminder', false),
((select caregiver_id from caregiver where lower(email) = 'srinidhiksp050@gmail.com'), 
 'Task assigned', 'Evening medication for Prema due at 8:30 PM today.', 'reminder', false),
((select caregiver_id from caregiver where lower(email) = 'shreyaabalas@gmail.com'), 
 'Appointment reminder', 'Neurology appointment for Naresh on ' || (current_date + interval '5 days')::text || ' at 11:00 AM. Arrange transportation.', 'reminder', false),
((select caregiver_id from caregiver where lower(email) = 'fjbegining@gmail.com'), 
 'Task completed', 'Physiotherapy exercises for Naresh marked complete. Good progress!', 'confirmation', true);

-- 12. TRAINING SCENARIOS
insert into scenario_card (title, scenario_text, difficulty, category) values
('Dementia sundowning', 'It is 6 PM. Prema becomes agitated and asks to "go home." You are alone. What do you do?', 'medium', 'dementia_care'),
('Stroke medication refusal', 'Naresh refuses to take his morning blood-thinner medication, saying it makes him feel unwell. How do you respond?', 'hard', 'stroke_care'),
('Caregiver stress', 'You are the main caregiver and have been caring for your patient 24/7. You are exhausted and irritable. What is the first step?', 'medium', 'caregiver_wellbeing'),
('Emergency response', 'Prema falls while walking to the bathroom at night. She is conscious but complaining of hip pain. What is your immediate action?', 'hard', 'emergency_response')
on conflict do nothing;

delete from scenario_option where scenario_id in (
  select scenario_id from scenario_card where title in (
    'Dementia sundowning', 'Stroke medication refusal', 'Caregiver stress', 'Emergency response'
  )
);

insert into scenario_option (scenario_id, option_text, explanation, is_correct) values
((select scenario_id from scenario_card where title = 'Dementia sundowning' limit 1), 
 'Calmly reassure her, redirect to a familiar activity (music, old photos)', 
 'Validation and redirection reduce distress in dementia patients.', true),
((select scenario_id from scenario_card where title = 'Dementia sundowning' limit 1), 
 'Tell her firmly that she is already home, get frustrated', 
 'Contradiction and frustration increase agitation in dementia.', false),
((select scenario_id from scenario_card where title = 'Stroke medication refusal' limit 1), 
 'Call the doctor immediately to report and ask for guidance', 
 'Blood thinners are essential post-stroke. Doctor input is critical.', true),
((select scenario_id from scenario_card where title = 'Stroke medication refusal' limit 1), 
 'Skip the dose, do not mention to anyone', 
 'Skipping blood thinners increases clot risk. Must inform doctor immediately.', false),
((select scenario_id from scenario_card where title = 'Caregiver stress' limit 1), 
 'Ask for help. Involve other family members or professional caregivers to share the load.', 
 'Caregiver burnout is real. Sharing responsibility is essential.', true),
((select scenario_id from scenario_card where title = 'Caregiver stress' limit 1), 
 'Push through. You are responsible, so you must do it all.', 
 'Burnout leads to poor care and health issues. Support is necessary.', false),
((select scenario_id from scenario_card where title = 'Emergency response' limit 1), 
 'Check for injuries, call ambulance immediately, do not move her.', 
 'Hip fracture post-fall requires professional medical evaluation immediately.', true),
((select scenario_id from scenario_card where title = 'Emergency response' limit 1), 
 'Wait a few minutes, see if she can get up and walk it off.', 
 'Waiting risks further injury if fracture is present. Immediate medical evaluation is needed.', false);

commit;
notify pgrst, 'reload schema';
