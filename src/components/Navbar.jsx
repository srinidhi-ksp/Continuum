import { useState, useEffect } from "react";
import { Bell, Search, LogOut, LogIn, X } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabaseClient";
import AuthModal from "./AuthModal";

const ROUTE_TITLES = {
  "/": "Dashboard",
  "/patient": "Patient Profile",
  "/daily-care": "Daily Care Tracking",
  "/medications": "Medications & Appointments",
  "/timeline": "Care Timeline",
  "/care-circle": "Care Circle Management",
  "/reports": "Health Reports",
  "/learn": "Scenario Micro-Learning",
  "/assistant": "AI Caregiver Assistant",
  "/settings": "Settings & Preferences",
};

function Navbar() {
  const { pathname } = useLocation();
  const pageTitle = ROUTE_TITLES[pathname] ?? "Dashboard";

  const { caregiverProfile, isAuthenticated, logout } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showNotifMenu, setShowNotifMenu] = useState(false);

  const name = caregiverProfile?.full_name || "Caregiver";
  const initial = name.charAt(0).toUpperCase();

  useEffect(() => {
    if (!caregiverProfile?.caregiver_id) return;
    let mounted = true;
    supabase
      .from("notification")
      .select("*")
      .eq("caregiver_id", caregiverProfile.caregiver_id)
      .order("created_at", { ascending: false })
      .limit(10)
      .then(({ data, error }) => {
        if (!error && data && mounted) setNotifications(data);
      });
    return () => { mounted = false; };
  }, [caregiverProfile?.caregiver_id]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const markAsRead = async (id) => {
    try {
      await supabase.from("notification").update({ is_read: true }).eq("notification_id", id);
      setNotifications((prev) => prev.map((n) => (n.notification_id === id ? { ...n, is_read: true } : n)));
    } catch {
      // non-fatal
    }
  };

  return (
    <header className="navbar">
      <div className="navbar-left">
        <h3>{pageTitle}</h3>
      </div>

      <div className="navbar-right" style={{ position: "relative" }}>
        <button className="icon-button" title="Search">
          <Search size={19} />
        </button>

        <button
          className="icon-button"
          title="Notifications"
          onClick={() => setShowNotifMenu((prev) => !prev)}
          style={{ position: "relative" }}
        >
          <Bell size={19} />
          {unreadCount > 0 && (
            <span
              style={{
                position: "absolute",
                top: 4,
                right: 4,
                width: 8,
                height: 8,
                background: "#ef4444",
                borderRadius: "50%",
              }}
            />
          )}
        </button>

        {showNotifMenu && (
          <div
            style={{
              position: "absolute",
              top: 45,
              right: 120,
              width: 320,
              background: "white",
              borderRadius: 14,
              boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
              border: "1px solid #e2e8f0",
              zIndex: 1000,
              padding: 14,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, borderBottom: "1px solid #f1f5f9", paddingBottom: 8 }}>
              <strong style={{ fontSize: 13, color: "#0f172a" }}>Notifications ({unreadCount})</strong>
              <button
                onClick={() => setShowNotifMenu(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}
              >
                <X size={14} />
              </button>
            </div>
            {notifications.length === 0 ? (
              <p style={{ fontSize: 12, color: "#94a3b8", textAlign: "center", margin: "16px 0" }}>No new notifications.</p>
            ) : (
              <div style={{ maxHeight: 240, overflowY: "auto" }}>
                {notifications.map((n) => (
                  <div
                    key={n.notification_id}
                    onClick={() => markAsRead(n.notification_id)}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 8,
                      marginBottom: 6,
                      background: n.is_read ? "#f8fafc" : "#f0fdf4",
                      border: n.is_read ? "1px solid #f1f5f9" : "1px solid #bbf7d0",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <strong style={{ fontSize: 12, color: "#1e293b" }}>{n.title || "Care Alert"}</strong>
                      {!n.is_read && <span style={{ fontSize: 10, color: "#16a34a", fontWeight: 700 }}>NEW</span>}
                    </div>
                    <p style={{ fontSize: 11, color: "#64748b", margin: "4px 0 0" }}>{n.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="profile">
          <div className="profile-avatar">{initial}</div>

          <div className="profile-info">
            <span className="profile-name">{name}</span>
            <span className="profile-role">Caregiver</span>
          </div>
        </div>

        {isAuthenticated ? (
          <button
            onClick={logout}
            className="icon-button"
            title="Log Out"
            style={{ marginLeft: 6, color: "#64748b" }}
          >
            <LogOut size={18} />
          </button>
        ) : (
          <button
            onClick={() => setShowAuthModal(true)}
            className="wt-btn wt-btn--primary wt-btn--sm"
            style={{ marginLeft: 8 }}
          >
            <LogIn size={15} /> Log In
          </button>
        )}
      </div>

      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </header>
  );
}

export default Navbar;