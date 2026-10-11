import { supabase, getCaregiverId } from "./supabaseClient";

export async function fetchTimelineEvents(patientId, targetDate = null) {
  if (!patientId) return [];

  // Query time_event table
  const { data: eventRows, error: eventErr } = await supabase
    .from("time_event")
    .select("*, caregiver:caregiver_id ( full_name )")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });

  if (eventErr) {
    console.warn("[timelineApi] Error querying time_event table:", eventErr.message);
  }

  const events = eventRows || [];
  const eventIds = events.map((e) => e.event_id);

  let commentsByEvent = {};
  if (eventIds.length > 0) {
    const { data: commentRows, error: comErr } = await supabase
      .from("timeline_commend")
      .select("*, caregiver:caregiver_id ( full_name )")
      .in("event_id", eventIds)
      .order("created_at", { ascending: true });

    if (!comErr && commentRows) {
      commentsByEvent = commentRows.reduce((acc, c) => {
        (acc[c.event_id] ??= []).push({
          id: c.commend_id,
          name: c.caregiver?.full_name || "Caregiver",
          text: c.commend_text,
          createdAt: c.created_at,
        });
        return acc;
      }, {});
    }
  }

  // Map to Timeline UI format
  const mapped = events.map((ev) => {
    const dt = new Date(ev.created_at);
    const dateKey = dt.toISOString().split("T")[0];
    const timeStr = dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    let type = (ev.event_type || "Note").toLowerCase();
    type = type.charAt(0).toUpperCase() + type.slice(1);
    if (type === "Meal") type = "Food";

    return {
      id: ev.event_id,
      dateKey,
      time: timeStr,
      type,
      title: ev.title || "Care Activity",
      description: ev.title || "",
      caregiver: ev.caregiver?.full_name || "Caregiver",
      comments: commentsByEvent[ev.event_id] || [],
      completed: type === "Medication" || type === "Food",
      isAutomated: ev.caregiver_id === null || ev.event_type === "appointment",
      created_at: ev.created_at,
    };
  });

  if (targetDate) {
    return mapped.filter((e) => e.dateKey === targetDate);
  }

  return mapped;
}

export async function addTimelineComment(eventId, commentText, caregiverId = null) {
  const cgId = caregiverId || getCaregiverId();
  if (!eventId || !commentText) {
    throw new Error("eventId and commentText are required.");
  }

  const payload = {
    event_id: eventId,
    caregiver_id: cgId,
    commend_text: commentText,
    created_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("timeline_commend")
    .insert(payload)
    .select("*, caregiver:caregiver_id ( full_name )")
    .single();

  if (error) {
    console.error("[timelineApi] Failed to insert timeline comment:", error);
    throw error;
  }

  return {
    id: data.commend_id,
    eventId: data.event_id,
    name: data.caregiver?.full_name || "You",
    text: data.commend_text,
    createdAt: data.created_at,
  };
}
