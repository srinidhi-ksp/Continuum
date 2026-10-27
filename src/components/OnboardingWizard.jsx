import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { usePatient } from "../context/PatientContext";
import { createPatient } from "../lib/patientApi";
import { createInvitation, getInvitationByToken, acceptInvitation, extractToken } from "../lib/invitationApi";
import {
  CheckCircle,
  Copy,
  Check,
  Share2,
  X,
  AlertCircle,
} from "lucide-react";

const RELATIONSHIPS = [
  "Daughter",
  "Son",
  "Spouse",
  "Granddaughter",
  "Grandson",
  "Sister",
  "Brother",
  "Guardian",
  "Other",
];

const inp = {
  width: "100%",
  padding: "10px 13px",
  borderRadius: 9,
  border: "1px solid #cbd5e1",
  fontSize: 14,
  boxSizing: "border-box",
  background: "white",
  color: "#0f172a",
  outline: "none",
};

const lbl = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "#475569",
  marginBottom: 5,
};

const row = { marginBottom: 14 };

export default function OnboardingWizard({ initialType = "new_patient", onClose }) {
  const { caregiverProfile, completeOnboarding } = useAuth();
  const { setCurrentPatientId, reloadPatients } = usePatient();

  const [setupType, setSetupType] = useState(initialType); // 'new_patient' | 'join_circle'
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // New Patient fields
  const [patientName, setPatientName] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("Female");
  const [condition, setCondition] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [allergies, setAllergies] = useState("");
  const [notes, setNotes] = useState("");
  const [relationship, setRelationship] = useState("Daughter");
  const emergencyContact = caregiverProfile?.full_name || "";
  const emergencyPhone = caregiverProfile?.phone || "";

  // Join Circle fields
  const [inviteTokenInput, setInviteTokenInput] = useState("");
  const [verifiedInvite, setVerifiedInvite] = useState(null);
  const [isVerifyingInvite, setIsVerifyingInvite] = useState(false);
  const [joinRelationship, setJoinRelationship] = useState("Family Member");

  // Post creation / invite state
  const [createdInvite, setCreatedInvite] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);

  async function handleVerifyInvite() {
    const clean = extractToken(inviteTokenInput);
    if (!clean) {
      setError("Please enter or paste an invitation link or token code.");
      return;
    }
    setError("");
    setIsVerifyingInvite(true);
    try {
      const inv = await getInvitationByToken(clean);
      if (!inv || !inv.isValid) {
        setError(inv ? `This invitation link is ${inv.reason || "invalid"}.` : "Invitation token not found.");
        setVerifiedInvite(null);
      } else {
        setVerifiedInvite(inv);
        if (inv.relationship) setJoinRelationship(inv.relationship);
      }
    } catch (err) {
      setError(err.message || "Failed to verify invitation token.");
      setVerifiedInvite(null);
    } finally {
      setIsVerifyingInvite(false);
    }
  }

  async function handleCreatePatient(e) {
    e.preventDefault();
    if (!patientName.trim()) { setError("Patient name is required."); return; }
    if (!condition.trim()) { setError("Primary medical condition is required."); return; }
    if (!dob) { setError("Patient date of birth is required."); return; }

    setError("");
    setIsSubmitting(true);
    try {
      const activeCgId = caregiverProfile?.caregiver_id;
      if (!activeCgId) throw new Error("No active caregiver profile found.");

      const newPatient = await createPatient({
        name: patientName.trim(),
        dob: dob || null,
        gender,
        condition: condition.trim(),
        bloodGroup: bloodGroup || null,
        allergies: allergies || null,
        notes: notes || null,
        relationship,
        caregiverId: activeCgId,
        emergencyContact: emergencyContact || caregiverProfile?.full_name,
        emergencyPhone: emergencyPhone || caregiverProfile?.phone || null,
      });

      let inv = null;
      try {
        inv = await createInvitation({
          patientId: newPatient.patient_id,
          invitedBy: activeCgId,
          relationship: "Family Member",
          role: "family",
        });
        setCreatedInvite(inv);
      } catch (invErr) {
        console.warn("[OnboardingWizard] Invite creation notice:", invErr);
      }

      await reloadPatients();
      setCurrentPatientId(newPatient.patient_id);
      setDone(true);
    } catch (err) {
      console.error("[OnboardingWizard] create failed:", err);
      setError(err.message || "Setup failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleJoinCircle(e) {
    e.preventDefault();
    const clean = extractToken(inviteTokenInput);
    if (!clean) {
      setError("Please paste a valid invitation link or code.");
      return;
    }

    setError("");
    setIsSubmitting(true);
    try {
      const activeCgId = caregiverProfile?.caregiver_id;
      if (!activeCgId) throw new Error("No active caregiver profile found.");

      const res = await acceptInvitation(clean, activeCgId, joinRelationship);
      await reloadPatients();
      if (res.patientId) setCurrentPatientId(res.patientId);
      setDone(true);
    } catch (err) {
      console.error("[OnboardingWizard] join failed:", err);
      setError(err.message || "Failed to join care circle. Check your invite link.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleFinish() {
    completeOnboarding();
    if (onClose) onClose();
  }

  function handleCopyInvite() {
    if (!createdInvite?.shareableUrl) return;
    navigator.clipboard.writeText(createdInvite.shareableUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  }

  function handleWhatsAppShare() {
    if (!createdInvite?.shareableUrl) return;
    const text = encodeURIComponent(
      `Hello! I've set up ${patientName}'s care circle on CONTINUUM. Please join our care circle here to coordinate medications and daily updates together:\n${createdInvite.shareableUrl}`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, "_blank");
  }

  if (done) {
    return (
      <div style={overlay}>
        <div style={{ ...card, textAlign: "center", padding: "40px 32px" }}>
          <CheckCircle size={52} color="#10b981" style={{ margin: "0 auto 14px" }} />
          <h2 style={{ margin: "0 0 8px", fontSize: 22, color: "#0f172a" }}>
            {setupType === "new_patient" ? "Care Circle Created!" : "Joined Care Circle!"}
          </h2>
          <p style={{ color: "#64748b", fontSize: 14, marginBottom: 20 }}>
            {setupType === "new_patient" ? (
              <>
                <strong>{patientName}</strong>'s care circle is active. You are registered as the <strong>Primary Caregiver</strong> ({relationship}).
              </>
            ) : (
              <>
                You have successfully joined the care circle as a caregiver ({joinRelationship}).
              </>
            )}
          </p>

          {/* Shareable Invite Box if New Patient */}
          {setupType === "new_patient" && createdInvite?.shareableUrl && (
            <div
              style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                padding: 16,
                textAlign: "left",
                marginBottom: 24,
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: "#5b57d9", letterSpacing: "0.5px", marginBottom: 6 }}>
                SHAREABLE FAMILY INVITE LINK
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <input
                  readOnly
                  style={{ ...inp, fontSize: 12, padding: "8px 10px", background: "white" }}
                  value={createdInvite.shareableUrl}
                />
                <button
                  type="button"
                  onClick={handleCopyInvite}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 8,
                    background: copiedLink ? "#10b981" : "#5b57d9",
                    color: "white",
                    border: "none",
                    fontWeight: 600,
                    fontSize: 12,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    whiteSpace: "nowrap",
                  }}
                >
                  {copiedLink ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
                </button>
              </div>

              <button
                type="button"
                onClick={handleWhatsAppShare}
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: 8,
                  background: "#25D366",
                  color: "white",
                  border: "none",
                  fontWeight: 600,
                  fontSize: 12,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                <Share2 size={13} /> Share on WhatsApp
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={handleFinish}
            style={{
              width: "100%",
              padding: "13px",
              borderRadius: 10,
              background: "#5b57d9",
              color: "white",
              border: "none",
              fontWeight: 700,
              fontSize: 15,
              cursor: "pointer",
              boxShadow: "0 4px 14px rgba(91, 87, 217, 0.25)",
            }}
          >
            Go to Dashboard →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={overlay}>
      <div style={card}>
        {/* Header */}
        <div style={header}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "1px", opacity: 0.85, textTransform: "uppercase" }}>
              CONTINUUM · Care Setup
            </div>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                style={{ background: "none", border: "none", color: "white", cursor: "pointer", padding: 4 }}
              >
                <X size={18} />
              </button>
            )}
          </div>
          <h2 style={{ margin: "6px 0 0", fontSize: 20, fontWeight: 700 }}>
            {setupType === "new_patient" ? "Set Up a New Patient Circle" : "Join Existing Care Circle"}
          </h2>
        </div>

        {/* Path Selector Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
          <button
            type="button"
            onClick={() => { setSetupType("new_patient"); setError(""); }}
            style={{
              flex: 1,
              padding: "11px",
              border: "none",
              background: setupType === "new_patient" ? "white" : "transparent",
              fontSize: 13,
              fontWeight: 600,
              color: setupType === "new_patient" ? "#5b57d9" : "#64748b",
              borderBottom: `2px solid ${setupType === "new_patient" ? "#5b57d9" : "transparent"}`,
              cursor: "pointer",
            }}
          >
            + Create New Patient
          </button>
          <button
            type="button"
            onClick={() => { setSetupType("join_circle"); setError(""); }}
            style={{
              flex: 1,
              padding: "11px",
              border: "none",
              background: setupType === "join_circle" ? "white" : "transparent",
              fontSize: 13,
              fontWeight: 600,
              color: setupType === "join_circle" ? "#5b57d9" : "#64748b",
              borderBottom: `2px solid ${setupType === "join_circle" ? "#5b57d9" : "transparent"}`,
              cursor: "pointer",
            }}
          >
            Join with Invite Link
          </button>
        </div>

        {/* Wizard Body */}
        <div style={{ padding: "24px 28px 28px", maxHeight: "75vh", overflowY: "auto" }}>
          {error && (
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#991b1b",
                borderRadius: 8,
                padding: "9px 12px",
                fontSize: 13,
                marginBottom: 16,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <AlertCircle size={16} />
              <div>{error}</div>
            </div>
          )}

          {setupType === "new_patient" ? (
            <form onSubmit={handleCreatePatient}>
              <div style={row}>
                <label style={lbl}>Your Relationship to Patient *</label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
                  {RELATIONSHIPS.map((rel) => {
                    const sel = relationship === rel;
                    return (
                      <button
                        key={rel}
                        type="button"
                        onClick={() => setRelationship(rel)}
                        style={{
                          padding: "7px 4px",
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: sel ? 700 : 500,
                          cursor: "pointer",
                          textAlign: "center",
                          border: `1.5px solid ${sel ? "#5b57d9" : "#e2e8f0"}`,
                          background: sel ? "#eeedff" : "white",
                          color: sel ? "#5b57d9" : "#334155",
                        }}
                      >
                        {rel}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={row}>
                <label style={lbl}>Patient Full Name *</label>
                <input
                  style={inp}
                  type="text"
                  required
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  placeholder="e.g. Prema Nellaiappan"
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                <div>
                  <label style={lbl}>Date of Birth *</label>
                  <input style={inp} type="date" required value={dob} onChange={(e) => setDob(e.target.value)} />
                </div>
                <div>
                  <label style={lbl}>Gender</label>
                  <select style={inp} value={gender} onChange={(e) => setGender(e.target.value)}>
                    <option>Female</option>
                    <option>Male</option>
                    <option>Other</option>
                  </select>
                </div>
              </div>

              <div style={row}>
                <label style={lbl}>Primary Medical Condition *</label>
                <input
                  style={inp}
                  type="text"
                  required
                  value={condition}
                  onChange={(e) => setCondition(e.target.value)}
                  placeholder="e.g. Dementia, Parkinson's"
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                <div>
                  <label style={lbl}>Blood Group (optional)</label>
                  <select style={inp} value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)}>
                    <option value="">Select blood group</option>
                    {["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"].map((bg) => (
                      <option key={bg} value={bg}>{bg}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Allergies (optional)</label>
                  <input
                    style={inp}
                    type="text"
                    value={allergies}
                    onChange={(e) => setAllergies(e.target.value)}
                    placeholder="e.g. Penicillin"
                  />
                </div>
              </div>

              <div style={row}>
                <label style={lbl}>Care Notes / Instructions (optional)</label>
                <textarea
                  style={{ ...inp, height: 50, resize: "none" }}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Daily routine prompts, afternoon rest."
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: 10,
                  background: isSubmitting ? "#a5b4fc" : "#5b57d9",
                  color: "white",
                  border: "none",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: isSubmitting ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  marginTop: 8,
                }}
              >
                {isSubmitting ? "Creating Care Circle…" : "Create Care Circle & Generate Invite Link"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleJoinCircle}>
              <div style={row}>
                <label style={lbl}>Invitation Link or Token Code *</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    style={{ ...inp, flex: 1 }}
                    type="text"
                    required
                    value={inviteTokenInput}
                    onChange={(e) => setInviteTokenInput(e.target.value)}
                    placeholder="Paste http://.../join?token=... or code"
                  />
                  <button
                    type="button"
                    onClick={handleVerifyInvite}
                    disabled={isVerifyingInvite || !inviteTokenInput.trim()}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 8,
                      background: "#334155",
                      color: "white",
                      border: "none",
                      fontWeight: 600,
                      fontSize: 12,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {isVerifyingInvite ? "Checking…" : "Verify"}
                  </button>
                </div>
              </div>

              {verifiedInvite && (
                <div
                  style={{
                    background: "#f0fdf4",
                    border: "1px solid #bbf7d0",
                    borderRadius: 10,
                    padding: 12,
                    marginBottom: 16,
                  }}
                >
                  <div style={{ color: "#166534", fontSize: 11, fontWeight: 700, marginBottom: 2 }}>
                    ✓ VALID INVITATION FOUND
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
                    {verifiedInvite.patient?.full_name || "Patient Care Circle"}
                  </div>
                  <div style={{ fontSize: 12, color: "#475569" }}>
                    Condition: {verifiedInvite.patient?.condition_type || "Care coordination"}
                  </div>
                </div>
              )}

              <div style={row}>
                <label style={lbl}>Your Relationship to Patient *</label>
                <input
                  style={inp}
                  type="text"
                  required
                  value={joinRelationship}
                  onChange={(e) => setJoinRelationship(e.target.value)}
                  placeholder="e.g. Granddaughter, Son, Nurse"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: 10,
                  background: isSubmitting ? "#a5b4fc" : "#10b981",
                  color: "white",
                  border: "none",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: isSubmitting ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  marginTop: 8,
                }}
              >
                {isSubmitting ? "Joining Care Circle…" : "Accept & Join Care Circle"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

const overlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.65)",
  backdropFilter: "blur(6px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
  zIndex: 2000,
  fontFamily: "Inter, Arial, sans-serif",
};

const card = {
  width: "100%",
  maxWidth: 540,
  background: "white",
  borderRadius: 20,
  boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
  overflow: "hidden",
};

const header = {
  background: "linear-gradient(135deg, #5b57d9 0%, #3c38b0 100%)",
  color: "white",
  padding: "20px 28px",
};
