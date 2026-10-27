import { useState } from "react";
import { useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";
import { usePatient } from "../context/PatientContext";
import { useAuth } from "../context/AuthContext";
import OnboardingWizard from "./OnboardingWizard";
import { Heart, Users, PlusCircle } from "lucide-react";

function AppShellState({ isLoading, loadError, isEmpty, onRetry, onOpenWizard }) {
  if (isLoading) {
    return (
      <div className="shell-state">
        <div className="shell-thread" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <p>Gathering the care circle…</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="shell-state shell-state--error">
        <p className="shell-state__title">Couldn't reach Supabase</p>
        <p className="shell-state__detail">{loadError}</p>
        <p className="shell-state__hint">
          Check <code>.env</code> has valid <code>VITE_SUPABASE_URL</code> /{" "}
          <code>VITE_SUPABASE_ANON_KEY</code>, and that the database schema and seed SQL have been run in Supabase SQL editor.
        </p>
        <button type="button" className="shell-state__retry" onClick={onRetry}>
          Retry Connection
        </button>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div style={{ padding: "40px 24px", maxWidth: 620, margin: "40px auto 0", textAlign: "center", background: "white", borderRadius: 20, boxShadow: "0 10px 30px rgba(0,0,0,0.05)", border: "1px solid #e2e8f0" }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            background: "rgba(91, 87, 217, 0.12)",
            color: "#5b57d9",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px",
          }}
        >
          <Heart size={28} />
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", margin: "0 0 8px" }}>
          Welcome to CONTINUUM
        </h2>
        <p style={{ fontSize: 14, color: "#64748b", margin: "0 0 24px", lineHeight: 1.5 }}>
          No patient is linked to your caregiver account yet. Start by setting up a care circle for your patient or joining an existing circle with an invite link.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => onOpenWizard("new_patient")}
            style={{
              padding: "12px 22px",
              borderRadius: 10,
              background: "#5b57d9",
              color: "white",
              border: "none",
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              boxShadow: "0 4px 14px rgba(91, 87, 217, 0.25)",
            }}
          >
            <PlusCircle size={16} /> Set Up a Patient
          </button>
          <button
            type="button"
            onClick={() => onOpenWizard("join_circle")}
            style={{
              padding: "12px 20px",
              borderRadius: 10,
              background: "white",
              color: "#334155",
              border: "1.5px solid #cbd5e1",
              fontWeight: 600,
              fontSize: 14,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Users size={16} /> Join Care Circle
          </button>
        </div>
      </div>
    );
  }

  return null;
}

function MainLayout({ children }) {
  const { isLoading, loadError, patients, reloadPatients } = usePatient();
  const { needsOnboarding } = useAuth();
  const location = useLocation();
  const [manualWizardOpen, setManualWizardOpen] = useState(false);
  const [initialWizardType, setInitialWizardType] = useState("new_patient");

  const isEmpty = !isLoading && !loadError && patients.length === 0;
  const isPatientRoute = location.pathname === "/patient";

  // Show setup wizard only when explicitly opened or when user has no active memberships and is in onboarding state
  const shouldShowWizard = manualWizardOpen || (isEmpty && needsOnboarding);

  // Show AppShellState only when loading, loadError, or empty without the wizard active
  const showState = isLoading || loadError || (isEmpty && !isPatientRoute && !shouldShowWizard);

  const handleOpenWizard = (type = "new_patient") => {
    setInitialWizardType(type);
    setManualWizardOpen(true);
  };

  const handleCloseWizard = () => {
    setManualWizardOpen(false);
    reloadPatients();
  };

  return (
    <div className="app-layout">
      <Sidebar />

      <div className="main-section">
        <Navbar />

        <main className="page-content">
          {shouldShowWizard && (
            <OnboardingWizard
              initialType={initialWizardType}
              onClose={handleCloseWizard}
            />
          )}

          {showState ? (
            <AppShellState
              isLoading={isLoading}
              loadError={loadError}
              isEmpty={isEmpty}
              onRetry={reloadPatients}
              onOpenWizard={handleOpenWizard}
            />
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}

export default MainLayout;
