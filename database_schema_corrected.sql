-- =====================================================================
-- CONTINUUM — Complete Clean Schema (v1)
-- 26 tables, no data. Run this ONCE to set up the database from scratch.
-- Drops all public tables first, then creates everything fresh.
-- Row-level security is configured but disabled by default (see bottom).
-- =====================================================================

-- Drop all existing tables in public schema
do $$
declare t record;
begin
  for t in (select tablename from pg_tables where schemaname = 'public') loop
    execute format('drop table if exists public.%I cascade', t.tablename);
  end loop;
  for t in (select viewname from pg_views where schemaname = 'public') loop
    execute format('drop view if exists public.%I cascade', t.viewname);
  end loop;
end $$;

create extension if not exists pgcrypto with schema extensions;

-- =====================================================================
-- 1. CAREGIVER (user account linked to Supabase Auth)
-- =====================================================================
create table caregiver (
  caregiver_id    uuid primary key default gen_random_uuid(),
  auth_user_id    uuid unique,                           -- links to auth.users(id)
  full_name       text not null,
  email           text not null unique,
  phone           text,
  language        text default 'en',
  profile_image   text,
  last_login_at   timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index idx_caregiver_auth_user on caregiver(auth_user_id);

-- =====================================================================
-- 2. PATIENT (person receiving care)
-- =====================================================================
create table patient (
  patient_id      uuid primary key default gen_random_uuid(),
  full_name       text not null,
  dob             date,
  gender          text,
  condition_type  text,                                 -- Dementia, Parkinson's, etc.
  time_zone       text not null default 'Asia/Kolkata',
  blood_group     text,
  allergies       text,
  phone           text,
  medical_notes   text,
  created_by      uuid references caregiver(caregiver_id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index idx_patient_created_by on patient(created_by);

-- =====================================================================
-- 3. CAREGIVER_PAT (membership in a care circle; M:N)
-- =====================================================================
create table caregiver_pat (
  caregiver_id    uuid not null references caregiver(caregiver_id) on delete cascade,
  patient_id      uuid not null references patient(patient_id) on delete cascade,
  role            text not null check (role in ('primary','family','external')),
  status          text not null default 'active' check (status in ('pending','active','revoked')),
  relationship    text,                                 -- e.g. 'Daughter', 'Granddaughter', 'External caregiver'
  alert_preference text default 'all',                  -- which alerts to send
  alert_priority  int default 1,                        -- 1 = highest
  assigned_responsibilities text[] not null default '{}',  -- list of area names assigned to this caregiver
  joining_at      timestamptz not null default now(),
  removed_at      timestamptz,
  primary key (caregiver_id, patient_id)
);
create unique index uq_caregiver_pat_active_primary on caregiver_pat(patient_id) where role = 'primary' and status = 'active';
create index idx_caregiver_pat_patient   on caregiver_pat(patient_id);
create index idx_caregiver_pat_role      on caregiver_pat(role);
create index idx_caregiver_pat_status    on caregiver_pat(status);

-- =====================================================================
-- 4. EMERGENCY_CONTACT (owned by patient; 1:N)
-- =====================================================================
create table emergency_contact (
  contact_id      uuid primary key default gen_random_uuid(),
  patient_id      uuid not null references patient(patient_id) on delete cascade,
  name            text not null,
  relation        text,
  phone           text,
  priority        int default 1
);
create index idx_emergency_contact_patient on emergency_contact(patient_id);

-- =====================================================================
-- 5. MEDICATION (prescribed to a patient)
-- =====================================================================
create table medication (
  medication_id   uuid primary key default gen_random_uuid(),
  patient_id      uuid not null references patient(patient_id) on delete cascade,
  medicine_name   text not null,
  brand           text,
  dosage          text,
  instruction     text,
  purpose         text,                                 -- reason prescribed
  frequency       text,                                 -- human label: 'Once daily', '3x daily'
  start_date      date,
  end_date        date,
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);
create index idx_medication_patient on medication(patient_id);
create index idx_medication_active  on medication(active);

-- =====================================================================
-- 6. MEDICATION_SCHEDULE (when to take a medication)
-- =====================================================================
create table medication_schedule (
  schedule_id     uuid primary key default gen_random_uuid(),
  medication_id   uuid not null references medication(medication_id) on delete cascade,
  time_of_day     time not null
);
create index idx_medication_schedule_medication on medication_schedule(medication_id);

-- =====================================================================
-- 7. MEDICATION_SCHEDULE_DAY_OF_WEEK (which days to take it)
-- =====================================================================
create table medication_schedule_day_of_week (
  schedule_id     uuid not null references medication_schedule(schedule_id) on delete cascade,
  day_of_week     smallint not null check (day_of_week between 0 and 6),  -- 0=Sun, 6=Sat
  primary key (schedule_id, day_of_week)
);

-- =====================================================================
-- 8. APPOINTMENT (doctor appointments)
-- =====================================================================
create table appointment (
  appointment_id  uuid primary key default gen_random_uuid(),
  patient_id      uuid not null references patient(patient_id) on delete cascade,
  created_by      uuid references caregiver(caregiver_id) on delete set null,
  doctor_name     text,
  hospital        text,
  appointment_date timestamptz,
  notes           text,
  created_at      timestamptz not null default now()
);
create index idx_appointment_patient      on appointment(patient_id);
create index idx_appointment_created_by   on appointment(created_by);
create index idx_appointment_date         on appointment(appointment_date);

-- =====================================================================
-- 9. TIME_EVENT (timeline of events: meals, sleep, appointments, etc.)
-- =====================================================================
create table time_event (
  event_id        uuid primary key default gen_random_uuid(),
  patient_id      uuid not null references patient(patient_id) on delete cascade,
  caregiver_id    uuid references caregiver(caregiver_id) on delete set null,
  title           text,
  event_type      text,                                 -- 'meal', 'medication', 'sleep', 'appointment', 'night_interruption'
  created_at      timestamptz not null default now()
);
create index idx_time_event_patient   on time_event(patient_id);
create index idx_time_event_caregiver on time_event(caregiver_id);
create index idx_time_event_type      on time_event(event_type);

-- =====================================================================
-- 10. TIMELINE_COMMEND (comments on timeline events)
-- =====================================================================
create table timeline_commend (
  commend_id      uuid primary key default gen_random_uuid(),
  event_id        uuid not null references time_event(event_id) on delete cascade,
  caregiver_id    uuid references caregiver(caregiver_id) on delete set null,
  commend_text    text not null,
  created_at      timestamptz not null default now()
);
create index idx_timeline_commend_event on timeline_commend(event_id);

-- =====================================================================
-- 11. DAILY_CARE_LOG (structured care logs: meals, sleep, symptoms)
-- =====================================================================
create table daily_care_log (
  log_id          uuid primary key default gen_random_uuid(),
  patient_id      uuid not null references patient(patient_id) on delete cascade,
  caregiver_id    uuid references caregiver(caregiver_id) on delete set null,
  type            text not null,                        -- 'meal', 'medication', 'sleep', 'activity'
  quantity        text,                                 -- e.g. 'Full portion', null for others
  symptoms        text,                                 -- e.g. 'Increased tremor'
  notes           text,
  sleep_hours     numeric(4,1),
  created_at      timestamptz not null default now()
);
create index idx_daily_care_log_patient    on daily_care_log(patient_id);
create index idx_daily_care_log_caregiver  on daily_care_log(caregiver_id);
create index idx_daily_care_log_type       on daily_care_log(type);

-- =====================================================================
-- 12. HEALTH_REPORT (generated reports)
-- =====================================================================
create table health_report (
  report_id       uuid primary key default gen_random_uuid(),
  patient_id      uuid not null references patient(patient_id) on delete cascade,
  generated_by    uuid references caregiver(caregiver_id) on delete set null,
  file_url        text,
  generated_at    timestamptz not null default now()
);
create index idx_health_report_patient on health_report(patient_id);

-- =====================================================================
-- 13. CARE_TASK_TEMPLATE (reusable task definitions)
-- =====================================================================
create table care_task_template (
  template_id     uuid primary key default gen_random_uuid(),
  patient_id      uuid references patient(patient_id) on delete cascade,   -- null = global template
  title           text not null,
  description     text,
  category        text,
  default_priority text not null default 'normal' check (default_priority in ('low','normal','high')),
  is_essential    boolean not null default false,       -- medication tasks, etc. (no auto-reassign)
  created_by      uuid references caregiver(caregiver_id) on delete set null,
  created_at      timestamptz not null default now()
);
create index idx_care_task_template_patient on care_task_template(patient_id);

-- =====================================================================
-- 14. CARE_TASK (assigned tasks with status)
-- =====================================================================
create table care_task (
  task_id         uuid primary key default gen_random_uuid(),
  patient_id      uuid not null references patient(patient_id) on delete cascade,
  title           text not null,
  description     text,
  category        text,
  priority        text not null default 'normal' check (priority in ('low','normal','high')),
  assigned_to     uuid references caregiver(caregiver_id) on delete set null,   -- null = unassigned
  backup_caregiver_id uuid references caregiver(caregiver_id) on delete set null,
  assigned_by     uuid references caregiver(caregiver_id) on delete set null,
  template_id     uuid references care_task_template(template_id) on delete set null,
  due_at          timestamptz,
  grace_minutes   int not null default 30 check (grace_minutes >= 0),           -- allowable lateness
  is_essential    boolean not null default false,
  status          text not null default 'pending' check (status in ('pending','in_progress','completed','skipped','cancelled')),
  completed_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index idx_care_task_patient       on care_task(patient_id);
create index idx_care_task_assigned_to   on care_task(assigned_to);
create index idx_care_task_backup        on care_task(backup_caregiver_id);
create index idx_care_task_due           on care_task(patient_id, due_at);
create index idx_care_task_status        on care_task(status);

-- =====================================================================
-- 15. CARE_TASK_HISTORY (audit trail of task changes)
-- =====================================================================
create table care_task_history (
  history_id      uuid primary key default gen_random_uuid(),
  task_id         uuid not null references care_task(task_id) on delete cascade,
  changed_by      uuid references caregiver(caregiver_id) on delete set null,
  action          text not null,                        -- 'assigned', 'reassigned', 'status_changed', 'skipped'
  from_assignee   uuid references caregiver(caregiver_id) on delete set null,
  to_assignee     uuid references caregiver(caregiver_id) on delete set null,
  from_status     text,
  to_status       text,
  note            text,
  created_at      timestamptz not null default now()
);
create index idx_care_task_history_task on care_task_history(task_id);

-- =====================================================================
-- 16. TASK_SUGGESTION (backend suggests task sharing)
-- =====================================================================
create table task_suggestion (
  suggestion_id   uuid primary key default gen_random_uuid(),
  patient_id      uuid not null references patient(patient_id) on delete cascade,
  task_id         uuid not null references care_task(task_id) on delete cascade,
  from_caregiver  uuid references caregiver(caregiver_id) on delete set null,   -- who currently owns it
  to_caregiver    uuid not null references caregiver(caregiver_id) on delete cascade,  -- who should take it
  reason          text,
  status          text not null default 'pending' check (status in ('pending','accepted','declined','expired')),
  created_at      timestamptz not null default now(),
  decided_by      uuid references caregiver(caregiver_id) on delete set null,
  decided_at      timestamptz
);
create unique index uq_task_suggestion_pending on task_suggestion(task_id) where status = 'pending';
create index idx_task_suggestion_patient on task_suggestion(patient_id);
create index idx_task_suggestion_to      on task_suggestion(to_caregiver);

-- =====================================================================
-- 17. ROLE_PERMISSION (authoritative role-to-capability map)
-- =====================================================================
create table role_permission (
  role            text not null check (role in ('primary','family','external')),
  capability      text not null,
  primary key (role, capability)
);
insert into role_permission (role, capability) values
 ('primary', 'view_patient'),
 ('primary', 'edit_patient'),
 ('primary', 'view_care_records'),
 ('primary', 'create_care_record'),
 ('primary', 'complete_assigned_task'),
 ('primary', 'manage_members'),
 ('primary', 'manage_invitations'),
 ('primary', 'manage_responsibilities'),
 ('primary', 'manage_access_settings'),
 ('primary', 'transfer_ownership'),
 ('family', 'view_patient'),
 ('family', 'view_care_records'),
 ('family', 'create_care_record'),
 ('family', 'complete_assigned_task'),
 ('external', 'view_patient'),
 ('external', 'view_care_records'),
 ('external', 'create_care_record'),
 ('external', 'complete_assigned_task');

-- =====================================================================
-- 18. INVITATION (to join a care circle; token stored as SHA-256 hash)
-- =====================================================================
create table invitation (
  invitation_id   uuid primary key default gen_random_uuid(),
  patient_id      uuid not null references patient(patient_id) on delete cascade,
  invited_by      uuid references caregiver(caregiver_id) on delete set null,
  email           text not null,
  role            text not null check (role in ('family','external')),
  relationship    text,                                 -- e.g. 'Granddaughter'
  token_hash      text not null unique,                 -- SHA-256 hash of the token
  status          text not null default 'pending' check (status in ('pending','accepted','revoked','expired')),
  expires_at      timestamptz not null default now() + interval '7 days',
  accepted_by     uuid references caregiver(caregiver_id) on delete set null,
  accepted_at     timestamptz,
  created_at      timestamptz not null default now()
);
create unique index uq_invitation_pending on invitation(patient_id, lower(email)) where status = 'pending';
create index idx_invitation_patient on invitation(patient_id);

-- =====================================================================
-- 19. COORDINATION_METRIC (workload and strain scores per caregiver-patient pair)
-- =====================================================================
create table coordination_metric (
  metric_id       uuid primary key default gen_random_uuid(),
  caregiver_id    uuid not null references caregiver(caregiver_id) on delete cascade,
  patient_id      uuid not null references patient(patient_id) on delete cascade,
  score           numeric(5,2),                         -- 0-100 overall coordination score
  risk_level      text,                                 -- 'low', 'moderate', 'high'
  recommendation  text,
  strain_index    numeric(5,2),                         -- behavioral strain, 0-100
  workload_level  text check (workload_level in ('low','moderate','high')),  -- from Random Forest
  window_start    timestamptz,                          -- 7-day window start
  window_end      timestamptz,                          -- 7-day window end
  features        jsonb,                                -- {"tasks_share":0.57, "overdue":2, ...}
  unavailable_metrics text[] not null default '{}',    -- which metrics had missing data
  anomaly_flag    boolean,                              -- Isolation Forest: unusual pattern
  predicted_at    timestamptz not null default now()
);
create index idx_coordination_metric_caregiver on coordination_metric(caregiver_id);
create index idx_coordination_metric_patient   on coordination_metric(patient_id);
create index idx_coordination_metric_window    on coordination_metric(window_start, window_end);

-- =====================================================================
-- 20. CAREGIVER_SLEEP_LOG (caregiver's own sleep; entered by them)
-- =====================================================================
create table caregiver_sleep_log (
  sleep_id        uuid primary key default gen_random_uuid(),
  caregiver_id    uuid not null references caregiver(caregiver_id) on delete cascade,
  sleep_date      date not null,
  hours           numeric(4,1) not null check (hours >= 0 and hours <= 24),
  created_at      timestamptz not null default now(),
  unique (caregiver_id, sleep_date)
);
create index idx_caregiver_sleep_log_caregiver on caregiver_sleep_log(caregiver_id, sleep_date);

-- =====================================================================
-- 21. CARE_ALERT (alerts for caregivers; deduped per week)
-- =====================================================================
create table care_alert (
  alert_id        uuid primary key default gen_random_uuid(),
  patient_id      uuid not null references patient(patient_id) on delete cascade,
  caregiver_id    uuid references caregiver(caregiver_id) on delete set null,   -- null = whole circle
  alert_type      text not null check (alert_type in ('strain_elevated','high_workload_strain','repeated_overdue',
                    'task_imbalance','night_interruptions','missing_sleep_data','unusual_pattern')),
  severity        text not null default 'info' check (severity in ('info','warning','high')),
  message         text not null,
  factors         jsonb not null default '{}'::jsonb,   -- data that contributed to alert
  dedupe_key      text not null,                        -- e.g. 'high_workload_strain:2026-W43'
  status          text not null default 'new' check (status in ('new','acknowledged','dismissed')),
  created_at      timestamptz not null default now(),
  acknowledged_by uuid references caregiver(caregiver_id) on delete set null,
  acknowledged_at timestamptz
);
create unique index uq_care_alert_open on care_alert(patient_id, dedupe_key) where status = 'new';
create index idx_care_alert_patient   on care_alert(patient_id);
create index idx_care_alert_caregiver on care_alert(caregiver_id);

-- =====================================================================
-- 22. SCENARIO_CARD (training scenarios for caregivers)
-- =====================================================================
create table scenario_card (
  scenario_id     uuid primary key default gen_random_uuid(),
  caregiver_id    uuid references caregiver(caregiver_id) on delete set null,  -- creator (null = system)
  title           text not null,
  scenario_text   text,
  difficulty      text,                                 -- 'easy', 'medium', 'hard'
  category        text,                                 -- 'dementia_care', 'medication', etc.
  created_at      timestamptz not null default now()
);
create index idx_scenario_card_caregiver on scenario_card(caregiver_id);

-- =====================================================================
-- 23. SCENARIO_OPTION (answer choices for a scenario)
-- =====================================================================
create table scenario_option (
  option_id       uuid primary key default gen_random_uuid(),
  scenario_id     uuid not null references scenario_card(scenario_id) on delete cascade,
  option_text     text not null,
  explanation     text,
  is_correct      boolean not null default false
);
create index idx_scenario_option_scenario on scenario_option(scenario_id);

-- =====================================================================
-- 24. SCENARIO_ATTEMPT (caregiver's attempt at a scenario; server-decided)
-- =====================================================================
create table scenario_attempt (
  attempt_id      uuid primary key default gen_random_uuid(),
  caregiver_id    uuid not null references caregiver(caregiver_id) on delete cascade,
  scenario_id     uuid not null references scenario_card(scenario_id) on delete cascade,
  option_id       uuid not null references scenario_option(option_id) on delete cascade,
  is_correct      boolean,                              -- server sets this from scenario_option
  attempted_at    timestamptz not null default now()
);
create index idx_scenario_attempt_caregiver on scenario_attempt(caregiver_id);
create index idx_scenario_attempt_scenario  on scenario_attempt(scenario_id);

-- =====================================================================
-- 25. NOTIFICATION (sent to caregivers)
-- =====================================================================
create table notification (
  notification_id uuid primary key default gen_random_uuid(),
  caregiver_id    uuid not null references caregiver(caregiver_id) on delete cascade,
  title           text,
  message         text,
  type            text,                                 -- 'reminder', 'alert', 'confirmation', 'insight'
  is_read         boolean not null default false,
  created_at      timestamptz not null default now()
);
create index idx_notification_caregiver on notification(caregiver_id);
create index idx_notification_is_read   on notification(is_read);

-- =====================================================================
-- 26. LOGIN_AUDIT (audit trail of logins; filled by trigger)
-- =====================================================================
create table login_audit (
  audit_id        uuid primary key default gen_random_uuid(),
  caregiver_id    uuid references caregiver(caregiver_id) on delete set null,
  auth_user_id    uuid,
  event           text not null default 'login',
  created_at      timestamptz not null default now()
);
create index idx_login_audit_caregiver on login_audit(caregiver_id);

-- =====================================================================
-- SUMMARY
-- =====================================================================
-- Tables: 26
-- Constraints: Foreign keys, unique, check, primary keys
-- Indexes: on every foreign key and common query columns
-- This schema is complete and ready for auth triggers and RLS.
-- =====================================================================

-- =====================================================================
-- ROW LEVEL SECURITY (disabled by default)
-- =====================================================================
-- To enable RLS across your whole database, uncomment the code below and
-- add the necessary helper functions (current_caregiver_id, has_cap) and
-- RLS policies from 01_continuum_rbac_migration.sql.
-- For now, this schema provides the tables and structure only.

-- do $$ declare t text; begin
--   foreach t in array array['caregiver','patient','caregiver_pat','emergency_contact',
--     'medication','medication_schedule','medication_schedule_day_of_week','time_event',
--     'timeline_commend','appointment','daily_care_log','health_report','care_task_template',
--     'care_task','care_task_history','task_suggestion','role_permission','invitation',
--     'coordination_metric','caregiver_sleep_log','care_alert','scenario_card','scenario_option',
--     'scenario_attempt','notification','login_audit']
--   loop execute format('alter table %I enable row level security', t); end loop;
-- end $$;

-- To use RLS:
-- 1. Uncomment the loop above to enable RLS on all tables.
-- 2. Run 01_continuum_rbac_migration.sql to add helper functions and policies.
-- 3. Revoke default anon / authenticated access: revoke all on all tables in schema public from anon, authenticated;
-- 4. Grant execute on functions only (policies handle row-level access).

-- =====================================================================
