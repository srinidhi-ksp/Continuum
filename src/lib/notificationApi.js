import { supabase } from "./supabaseClient";

const NOTIFICATION_FIELDS =
  "notification_id, recipient_id, patient_id, medication_id, type, title, body, due_at, created_at, read_at";

export async function fetchNotifications(recipientId) {
  if (!recipientId) return { notifications: [], unreadCount: 0 };

  const [listResult, countResult] = await Promise.all([
    supabase
      .from("care_notification")
      .select(NOTIFICATION_FIELDS)
      .eq("recipient_id", recipientId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("care_notification")
      .select("notification_id", { count: "exact", head: true })
      .eq("recipient_id", recipientId)
      .is("read_at", null),
  ]);

  if (listResult.error || countResult.error) {
    const error = listResult.error || countResult.error;
    console.error("[notificationApi] Failed to fetch notifications:", error);
    const description = `${error.code || ""} ${error.message || ""}`.toLowerCase();
    if (
      description.includes("pgrst205") ||
      description.includes("schema cache") ||
      description.includes("care_notification") && description.includes("does not exist")
    ) {
      throw new Error(
        "The notification table is not available in Supabase. Apply continuum_notifications_migration.sql, then reload the PostgREST schema cache."
      );
    }
    throw error;
  }
  return {
    notifications: listResult.data || [],
    unreadCount: countResult.count || 0,
  };
}

export async function markNotificationRead(notificationId, recipientId) {
  const { error } = await supabase
    .from("care_notification")
    .update({ read_at: new Date().toISOString() })
    .eq("notification_id", notificationId)
    .eq("recipient_id", recipientId)
    .is("read_at", null);

  if (error) {
    console.error("[notificationApi] Failed to mark notification as read:", error);
    throw error;
  }
}

export async function markAllNotificationsRead(recipientId) {
  const { error } = await supabase
    .from("care_notification")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", recipientId)
    .is("read_at", null);

  if (error) {
    console.error("[notificationApi] Failed to mark notifications as read:", error);
    throw error;
  }
}
