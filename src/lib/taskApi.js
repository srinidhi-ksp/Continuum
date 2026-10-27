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

  // 1. Try RPC if available
  try {
    const { data: rpcData, error: rpcErr } = await supabase.rpc("assign_task", {
      p_patient_id: patientId,
      p_title: title.trim(),
      p_description: description.trim(),
      p_category: category,
      p_priority: priority,
      p_due_at: dueAt,
      p_assigned_to: assignedTo,
      p_assigned_by: assignedBy,
      p_is_essential: isEssential,
      p_grace_minutes: graceMinutes,
    });
    if (!rpcErr && rpcData) return rpcData;
  } catch {
    // fallback to direct insert
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

  try {
    const { data: rpcData, error: rpcErr } = await supabase.rpc("reassign_task", {
      p_task_id: taskId,
      p_assigned_to: newAssigneeId,
    });
    if (!rpcErr && rpcData) return rpcData;
  } catch {
    // fallback to direct table update
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
export async function setTaskStatus({ taskId, status }) {
  if (!taskId || !status) throw new Error("Task ID and status are required.");

  const now = new Date().toISOString();
  const isCompleted = status === "completed";

  try {
    const { data: rpcData, error: rpcErr } = await supabase.rpc("set_task_status", {
      p_task_id: taskId,
      p_status: status,
    });
    if (!rpcErr && rpcData) return rpcData;
  } catch {
    // fallback to direct table update
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
