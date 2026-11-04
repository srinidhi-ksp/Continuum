import { supabase, getCaregiverId } from "./supabaseClient";

/**
 * Fetch all tasks for a patient, joined with assigned caregiver info.
 */
export async function fetchPatientTasks(patientId) {
  if (!patientId) return [];

  const { data, error } = await supabase
    .from("care_task")
    .select(`
      task_id,
      patient_id,
      title,
      description,
      category,
      priority,
      assigned_to,
      backup_caregiver_id,
      assigned_by,
      due_at,
      grace_minutes,
      is_essential,
      status,
      completed_at,
      created_at,
      updated_at,
      assignee:assigned_to ( caregiver_id, full_name, email ),
      assigner:assigned_by ( caregiver_id, full_name )
    `)
    .eq("patient_id", patientId)
    .order("due_at", { ascending: true });

  if (error) {
    console.error("[taskApi] Error fetching patient tasks:", error);
    throw error;
  }
  return data || [];
}

/**
 * Fetch tasks specifically assigned to a caregiver for a patient.
 */
export async function fetchMyTasks(patientId, caregiverId) {
  const cId = caregiverId || getCaregiverId();
  if (!patientId || !cId) return [];

  const { data, error } = await supabase
    .from("care_task")
    .select(`
      task_id,
      patient_id,
      title,
      description,
      category,
      priority,
      assigned_to,
      backup_caregiver_id,
      assigned_by,
      due_at,
      grace_minutes,
      is_essential,
      status,
      completed_at,
      created_at,
      updated_at,
      assignee:assigned_to ( caregiver_id, full_name, email ),
      assigner:assigned_by ( caregiver_id, full_name )
    `)
    .eq("patient_id", patientId)
    .eq("assigned_to", cId)
    .order("due_at", { ascending: true });

  if (error) {
    console.error("[taskApi] Error fetching my tasks:", error);
    throw error;
  }
  return data || [];
}

/**
 * Verify whether a caregiver has primary/main caregiver privileges for a patient.
 */
export async function verifyPrimaryCaregiver(patientId, caregiverId) {
  const cId = caregiverId || getCaregiverId();
  if (!cId || !patientId) return false;

  const { data: member } = await supabase
    .from("caregiver_pat")
    .select("role, status")
    .eq("patient_id", patientId)
    .eq("caregiver_id", cId)
    .eq("status", "active")
    .maybeSingle();

  if (member?.role === "primary") return true;

  const { data: patient } = await supabase
    .from("patient")
    .select("created_by")
    .eq("patient_id", patientId)
    .maybeSingle();

  return patient?.created_by === cId;
}

/**
 * Assign a new task (primary caregiver creation).
 */
export async function assignTask({
  patientId,
  title,
  description = "",
  category = "daily_log",
  priority = "normal",
  dueAt = null,
  assignedTo = null,
  isEssential = false,
  graceMinutes = 30,
}) {
  const assignedBy = getCaregiverId();
  if (!patientId || !title?.trim()) {
    throw new Error("Patient ID and task title are required.");
  }

  const isPrimary = await verifyPrimaryCaregiver(patientId, assignedBy);
  if (!isPrimary) {
    throw new Error("Unauthorized: Only the Main/Primary Caregiver can assign tasks.");
  }

  // 1. Try RPC if available
  try {
    if (typeof supabase?.rpc === "function") {
      const { data: rpcData, error: rpcError } = await supabase.rpc("assign_task", {
      p_patient: patientId,
      p_assignee: assignedTo || null,
      p_title: title.trim(),
      p_description: description?.trim() || null,
      p_category: category || "daily_log",
      p_priority: priority || "normal",
      p_due_at: dueAt || null,
    });
      if (!rpcError && rpcData) {
        // Fetch joined task object to match return format
        const { data: fetched } = await supabase
          .from("care_task")
          .select(`
            *,
            assignee:assigned_to ( caregiver_id, full_name, email ),
            assigner:assigned_by ( caregiver_id, full_name )
          `)
          .eq("task_id", rpcData)
          .maybeSingle();
        if (fetched) return fetched;
      }
    }
  } catch (rpcErr) {
    console.warn("[taskApi] assign_task RPC failed, attempting direct insert:", rpcErr);
  }

  // 2. Direct table insert fallback
  const payload = {
    patient_id: patientId,
    title: title.trim(),
    description: description?.trim() || null,
    category: category || "daily_log",
    priority: priority || "normal",
    due_at: dueAt,
    assigned_to: assignedTo || null,
    assigned_by: assignedBy || null,
    is_essential: Boolean(isEssential),
    grace_minutes: graceMinutes || 30,
    status: "pending",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("care_task")
    .insert(payload)
    .select(`
      *,
      assignee:assigned_to ( caregiver_id, full_name, email ),
      assigner:assigned_by ( caregiver_id, full_name )
    `)
    .single();

  if (error) {
    console.error("[taskApi] Failed to create care task:", error);
    throw error;
  }
  return data;
}

/**
 * Reassign an existing task to another caregiver.
 */
export async function reassignTask({ taskId, newAssigneeId }) {
  if (!taskId) throw new Error("Task ID is required.");
  const currentCgId = getCaregiverId();

  const { data: taskRow } = await supabase
    .from("care_task")
    .select("patient_id")
    .eq("task_id", taskId)
    .maybeSingle();

  if (taskRow?.patient_id) {
    const isPrimary = await verifyPrimaryCaregiver(taskRow.patient_id, currentCgId);
    if (!isPrimary) {
      throw new Error("Unauthorized: Only the Main/Primary Caregiver can reassign tasks.");
    }
  }

  try {
    if (typeof supabase?.rpc === "function") {
      const { error: rpcErr } = await supabase.rpc("reassign_task", {
        p_task: taskId,
        p_new_assignee: newAssigneeId || null,
      });
      if (!rpcErr) {
      const { data: fetched } = await supabase
        .from("care_task")
        .select(`
          *,
          assignee:assigned_to ( caregiver_id, full_name, email )
        `)
        .eq("task_id", taskId)
        .maybeSingle();
      if (fetched) return fetched;
    }
  }
} catch (rpcEx) {
    console.warn("[taskApi] reassign_task RPC notice:", rpcEx);
  }

  const { data, error } = await supabase
    .from("care_task")
    .update({
      assigned_to: newAssigneeId || null,
      updated_at: new Date().toISOString(),
    })
    .eq("task_id", taskId)
    .select(`
      *,
      assignee:assigned_to ( caregiver_id, full_name, email )
    `)
    .single();

  if (error) {
    console.error("[taskApi] Failed to reassign task:", error);
    throw error;
  }
  return data;
}

/**
 * Update task status (e.g. in_progress, completed, cancelled).
 */
export async function setTaskStatus({ taskId, status, note = null }) {
  if (!taskId || !status) throw new Error("Task ID and status are required.");
  const currentCgId = getCaregiverId();

  const { data: taskRow } = await supabase
    .from("care_task")
    .select("patient_id, assigned_to")
    .eq("task_id", taskId)
    .maybeSingle();

  if (taskRow && currentCgId) {
    const isAssignee = taskRow.assigned_to === currentCgId;
    const isPrimary = await verifyPrimaryCaregiver(taskRow.patient_id, currentCgId);
    if (!isAssignee && !isPrimary) {
      throw new Error("Unauthorized: You can only complete tasks assigned to you.");
    }
  }

  const now = new Date().toISOString();
  const isCompleted = status === "completed";

  try {
    if (typeof supabase?.rpc === "function") {
      const { error: rpcErr } = await supabase.rpc("set_task_status", {
        p_task: taskId,
        p_status: status,
        p_note: note,
      });
      if (!rpcErr) {
        const { data: fetched } = await supabase
          .from("care_task")
          .select(`
            *,
            assignee:assigned_to ( caregiver_id, full_name, email )
          `)
          .eq("task_id", taskId)
          .maybeSingle();
        if (fetched) return fetched;
      }
    }
  } catch (rpcEx) {
    console.warn("[taskApi] set_task_status RPC notice:", rpcEx);
  }

  const updates = {
    status,
    updated_at: now,
    ...(isCompleted ? { completed_at: now } : {}),
  };

  const { data, error } = await supabase
    .from("care_task")
    .update(updates)
    .eq("task_id", taskId)
    .select(`
      *,
      assignee:assigned_to ( caregiver_id, full_name, email )
    `)
    .single();

  if (error) {
    console.error("[taskApi] Failed to update task status:", error);
    throw error;
  }
  return data;
}
