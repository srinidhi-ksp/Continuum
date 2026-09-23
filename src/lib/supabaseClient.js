import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Fails loudly in the console instead of silently returning empty data
  // everywhere, which is much faster to debug than a blank patient list.
  console.error(
    "[supabaseClient] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. " +
      "Copy .env.example to .env and fill in your project's values."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Temporary stand-in for real auth: there is no login screen yet, so the
// whole app acts as this one caregiver. Swap this for the authenticated
// user's id once Supabase Auth is wired up.
export const CURRENT_CAREGIVER_ID = import.meta.env.VITE_CURRENT_CAREGIVER_ID;
