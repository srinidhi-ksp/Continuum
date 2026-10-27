import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const isLocalMode = false;
export const hasSupabaseConfig = Boolean(
  supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith("https://") &&
  !supabaseUrl.includes("your-project-ref") && !supabaseAnonKey.includes("your-anon-public-key")
);

// Never fall back to seeded localStorage/demo data. Misconfiguration is surfaced to the UI.
// Using sessionStorage ensures each tab has its own independent session, allowing multiple
// distinct user logins in different tabs without cross-tab token overwrites.
export const supabase = createClient(
  hasSupabaseConfig ? supabaseUrl : "https://missing-config.supabase.co",
  hasSupabaseConfig ? supabaseAnonKey : "missing-public-anon-key",
  {
    auth: {
      storage: typeof window !== "undefined" ? window.sessionStorage : undefined,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  }
);

let currentCaregiverId = null;
export function setCurrentCaregiverId(id) { currentCaregiverId = id || null; }
export function getCaregiverId() { return currentCaregiverId; }
export async function getActiveCaregiverId() {
  if (currentCaregiverId) return currentCaregiverId;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) return null;
  const { data, error } = await supabase.from("caregiver").select("caregiver_id")
    .eq("auth_user_id", session.user.id).maybeSingle();
  if (error) throw error;
  currentCaregiverId = data?.caregiver_id || null;
  return currentCaregiverId;
}
