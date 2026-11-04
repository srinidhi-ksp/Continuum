import { supabase } from "./supabaseClient";
import { verifyPrimaryCaregiver } from "./taskApi";

const BACKEND_URL = (
  import.meta.env.VITE_BACKEND_URL ||
  (typeof window !== "undefined" && !window.location.hostname.includes("localhost")
    ? "https://continuum-server-4zju.onrender.com"
    : "http://localhost:8000")
).replace(/\/+$/, "");

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function newToken() {
  if (crypto?.randomUUID) return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  return `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export function getAppBaseUrl() {
  const envUrl = import.meta.env?.VITE_PUBLIC_APP_URL;
  if (envUrl && typeof envUrl === "string" && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, "");
  }
  if (typeof window !== "undefined" && window.location?.origin) {
    const origin = window.location.origin;
    if (!origin.includes("localhost") && !origin.includes("127.0.0.1")) {
      return origin;
    }
  }
  return "https://continuum-beta-seven.vercel.app";
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

  const isPrimary = await verifyPrimaryCaregiver(patientId, invitedBy);
  if (!isPrimary) {
    throw new Error("Unauthorized: Only the Main/Primary Caregiver can invite caregivers.");
  }
  if (!["family", "external"].includes(role)) throw new Error("Invitation role must be family or external.");
  
  const targetEmail = email && email.trim() ? email.trim().toLowerCase() : `invitee-${Date.now()}@carecircle.link`;

  // 1. Try Backend API first (handles duplicate pending invitations by reusing/refreshing token)
  try {
    const res = await fetch(`${BACKEND_URL}/api/invitations/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patient_id: patientId,
        invited_by: invitedBy,
        email: targetEmail,
        relationship: relationship || "Family Member",
        role: role || "family",
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.token && data?.shareableUrl) {
        return {
          token: data.token,
          shareableUrl: data.shareableUrl,
          invite: data.invite,
        };
      }
    }
  } catch (backendErr) {
    console.warn("[invitationApi] Backend create invitation notice, falling back to direct database:", backendErr);
  }

  // 2. Direct database fallback: safely reuse or refresh prior pending invitation to avoid uq_invitation_pending conflict
  const token = newToken();
  const tokenHash = await sha256Hex(token);
  const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString();

  if (!targetEmail.includes("@carecircle.link")) {
    try {
      const { data: existing } = await supabase
        .from("invitation")
        .select("invitation_id")
        .eq("patient_id", patientId)
        .ilike("email", targetEmail)
        .eq("status", "pending")
        .maybeSingle();

      if (existing?.invitation_id) {
        const { data: updated, error: updErr } = await supabase
          .from("invitation")
          .update({
            token_hash: tokenHash,
            role,
            relationship: relationship || "Family Member",
            invited_by: invitedBy,
            expires_at: expiresAt,
            status: "pending",
          })
          .eq("invitation_id", existing.invitation_id)
          .select("*")
          .single();
        if (!updErr && updated) {
          const baseUrl = getAppBaseUrl();
          return { token, shareableUrl: `${baseUrl}/join?token=${encodeURIComponent(token)}`, invite: updated };
        }
      }
    } catch (reuseErr) {
      console.warn("[invitationApi] Non-fatal pending reuse notice:", reuseErr);
    }
  }

  const payload = {
    patient_id: patientId,
    invited_by: invitedBy,
    email: targetEmail,
    relationship: relationship || "Family Member",
    role,
    token_hash: tokenHash,
    status: "pending",
    expires_at: expiresAt,
  };
  const { data, error } = await supabase.from("invitation").insert(payload).select("*").single();
  if (error) throw error;
  const baseUrl = getAppBaseUrl();
  return { token, shareableUrl: `${baseUrl}/join?token=${encodeURIComponent(token)}`, invite: data };
}

export async function getInvitationByToken(token) {
  if (!token) return null;
  const cleanToken = extractToken(token);

  // 1. Try Backend Invitation API first (uses server-side service role, bypasses RLS for anon visitors)
  try {
    const res = await fetch(`${BACKEND_URL}/api/invitations/validate?token=${encodeURIComponent(cleanToken)}`);
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === "object") {
        if (!data.isValid && data.reason === "not_found") {
          return null;
        }
        return {
          invitation_id: data.invitation_id,
          patient_id: data.patient_id,
          email: data.email,
          role: data.role,
          relationship: data.relationship,
          status: data.status,
          expires_at: data.expires_at,
          accountExists: Boolean(data.accountExists),
          patient: data.patient || { full_name: "Patient", condition_type: "Care Coordination" },
          inviter: data.inviter || { full_name: "Primary Caregiver" },
          isValid: Boolean(data.isValid),
          reason: data.reason || null,
        };
      }
    }
  } catch (backendErr) {
    console.warn("[invitationApi] Backend validation notice, falling back to direct database:", backendErr);
  }

  // 2. Try secure RPC get_invitation_details if available
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

  // 3. Direct table fallback if user is authenticated and has permission
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

  // 1. Try backend accept endpoint first
  try {
    const res = await fetch(`${BACKEND_URL}/api/invitations/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: cleanToken,
        caregiver_id: caregiverId,
        relationship: customRelationship || null,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      return {
        patientId: data.patientId,
        patientName: data.patientName,
      };
    } else {
      const errData = await res.json().catch(() => ({}));
      if (errData?.detail) {
        throw new Error(errData.detail);
      }
    }
  } catch (backendErr) {
    if (backendErr.message?.includes("specifically to")) {
      throw backendErr;
    }
    console.warn("[invitationApi] Backend accept notice, falling back to direct database:", backendErr);
  }

  // 2. Direct database fallback
  const invite = await getInvitationByToken(cleanToken);
  if (!invite?.isValid) throw new Error(invite ? `Invitation is ${invite.reason || "invalid"}.` : "Invitation not found.");

  const { data: caregiver } = await supabase.from("caregiver").select("email").eq("caregiver_id", caregiverId).maybeSingle();

  const isGenericInvite = !invite.email || invite.email.includes("@carecircle.link") || invite.email.includes("@continuum.local");
  if (!isGenericInvite && caregiver?.email && caregiver.email.toLowerCase() !== invite.email.toLowerCase()) {
    throw new Error(`This invitation was sent specifically to ${invite.email}. Please sign in with that email address to join.`);
  }

  // 3. Try atomic accept_invitation RPC (SECURITY DEFINER)
  try {
    if (typeof supabase?.rpc === "function") {
      const { data: acceptedPatientId, error: rpcErr } = await supabase.rpc("accept_invitation", {
        p_token: cleanToken,
        p_relationship: customRelationship || null,
      });
      if (rpcErr) {
        if (rpcErr.message && rpcErr.message.includes("different email")) {
          throw new Error(`This invitation was sent specifically to ${invite.email}. Please sign in with that email address to join.`);
        }
        console.warn("[invitationApi] accept_invitation RPC notice:", rpcErr);
      } else if (acceptedPatientId) {
        const { data: patientRow } = await supabase
          .from("patient")
          .select("patient_id, full_name")
          .eq("patient_id", acceptedPatientId)
          .maybeSingle();
        return {
          patientId: acceptedPatientId,
          patientName: patientRow?.full_name || invite.patient?.full_name || "Patient",
        };
      }
    }
  } catch (rpcEx) {
    if (rpcEx.message?.includes("specifically to")) {
      throw rpcEx;
    }
    console.warn("[invitationApi] accept_invitation RPC fallback:", rpcEx);
  }

  // 4. Direct table fallback
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
