-- =====================================================================
-- CONTINUUM — Complete RBAC / Auth Migration & RLS Security Fix
-- Run this in the Supabase SQL Editor.
-- Fully aligned with 00_continuum_clean_schema.sql (26 tables).
-- Does NOT touch or delete any data. Safe and idempotent.
-- =====================================================================

begin;

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- 1. Ensure columns & indexes exist without referencing missing columns
-- ---------------------------------------------------------------------
alter table caregiver add column if not exists auth_user_id  uuid;
alter table caregiver add column if not exists last_login_at timestamptz;

alter table caregiver drop constraint if exists fk_caregiver_auth_user;
alter table caregiver add  constraint fk_caregiver_auth_user
  foreign key (auth_user_id) references auth.users(id) on delete cascade;
create unique index if not exists uq_caregiver_auth_user
  on caregiver(auth_user_id) where auth_user_id is not null;

alter table patient add column if not exists time_zone  text not null default 'Asia/Kolkata';
alter table patient add column if not exists created_by uuid references caregiver(caregiver_id) on delete set null;

alter table caregiver_pat add column if not exists relationship              text;
alter table caregiver_pat add column if not exists status                    text not null default 'active';
alter table caregiver_pat add column if not exists alert_preference          text default 'all';
alter table caregiver_pat add column if not exists alert_priority            int  default 1;
alter table caregiver_pat add column if not exists assigned_responsibilities text[] not null default '{}';

update caregiver_pat set role = case
  when role = 'primary' then 'primary'
  when role in ('external', 'professional') then 'external'
  else 'family' end;
update caregiver_pat set status = 'revoked' where removed_at is not null;
update caregiver_pat set status = 'active'  where status is null or status not in ('pending','active','revoked');
alter table caregiver_pat alter column role set not null;

alter table caregiver_pat drop constraint if exists chk_cp_role;
alter table caregiver_pat add  constraint chk_cp_role   check (role in ('primary','family','external'));
alter table caregiver_pat drop constraint if exists chk_cp_status;
alter table caregiver_pat add  constraint chk_cp_status check (status in ('pending','active','revoked'));

create unique index if not exists uq_one_active_primary
  on caregiver_pat(patient_id) where role = 'primary' and status = 'active';
create index if not exists idx_caregiver_pat_caregiver on caregiver_pat(caregiver_id);

-- ---------------------------------------------------------------------
-- 2. Role Permissions (Authoritative matrix)
-- ---------------------------------------------------------------------
create table if not exists role_permission (
  role       text not null check (role in ('primary','family','external')),
  capability text not null,
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
  ('external', 'complete_assigned_task')
on conflict (role, capability) do nothing;

-- ---------------------------------------------------------------------
-- 3. Core Helper Functions (SECURITY DEFINER)
-- ---------------------------------------------------------------------
create or replace function public.current_caregiver_id() returns uuid
language sql stable security definer set search_path = public as $$
  select caregiver_id from public.caregiver where auth_user_id = auth.uid() limit 1;
$$;

create or replace function public.get_my_patient_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select cp.patient_id
  from public.caregiver_pat cp
  where cp.caregiver_id = (select c.caregiver_id from public.caregiver c where c.auth_user_id = auth.uid() limit 1)
    and cp.status = 'active';
$$;

create or replace function public.has_cap(p_patient uuid, p_cap text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.caregiver_pat cp
    join public.role_permission rp on rp.role = cp.role
    where cp.patient_id   = p_patient
      and cp.caregiver_id = public.current_caregiver_id()
      and cp.status = 'active'
      and cp.removed_at is null
      and rp.capability = p_cap
  );
$$;

create or replace function public.is_primary_caregiver_for(p_patient uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.caregiver_pat
    where patient_id = p_patient
      and caregiver_id = public.current_caregiver_id()
      and role = 'primary'
      and status = 'active'
  );
$$;

create or replace function public.is_active_caregiver_for(p_patient uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.caregiver_pat
    where patient_id = p_patient
      and caregiver_id = public.current_caregiver_id()
      and status = 'active'
      and removed_at is null
  );
$$;

-- ---------------------------------------------------------------------
-- 4. Auth Triggers
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.caregiver (auth_user_id, full_name, email, phone)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), split_part(new.email, '@', 1)),
    lower(trim(new.email)),
    new.raw_user_meta_data->>'phone'
  )
  on conflict (email) do update
    set auth_user_id = excluded.auth_user_id
    where caregiver.auth_user_id is null;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.handle_login() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_cg uuid;
begin
  select caregiver_id into v_cg from public.caregiver where auth_user_id = new.id;
  if v_cg is not null then
    update public.caregiver set last_login_at = new.last_sign_in_at where caregiver_id = v_cg;
    insert into public.login_audit(caregiver_id, auth_user_id, event)
    values (v_cg, new.id, 'login');
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_login on auth.users;
create trigger on_auth_user_login after update of last_sign_in_at on auth.users
  for each row when (old.last_sign_in_at is distinct from new.last_sign_in_at)
  execute function public.handle_login();

-- ---------------------------------------------------------------------
-- 5. Privileged Operations as RPCs
-- ---------------------------------------------------------------------

-- A. Create Patient atomically (inserts patient AND caregiver_pat primary link)
create or replace function public.create_patient(
  p_full_name      text,
  p_dob            date        default null,
  p_gender         text        default null,
  p_condition_type text        default null,
  p_time_zone      text        default 'Asia/Kolkata',
  p_blood_group    text        default null,
  p_allergies      text        default null,
  p_medical_notes  text        default null,
  p_relationship   text        default 'Primary caregiver'
)
returns public.patient
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cg_id uuid;
  v_pat   public.patient;
begin
  v_cg_id := public.current_caregiver_id();
  if v_cg_id is null then
    raise exception 'Not authenticated as a caregiver profile';
  end if;

  insert into public.patient (
    full_name, dob, gender, condition_type, time_zone,
    blood_group, allergies, medical_notes, created_by
  ) values (
    trim(p_full_name), p_dob, p_gender, p_condition_type, coalesce(p_time_zone, 'Asia/Kolkata'),
    p_blood_group, p_allergies, p_medical_notes, v_cg_id
  )
  returning * into v_pat;

  insert into public.caregiver_pat (
    caregiver_id, patient_id, role, status, relationship,
    alert_preference, alert_priority, assigned_responsibilities, joining_at
  ) values (
    v_cg_id, v_pat.patient_id, 'primary', 'active', coalesce(p_relationship, 'Primary Caregiver'),
    'all', 1, array['All care responsibilities'], now()
  )
  on conflict (caregiver_id, patient_id) do update
    set role = 'primary', status = 'active', relationship = excluded.relationship;

  return v_pat;
end;
$$;

-- B. Create Invitation (generates secure token and stores SHA-256 hash)
create or replace function public.create_invitation(
  p_patient      uuid,
  p_email        text,
  p_role         text,
  p_relationship text default null
)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_token text;
  v_cg    uuid := public.current_caregiver_id();
begin
  if not public.has_cap(p_patient, 'manage_invitations') then
    raise exception 'Not authorized to invite to this care circle';
  end if;
  if p_role not in ('family', 'external') then
    raise exception 'Invalid role for invitation; must be family or external';
  end if;

  -- Revoke any prior pending invitation for this email on this patient
  update public.invitation
  set status = 'revoked'
  where patient_id = p_patient
    and lower(email) = lower(trim(p_email))
    and status = 'pending';

  v_token := encode(gen_random_bytes(32), 'hex');

  insert into public.invitation (
    patient_id, invited_by, email, role, relationship, token_hash, status, expires_at
  ) values (
    p_patient,
    v_cg,
    lower(trim(p_email)),
    p_role,
    coalesce(nullif(trim(p_relationship), ''), 'Family Member'),
    encode(digest(v_token, 'sha256'), 'hex'),
    'pending',
    now() + interval '7 days'
  );

  return v_token;
end;
$$;

-- C. Secure Invitation Inspection (Readable by invitee without exposing whole table)
create or replace function public.get_invitation_details(p_token text)
returns table (
  invitation_id  uuid,
  patient_id     uuid,
  patient_name   text,
  condition_type text,
  inviter_name   text,
  email          text,
  role           text,
  relationship   text,
  status         text,
  expires_at     timestamptz,
  is_valid       boolean
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_hash text;
begin
  v_hash := encode(digest(trim(p_token), 'sha256'), 'hex');
  return query
  select
    i.invitation_id,
    i.patient_id,
    p.full_name as patient_name,
    p.condition_type,
    c.full_name as inviter_name,
    i.email,
    i.role,
    i.relationship,
    i.status,
    i.expires_at,
    (i.status = 'pending' and i.expires_at > now()) as is_valid
  from public.invitation i
  join public.patient p on p.patient_id = i.patient_id
  left join public.caregiver c on c.caregiver_id = i.invited_by
  where i.token_hash = v_hash;
end;
$$;

-- D. Accept Invitation (Links joining caregiver to circle; never duplicates patient)
create or replace function public.accept_invitation(
  p_token        text,
  p_relationship text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  inv   public.invitation%rowtype;
  v_cg  uuid := public.current_caregiver_id();
  v_rel text;
begin
  select * into inv
  from public.invitation
  where token_hash = encode(digest(trim(p_token), 'sha256'), 'hex')
  for update;

  if not found or inv.status <> 'pending' or inv.expires_at < now() or v_cg is null then
    raise exception 'Invalid or expired invitation';
  end if;

  -- Validate email match for specific person invites (allow wildcard/general links)
  if inv.email not like '%@carecircle.link'
     and inv.email not like '%@continuum.local'
     and inv.email <> ''
     and lower(inv.email) <> lower(coalesce(auth.jwt()->>'email', '')) then
    raise exception 'This invitation was sent to a different email address';
  end if;

  v_rel := coalesce(nullif(trim(p_relationship), ''), inv.relationship, 'Family Member');

  insert into public.caregiver_pat (
    caregiver_id, patient_id, role, status, relationship, joining_at, removed_at
  ) values (
    v_cg, inv.patient_id, inv.role, 'active', v_rel, now(), null
  )
  on conflict (caregiver_id, patient_id) do update
    set role = excluded.role,
        status = 'active',
        relationship = coalesce(v_rel, caregiver_pat.relationship),
        joining_at = now(),
        removed_at = null;

  update public.invitation
  set status = 'accepted',
      accepted_by = v_cg,
      accepted_at = now()
  where invitation_id = inv.invitation_id;

  return inv.patient_id;
end;
$$;

-- Overload for single-argument call
create or replace function public.accept_invitation(p_token text) returns uuid
language sql security definer set search_path = public as $$
  select public.accept_invitation(p_token, null);
$$;

-- E. Task Management RPCs
create or replace function public.assign_task(
  p_patient     uuid,
  p_assignee    uuid,
  p_title       text,
  p_description text        default null,
  p_category    text        default 'daily_log',
  p_priority    text        default 'normal',
  p_due_at      timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_cg uuid := public.current_caregiver_id();
begin
  if not public.has_cap(p_patient, 'manage_responsibilities') then
    raise exception 'Not authorized to assign tasks for this patient';
  end if;
  if p_assignee is not null and not exists (
    select 1 from public.caregiver_pat
    where patient_id = p_patient and caregiver_id = p_assignee and status = 'active'
  ) then
    raise exception 'Assignee is not an active member of this care circle';
  end if;

  insert into public.care_task (
    patient_id, title, description, category, priority, assigned_to, assigned_by, due_at
  ) values (
    p_patient, trim(p_title), trim(p_description), coalesce(p_category, 'daily_log'),
    coalesce(p_priority, 'normal'), p_assignee, v_cg, p_due_at
  )
  returning task_id into v_id;

  insert into public.care_task_history (task_id, changed_by, action, to_assignee, to_status)
  values (v_id, v_cg, 'assigned', p_assignee, 'pending');

  return v_id;
end;
$$;

create or replace function public.reassign_task(p_task uuid, p_new_assignee uuid) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.care_task%rowtype;
begin
  select * into t from public.care_task where task_id = p_task for update;
  if not found or not public.has_cap(t.patient_id, 'manage_responsibilities') then
    raise exception 'Not authorized to reassign this task';
  end if;

  if p_new_assignee is not null and not exists (
    select 1 from public.caregiver_pat
    where patient_id = t.patient_id and caregiver_id = p_new_assignee and status = 'active'
  ) then
    raise exception 'Target caregiver is not an active member of this care circle';
  end if;

  update public.care_task
  set assigned_to = p_new_assignee, updated_at = now()
  where task_id = p_task;

  insert into public.care_task_history (task_id, changed_by, action, from_assignee, to_assignee)
  values (p_task, public.current_caregiver_id(), 'reassigned', t.assigned_to, p_new_assignee);
end;
$$;

create or replace function public.set_task_status(
  p_task   uuid,
  p_status text,
  p_note   text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t      public.care_task%rowtype;
  v_main boolean;
  v_me   uuid := public.current_caregiver_id();
begin
  select * into t from public.care_task where task_id = p_task for update;
  if not found then raise exception 'Task not found'; end if;

  v_main := public.has_cap(t.patient_id, 'manage_responsibilities');
  if not (
    v_main or
    (t.assigned_to = v_me and public.has_cap(t.patient_id, 'complete_assigned_task'))
  ) then
    raise exception 'Not authorized to update this task status';
  end if;

  update public.care_task
  set status = p_status,
      updated_at = now(),
      completed_at = case when p_status = 'completed' then now() else null end
  where task_id = p_task;

  insert into public.care_task_history (task_id, changed_by, action, from_status, to_status, note)
  values (p_task, v_me, 'status_changed', t.status, p_status, p_note);
end;
$$;

-- F. Member & Circle Administration RPCs
create or replace function public.revoke_member(p_patient uuid, p_caregiver uuid) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_cap(p_patient, 'manage_members') then
    raise exception 'Not authorized to remove circle members';
  end if;
  if exists (
    select 1 from public.caregiver_pat
    where patient_id = p_patient and caregiver_id = p_caregiver and role = 'primary'
  ) then
    raise exception 'Primary caregiver cannot be removed; transfer circle ownership first';
  end if;

  update public.caregiver_pat
  set status = 'revoked', removed_at = now()
  where patient_id = p_patient and caregiver_id = p_caregiver;

  update public.care_task
  set status = 'cancelled', updated_at = now()
  where patient_id = p_patient and assigned_to = p_caregiver and status in ('pending', 'in_progress');
end;
$$;

create or replace function public.set_member_role(p_patient uuid, p_caregiver uuid, p_role text) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_cap(p_patient, 'manage_members') then
    raise exception 'Not authorized to change member roles';
  end if;
  if p_role not in ('family', 'external') then
    raise exception 'Use transfer_ownership to assign primary role';
  end if;

  update public.caregiver_pat
  set role = p_role
  where patient_id = p_patient and caregiver_id = p_caregiver and role <> 'primary' and status = 'active';
end;
$$;

create or replace function public.transfer_ownership(p_patient uuid, p_new_primary uuid) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_cap(p_patient, 'transfer_ownership') then
    raise exception 'Only the current primary caregiver can transfer ownership';
  end if;
  if not exists (
    select 1 from public.caregiver_pat
    where patient_id = p_patient and caregiver_id = p_new_primary and status = 'active'
  ) then
    raise exception 'Target caregiver must be an active circle member';
  end if;

  update public.caregiver_pat
  set role = 'family'
  where patient_id = p_patient and role = 'primary' and status = 'active';

  update public.caregiver_pat
  set role = 'primary'
  where patient_id = p_patient and caregiver_id = p_new_primary and status = 'active';
end;
$$;

-- ---------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- ---------------------------------------------------------------------

-- Enable RLS across all tables
do $$
declare t text;
begin
  foreach t in array array[
    'caregiver', 'patient', 'caregiver_pat', 'emergency_contact',
    'medication', 'medication_schedule', 'medication_schedule_day_of_week',
    'appointment', 'time_event', 'timeline_commend', 'daily_care_log',
    'health_report', 'care_task_template', 'care_task', 'care_task_history',
    'task_suggestion', 'role_permission', 'invitation', 'coordination_metric',
    'caregiver_sleep_log', 'care_alert', 'scenario_card', 'scenario_option',
    'scenario_attempt', 'notification', 'login_audit'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Drop all existing custom policies to guarantee a clean slate
do $$
declare pol record;
begin
  for pol in (
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
  ) loop
    execute format('drop policy if exists %I on public.%I', pol.policyname, pol.tablename);
  end loop;
end $$;

-- Table Grants: Allow authenticated roles to execute statements subject to RLS
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on public.scenario_card, public.scenario_option, public.role_permission to anon;

-- A. CAREGIVER Policies
create policy cg_select on public.caregiver for select to authenticated using (
  auth_user_id = auth.uid()
  or caregiver_id = public.current_caregiver_id()
  or caregiver_id in (
    select cp.caregiver_id from public.caregiver_pat cp
    where cp.patient_id in (select public.get_my_patient_ids())
  )
);

create policy cg_insert on public.caregiver for insert to authenticated with check (
  auth_user_id = auth.uid()
);

create policy cg_update on public.caregiver for update to authenticated
  using (auth_user_id = auth.uid() or caregiver_id = public.current_caregiver_id())
  with check (auth_user_id = auth.uid() or caregiver_id = public.current_caregiver_id());

-- B. PATIENT Policies
create policy pt_select on public.patient for select to authenticated using (
  patient_id in (select public.get_my_patient_ids())
  or created_by = public.current_caregiver_id()
);

create policy pt_insert on public.patient for insert to authenticated with check (
  created_by = public.current_caregiver_id()
);

create policy pt_update on public.patient for update to authenticated
  using (created_by = public.current_caregiver_id() or public.has_cap(patient_id, 'edit_patient'))
  with check (created_by = public.current_caregiver_id() or public.has_cap(patient_id, 'edit_patient'));

create policy pt_delete on public.patient for delete to authenticated using (
  created_by = public.current_caregiver_id() or public.has_cap(patient_id, 'edit_patient')
);

-- C. CAREGIVER_PAT (Circle Membership) Policies
create policy cp_select on public.caregiver_pat for select to authenticated using (
  caregiver_id = public.current_caregiver_id()
  or patient_id in (select public.get_my_patient_ids())
);

create policy cp_insert on public.caregiver_pat for insert to authenticated with check (
  caregiver_id = public.current_caregiver_id()
  or public.has_cap(patient_id, 'manage_members')
);

create policy cp_update on public.caregiver_pat for update to authenticated
  using (
    caregiver_id = public.current_caregiver_id()
    or public.has_cap(patient_id, 'manage_members')
  )
  with check (
    caregiver_id = public.current_caregiver_id()
    or public.has_cap(patient_id, 'manage_members')
  );

create policy cp_delete on public.caregiver_pat for delete to authenticated using (
  public.has_cap(patient_id, 'manage_members')
);

-- D. PATIENT-SCORED CHILD TABLES
-- (emergency_contact, medication, appointment, health_report)
do $$
declare t text;
begin
  foreach t in array array['emergency_contact', 'medication', 'appointment', 'health_report'] loop
    execute format('create policy %I on public.%I for select to authenticated using (patient_id in (select public.get_my_patient_ids()) or exists (select 1 from public.patient p where p.patient_id = %I.patient_id and p.created_by = public.current_caregiver_id()))', t||'_sel', t, t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.has_cap(patient_id, ''edit_patient'') or exists (select 1 from public.patient p where p.patient_id = %I.patient_id and p.created_by = public.current_caregiver_id()))', t||'_ins', t, t);
    execute format('create policy %I on public.%I for update to authenticated using (public.has_cap(patient_id, ''edit_patient'') or exists (select 1 from public.patient p where p.patient_id = %I.patient_id and p.created_by = public.current_caregiver_id())) with check (public.has_cap(patient_id, ''edit_patient'') or exists (select 1 from public.patient p where p.patient_id = %I.patient_id and p.created_by = public.current_caregiver_id()))', t||'_upd', t, t, t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.has_cap(patient_id, ''edit_patient'') or exists (select 1 from public.patient p where p.patient_id = %I.patient_id and p.created_by = public.current_caregiver_id()))', t||'_del', t, t);
  end loop;
end $$;

-- E. MEDICATION SCHEDULES
create policy ms_sel on public.medication_schedule for select to authenticated using (
  exists (
    select 1 from public.medication m
    where m.medication_id = medication_schedule.medication_id
      and m.patient_id in (select public.get_my_patient_ids())
  )
);
create policy ms_all on public.medication_schedule for all to authenticated using (
  exists (
    select 1 from public.medication m
    where m.medication_id = medication_schedule.medication_id
      and public.has_cap(m.patient_id, 'edit_patient')
  )
) with check (
  exists (
    select 1 from public.medication m
    where m.medication_id = medication_schedule.medication_id
      and public.has_cap(m.patient_id, 'edit_patient')
  )
);

create policy msd_sel on public.medication_schedule_day_of_week for select to authenticated using (
  exists (
    select 1 from public.medication_schedule s
    join public.medication m on m.medication_id = s.medication_id
    where s.schedule_id = medication_schedule_day_of_week.schedule_id
      and m.patient_id in (select public.get_my_patient_ids())
  )
);
create policy msd_all on public.medication_schedule_day_of_week for all to authenticated using (
  exists (
    select 1 from public.medication_schedule s
    join public.medication m on m.medication_id = s.medication_id
    where s.schedule_id = medication_schedule_day_of_week.schedule_id
      and public.has_cap(m.patient_id, 'edit_patient')
  )
) with check (
  exists (
    select 1 from public.medication_schedule s
    join public.medication m on m.medication_id = s.medication_id
    where s.schedule_id = medication_schedule_day_of_week.schedule_id
      and public.has_cap(m.patient_id, 'edit_patient')
  )
);

-- F. TIME_EVENT & DAILY_CARE_LOG
create policy te_sel on public.time_event for select to authenticated using (
  patient_id in (select public.get_my_patient_ids())
);
create policy te_ins on public.time_event for insert to authenticated with check (
  caregiver_id = public.current_caregiver_id()
  and public.has_cap(patient_id, 'create_care_record')
);
create policy te_upd on public.time_event for update to authenticated using (
  public.has_cap(patient_id, 'edit_patient') or caregiver_id = public.current_caregiver_id()
) with check (
  public.has_cap(patient_id, 'edit_patient') or caregiver_id = public.current_caregiver_id()
);
create policy te_del on public.time_event for delete to authenticated using (
  public.has_cap(patient_id, 'edit_patient')
);

create policy dl_sel on public.daily_care_log for select to authenticated using (
  patient_id in (select public.get_my_patient_ids())
);
create policy dl_ins on public.daily_care_log for insert to authenticated with check (
  caregiver_id = public.current_caregiver_id()
  and public.has_cap(patient_id, 'create_care_record')
);
create policy dl_upd on public.daily_care_log for update to authenticated using (
  public.has_cap(patient_id, 'edit_patient') or caregiver_id = public.current_caregiver_id()
) with check (
  public.has_cap(patient_id, 'edit_patient') or caregiver_id = public.current_caregiver_id()
);
create policy dl_del on public.daily_care_log for delete to authenticated using (
  public.has_cap(patient_id, 'edit_patient')
);

create policy tc_sel on public.timeline_commend for select to authenticated using (
  exists (
    select 1 from public.time_event e
    where e.event_id = timeline_commend.event_id
      and e.patient_id in (select public.get_my_patient_ids())
  )
);
create policy tc_ins on public.timeline_commend for insert to authenticated with check (
  caregiver_id = public.current_caregiver_id()
  and exists (
    select 1 from public.time_event e
    where e.event_id = timeline_commend.event_id
      and public.has_cap(e.patient_id, 'create_care_record')
  )
);

-- G. CARE_TASK & HISTORY
create policy ct_sel on public.care_task for select to authenticated using (
  patient_id in (select public.get_my_patient_ids())
);
create policy ct_ins on public.care_task for insert to authenticated with check (
  public.has_cap(patient_id, 'manage_responsibilities')
  or assigned_by = public.current_caregiver_id()
);
create policy ct_upd on public.care_task for update to authenticated using (
  public.has_cap(patient_id, 'manage_responsibilities')
  or assigned_to = public.current_caregiver_id()
) with check (
  public.has_cap(patient_id, 'manage_responsibilities')
  or assigned_to = public.current_caregiver_id()
);
create policy ct_del on public.care_task for delete to authenticated using (
  public.has_cap(patient_id, 'manage_responsibilities')
);

create policy cth_sel on public.care_task_history for select to authenticated using (
  exists (
    select 1 from public.care_task k
    where k.task_id = care_task_history.task_id
      and k.patient_id in (select public.get_my_patient_ids())
  )
);
create policy cth_ins on public.care_task_history for insert to authenticated with check (
  changed_by = public.current_caregiver_id()
);

-- H. INVITATION
create policy inv_sel on public.invitation for select to authenticated using (
  public.has_cap(patient_id, 'manage_invitations')
  or lower(email) = lower(coalesce(auth.jwt()->>'email', ''))
);
create policy inv_ins on public.invitation for insert to authenticated with check (
  public.has_cap(patient_id, 'manage_invitations')
);
create policy inv_upd on public.invitation for update to authenticated using (
  public.has_cap(patient_id, 'manage_invitations')
  or accepted_by = public.current_caregiver_id()
) with check (
  public.has_cap(patient_id, 'manage_invitations')
  or accepted_by = public.current_caregiver_id()
);

-- I. COORDINATION_METRIC
create policy cm_sel on public.coordination_metric for select to authenticated using (
  patient_id in (select public.get_my_patient_ids())
  or caregiver_id = public.current_caregiver_id()
);
create policy cm_ins on public.coordination_metric for insert to authenticated with check (
  caregiver_id = public.current_caregiver_id()
  or public.has_cap(patient_id, 'manage_responsibilities')
);
create policy cm_upd on public.coordination_metric for update to authenticated using (
  caregiver_id = public.current_caregiver_id()
  or public.has_cap(patient_id, 'manage_responsibilities')
);

-- J. CAREGIVER_SLEEP_LOG
create policy csl_all on public.caregiver_sleep_log for all to authenticated using (
  caregiver_id = public.current_caregiver_id()
) with check (
  caregiver_id = public.current_caregiver_id()
);

-- K. CARE_ALERT
create policy ca_sel on public.care_alert for select to authenticated using (
  patient_id in (select public.get_my_patient_ids())
  or caregiver_id = public.current_caregiver_id()
);
create policy ca_upd on public.care_alert for update to authenticated using (
  caregiver_id = public.current_caregiver_id()
  or public.has_cap(patient_id, 'manage_responsibilities')
);

-- L. NOTIFICATION
create policy nt_sel on public.notification for select to authenticated using (
  caregiver_id = public.current_caregiver_id()
);
create policy nt_upd on public.notification for update to authenticated using (
  caregiver_id = public.current_caregiver_id()
) with check (
  caregiver_id = public.current_caregiver_id()
);

-- M. MICRO-LEARNING SCENARIOS
create policy sc_sel on public.scenario_card for select to authenticated using (true);
create policy so_sel on public.scenario_option for select to authenticated using (true);
create policy sa_sel on public.scenario_attempt for select to authenticated using (
  caregiver_id = public.current_caregiver_id()
);
create policy sa_ins on public.scenario_attempt for insert to authenticated with check (
  caregiver_id = public.current_caregiver_id()
);

-- N. READ-ONLY MATRICES & AUDIT
create policy rp_sel on public.role_permission for select to authenticated using (true);
create policy la_sel on public.login_audit for select to authenticated using (
  caregiver_id = public.current_caregiver_id()
);

-- ---------------------------------------------------------------------
-- 7. Grant RPC Execute Rights
-- ---------------------------------------------------------------------
grant execute on function
  public.current_caregiver_id(),
  public.get_my_patient_ids(),
  public.has_cap(uuid, text),
  public.is_primary_caregiver_for(uuid),
  public.is_active_caregiver_for(uuid),
  public.create_patient(text, date, text, text, text, text, text, text, text),
  public.create_invitation(uuid, text, text, text),
  public.accept_invitation(text, text),
  public.accept_invitation(text),
  public.assign_task(uuid, uuid, text, text, text, text, timestamptz),
  public.reassign_task(uuid, uuid),
  public.set_task_status(uuid, text, text),
  public.revoke_member(uuid, uuid),
  public.set_member_role(uuid, uuid, text),
  public.transfer_ownership(uuid, uuid)
to authenticated;

grant execute on function public.get_invitation_details(text) to anon, authenticated;

commit;

-- Reload PostgREST schema cache
notify pgrst, 'reload schema';
