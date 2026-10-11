import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { usePatient } from "../context/PatientContext";
import { getInvitationByToken, acceptInvitation } from "../lib/invitationApi";
import AuthModal from "../components/AuthModal";
import { Users, CheckCircle, AlertCircle } from "lucide-react";

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();

  const { user, isAuthenticated } = useAuth();
  const { reloadPatients, setCurrentPatientId } = usePatient();

  const [invite, setInvite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadInvite = useCallback(async () => {
    if (!token) {
      setError("No invitation token provided in URL.");
      setLoading(false);
      return;
    }

    try {
      const inv = await getInvitationByToken(token);
      if (!inv) {
        setError("Invitation token not found.");
      } else if (!inv.isValid) {
        setError(`This invitation link is ${inv.reason || "invalid"}.`);
      } else {
        setInvite(inv);
      }
    } catch (err) {
      setError(err.message || "Failed to load invitation.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadInvite();
  }, [loadInvite]);

  const handleAccept = async () => {
    if (!isAuthenticated || !user?.id) {
      setShowAuthModal(true);
      return;
    }

    setIsSubmitting(true);
    setError("");
    try {
      const res = await acceptInvitation(token, user.id);
      setAccepted(true);
      await reloadPatients();
      if (res.patientId) setCurrentPatientId(res.patientId);

      setTimeout(() => {
        navigate("/");
      }, 1500);
    } catch (err) {
      console.error("[AcceptInvite] Error accepting invite:", err);
      setError(err.message || "Failed to accept invitation. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f7f8fc",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        fontFamily: "Inter, Arial, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 500,
          background: "white",
          borderRadius: 20,
          boxShadow: "0 20px 40px rgba(0,0,0,0.08)",
          border: "1px solid #e4e6ed",
          overflow: "hidden",
        }}
      >
        {/* Banner */}
        <div
          style={{
            background: "linear-gradient(135deg, #5b57d9 0%, #3c38b0 100%)",
            color: "white",
            padding: "28px 32px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: "rgba(255,255,255,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 12px",
            }}
          >
            <Users size={26} color="white" />
          </div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Care Circle Invitation</h2>
          <p style={{ margin: "6px 0 0", fontSize: 13, opacity: 0.9 }}>
            Join a shared care circle on CONTINUUM
          </p>
        </div>

        <div style={{ padding: 32 }}>
          {loading ? (
            <p style={{ textAlign: "center", color: "#64748b" }}>Validating invitation link…</p>
          ) : error ? (
            <div style={{ textAlign: "center" }}>
              <AlertCircle size={36} color="#ef4444" style={{ marginBottom: 10 }} />
              <h3 style={{ margin: "0 0 6px", color: "#1e293b" }}>Invalid Invitation</h3>
              <p style={{ color: "#64748b", fontSize: 14, marginBottom: 20 }}>{error}</p>
              <button
                onClick={() => navigate("/")}
                style={{
                  padding: "10px 20px",
                  borderRadius: 9,
                  background: "#5b57d9",
                  color: "white",
                  border: "none",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Go to App
              </button>
            </div>
          ) : accepted ? (
            <div style={{ textAlign: "center" }}>
              <CheckCircle size={40} color="#10b981" style={{ marginBottom: 10 }} />
              <h3 style={{ margin: "0 0 6px", color: "#1e293b" }}>Invitation Accepted!</h3>
              <p style={{ color: "#64748b", fontSize: 14 }}>
                You have joined <strong>{invite?.patient?.full_name || "the care circle"}</strong>. Redirecting to Dashboard...
              </p>
            </div>
          ) : (
            <div>
              <div
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: 14,
                  padding: 20,
                  marginBottom: 24,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: "#5b57d9", letterSpacing: "0.5px", marginBottom: 6 }}>
                  YOU HAVE BEEN INVITED TO JOIN
                </div>
                <h3 style={{ margin: "0 0 4px", fontSize: 20, color: "#0f172a" }}>
                  {invite?.patient?.full_name || "Patient Care Circle"}
                </h3>
                <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
                  Invited by: <strong>{invite?.inviter?.full_name || "Primary Caregiver"}</strong>
                </p>
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #e2e8f0", fontSize: 13, color: "#334155" }}>
                  Role: <strong className="wt-capitalize">{invite?.role || "Family Caregiver"}</strong> · Relationship: <strong>{invite?.relationship || "Family Member"}</strong>
                </div>
              </div>

              {!isAuthenticated && (
                <div style={{ background: "#fffbe6", border: "1px solid #ffe58f", padding: "12px 14px", borderRadius: 10, fontSize: 13, color: "#d48806", marginBottom: 20 }}>
                  Please log in or register to accept this invitation and join the care circle.
                </div>
              )}

              <button
                onClick={handleAccept}
                disabled={isSubmitting}
                style={{
                  width: "100%",
                  padding: "14px",
                  borderRadius: 10,
                  background: "#5b57d9",
                  color: "white",
                  border: "none",
                  fontWeight: 700,
                  fontSize: 15,
                  cursor: "pointer",
                }}
              >
                {isSubmitting ? "Joining Care Circle..." : isAuthenticated ? "Accept Invitation & Join Care Circle" : "Log In / Register to Accept"}
              </button>
            </div>
          )}
        </div>
      </div>

      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </div>
  );
}
