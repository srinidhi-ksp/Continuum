import { useState } from "react";
import { Bell, Search, LogOut, LogIn } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
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

  const name = caregiverProfile?.full_name || "Srinidhi";
  const initial = name.charAt(0).toUpperCase();

  return (
    <header className="navbar">
      <div className="navbar-left">
        <h3>{pageTitle}</h3>
      </div>

      <div className="navbar-right">
        <button className="icon-button" title="Search">
          <Search size={19} />
        </button>

        <button className="icon-button" title="Notifications">
          <Bell size={19} />
        </button>

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