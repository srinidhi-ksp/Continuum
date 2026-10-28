-- CONTINUUM: minimal synthetic demo seed for the CLEAN schema.
-- Run only after at least one real caregiver has registered in Supabase Auth.
-- This does NOT create fake auth users or passwords. It creates one clearly labelled demo patient.
-- Safe to re-run: stable IDs are used for the demo patient/tasks/logs/events/notification.
-- Do not use these synthetic records as real clinical information or ML training truth.

begin;

do $$
declare
  v_auth_user_id uuid;
  v_email text;
  v_name text;
  v_caregiver_id uuid;
  v_patient_id uuid := 'd0000000-0000-4000-8000-000000000001';
begin
  select id, lower(email), coalesce(nullif(raw_user_meta_data->>'full_name',''), split_part(email,'@',1))
    into v_auth_user_id, v_email, v_name
  from auth.users
  where email is not null and coalesce(email_confirmed_at, confirmed_at) is not null
  order by created_at
  limit 1;

  if v_auth_user_id is null then
    raise exception 'No email-verified Supabase Auth user found. Register and verify one caregiver account first, then rerun this seed.';
  end if;

  insert into public.caregiver (auth_user_id, full_name, email)
  values (v_auth_user_id, v_name, v_email)
  on conflict (auth_user_id) do update
    set full_name = excluded.full_name,
        email = excluded.email,
        updated_at = now()
  returning caregiver_id into v_caregiver_id;

  if v_caregiver_id is null then
    select caregiver_id into v_caregiver_id from public.caregiver where auth_user_id = v_auth_user_id;
  end if;

  insert into public.patient
    (patient_id, full_name, dob, gender, condition_type, time_zone, medical_notes, created_by)
  values
    (v_patient_id, 'Continuum Demo Patient', null, null, 'Demo data only', 'Asia/Kolkata',
     'Synthetic demonstration record. Not a real patient and not clinical guidance.', v_caregiver_id)
  on conflict (patient_id) do update set
    full_name = excluded.full_name,
    condition_type = excluded.condition_type,
    medical_notes = excluded.medical_notes,
    created_by = excluded.created_by,
    updated_at = now();

  insert into public.caregiver_pat
    (caregiver_id, patient_id, role, status, relationship, alert_preference, alert_priority, assigned_responsibilities)
  values
    (v_caregiver_id, v_patient_id, 'primary', 'active', 'Demo caregiver', 'all', 1,
     array['care coordination','daily logs','appointments'])
  on conflict (caregiver_id, patient_id) do update set
    role = 'primary', status = 'active', relationship = excluded.relationship,
    alert_preference = excluded.alert_preference,
    assigned_responsibilities = excluded.assigned_responsibilities;

  insert into public.care_task
    (task_id, patient_id, title, description, category, priority, assigned_to, assigned_by, due_at, status, is_essential)
  values
    ('d0000000-0000-4000-8000-000000000011', v_patient_id, 'Review daily care notes', 'Review and update the synthetic demo care notes.', 'care_coordination', 'normal', v_caregiver_id, v_caregiver_id, now() + interval '3 hours', 'pending', false),
    ('d0000000-0000-4000-8000-000000000012', v_patient_id, 'Check care-circle details', 'Confirm the caregiver profile and patient details are correct.', 'care_coordination', 'low', v_caregiver_id, v_caregiver_id, now() + interval '1 day', 'pending', false)
  on conflict (task_id) do update set
    title = excluded.title, description = excluded.description, assigned_to = excluded.assigned_to,
    assigned_by = excluded.assigned_by, due_at = excluded.due_at, status = excluded.status;

  insert into public.daily_care_log (log_id, patient_id, caregiver_id, type, quantity, notes, created_at)
  values
    ('d0000000-0000-4000-8000-000000000021', v_patient_id, v_caregiver_id, 'meal', 'Demo entry', 'Synthetic seed record — replace with real care data.', now() - interval '2 hours'),
    ('d0000000-0000-4000-8000-000000000022', v_patient_id, v_caregiver_id, 'activity', null, 'Synthetic activity log for UI testing only.', now() - interval '1 hour')
  on conflict (log_id) do update set
    type = excluded.type, quantity = excluded.quantity, notes = excluded.notes, created_at = excluded.created_at;

  insert into public.time_event (event_id, patient_id, caregiver_id, title, event_type, created_at)
  values
    ('d0000000-0000-4000-8000-000000000031', v_patient_id, v_caregiver_id, 'Demo care record created', 'care_coordination', now() - interval '2 hours'),
    ('d0000000-0000-4000-8000-000000000032', v_patient_id, v_caregiver_id, 'Demo activity logged', 'activity', now() - interval '1 hour')
  on conflict (event_id) do update set title = excluded.title, event_type = excluded.event_type, created_at = excluded.created_at;

  insert into public.caregiver_sleep_log (caregiver_id, sleep_date, hours)
  values (v_caregiver_id, current_date, 7.0)
  on conflict (caregiver_id, sleep_date) do update set hours = excluded.hours;

  insert into public.notification (notification_id, caregiver_id, title, message, type, is_read)
  values ('d0000000-0000-4000-8000-000000000041', v_caregiver_id, 'Demo data loaded',
          'Synthetic demo data is available. Replace it with real records before evaluation.', 'confirmation', false)
  on conflict (notification_id) do update set title = excluded.title, message = excluded.message, is_read = excluded.is_read;
end $$;

commit;

-- No coordination_metric is inserted: the score must be generated by the authenticated ML endpoint.
