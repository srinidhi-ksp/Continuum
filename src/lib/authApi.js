import { supabase, setCurrentCaregiverId } from "./supabaseClient";

export async function fetchCaregiverProfile(authUserId) {
  if (!authUserId) return null;
  let { data, error } = await supabase
    .from("caregiver")
    .select("*")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    const fallback = await supabase
      .from("caregiver")
      .select("*")
      .eq("caregiver_id", authUserId)
      .maybeSingle();
    data = fallback.data;
  }
  if (data) setCurrentCaregiverId(data.caregiver_id);
  return data || null;
}

export async function createCaregiverProfile({ caregiverId, authUserId = caregiverId, fullName, email, phone, language }) {
  if (!authUserId) throw new Error("Authenticated user ID is required to create a caregiver profile.");
  const existing = await fetchCaregiverProfile(authUserId);
  if (existing) return existing;

  // Check if a caregiver row with this email already exists (e.g. from seed or prior setup)
  if (email) {
    const { data: byEmail } = await supabase
      .from("caregiver")
      .select("*")
      .eq("email", email.trim().toLowerCase())
      .maybeSingle();

    if (byEmail) {
      const { data: updated, error: upError } = await supabase
        .from("caregiver")
        .update({
          auth_user_id: authUserId,
          full_name: fullName?.trim() || byEmail.full_name,
          phone: phone || byEmail.phone,
          language: language || byEmail.language,
          updated_at: new Date().toISOString(),
        })
        .eq("caregiver_id", byEmail.caregiver_id)
        .select("*")
        .single();
      if (!upError && updated) {
        setCurrentCaregiverId(updated.caregiver_id);
        return updated;
      }
    }
  }

  const payload = {
    auth_user_id: authUserId,
    full_name: (fullName || email?.split("@")[0] || "Caregiver").trim(),
    email: email.trim().toLowerCase(),
    phone: phone || null,
    language: language || "en",
  };
  const { data, error } = await supabase.from("caregiver").insert(payload).select("*").single();
  if (error) throw error;
  setCurrentCaregiverId(data.caregiver_id);
  return data;
}

export async function signUpCaregiver({ email, password, fullName, phone, language }) {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: { data: { full_name: fullName, phone } },
  });
  if (error) throw error;
  const user = data?.user;
  let caregiver = null;
  if (user && data.session) {
    caregiver = await createCaregiverProfile({
      authUserId: user.id, fullName, email, phone, language,
    });
  }
  return { user, caregiver, session: data?.session, needsEmailConfirmation: !!user && !data?.session };
}

export async function signInCaregiver({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(), password,
  });
  if (error) throw error;
  const user = data?.user;
  if (!user) return { user: null, caregiver: null, session: null };
  let caregiver = await fetchCaregiverProfile(user.id);
  if (!caregiver) {
    caregiver = await createCaregiverProfile({
      authUserId: user.id,
      fullName: user.user_metadata?.full_name,
      email: user.email || email,
      phone: user.user_metadata?.phone,
    });
  }
  setCurrentCaregiverId(caregiver.caregiver_id);
  return { user, caregiver, session: data.session };
}

export async function signOutCaregiver() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  setCurrentCaregiverId(null);
}
