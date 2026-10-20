import { useState } from "react";
import { Search, LogOut, LogIn } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AuthModal from "./AuthModal";
import GlobalSearch from "./GlobalSearch";
import NotificationCenter from "./NotificationCenter";

const ROUTE_TITLES = {
  "/": "Dashboard",
  "/patient": "Patient",
  "/daily-care": "Daily Care",
  "/medications": "Medications",
  "/timeline": "Timeline",
  "/care-circle": "Care Circle",
  "/learn": "Learn",
  "/assistant": "Assistant",
  "/reports": "Reports",
  "/settings": "Settings",
};

function Navbar() {
  const { pathname } = useLocation();
  const pageTitle = ROUTE_TITLES[pathname] ?? "Dashboard";

  const { caregiverProfile, isAuthenticated, logout, user } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  const name = caregiverProfile?.full_name || "Srinidhi";
  const initial = name.charAt(0).toUpperCase();

  return (
    <header className="navbar">
      <div className="navbar-left">
        <h3>{pageTitle}</h3>
      </div>

      <div className="navbar-right">
        <button
          className="icon-button"
          title="Search"
          aria-label="Search patients and care records"
          onClick={() => setShowSearch(true)}
        >
          <Search size={19} />
        </button>

        <NotificationCenter key={user?.id || "signed-out"} />

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
      {showSearch && <GlobalSearch onClose={() => setShowSearch(false)} />}
    </header>
  );
}

export default Navbar;