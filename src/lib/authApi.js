import { supabase, setCurrentCaregiverId } from "./supabaseClient";

export async function fetchCaregiverProfile(caregiverId) {
  if (!caregiverId) return null;
  const { data, error } = await supabase
    .from("caregiver")
    .select("*")
    .eq("caregiver_id", caregiverId)
    .single();

  if (error && error.code !== "PGRST116") {
    console.warn("[authApi] Failed to fetch caregiver profile:", error.message);
  }
  return data || null;
}

export async function createCaregiverProfile({ caregiverId, fullName, email, phone, language }) {
  const payload = {
    caregiver_id: caregiverId,
    full_name: fullName,
    email: email,
    phone: phone || null,
    language: language || null,
    // Supabase Auth manages passwords — password_hash is a legacy NOT NULL column
    // kept for schema compatibility; it must be non-null but is never used for auth.
    password_hash: "SUPABASE_AUTH_MANAGED",
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("caregiver")
    .upsert(payload, { onConflict: "caregiver_id" })
    .select()
    .single();

  if (error) {
    console.error("[authApi] Failed to create/upsert caregiver profile:", error);
    throw error;
  }
  setCurrentCaregiverId(data.caregiver_id);
  return data;
}

export async function signUpCaregiver({ email, password, fullName, phone, language }) {
  // Step 1: Create Supabase Auth user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, phone },
    },
  });

  if (authError) throw authError;

  const user = authData?.user;
  let caregiverProfile = null;

  if (user) {
    setCurrentCaregiverId(user.id);

    // Step 2: Create caregiver profile row using the auth user's UUID
    // This MUST happen before any caregiver_pat inserts (FK constraint)
    try {
      caregiverProfile = await createCaregiverProfile({
        caregiverId: user.id,
        fullName: fullName || email.split("@")[0],
        email,
        phone,
        language,
      });
    } catch (profileErr) {
      console.warn("[authApi] Profile creation failed:", profileErr.message);
      // Return a temporary in-memory profile — onboarding will retry on submit
      caregiverProfile = {
        caregiver_id: user.id,
        full_name: fullName || email.split("@")[0],
        email,
        phone,
        language,
      };
    }
  }

  return { user, caregiver: caregiverProfile, session: authData?.session };
}

export async function signInCaregiver({ email, password }) {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError) throw authError;

  const user = authData?.user;
  if (user) {
    setCurrentCaregiverId(user.id);
    let profile = await fetchCaregiverProfile(user.id);
    if (!profile) {
      // First login after email-confirmation flow (profile may not yet exist)
      profile = await createCaregiverProfile({
        caregiverId: user.id,
        fullName: user.user_metadata?.full_name || email.split("@")[0],
        email,
        phone: user.user_metadata?.phone || null,
      });
    }
    return { user, caregiver: profile, session: authData?.session };
  }

  return { user: null, caregiver: null, session: null };
}

export async function signOutCaregiver() {
  const { error } = await supabase.auth.signOut();
  if (error) console.warn("[authApi] Error signing out:", error.message);
}
