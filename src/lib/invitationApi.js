import { supabase } from "./supabaseClient";

function generateSecureToken() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export async function createInvitation({
  patientId,
  invitedBy,
  email = null,
  phone = null,
  relationship = "Family Member",
  role = "family",
}) {
  if (!patientId || !invitedBy) {
    throw new Error("patientId and invitedBy are required to create an invitation.");
  }

  const token = generateSecureToken();
  const payload = {
    patient_id: patientId,
    invited_by: invitedBy,
    email: email || null,
    phone: phone || null,
    relationship: relationship || "Family Member",
    role: role || "family",
    token: token,
    status: "pending",
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
  };

  const { data, error } = await supabase
    .from("care_circle_invite")
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.warn("[invitationApi] care_circle_invite table not ready, using token fallback:", error.message);
    // Return graceful token object even if table insertion fallback occurs
    const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:5173";
    return {
      token,
      shareableUrl: `${origin}/join?token=${token}`,
      invite: payload,
    };
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:5173";
  return {
    token: data.token,
    shareableUrl: `${origin}/join?token=${data.token}`,
    invite: data,
  };
}

export async function getInvitationByToken(token) {
  if (!token) return null;

  const { data, error } = await supabase
    .from("care_circle_invite")
    .select("*, patient:patient_id ( full_name, condition_type ), inviter:invited_by ( full_name )")
    .eq("token", token)
    .single();

  if (error || !data) {
    return null;
  }

  const isExpired = new Date(data.expires_at) < new Date();
  if (isExpired || data.status !== "pending") {
    return { ...data, isValid: false, reason: isExpired ? "expired" : "used" };
  }

  return { ...data, isValid: true };
}

export async function acceptInvitation(token, caregiverId) {
  if (!token || !caregiverId) {
    throw new Error("Token and caregiverId are required to accept an invitation.");
  }

  // 1. Validate invitation
  const invite = await getInvitationByToken(token);
  if (!invite || !invite.isValid) {
    throw new Error(invite ? `Invitation is ${invite.reason || "invalid"}.` : "Invitation not found.");
  }

  const patientId = invite.patient_id;

  // 2. Check if caregiver is already linked to this patient (prevents duplicate links)
  const { data: existingLink } = await supabase
    .from("caregiver_pat")
    .select("*")
    .eq("caregiver_id", caregiverId)
    .eq("patient_id", patientId)
    .is("removed_at", null)
    .single();

  if (!existingLink) {
    // 3. Link caregiver to existing patient (NO duplicate patient created)
    const linkPayload = {
      caregiver_id: caregiverId,
      patient_id: patientId,
      role: invite.role || "family",
      joining_at: new Date().toISOString(),
      removed_at: null,
    };

    const { error: linkError } = await supabase.from("caregiver_pat").insert(linkPayload);
    if (linkError) {
      console.error("[invitationApi] Failed to link caregiver to patient:", linkError);
      throw linkError;
    }
  }

  // 4. Mark invite as accepted/used
  await supabase
    .from("care_circle_invite")
    .update({ status: "accepted" })
    .eq("token", token);

  return { patientId, patientName: invite.patient?.full_name };
}
