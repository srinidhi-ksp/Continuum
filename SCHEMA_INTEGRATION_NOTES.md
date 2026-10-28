# Continuum frontend — schema alignment notes

This frontend update aligns database calls with `00_continuum_clean_schema.sql`.

## Important schema mappings

- Authentication: `auth.users.id` is stored in `caregiver.auth_user_id`; frontend foreign keys use the separate `caregiver.caregiver_id` value.
- Care circle: active membership is determined by `caregiver_pat.status = 'active'`. The schema has no `removed_at` column.
- Invitations: use `invitation` and store only a SHA-256 `token_hash`; the raw token is only included in the shareable URL.
- Appointments: persist `appointment_date`, `hospital`, `doctor_name`, `created_by`, and `notes`. Appointment status/specialty are not columns in the supplied schema, so the UI derives the display status from the appointment date and does not write a status column.
- Daily care: `daily_care_log` does not have `event_id`; timeline events are stored independently in `time_event`.
- Caregiver sleep: coordination feature aggregation reads `caregiver_sleep_log.hours`.
- Settings: caregiver name, phone, and language update the `caregiver` row.

## Setup

1. In the frontend directory, copy `.env.example` to `.env`.
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to your project's public client values.
3. Install dependencies with `npm install` and run `npm run dev`.
4. Run database migrations/RLS policies appropriate for your deployment. The supplied clean schema says RLS is disabled by default; do not deploy sensitive patient data without enabling and testing appropriate RLS policies.

## Database warning

The supplied clean schema starts by dropping every table and view in the `public` schema. It is destructive. Run it only against a database you intentionally want to reset, after taking a backup. The corrected SQL file fixes the invalid partial unique constraint syntax and the `health_report` index statement, plus makes two nullable actor references consistent with `ON DELETE SET NULL`.

## Validation status

All frontend JavaScript and JSX source files passed Babel syntax parsing, and the schema-aligned files passed ESLint. A production Vite build could not be completed in this environment because the uploaded `node_modules` lacks the platform-specific Rolldown native binding; reinstall dependencies on your machine before building.

The root file `database_schema_corrected.sql` is a corrected copy of the supplied schema for reference. Review its destructive reset behavior before executing it.
