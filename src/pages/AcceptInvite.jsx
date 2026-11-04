import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { usePatient } from "../context/PatientContext";
import { supabase } from "../lib/supabaseClient";
import { getInvitationByToken, acceptInvitation } from "../lib/invitationApi";
import AuthModal from "../components/AuthModal";
import { Users, CheckCircle, AlertCircle, LogIn, UserPlus, LogOut } from "lucide-react";

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();

  const { caregiverProfile, isAuthenticated, logout } = useAuth();
  const { reloadPatients, setCurrentPatientId } = usePatient();

  const [invite, setInvite] = useState(null);
  const [hasExistingAccount, setHasExistingAccount] = useState(false);
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
        // Check if an existing caregiver account matches this email
        if (inv.email && !inv.email.includes("@carecircle.link")) {
          try {
            const { data: existingCg } = await supabase
              .from("caregiver")
              .select("caregiver_id, email, full_name")
              .ilike("email", inv.email.trim())
              .maybeSingle();
            setHasExistingAccount(Boolean(existingCg));
          } catch (lookupErr) {
            console.warn("[AcceptInvite] Caregiver lookup notice:", lookupErr);
          }
        }
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
    if (!isAuthenticated || !caregiverProfile?.caregiver_id) {
      setShowAuthModal(true);
      return;
    }

    setIsSubmitting(true);
    setError("");
    try {
      const res = await acceptInvitation(token, caregiverProfile.caregiver_id, invite?.relationship);
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

  const currentEmail = caregiverProfile?.email?.trim().toLowerCase();
  const invitedEmail = invite?.email?.trim().toLowerCase();
  const isEmailMismatch = Boolean(
    isAuthenticated &&
    invitedEmail &&
    !invitedEmail.includes("@carecircle.link") &&
    currentEmail &&
    currentEmail !== invitedEmail
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg-main, #fbf8f3)",
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
          border: "1px solid var(--border-subtle, #e4e6ed)",
          overflow: "hidden",
        }}
      >
        {/* Banner */}
        <div
          style={{
            background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)",
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
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, fontFamily: "var(--font-serif, Fraunces, serif)" }}>
            Care Circle Invitation
          </h2>
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
                className="wt-btn wt-btn--primary"
                style={{
                  padding: "10px 20px",
                  borderRadius: 9,
                  background: "var(--primary)",
                  color: "#ffffff",
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
                  background: "#fdf8f5",
                  border: "1px solid #fed7aa",
                  borderRadius: 14,
                  padding: 20,
                  marginBottom: 24,
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--primary)", letterSpacing: "0.5px", marginBottom: 6 }}>
                  YOU HAVE BEEN INVITED TO JOIN
                </div>
                <h3 style={{ margin: "0 0 4px", fontSize: 20, color: "#0f172a", fontFamily: "var(--font-serif, Fraunces, serif)" }}>
                  {invite?.patient?.full_name || "Patient Care Circle"}
                </h3>
                <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
                  Invited by: <strong>{invite?.inviter?.full_name || "Primary Caregiver"}</strong>
                </p>
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #fed7aa", fontSize: 13, color: "#334155" }}>
                  Role: <strong className="wt-capitalize">{invite?.role || "Family Caregiver"}</strong>
                  {invite?.email && (
                    <div style={{ marginTop: 4, fontSize: 12, color: "#64748b" }}>
                      Invited email: <strong>{invite.email}</strong>
                    </div>
                  )}
                </div>
              </div>

              {/* Account Mismatch Warning */}
              {isEmailMismatch && (
                <div style={{
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: 10,
                  padding: "14px 16px",
                  fontSize: 13,
                  color: "#991b1b",
                  marginBottom: 20,
                }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 10 }}>
                    <AlertCircle size={18} color="#ef4444" style={{ flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <strong>Account Mismatch:</strong> This invitation was sent specifically to <u>{invite.email}</u>, but you are currently signed in as <u>{caregiverProfile?.email}</u>.
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      await logout();
                      navigate(`/login?email=${encodeURIComponent(invite.email)}&token=${encodeURIComponent(token)}`);
                    }}
                    style={{
                      width: "100%",
                      padding: "9px 14px",
                      borderRadius: 8,
                      border: "1px solid #ef4444",
                      background: "#ffffff",
                      color: "#dc2626",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                    }}
                  >
                    <LogOut size={14} /> Sign Out & Switch to {invite.email}
                  </button>
                </div>
              )}

              {/* Authenticated and Matching Email */}
              {isAuthenticated && !isEmailMismatch && (
                <div style={{ marginTop: 14 }}>
                  <div style={{
                    background: "#f0fdf4",
                    border: "1px solid #bbf7d0",
                    borderRadius: 10,
                    padding: "10px 14px",
                    fontSize: 13,
                    color: "#166534",
                    marginBottom: 16,
                  }}>
                    Signed in as <strong>{caregiverProfile?.full_name || caregiverProfile?.email}</strong> ({caregiverProfile?.email}).
                  </div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 5 }}>
                    Your Relationship to {invite?.patient?.full_name || "Patient"}
                  </label>
                  <input
                    type="text"
                    value={invite?.relationship || "Family Member"}
                    onChange={(e) => setInvite(prev => ({ ...prev, relationship: e.target.value }))}
                    placeholder="e.g. Granddaughter, Son, Nurse"
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      fontSize: 14,
                      boxSizing: "border-box",
                      marginBottom: 16,
                    }}
                  />
                  <button
                    onClick={handleAccept}
                    disabled={isSubmitting}
                    className="wt-btn wt-btn--primary"
                    style={{
                      width: "100%",
                      padding: "14px",
                      borderRadius: 10,
                      background: "var(--primary)",
                      color: "#ffffff",
                      border: "none",
                      fontWeight: 700,
                      fontSize: 15,
                      cursor: isSubmitting ? "not-allowed" : "pointer",
                      boxShadow: "0 4px 12px rgba(190, 91, 46, 0.25)",
                    }}
                  >
                    {isSubmitting ? "Joining Care Circle..." : "Accept Invitation & Join Care Circle"}
                  </button>
                </div>
              )}

              {/* Not Authenticated: Existing Account vs New Registration */}
              {!isAuthenticated && (
                <div>
                  {hasExistingAccount ? (
                    <div>
                      <div style={{
                        background: "#f0f9ff",
                        border: "1px solid #bae6fd",
                        padding: "12px 14px",
                        borderRadius: 10,
                        fontSize: 13,
                        color: "#0369a1",
                        marginBottom: 20,
                      }}>
                        An account exists for <strong>{invite?.email}</strong>. Please log in with your credentials to accept this invitation and join the circle.
                      </div>
                      <button
                        onClick={() => {
                          navigate(`/login?email=${encodeURIComponent(invite?.email || "")}&token=${encodeURIComponent(token)}`);
                        }}
                        className="wt-btn wt-btn--primary"
                        style={{
                          width: "100%",
                          padding: "14px",
                          borderRadius: 10,
                          background: "var(--primary)",
                          color: "#ffffff",
                          border: "none",
                          fontWeight: 700,
                          fontSize: 15,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 8,
                          boxShadow: "0 4px 12px rgba(190, 91, 46, 0.25)",
                        }}
                      >
                        <LogIn size={16} color="#ffffff" /> Log In to Accept Invitation
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div style={{
                        background: "#fffbe6",
                        border: "1px solid #ffe58f",
                        padding: "12px 14px",
                        borderRadius: 10,
                        fontSize: 13,
                        color: "#d48806",
                        marginBottom: 20,
                      }}>
                        Please create your caregiver account for <strong>{invite?.email}</strong> to join this care circle.
                      </div>
                      <button
                        onClick={() => {
                          navigate(`/login?tab=register&email=${encodeURIComponent(invite?.email || "")}&token=${encodeURIComponent(token)}`);
                        }}
                        className="wt-btn wt-btn--primary"
                        style={{
                          width: "100%",
                          padding: "14px",
                          borderRadius: 10,
                          background: "var(--primary)",
                          color: "#ffffff",
                          border: "none",
                          fontWeight: 700,
                          fontSize: 15,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 8,
                          boxShadow: "0 4px 12px rgba(190, 91, 46, 0.25)",
                        }}
                      >
                        <UserPlus size={16} color="#ffffff" /> Register to Join Care Circle
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </div>
  );
}
