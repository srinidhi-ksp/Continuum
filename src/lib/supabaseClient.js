import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "[supabaseClient] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. " +
      "Copy .env.example to .env and fill in your project's values."
  );
}

export const supabase = createClient(supabaseUrl || "", supabaseAnonKey || "");

// ── Caregiver ID Management ─────────────────────────────────────────────
// The canonical source of truth is the Supabase Auth session (user.id).
// These helpers exist so that API-layer files (dailyCareApi, medicationApi,
// etc.) that need a caregiver_id for write operations can obtain one
// without importing React context.

let _caregiverId = null;

export function setCurrentCaregiverId(id) {
  _caregiverId = id || null;
}

export function getCaregiverId() {
  return _caregiverId;
}

export async function getActiveCaregiverId() {
  if (_caregiverId) return _caregiverId;
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id || null;
}
