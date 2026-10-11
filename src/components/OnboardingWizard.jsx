import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { usePatient } from "../context/PatientContext";
import { createPatient } from "../lib/patientApi";
import { ArrowRight, CheckCircle } from "lucide-react";

const RELATIONSHIPS = [
  "Daughter",
  "Son",
  "Granddaughter",
  "Grandson",
  "Spouse",
  "Parent",
  "Sibling",
  "External Caregiver",
  "Other",
];

const STEP_LABELS = [
  "Your Details",
  "Patient Info",
  "Relationship",
  "Confirm",
];

/* ── Shared input style ─────────────────────────────────────── */
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

/* ── Stepper dots ───────────────────────────────────────────── */
function StepDots({ step, total }) {
  return (
    <div style={{ display: "flex", gap: 6, marginTop: 18 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: 3,
            borderRadius: 2,
            background: i < step ? "white" : "rgba(255,255,255,0.3)",
            transition: "background 0.3s",
          }}
        />
      ))}
    </div>
  );
}

/* ── Button helpers ─────────────────────────────────────────── */
function PrimaryBtn({ children, disabled, ...rest }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      style={{
        flex: 1,
        padding: "11px 14px",
        borderRadius: 9,
        background: disabled ? "#a5b4fc" : "#5b57d9",
        color: "white",
        border: "none",
        fontWeight: 600,
        fontSize: 14,
        cursor: disabled ? "not-allowed" : "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

function BackBtn({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "11px 16px",
        borderRadius: 9,
        border: "1px solid #e2e8f0",
        background: "white",
        color: "#475569",
        fontWeight: 600,
        fontSize: 14,
        cursor: "pointer",
      }}
    >
      Back
    </button>
  );
}

/* ── Main Component ─────────────────────────────────────────── */
export default function OnboardingWizard() {
  const { user, caregiverProfile, completeOnboarding } = useAuth();
  const { setCurrentPatientId, reloadPatients } = usePatient();

  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // Step 1 — Caregiver details
  const [cgName, setCgName] = useState(caregiverProfile?.full_name || user?.user_metadata?.full_name || "");
  const [cgPhone, setCgPhone] = useState(caregiverProfile?.phone || "");

  // Step 2 — Patient info
  const [patientName, setPatientName] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("Female");
  const [condition, setCondition] = useState("");
  const [allergies, setAllergies] = useState("");

  // Step 3 — Relationship
  const [relationship, setRelationship] = useState("Daughter");

  /* ── Handlers ─────────────────────────────────── */
  function goNext1(e) {
    e.preventDefault();
    if (!cgName.trim()) { setError("Please enter your full name."); return; }
    setError(""); setStep(2);
  }

  function goNext2(e) {
    e.preventDefault();
    if (!patientName.trim()) { setError("Patient name is required."); return; }
    if (!condition.trim()) { setError("Primary medical condition is required."); return; }
    setError(""); setStep(3);
  }

  function goNext3(e) {
    e.preventDefault();
    setError(""); setStep(4);
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError(""); setIsSubmitting(true);
    try {
      const newPatient = await createPatient({
        name: patientName,
        dob: dob || null,
        gender,
        condition,
        allergies: allergies || null,
        relationship,             // passed so caregiver_pat.relationship is set
        caregiverId: user?.id,    // explicit override — avoids stale module constant
      });

      await reloadPatients();
      setCurrentPatientId(newPatient.patient_id);
      setDone(true);
    } catch (err) {
      console.error("[Onboarding] create failed:", err);
      setError(err.message || "Setup failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  /* ── Done screen ──────────────────────────────── */
  if (done) {
    return (
      <div style={overlay}>
        <div style={{ ...card, textAlign: "center", padding: 48 }}>
          <CheckCircle size={52} color="#10b981" style={{ marginBottom: 14 }} />
          <h2 style={{ margin: "0 0 8px", fontSize: 22, color: "#0f172a" }}>
            Care Circle Created!
          </h2>
          <p style={{ color: "#64748b", fontSize: 14, marginBottom: 28 }}>
            <strong>{patientName}</strong>'s care circle is ready. You can invite
            other caregivers from the Care Circle page at any time.
          </p>
          <button
            onClick={completeOnboarding}
            style={{
              padding: "12px 32px",
              borderRadius: 9,
              background: "#5b57d9",
              color: "white",
              border: "none",
              fontWeight: 700,
              fontSize: 15,
              cursor: "pointer",
            }}
          >
            Go to Dashboard →
          </button>
        </div>
      </div>
    );
  }

  /* ── Overlay ──────────────────────────────────── */
  return (
    <div style={overlay}>
      <div style={card}>
        {/* Header */}
        <div style={header}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "1.2px", opacity: 0.8, textTransform: "uppercase", marginBottom: 4 }}>
            CONTINUUM · Setup
          </div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
            {STEP_LABELS[step - 1]}
          </h2>
          <StepDots step={step} total={4} />
        </div>

        {/* Body */}
        <div style={{ padding: "28px 32px 32px" }}>
          {error && (
            <div style={{
              background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b",
              borderRadius: 8, padding: "9px 12px", fontSize: 13, marginBottom: 16,
            }}>
              {error}
            </div>
          )}

          {/* ── STEP 1 ─ Caregiver Details ── */}
          {step === 1 && (
            <form onSubmit={goNext1}>
              <p style={{ margin: "0 0 20px", color: "#64748b", fontSize: 13 }}>
                Tell us about yourself as the primary caregiver.
              </p>
              <div style={row}>
                <label style={lbl}>Full Name *</label>
                <input style={inp} type="text" value={cgName}
                  onChange={e => setCgName(e.target.value)} placeholder="e.g. Srinidhi Ravi" />
              </div>
              <div style={{ ...row, marginBottom: 24 }}>
                <label style={lbl}>Phone <span style={{ color: "#94a3b8", fontWeight: 400 }}>(optional)</span></label>
                <input style={inp} type="tel" value={cgPhone}
                  onChange={e => setCgPhone(e.target.value)} placeholder="+91 98765 43210" />
              </div>
              <PrimaryBtn>Continue <ArrowRight size={15} /></PrimaryBtn>
            </form>
          )}

          {/* ── STEP 2 ─ Patient Info ── */}
          {step === 2 && (
            <form onSubmit={goNext2}>
              <p style={{ margin: "0 0 20px", color: "#64748b", fontSize: 13 }}>
                Who will you be caring for?
              </p>
              <div style={row}>
                <label style={lbl}>Patient Full Name *</label>
                <input style={inp} type="text" value={patientName}
                  onChange={e => setPatientName(e.target.value)} placeholder="e.g. Lakshmi Krishnan" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={lbl}>Date of Birth</label>
                  <input style={inp} type="date" value={dob} onChange={e => setDob(e.target.value)} />
                </div>
                <div>
                  <label style={lbl}>Gender</label>
                  <select style={inp} value={gender} onChange={e => setGender(e.target.value)}>
                    <option>Female</option>
                    <option>Male</option>
                    <option>Other</option>
                  </select>
                </div>
              </div>
              <div style={row}>
                <label style={lbl}>Primary Medical Condition *</label>
                <input style={inp} type="text" value={condition}
                  onChange={e => setCondition(e.target.value)} placeholder="e.g. Dementia / Alzheimer's" />
              </div>
              <div style={{ ...row, marginBottom: 24 }}>
                <label style={lbl}>Allergies <span style={{ color: "#94a3b8", fontWeight: 400 }}>(optional)</span></label>
                <input style={inp} type="text" value={allergies}
                  onChange={e => setAllergies(e.target.value)} placeholder="e.g. Penicillin, Pollen" />
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <BackBtn onClick={() => setStep(1)} />
                <PrimaryBtn>Continue <ArrowRight size={15} /></PrimaryBtn>
              </div>
            </form>
          )}

          {/* ── STEP 3 ─ Relationship ── */}
          {step === 3 && (
            <form onSubmit={goNext3}>
              <p style={{ margin: "0 0 16px", color: "#64748b", fontSize: 13 }}>
                Your relationship to <strong>{patientName || "the patient"}</strong>:
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 24 }}>
                {RELATIONSHIPS.map(rel => {
                  const sel = relationship === rel;
                  return (
                    <button key={rel} type="button" onClick={() => setRelationship(rel)}
                      style={{
                        padding: "11px 8px", borderRadius: 10, fontSize: 13, fontWeight: sel ? 700 : 500,
                        cursor: "pointer", textAlign: "center",
                        border: `2px solid ${sel ? "#5b57d9" : "#e2e8f0"}`,
                        background: sel ? "#eeedff" : "white",
                        color: sel ? "#5b57d9" : "#334155",
                      }}
                    >
                      {rel}
                    </button>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <BackBtn onClick={() => setStep(2)} />
                <PrimaryBtn>Continue <ArrowRight size={15} /></PrimaryBtn>
              </div>
            </form>
          )}

          {/* ── STEP 4 ─ Confirm & Create ── */}
          {step === 4 && (
            <form onSubmit={handleCreate}>
              <div style={{
                background: "#f8fafc", border: "1px solid #e2e8f0",
                borderRadius: 12, padding: "18px 20px", marginBottom: 20,
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#5b57d9", letterSpacing: "0.8px", marginBottom: 10 }}>
                  CARE CIRCLE SUMMARY
                </div>
                {[
                  ["Primary Caregiver", cgName],
                  ["Role", "Primary Coordinator"],
                  ["Relationship to Patient", relationship],
                  ["Patient", patientName],
                  ["Medical Condition", condition],
                ].map(([label, value]) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "5px 0", borderBottom: "1px solid #f1f5f9" }}>
                    <span style={{ color: "#64748b" }}>{label}</span>
                    <span style={{ color: "#0f172a", fontWeight: 600 }}>{value}</span>
                  </div>
                ))}
              </div>
              <p style={{ color: "#64748b", fontSize: 12, marginBottom: 20 }}>
                You can invite other caregivers and add medications from the Care Circle and Medications pages after setup.
              </p>
              <div style={{ display: "flex", gap: 10 }}>
                <BackBtn onClick={() => setStep(3)} />
                <PrimaryBtn disabled={isSubmitting}>
                  {isSubmitting ? "Creating…" : "Create Care Circle"}
                </PrimaryBtn>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Styles ─────────────────────────────────────────────────── */
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
  maxWidth: 520,
  background: "white",
  borderRadius: 18,
  boxShadow: "0 25px 50px -12px rgba(0,0,0,0.22)",
  overflow: "hidden",
};

const header = {
  background: "linear-gradient(135deg, #5b57d9 0%, #3c38b0 100%)",
  color: "white",
  padding: "24px 32px 20px",
};
