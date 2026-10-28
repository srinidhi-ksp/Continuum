import { supabase } from "./supabaseClient";

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function newToken() {
  if (crypto?.randomUUID) return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  return `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export function extractToken(input) {
  if (!input) return "";
  const str = input.trim();
  if (str.includes("token=")) {
    return str.split("token=")[1].split("&")[0];
  }
  return str;
}

export async function createInvitation({ patientId, invitedBy, email, relationship = "Family Member", role = "family" }) {
  if (!patientId || !invitedBy) throw new Error("Patient ID and inviter caregiver ID are required.");
  if (!["family", "external"].includes(role)) throw new Error("Invitation role must be family or external.");
  
  const token = newToken();
  const tokenHash = await sha256Hex(token);
  // If email is not specified (e.g. general circle shareable link), use a placeholder to satisfy DB NOT NULL constraint
  const targetEmail = email && email.trim() ? email.trim().toLowerCase() : `invitee-${Date.now()}@carecircle.link`;
  
  const payload = {
    patient_id: patientId,
    invited_by: invitedBy,
    email: targetEmail,
    relationship: relationship || "Family Member",
    role,
    token_hash: tokenHash,
    status: "pending",
    expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
  };
  const { data, error } = await supabase.from("invitation").insert(payload).select("*").single();
  if (error) throw error;
  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:5173";
  return { token, shareableUrl: `${origin}/join?token=${encodeURIComponent(token)}`, invite: data };
}

export async function getInvitationByToken(token) {
  if (!token) return null;
  const cleanToken = extractToken(token);

  // 1. Try secure RPC get_invitation_details (accessible to anon & authenticated)
  try {
    if (typeof supabase?.rpc === "function") {
      const { data: rpcData, error: rpcErr } = await supabase.rpc("get_invitation_details", {
        p_token: cleanToken,
      });
      if (!rpcErr && rpcData) {
        const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
        if (row) {
          const expired = new Date(row.expires_at) < new Date();
          const isValid = !expired && row.status === "pending";
          return {
            invitation_id: row.invitation_id,
            patient_id: row.patient_id,
            email: row.email,
            role: row.role,
            relationship: row.relationship,
            status: row.status,
            expires_at: row.expires_at,
            patient: { full_name: row.patient_name, condition_type: row.condition_type },
            inviter: { full_name: row.inviter_name },
            isValid,
            reason: expired ? "expired" : row.status !== "pending" ? row.status : null,
          };
        }
      }
    }
  } catch (rpcEx) {
    console.warn("[invitationApi] get_invitation_details RPC notice:", rpcEx);
  }

  // 2. Direct table fallback if RPC not yet deployed
  const tokenHash = await sha256Hex(cleanToken);
  let { data, error } = await supabase.from("invitation")
    .select("*, patient:patient_id ( full_name, condition_type ), inviter:invited_by ( full_name )")
    .eq("token_hash", tokenHash).maybeSingle();
    
  if (!data) {
    const fallback = await supabase.from("invitation")
      .select("*, patient:patient_id ( full_name, condition_type ), inviter:invited_by ( full_name )")
      .eq("token", cleanToken).maybeSingle();
    if (fallback.data) {
      data = fallback.data;
      error = fallback.error;
    }
  }

  if (error || !data) return null;
  const expired = new Date(data.expires_at) < new Date();
  return { ...data, isValid: !expired && data.status === "pending", reason: expired ? "expired" : data.status !== "pending" ? data.status : null };
}

export async function acceptInvitation(token, caregiverId, customRelationship = null) {
  if (!token || !caregiverId) throw new Error("Token and caregiverId are required.");
  const cleanToken = extractToken(token);

  // 1. Try atomic accept_invitation RPC (SECURITY DEFINER)
  try {
    if (typeof supabase?.rpc === "function") {
      const { data: acceptedPatientId, error: rpcErr } = await supabase.rpc("accept_invitation", {
        p_token: cleanToken,
        p_relationship: customRelationship || null,
      });
      if (!rpcErr && acceptedPatientId) {
        const { data: patientRow } = await supabase
          .from("patient")
          .select("patient_id, full_name")
          .eq("patient_id", acceptedPatientId)
          .maybeSingle();
        return {
          patientId: acceptedPatientId,
          patientName: patientRow?.full_name || "Patient",
        };
      }
    }
  } catch (rpcEx) {
    console.warn("[invitationApi] accept_invitation RPC fallback:", rpcEx);
  }

  // 2. Direct table fallback
  const invite = await getInvitationByToken(cleanToken);
  if (!invite?.isValid) throw new Error(invite ? `Invitation is ${invite.reason || "invalid"}.` : "Invitation not found.");
  
  const { data: caregiver } = await supabase.from("caregiver").select("email").eq("caregiver_id", caregiverId).maybeSingle();

  const isGenericInvite = !invite.email || invite.email.includes("@carecircle.link") || invite.email.includes("@continuum.local") || invite.email === "family@example.com";
  if (!isGenericInvite && caregiver?.email && caregiver.email.toLowerCase() !== invite.email.toLowerCase()) {
    throw new Error(`Sign in with the email address this invitation was sent to (${invite.email}).`);
  }

  const relationship = customRelationship || invite.relationship || "Family Member";

  const { data: existing } = await supabase.from("caregiver_pat").select("caregiver_id, status")
    .eq("caregiver_id", caregiverId).eq("patient_id", invite.patient_id).maybeSingle();
  if (existing) {
    if (existing.status !== "active") {
      const { error } = await supabase.from("caregiver_pat").update({
        role: invite.role, relationship, status: "active", joining_at: new Date().toISOString(),
      }).eq("caregiver_id", caregiverId).eq("patient_id", invite.patient_id);
      if (error) throw error;
    }
  } else {
    const { error } = await supabase.from("caregiver_pat").insert({
      caregiver_id: caregiverId, patient_id: invite.patient_id, role: invite.role,
      relationship, status: "active",
    });
    if (error) throw error;
  }
  
  const inviteId = invite.invitation_id || invite.invite_id;
  const idCol = invite.invitation_id ? "invitation_id" : "invite_id";
  const { error: updateError } = await supabase.from("invitation").update({
    status: "accepted", accepted_by: caregiverId, accepted_at: new Date().toISOString(),
  }).eq(idCol, inviteId);
  if (updateError) throw updateError;
  return { patientId: invite.patient_id, patientName: invite.patient?.full_name };
}
