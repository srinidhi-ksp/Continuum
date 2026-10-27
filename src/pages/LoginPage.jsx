import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { usePatient } from "../context/PatientContext";
import { hasSupabaseConfig } from "../lib/supabaseClient";
import { getInvitationByToken, extractToken } from "../lib/invitationApi";
import {
  Heart,
  Users,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  Copy,
  Check,
  Share2,
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
  padding: "11px 14px",
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  fontSize: 14,
  boxSizing: "border-box",
  outline: "none",
  background: "#ffffff",
  color: "#0f172a",
  transition: "border-color 0.2s, box-shadow 0.2s",
};

const lbl = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "#475569",
  marginBottom: 6,
};

export default function LoginPage() {
  const { login, registerWithSetup, isLoading: isAuthLoading } = useAuth();
  const { reloadPatients, setCurrentPatientId } = usePatient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [tab, setTab] = useState(searchParams.get("tab") === "register" ? "register" : "login");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Login form state ──
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // ── Register wizard state ──
  // Step 1: Caregiver details
  // Step 2: Choose Path (new_patient vs join_circle)
  // Step 3: Patient & Care details / Join details
  // Step 4: Success & Share Invite Link
  const [regStep, setRegStep] = useState(1);
  const [setupType, setSetupType] = useState("new_patient"); // 'new_patient' | 'join_circle'

  // Step 1 fields (Caregiver)
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [language, setLanguage] = useState("English");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Step 3A fields (New Patient)
  const [relationship, setRelationship] = useState("Daughter");
  const [patientName, setPatientName] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("Female");
  const [condition, setCondition] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [allergies, setAllergies] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");

  // Step 3B fields (Join Circle)
  const [inviteTokenInput, setInviteTokenInput] = useState(searchParams.get("token") || "");
  const [verifiedInvite, setVerifiedInvite] = useState(null);
  const [isVerifyingInvite, setIsVerifyingInvite] = useState(false);
  const [joinRelationship, setJoinRelationship] = useState("Family Member");
  const [joinRole, setJoinRole] = useState("family");

  // Step 4 fields (Success state)
  const [createdCircleResult, setCreatedCircleResult] = useState(null);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [emailConfirmationRequired, setEmailConfirmationRequired] = useState(false);

  // Auto-verify if token was in query params
  useEffect(() => {
    const queryToken = searchParams.get("token");
    if (queryToken) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTab("register");
      setSetupType("join_circle");
      setRegStep(3);
      setInviteTokenInput(queryToken);
      verifyToken(queryToken);
    }
  }, [searchParams]);

  async function verifyToken(raw) {
    if (!raw?.trim()) return;
    setIsVerifyingInvite(true);
    setError("");
    try {
      const clean = extractToken(raw);
      const inv = await getInvitationByToken(clean);
      if (!inv || !inv.isValid) {
        setError(inv ? `This invitation link is ${inv.reason || "invalid"}.` : "Invitation token not found.");
        setVerifiedInvite(null);
      } else {
        setVerifiedInvite(inv);
        if (inv.relationship) setJoinRelationship(inv.relationship);
        if (inv.role) setJoinRole(inv.role);
      }
    } catch (err) {
      setError(err.message || "Could not verify invitation token.");
      setVerifiedInvite(null);
    } finally {
      setIsVerifyingInvite(false);
    }
  }

  // Handle Login submission
  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    if (!loginEmail.trim() || !loginPassword) {
      setError("Please enter your email and password.");
      return;
    }

    setIsSubmitting(true);
    try {
      await login(loginEmail, loginPassword);
      await reloadPatients();
      navigate("/");
    } catch (err) {
      console.error("[LoginPage] Login error:", err);
      const msg = err.message || "";
      if (msg.includes("Invalid login credentials")) {
        setError("Incorrect email or password. Please try again.");
      } else if (msg.includes("Email not confirmed")) {
        setError("Please check your email and confirm your account before logging in. If you don't receive an email, check your spam or ask your administrator to disable email confirmations.");
      } else {
        setError(msg || "Failed to log in. Please check your credentials.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  // Step 1 Validation -> Go to Step 2
  function handleGoToStep2(e) {
    e.preventDefault();
    setError("");
    if (!fullName.trim()) { setError("Full name is required."); return; }
    if (!email.trim()) { setError("Email address is required."); return; }
    if (!email.includes("@")) { setError("Please enter a valid email address."); return; }
    if (!password) { setError("Password is required."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }

    // Pre-fill emergency contact with caregiver details as convenient default
    if (!emergencyContact) setEmergencyContact(fullName);
    if (!emergencyPhone && phone) setEmergencyPhone(phone);

    setRegStep(2);
  }

  // Final Registration & Care Circle Setup Submission
  async function handleFinishRegistration(e) {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      if (setupType === "new_patient") {
        if (!patientName.trim()) { setError("Patient full name is required."); setIsSubmitting(false); return; }
        if (!condition.trim()) { setError("Primary medical condition is required."); setIsSubmitting(false); return; }
        if (!dob) { setError("Patient date of birth is required."); setIsSubmitting(false); return; }

        const patientPayload = {
          name: patientName.trim(),
          dob,
          gender,
          condition: condition.trim(),
          bloodGroup: bloodGroup || null,
          allergies: allergies || null,
          phone: patientPhone || null,
          notes: notes || null,
          relationship,
          emergencyContact: emergencyContact || fullName,
          emergencyPhone: emergencyPhone || phone || null,
        };

        const res = await registerWithSetup({
          email: email.trim(),
          password,
          fullName: fullName.trim(),
          phone: phone.trim() || null,
          language,
          setupType: "new_patient",
          patientData: patientPayload,
        });

        if (res.needsEmailConfirmation) {
          setEmailConfirmationRequired(true);
          return;
        }

        if (res.patient) {
          setCreatedCircleResult({
            patient: res.patient,
            invite: res.invite,
          });
          setRegStep(4);
          await reloadPatients();
          setCurrentPatientId(res.patient.patient_id);
        } else {
          navigate("/");
        }
      } else {
        // Join existing care circle
        const cleanToken = extractToken(inviteTokenInput);
        if (!cleanToken) {
          setError("Please enter or paste an invitation link or code.");
          setIsSubmitting(false);
          return;
        }

        const res = await registerWithSetup({
          email: email.trim(),
          password,
          fullName: fullName.trim(),
          phone: phone.trim() || null,
          language,
          setupType: "join_circle",
          joinData: {
            token: cleanToken,
            relationship: joinRelationship,
          },
        });

        if (res.needsEmailConfirmation) {
          setEmailConfirmationRequired(true);
          return;
        }

        await reloadPatients();
        navigate("/");
      }
    } catch (err) {
      console.error("[LoginPage] Register error:", err);
      const msg = err.message || "";
      if (msg.includes("already registered") || msg.includes("User already registered")) {
        setError("An account with this email already exists. Please switch to Log In.");
      } else {
        setError(msg || "Registration failed. Please check your details and try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleCopyInviteLink() {
    if (!createdCircleResult?.invite?.shareableUrl) return;
    navigator.clipboard.writeText(createdCircleResult.invite.shareableUrl);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2500);
  }

  function handleWhatsAppShare() {
    if (!createdCircleResult?.invite?.shareableUrl) return;
    const pName = createdCircleResult.patient?.full_name || patientName || "our loved one";
    const text = encodeURIComponent(
      `Hello! I've set up ${pName}'s care circle on CONTINUUM. Please join our care circle here to coordinate medications, daily meals, and care updates together:\n${createdCircleResult.invite.shareableUrl}`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, "_blank");
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #f0f0ff 0%, #f7f8fc 60%, #eef6ff 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
        fontFamily: "Inter, Arial, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: tab === "register" && (regStep === 3 || regStep === 4) ? 580 : 460,
          background: "white",
          borderRadius: 22,
          boxShadow: "0 20px 60px rgba(91, 87, 217, 0.14)",
          border: "1px solid #e2e8f0",
          overflow: "hidden",
          transition: "max-width 0.3s ease",
        }}
      >
        {/* Brand Header */}
        <div
          style={{
            background: "linear-gradient(135deg, #5b57d9 0%, #3c38b0 100%)",
            color: "white",
            padding: "28px 32px 22px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: "rgba(255,255,255,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 10px",
              fontSize: 22,
              fontWeight: 800,
            }}
          >
            C
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: "0.5px" }}>CONTINUUM</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, opacity: 0.88 }}>Woven Caregiver Intelligence</p>
        </div>

        {/* Top Navigation Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
          <button
            type="button"
            onClick={() => { setTab("login"); setError(""); }}
            style={{
              flex: 1,
              padding: "13px",
              border: "none",
              background: tab === "login" ? "white" : "transparent",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              color: tab === "login" ? "#5b57d9" : "#64748b",
              borderBottom: `2px solid ${tab === "login" ? "#5b57d9" : "transparent"}`,
            }}
          >
            Log In
          </button>
          <button
            type="button"
            onClick={() => { setTab("register"); setError(""); }}
            style={{
              flex: 1,
              padding: "13px",
              border: "none",
              background: tab === "register" ? "white" : "transparent",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              color: tab === "register" ? "#5b57d9" : "#64748b",
              borderBottom: `2px solid ${tab === "register" ? "#5b57d9" : "transparent"}`,
            }}
          >
            Register & Setup Care
          </button>
        </div>

        {/* Global Configuration or Error Alert */}
        <div style={{ padding: "24px 28px 0" }}>
          {!hasSupabaseConfig && (
            <div
              style={{
                background: "#fff7ed",
                border: "1px solid #fed7aa",
                color: "#9a3412",
                borderRadius: 10,
                padding: "10px 14px",
                fontSize: 13,
                marginBottom: 16,
              }}
            >
              Supabase configuration missing in .env. Please check VITE_SUPABASE_URL and anon key.
            </div>
          )}

          {error && (
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#991b1b",
                borderRadius: 10,
                padding: "10px 14px",
                fontSize: 13,
                marginBottom: 16,
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
              }}
            >
              <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>{error}</div>
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════════════════════════
            TAB 1: LOG IN
        ══════════════════════════════════════════════════════════════ */}
        {tab === "login" && (
          <form onSubmit={handleLogin} style={{ padding: "16px 28px 28px" }}>
            <p style={{ margin: "0 0 20px", color: "#64748b", fontSize: 13 }}>
              Welcome back. Sign in to your caregiver account to access your patient dashboard.
            </p>

            <div style={{ marginBottom: 16 }}>
              <label style={lbl}>Email Address *</label>
              <input
                style={inp}
                type="email"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="caregiver@example.com"
              />
            </div>

            <div style={{ marginBottom: 22 }}>
              <label style={lbl}>Password *</label>
              <input
                style={inp}
                type="password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={!hasSupabaseConfig || isSubmitting || isAuthLoading}
              style={{
                width: "100%",
                padding: "13px",
                borderRadius: 10,
                background: isSubmitting || isAuthLoading ? "#a5b4fc" : "#5b57d9",
                color: "white",
                border: "none",
                fontWeight: 700,
                fontSize: 14,
                cursor: isSubmitting || isAuthLoading ? "not-allowed" : "pointer",
                boxShadow: "0 4px 12px rgba(91, 87, 217, 0.25)",
              }}
            >
              {isSubmitting ? "Signing In…" : "Log In to Dashboard"}
            </button>

            <div style={{ textAlign: "center", marginTop: 20 }}>
              <span style={{ fontSize: 13, color: "#64748b" }}>First time using Continuum? </span>
              <button
                type="button"
                onClick={() => { setTab("register"); setError(""); }}
                style={{
                  background: "none",
                  border: "none",
                  color: "#5b57d9",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                  padding: 0,
                  textDecoration: "underline",
                }}
              >
                Register & Set Up Care Circle
              </button>
            </div>
          </form>
        )}

        {/* ══════════════════════════════════════════════════════════════
            TAB 2: REGISTER & SET UP CARE CIRCLE
        ══════════════════════════════════════════════════════════════ */}
        {tab === "register" && (
          <div style={{ padding: "16px 28px 28px" }}>
            {/* Step Progress Indicators */}
            {!emailConfirmationRequired && regStep < 4 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                {[
                  { n: 1, label: "Caregiver" },
                  { n: 2, label: "Setup Choice" },
                  { n: 3, label: setupType === "new_patient" ? "Patient & Circle" : "Join Circle" },
                ].map((s) => (
                  <div key={s.n} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: "50%",
                        background: regStep >= s.n ? "#5b57d9" : "#e2e8f0",
                        color: regStep >= s.n ? "white" : "#64748b",
                        fontSize: 11,
                        fontWeight: 700,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {regStep > s.n ? <Check size={13} /> : s.n}
                    </div>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: regStep === s.n ? 700 : 500,
                        color: regStep === s.n ? "#0f172a" : "#64748b",
                      }}
                    >
                      {s.label}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Email Confirmation Required Screen */}
            {emailConfirmationRequired ? (
              <div style={{ textAlign: "center", padding: "12px 4px" }}>
                <CheckCircle size={48} color="#10b981" style={{ margin: "0 auto 12px" }} />
                <h3 style={{ margin: "0 0 8px", fontSize: 18, color: "#0f172a" }}>Confirm Your Email</h3>
                <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.5, marginBottom: 18 }}>
                  We sent a confirmation link to <strong>{email}</strong>. Please click the link in your email to confirm your account.
                </p>
                <div
                  style={{
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: 12,
                    padding: 14,
                    fontSize: 12,
                    color: "#475569",
                    textAlign: "left",
                    marginBottom: 20,
                  }}
                >
                  <strong>Care Circle Saved:</strong> Your patient setup details have been preserved. Once confirmed, simply return and log in with your email and password — your Care Circle will be ready immediately!
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEmailConfirmationRequired(false);
                    setTab("login");
                    setLoginEmail(email);
                  }}
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: 10,
                    background: "#5b57d9",
                    color: "white",
                    border: "none",
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: "pointer",
                  }}
                >
                  Return to Log In
                </button>
              </div>
            ) : (
              <>
                {/* ── STEP 1: CAREGIVER DETAILS ────────────────────── */}
                {regStep === 1 && (
                  <form onSubmit={handleGoToStep2}>
                    <p style={{ margin: "0 0 16px", color: "#64748b", fontSize: 13 }}>
                      Create your caregiver profile. You will use these details to coordinate care and communicate with doctors and family members.
                    </p>

                    <div style={{ marginBottom: 14 }}>
                      <label style={lbl}>Caregiver Full Name *</label>
                      <input
                        style={inp}
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g. Shanmuga Sundari"
                      />
                    </div>

                    <div style={{ marginBottom: 14 }}>
                      <label style={lbl}>Email Address *</label>
                      <input
                        style={inp}
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="caregiver@example.com"
                      />
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                      <div>
                        <label style={lbl}>Phone (optional)</label>
                        <input
                          style={inp}
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="+91 99945 10170"
                        />
                      </div>
                      <div>
                        <label style={lbl}>Language</label>
                        <select style={inp} value={language} onChange={(e) => setLanguage(e.target.value)}>
                          {["English", "Tamil", "Hindi", "Kannada", "Telugu", "Malayalam"].map((l) => (
                            <option key={l}>{l}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
                      <div>
                        <label style={lbl}>Password *</label>
                        <input
                          style={inp}
                          type="password"
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                        />
                      </div>
                      <div>
                        <label style={lbl}>Confirm Password *</label>
                        <input
                          style={inp}
                          type="password"
                          required
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="••••••••"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      style={{
                        width: "100%",
                        padding: "13px",
                        borderRadius: 10,
                        background: "#5b57d9",
                        color: "white",
                        border: "none",
                        fontWeight: 700,
                        fontSize: 14,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        boxShadow: "0 4px 12px rgba(91, 87, 217, 0.25)",
                      }}
                    >
                      Continue to Care Setup <ArrowRight size={16} />
                    </button>
                  </form>
                )}

                {/* ── STEP 2: CHOOSE PATH (CREATE VS JOIN) ──────────── */}
                {regStep === 2 && (
                  <div>
                    <p style={{ margin: "0 0 16px", color: "#64748b", fontSize: 13 }}>
                      How would you like to set up care for your patient?
                    </p>

                    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
                      {/* Card A: Create New Patient Circle */}
                      <div
                        onClick={() => { setSetupType("new_patient"); setRegStep(3); }}
                        style={{
                          border: setupType === "new_patient" ? "2px solid #5b57d9" : "1.5px solid #e2e8f0",
                          borderRadius: 14,
                          padding: 16,
                          background: setupType === "new_patient" ? "#fbfbfe" : "white",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 14,
                          transition: "all 0.2s ease",
                        }}
                      >
                        <div
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 12,
                            background: "rgba(91, 87, 217, 0.12)",
                            color: "#5b57d9",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <Heart size={22} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <strong style={{ fontSize: 15, color: "#0f172a" }}>Create New Patient Setup</strong>
                            <span
                              style={{
                                fontSize: 10,
                                background: "#eeedff",
                                color: "#5b57d9",
                                padding: "2px 8px",
                                borderRadius: 12,
                                fontWeight: 700,
                              }}
                            >
                              PRIMARY
                            </span>
                          </div>
                          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748b", lineHeight: 1.4 }}>
                            I am setting up care for a patient (parent, spouse, loved one). I will enter their health details and become the Primary Caregiver.
                          </p>
                        </div>
                      </div>

                      {/* Card B: Join Existing Circle */}
                      <div
                        onClick={() => { setSetupType("join_circle"); setRegStep(3); }}
                        style={{
                          border: setupType === "join_circle" ? "2px solid #5b57d9" : "1.5px solid #e2e8f0",
                          borderRadius: 14,
                          padding: 16,
                          background: setupType === "join_circle" ? "#fbfbfe" : "white",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 14,
                          transition: "all 0.2s ease",
                        }}
                      >
                        <div
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 12,
                            background: "rgba(16, 185, 129, 0.12)",
                            color: "#10b981",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <Users size={22} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <strong style={{ fontSize: 15, color: "#0f172a" }}>Join Existing Care Circle</strong>
                            <span
                              style={{
                                fontSize: 10,
                                background: "#ecfdf5",
                                color: "#059669",
                                padding: "2px 8px",
                                borderRadius: 12,
                                fontWeight: 700,
                              }}
                            >
                              INVITE LINK
                            </span>
                          </div>
                          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748b", lineHeight: 1.4 }}>
                            I received an invitation link or token from another family member or coordinator. I will enter my relationship to join.
                          </p>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setRegStep(1)}
                      style={{
                        padding: "10px 16px",
                        borderRadius: 9,
                        border: "1px solid #cbd5e1",
                        background: "white",
                        color: "#475569",
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <ArrowLeft size={14} /> Back
                    </button>
                  </div>
                )}

                {/* ── STEP 3A: NEW PATIENT DETAILS ─────────────────── */}
                {regStep === 3 && setupType === "new_patient" && (
                  <form onSubmit={handleFinishRegistration}>
                    <p style={{ margin: "0 0 16px", color: "#64748b", fontSize: 13 }}>
                      Enter patient details and your relationship. You will be registered as the <strong>Primary Caregiver</strong> and will receive a shareable invite link for family members.
                    </p>

                    {/* Caregiver's Relationship to Patient */}
                    <div style={{ marginBottom: 16 }}>
                      <label style={lbl}>Your Relationship to Patient *</label>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 7 }}>
                        {RELATIONSHIPS.map((rel) => {
                          const isSelected = relationship === rel;
                          return (
                            <button
                              key={rel}
                              type="button"
                              onClick={() => setRelationship(rel)}
                              style={{
                                padding: "8px 6px",
                                borderRadius: 8,
                                border: `1.5px solid ${isSelected ? "#5b57d9" : "#cbd5e1"}`,
                                background: isSelected ? "#eeedff" : "white",
                                color: isSelected ? "#5b57d9" : "#334155",
                                fontWeight: isSelected ? 700 : 500,
                                fontSize: 12,
                                cursor: "pointer",
                                textAlign: "center",
                              }}
                            >
                              {rel}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Patient Information */}
                    <div style={{ marginBottom: 14 }}>
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
                        <input
                          style={inp}
                          type="date"
                          required
                          value={dob}
                          onChange={(e) => setDob(e.target.value)}
                        />
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

                    <div style={{ marginBottom: 14 }}>
                      <label style={lbl}>Primary Medical Condition *</label>
                      <input
                        style={inp}
                        type="text"
                        required
                        value={condition}
                        onChange={(e) => setCondition(e.target.value)}
                        placeholder="e.g. Dementia, Parkinson's, Alzheimer's"
                      />
                    </div>

                    <div style={{ marginBottom: 14 }}>
                      <label style={lbl}>Blood Group (optional)</label>
                      <select style={inp} value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)}>
                        <option value="">Select blood group</option>
                        {["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"].map((bg) => (
                          <option key={bg} value={bg}>{bg}</option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                      <div>
                        <label style={lbl}>Known Allergies (optional)</label>
                        <input
                          style={inp}
                          type="text"
                          value={allergies}
                          onChange={(e) => setAllergies(e.target.value)}
                          placeholder="e.g. Penicillin, Pollen"
                        />
                      </div>
                      <div>
                        <label style={lbl}>Patient Phone (optional)</label>
                        <input
                          style={inp}
                          type="tel"
                          value={patientPhone}
                          onChange={(e) => setPatientPhone(e.target.value)}
                          placeholder="+91 98765 43210"
                        />
                      </div>
                    </div>

                    <div style={{ marginBottom: 14 }}>
                      <label style={lbl}>Daily Care & Medical Notes (optional)</label>
                      <textarea
                        style={{ ...inp, height: 60, resize: "none" }}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="e.g. Needs gentle meal reminders, afternoon rest, familiar evening music."
                      />
                    </div>

                    {/* Emergency Contact */}
                    <div style={{ background: "#f8fafc", padding: 12, borderRadius: 10, border: "1px solid #e2e8f0", marginBottom: 18 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#5b57d9", textTransform: "uppercase" }}>
                        Emergency Contact
                      </span>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 8 }}>
                        <input
                          style={{ ...inp, padding: "8px 10px", fontSize: 13 }}
                          type="text"
                          value={emergencyContact}
                          onChange={(e) => setEmergencyContact(e.target.value)}
                          placeholder="Contact Name"
                        />
                        <input
                          style={{ ...inp, padding: "8px 10px", fontSize: 13 }}
                          type="tel"
                          value={emergencyPhone}
                          onChange={(e) => setEmergencyPhone(e.target.value)}
                          placeholder="Contact Phone"
                        />
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 10 }}>
                      <button
                        type="button"
                        onClick={() => setRegStep(2)}
                        style={{
                          padding: "12px 16px",
                          borderRadius: 10,
                          border: "1px solid #cbd5e1",
                          background: "white",
                          color: "#475569",
                          fontWeight: 600,
                          fontSize: 13,
                          cursor: "pointer",
                        }}
                      >
                        Back
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        style={{
                          flex: 1,
                          padding: "13px",
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
                          boxShadow: "0 4px 12px rgba(91, 87, 217, 0.25)",
                        }}
                      >
                        {isSubmitting ? "Creating Care Circle…" : "Create Care Circle & Invite Link"}
                      </button>
                    </div>
                  </form>
                )}

                {/* ── STEP 3B: JOIN EXISTING CIRCLE DETAILS ─────────── */}
                {regStep === 3 && setupType === "join_circle" && (
                  <form onSubmit={handleFinishRegistration}>
                    <p style={{ margin: "0 0 16px", color: "#64748b", fontSize: 13 }}>
                      Paste your invitation link or code to connect with your patient's care circle.
                    </p>

                    <div style={{ marginBottom: 14 }}>
                      <label style={lbl}>Invitation Link or Code *</label>
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
                          onClick={() => verifyToken(inviteTokenInput)}
                          disabled={isVerifyingInvite || !inviteTokenInput.trim()}
                          style={{
                            padding: "10px 14px",
                            borderRadius: 10,
                            background: "#334155",
                            color: "white",
                            border: "none",
                            fontWeight: 600,
                            fontSize: 13,
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {isVerifyingInvite ? "Checking…" : "Verify Link"}
                        </button>
                      </div>
                    </div>

                    {/* Verified Invite Preview Card */}
                    {verifiedInvite && (
                      <div
                        style={{
                          background: "#f0fdf4",
                          border: "1px solid #bbf7d0",
                          borderRadius: 12,
                          padding: 14,
                          marginBottom: 16,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#166534", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                          <CheckCircle size={15} /> VALID INVITATION FOUND
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>
                          {verifiedInvite.patient?.full_name || "Patient Care Circle"}
                        </div>
                        <div style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>
                          Condition: <strong>{verifiedInvite.patient?.condition_type || "Care coordination"}</strong> · Invited by: <strong>{verifiedInvite.inviter?.full_name || "Primary Caregiver"}</strong>
                        </div>
                      </div>
                    )}

                    <div style={{ marginBottom: 16 }}>
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

                    <div style={{ marginBottom: 20 }}>
                      <label style={lbl}>Care Circle Role</label>
                      <select style={inp} value={joinRole} onChange={(e) => setJoinRole(e.target.value)}>
                        <option value="family">Family Caregiver</option>
                        <option value="external">External / Professional Caregiver</option>
                      </select>
                    </div>

                    <div style={{ display: "flex", gap: 10 }}>
                      <button
                        type="button"
                        onClick={() => setRegStep(2)}
                        style={{
                          padding: "12px 16px",
                          borderRadius: 10,
                          border: "1px solid #cbd5e1",
                          background: "white",
                          color: "#475569",
                          fontWeight: 600,
                          fontSize: 13,
                          cursor: "pointer",
                        }}
                      >
                        Back
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        style={{
                          flex: 1,
                          padding: "13px",
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
                          boxShadow: "0 4px 12px rgba(16, 185, 129, 0.25)",
                        }}
                      >
                        {isSubmitting ? "Joining Care Circle…" : "Accept & Join Care Circle"}
                      </button>
                    </div>
                  </form>
                )}

                {/* ── STEP 4: SUCCESS & SHARE INVITE LINK SCREEN ────── */}
                {regStep === 4 && (
                  <div style={{ textAlign: "center", padding: "8px 0" }}>
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: "50%",
                        background: "rgba(16, 185, 129, 0.12)",
                        color: "#10b981",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        margin: "0 auto 12px",
                      }}
                    >
                      <CheckCircle size={32} />
                    </div>

                    <h2 style={{ margin: "0 0 6px", fontSize: 20, color: "#0f172a" }}>
                      Care Circle Created!
                    </h2>
                    <p style={{ margin: "0 0 16px", fontSize: 13, color: "#64748b" }}>
                      Care circle for <strong>{createdCircleResult?.patient?.full_name || patientName}</strong> is active. You are registered as the <strong>Primary Caregiver</strong> ({relationship}).
                    </p>

                    {/* Shareable Invite Box */}
                    {createdCircleResult?.invite?.shareableUrl && (
                      <div
                        style={{
                          background: "#f8fafc",
                          border: "1px solid #e2e8f0",
                          borderRadius: 14,
                          padding: 16,
                          textAlign: "left",
                          marginBottom: 20,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "#5b57d9", letterSpacing: "0.5px" }}>
                            SHAREABLE CAREGIVER INVITE LINK
                          </span>
                          <span style={{ fontSize: 11, color: "#94a3b8" }}>Valid for 7 days</span>
                        </div>

                        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                          <input
                            readOnly
                            style={{ ...inp, fontSize: 12, padding: "8px 12px", background: "white" }}
                            value={createdCircleResult.invite.shareableUrl}
                          />
                          <button
                            type="button"
                            onClick={handleCopyInviteLink}
                            style={{
                              padding: "8px 14px",
                              borderRadius: 8,
                              background: copiedInvite ? "#10b981" : "#5b57d9",
                              color: "white",
                              border: "none",
                              fontWeight: 600,
                              fontSize: 12,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              whiteSpace: "nowrap",
                              transition: "background 0.2s",
                            }}
                          >
                            {copiedInvite ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy</>}
                          </button>
                        </div>

                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            type="button"
                            onClick={handleWhatsAppShare}
                            style={{
                              flex: 1,
                              padding: "8px 12px",
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
                          <a
                            href={`mailto:?subject=${encodeURIComponent(`Care Circle Invitation for ${patientName}`)}&body=${encodeURIComponent(`Hello, please join ${patientName}'s care circle on CONTINUUM to coordinate daily care:\n${createdCircleResult.invite.shareableUrl}`)}`}
                            style={{
                              flex: 1,
                              padding: "8px 12px",
                              borderRadius: 8,
                              background: "white",
                              color: "#475569",
                              border: "1px solid #cbd5e1",
                              fontWeight: 600,
                              fontSize: 12,
                              textDecoration: "none",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 6,
                            }}
                          >
                            Send Email
                          </a>
                        </div>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        reloadPatients();
                        navigate("/");
                      }}
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
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        boxShadow: "0 4px 14px rgba(91, 87, 217, 0.3)",
                      }}
                    >
                      Enter Main Dashboard <ArrowRight size={18} />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
