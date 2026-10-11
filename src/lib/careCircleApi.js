import { supabase } from "./supabaseClient";

// Default responsibilities available in the application
export const CARE_RESPONSIBILITIES = [
  "Medication",
  "Meals",
  "Sleep",
  "Symptoms",
  "Appointments",
  "Daily Care",
  "Night Care",
  "Other",
];

// Helper to sanitize array or fallback
function normalizeArray(val) {
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return val ? val.split(",").map((s) => s.trim()) : [];
    }
  }
  return [];
}

export async function fetchCareCircleMembers(patientId) {
  if (!patientId) return [];

  // Select only the base columns that definitely exist.
  // Optional columns (relationship, status, alert_*) are fetched with
  // a wider select and gracefully defaulted if absent.
  const { data: rows, error } = await supabase
    .from("caregiver_pat")
    .select(
      "caregiver_id, role, joining_at, removed_at, relationship, status, alert_preference, alert_priority, assigned_responsibilities, caregiver:caregiver_id ( caregiver_id, full_name, email, phone, profile_image )"
    )
    .eq("patient_id", patientId)
    .is("removed_at", null);

  if (error) {
    // If the columns don't exist yet (migration not applied), fall back to
    // the minimal column set to avoid breaking the UI.
    if (error.message?.includes("column") || error.message?.includes("relationship")) {
      console.warn("[careCircleApi] Extended columns not yet migrated — fetching base columns:", error.message);
      const { data: baseRows, error: baseErr } = await supabase
        .from("caregiver_pat")
        .select("caregiver_id, role, joining_at, removed_at, caregiver:caregiver_id ( caregiver_id, full_name, email, phone )")
        .eq("patient_id", patientId)
        .is("removed_at", null);

      if (baseErr) {
        console.error("[careCircleApi] Failed to fetch care circle members:", baseErr);
        throw baseErr;
      }
      return (baseRows || []).map(r => mapMemberRow(r, {}));
    }
    console.error("[careCircleApi] Failed to fetch care circle members:", error);
    throw error;
  }

  return (rows || []).map(r => mapMemberRow(r, r));
}

function mapMemberRow(r, full) {
  const cg = r.caregiver || {};
  return {
    id: r.caregiver_id || cg.caregiver_id,
    name: cg.full_name || "Caregiver",
    email: cg.email || "",
    phone: cg.phone || "",
    profileImage: cg.profile_image || null,
    role: r.role || "family",
    relationship: full.relationship || (r.role === "primary" ? "Primary Caregiver" : "Family"),
    status: full.status || "active",
    alertPreference: full.alert_preference || "all",
    alertPriority: full.alert_priority ?? 1,
    assignedResponsibilities: normalizeArray(full.assigned_responsibilities),
    joinedAt: r.joining_at,
  };
}

export async function updateCareCircleMember(patientId, caregiverId, updates) {
  const payload = {};
  if (updates.role !== undefined) payload.role = updates.role;
  if (updates.relationship !== undefined) payload.relationship = updates.relationship;
  if (updates.status !== undefined) payload.status = updates.status;
  if (updates.alertPreference !== undefined) payload.alert_preference = updates.alertPreference;
  if (updates.alertPriority !== undefined) payload.alert_priority = updates.alertPriority;
  if (updates.assignedResponsibilities !== undefined) {
    payload.assigned_responsibilities = updates.assignedResponsibilities;
  }

  const { error } = await supabase
    .from("caregiver_pat")
    .update(payload)
    .eq("patient_id", patientId)
    .eq("caregiver_id", caregiverId);

  if (error) {
    console.error("[careCircleApi] Failed to update member:", error);
    throw error;
  }
}

export async function removeCareCircleMember(patientId, caregiverId) {
  const { error } = await supabase
    .from("caregiver_pat")
    .update({ removed_at: new Date().toISOString() })
    .eq("patient_id", patientId)
    .eq("caregiver_id", caregiverId);

  if (error) {
    console.error("[careCircleApi] Failed to remove caregiver link:", error);
    throw error;
  }
}

export async function assignMemberResponsibilities(patientId, caregiverId, responsibilities) {
  return updateCareCircleMember(patientId, caregiverId, {
    assignedResponsibilities: responsibilities,
  });
}

export async function updateMemberAlertPriority(patientId, caregiverId, priority, preference = "all") {
  return updateCareCircleMember(patientId, caregiverId, {
    alertPriority: priority,
    alertPreference: preference,
  });
}

/**
 * Route an alert to care circle members in configured priority order.
 */
export async function routeAlert(patientId, alertData) {
  const members = await fetchCareCircleMembers(patientId);

  // Filter active members and sort by alert priority
  const activeMembers = members
    .filter((m) => m.status === "active" && m.alertPreference !== "none")
    .sort((a, b) => a.alertPriority - b.alertPriority);

  return {
    alert: alertData,
    routedTo: activeMembers.map((m) => ({
      caregiverId: m.id,
      name: m.name,
      priority: m.alertPriority,
      preference: m.alertPreference,
    })),
  };
}
