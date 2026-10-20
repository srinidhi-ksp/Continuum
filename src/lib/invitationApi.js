import { supabase } from "./supabaseClient";

function generateSecureToken() {
  if (typeof crypto === "undefined" || typeof crypto.randomUUID !== "function") {
    throw new Error("Secure invitation tokens are unavailable in this browser.");
  }
  return crypto.randomUUID().replace(/-/g, "");
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
    token,
  };

  const { data, error } = await supabase
    .from("care_circle_invite")
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error("[invitationApi] Failed to create invitation:", error);
    throw error;
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

  const { data, error } = await supabase.rpc("lookup_care_circle_invitation", {
    p_token: token,
  });

  if (error) {
    console.error("[invitationApi] Failed to look up invitation:", error);
    throw error;
  }
  const invite = data?.[0];
  if (!invite) return null;
  return {
    ...invite,
    isValid: invite.is_valid,
    reason: invite.invalid_reason,
    patient: { full_name: invite.patient_name },
    inviter: { full_name: invite.inviter_name },
  };
}

export async function acceptInvitation(token, caregiverId) {
  if (!token || !caregiverId) {
    throw new Error("Token and caregiverId are required to accept an invitation.");
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user || user.id !== caregiverId) {
    throw new Error("The signed-in account does not match the invitation recipient.");
  }
  const { data, error } = await supabase.rpc("accept_care_circle_invitation", {
    p_token: token,
  });
  if (error) {
    console.error("[invitationApi] Failed to accept invitation:", error);
    throw error;
  }
  const accepted = data?.[0];
  if (!accepted) throw new Error("The invitation could not be accepted.");
  return { patientId: accepted.patient_id, patientName: accepted.patient_name };
}
