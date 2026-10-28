# Continuum frontend/schema review (27 Oct 2026)

## Frontend changes in this package
- Removed the local Supabase imitation that silently loaded pre-seeded localStorage fixtures when `.env` was missing.
- Removed production source demo patient/caregiver/care/timeline data modules. Test fixtures remain under `src/test` only.
- Removed prefilled login email/password.
- Registration now displays an email-confirmation message and does not navigate to the authenticated dashboard without an active session.
- A dashboard with no linked patient now displays an explicit empty state instead of rendering a blank page.
- The assistant no longer invents canned patient answers or reports a fabricated score when its backend is down. It requires `VITE_BACKEND_URL`; simple out-of-scope and medication-change requests are safely declined client-side. Server-side policy enforcement is still required.
- Score recalculation no longer uses `demo-token` or creates a fake local score when `/ml/predict` is unavailable. It requires the current Supabase access token and reports backend errors.
- Removed `scenario_attempts` from the frontend ML feature payload. Missing sleep data remains `null` instead of being represented as zero.
- Added `VITE_BACKEND_URL` to `.env.example`.

## Important: this is not a full backend implementation
The client cannot make `/ml/predict` secure by itself. The server must verify the Supabase JWT, derive/verify the authenticated caregiver identity, check patient membership, validate the exact trained-model feature contract, and persist the result. The backend must also implement the assistant's scope/medical safety policy and the scenario-generation endpoint. Do not deploy sensitive patient data until RLS policies are enabled and tested.

## Why the originally attached `04_continuum_comprehensive_seed.sql` is unsafe/unusable as-is
1. It hard-requires six exact email addresses to exist and be email-verified in `auth.users`. Those are sample addresses from the script, not guaranteed to be your accounts.
2. It then looks up caregiver rows by those same emails. A clean schema has no auth-user trigger until a compatible migration is installed; existing Auth users do not automatically have `public.caregiver` rows. The scalar lookups can therefore return `NULL`, causing foreign-key/not-null failures.
3. Its header requires `01_migration`, `02_schema`, and `03_analytics`, but only the clean schema and the RBAC migration were provided in this review. The RBAC migration must not be run as-is because it contains incompatible references such as `caregiver.password_hash` (not present in the clean schema) and tries to create tables already present.
4. It inserts fixed patient IDs and a large amount of synthetic patient/medication data. Running it repeatedly can collide with existing rows because many inserts are not idempotent. The sample medication/clinical details must never be treated as real patient instructions.
5. It inserts a hand-written `coordination_metric`; that would make the dashboard appear to have a model score even when `/ml/predict` has never run. This conflicts with your requirement that scores come from live features and the trained model.
6. The `medication_schedule_day_of_week` section uses `INSERT ... SELECT`, which is a valid SQL pattern; its day-of-week values and constraints should still be checked against the live table definition. The main blockers are the six-account prerequisite, missing caregiver profiles, migration/schema compatibility, and the static score data.

## Safer demo seed included
`04_demo_seed_one_verified_user.sql` requires one email-verified Auth user, creates/updates that user's caregiver profile, and inserts a single clearly labelled synthetic patient plus a few UI-test records. It is rerunnable using stable demo IDs. It does not create fake Auth users, store passwords, insert a static coordination score, or include medication prescriptions.

Run the demo seed only after registering and verifying at least one real account. It is intended for development/testing, not real patient data. The clean schema says RLS is disabled by default; configure and test policies before deploying real patient information.

## Requested work still requiring backend/review work
- A full role-safe create-patient / create-care-circle / accept-invite workflow requires the compatible RBAC migration and RLS policies. Do not run the old migration unchanged.
- Task UI and RPC wiring must be checked against the server's actual `assign_task`, `reassign_task`, and `set_task_status` signatures and permissions.
- Strain Index / Action Engine, Random Forest and Isolation Forest retraining, and pytest JWT authorization tests are backend/model work and cannot be completed or validated from a frontend-only ZIP.
- Personalized LLM scenarios require the backend endpoint and its structured output validation. The frontend still uses the existing learning UI/API contract; server implementation must be verified.

## Environment setup
Copy `.env.example` to `.env` and set the Supabase project URL, public anon/publishable key, and backend URL. Never put a Supabase service-role key or Gemini API key in frontend variables.
