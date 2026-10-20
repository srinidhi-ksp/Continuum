import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Check, ChevronRight, Pill, RefreshCw } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { usePatient } from "../context/PatientContext";
import { supabase } from "../lib/supabaseClient";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../lib/notificationApi";

function formatNotificationTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function NotificationCenter() {
  const { user } = useAuth();
  const userId = user?.id;
  const { setCurrentPatientId } = usePatient();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const rootRef = useRef(null);
  const requestIdRef = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    if (!userId) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      setError("");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await fetchNotifications(userId);
      if (requestId !== requestIdRef.current) return;
      setNotifications(result.notifications);
      setUnreadCount(result.unreadCount);
    } catch (fetchError) {
      if (requestId !== requestIdRef.current) return;
      console.error("[NotificationCenter] Refresh failed:", fetchError);
      setError(fetchError.message || "Notifications couldn't be loaded.");
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return undefined;

    const channel = supabaseNotificationChannel(userId, refresh);
    const initialFetch = window.setTimeout(refresh, 0);
    const fallback = window.setInterval(refresh, 60_000);
    return () => {
      requestIdRef.current += 1;
      window.clearTimeout(initialFetch);
      window.clearInterval(fallback);
      channel?.unsubscribe();
    };
  }, [refresh, userId]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handlePointer = (event) => {
      if (!rootRef.current?.contains(event.target)) setIsOpen(false);
    };
    const handleKey = (event) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("mousedown", handlePointer);
    window.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      window.removeEventListener("keydown", handleKey);
    };
  }, [isOpen]);

  const openNotification = async (notification) => {
    setActionError("");
    try {
      if (!notification.read_at) {
        await markNotificationRead(notification.notification_id, userId);
        setNotifications((current) => current.map((item) => (
          item.notification_id === notification.notification_id
            ? { ...item, read_at: new Date().toISOString() }
            : item
        )));
        setUnreadCount((count) => Math.max(0, count - 1));
      }
      setCurrentPatientId(notification.patient_id);
      navigate(
        notification.medication_id
          ? "/medications"
          : notification.type === "coordination_alert" ? "/" : "/patient",
      );
      setIsOpen(false);
    } catch (actionFailure) {
      console.error("[NotificationCenter] Could not open notification:", actionFailure);
      setActionError(actionFailure.message || "This notification couldn't be opened.");
    }
  };

  const markAllRead = async () => {
    setActionError("");
    try {
      await markAllNotificationsRead(userId);
      const now = new Date().toISOString();
      setNotifications((current) => current.map((item) => item.read_at ? item : { ...item, read_at: now }));
      setUnreadCount(0);
    } catch (actionFailure) {
      console.error("[NotificationCenter] Could not mark all notifications read:", actionFailure);
      setActionError(actionFailure.message || "Notifications couldn't be marked as read.");
    }
  };

  return (
    <div className="notification-center" ref={rootRef}>
      <button
        className={`icon-button notification-trigger ${isOpen ? "is-open" : ""}`}
        title="Notifications"
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
        aria-expanded={isOpen}
        onClick={() => {
          setIsOpen((open) => !open);
          setActionError("");
          refresh();
        }}
      >
        <Bell size={19} />
        {unreadCount > 0 && <span className="notification-count">{unreadCount > 99 ? "99+" : unreadCount}</span>}
      </button>

      {isOpen && (
        <section className="notification-panel" aria-label="Notifications">
          <header className="notification-panel-header">
            <div><h2>Notifications</h2><p>{unreadCount ? `${unreadCount} unread` : "You're all caught up"}</p></div>
            <button className="notification-refresh" onClick={refresh} aria-label="Refresh notifications" title="Refresh">
              <RefreshCw size={15} />
            </button>
          </header>
          {unreadCount > 0 && (
            <button className="notification-mark-all" onClick={markAllRead}><Check size={14} /> Mark all as read</button>
          )}
          {actionError && <p className="notification-error" role="alert">{actionError}</p>}
          {loading && notifications.length === 0 ? (
            <div className="notification-empty">Loading notifications…</div>
          ) : error ? (
            <div className="notification-empty notification-empty--error" role="alert">
              <p>Notifications are unavailable.</p>
              <small>{error}</small>
              <button onClick={refresh}>Try again</button>
            </div>
          ) : notifications.length === 0 ? (
            <div className="notification-empty">
              <span><Bell size={19} /></span>
              <strong>You're all caught up</strong>
              <p>Care reminders and coordination updates will appear here.</p>
            </div>
          ) : (
            <div className="notification-list">
              {notifications.map((notification) => (
                <button
                  className={`notification-item ${notification.read_at ? "" : "notification-item--unread"}`}
                  key={notification.notification_id}
                  onClick={() => openNotification(notification)}
                >
                  <span className="notification-item-icon">
                    {notification.medication_id ? <Pill size={17} /> : <Bell size={17} />}
                  </span>
                  <span className="notification-item-content">
                    <strong>{notification.title}</strong>
                    <span>{notification.body}</span>
                    <time dateTime={notification.created_at}>{formatNotificationTime(notification.created_at)}</time>
                  </span>
                  <ChevronRight size={15} className="notification-item-chevron" />
                </button>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function supabaseNotificationChannel(recipientId, onChange) {
  if (typeof supabase.channel !== "function") return null;
  try {
    return supabase
      .channel(`care-notifications-${recipientId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "care_notification",
          filter: `recipient_id=eq.${recipientId}`,
        },
        onChange,
      )
      .subscribe();
  } catch (subscribeError) {
    console.error("[NotificationCenter] Realtime subscription failed; polling remains active:", subscribeError);
    return null;
  }
}
