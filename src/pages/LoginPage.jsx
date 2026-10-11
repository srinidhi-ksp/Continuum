import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const inp = {
  width: "100%",
  padding: "10px 13px",
  borderRadius: 9,
  border: "1px solid #cbd5e1",
  fontSize: 14,
  boxSizing: "border-box",
  outline: "none",
};

const lbl = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "#475569",
  marginBottom: 5,
};

export default function LoginPage() {
  const { login, register, isLoading } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState("login");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [language, setLanguage] = useState("English");
  const [email, setEmail] = useState("srinidhi@continuum.app");
  const [password, setPassword] = useState("Continuum@123");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      if (tab === "login") {
        if (!email || !password) { setError("Email and password are required."); return; }
        await login(email, password);
        navigate("/");
      } else {
        if (!fullName.trim()) { setError("Full name is required."); return; }
        if (!email || !password) { setError("Email and password are required."); return; }
        if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
        await register(email, password, fullName, phone, language);
        navigate("/");   // AuthContext sets needsOnboarding → wizard shows automatically
      }
    } catch (err) {
      console.error("[LoginPage] Auth error:", err);
      // Map common Supabase error messages to user-friendly text
      const msg = err.message || "";
      if (msg.includes("Invalid login credentials")) {
        setError("Incorrect email or password. Please try again.");
      } else if (msg.includes("already registered") || msg.includes("User already registered")) {
        setError("An account with this email already exists. Please log in instead.");
      } else if (msg.includes("Email not confirmed")) {
        setError("Please check your email and confirm your account before logging in.");
      } else {
        setError(msg || "Authentication failed. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #f0f0ff 0%, #f7f8fc 60%, #eef6ff 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
      fontFamily: "Inter, Arial, sans-serif",
    }}>
      <div style={{
        width: "100%",
        maxWidth: 440,
        background: "white",
        borderRadius: 20,
        boxShadow: "0 20px 50px rgba(91, 87, 217, 0.12)",
        overflow: "hidden",
      }}>
        {/* Brand Header */}
        <div style={{
          background: "linear-gradient(135deg, #5b57d9 0%, #3c38b0 100%)",
          color: "white",
          padding: "28px 32px 24px",
          textAlign: "center",
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: "rgba(255,255,255,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 10px", fontSize: 20, fontWeight: 800,
          }}>
            C
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: "0.5px" }}>CONTINUUM</h1>
          <p style={{ margin: "5px 0 0", fontSize: 13, opacity: 0.85 }}>Woven Caregiver Intelligence</p>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid #e2e8f0" }}>
          {["login", "register"].map(t => (
            <button key={t} type="button" onClick={() => { setTab(t); setError(""); }}
              style={{
                flex: 1, padding: "12px", border: "none", background: "white",
                fontSize: 14, fontWeight: 600, cursor: "pointer",
                color: tab === t ? "#5b57d9" : "#64748b",
                borderBottom: `2px solid ${tab === t ? "#5b57d9" : "transparent"}`,
              }}
            >
              {t === "login" ? "Log In" : "Register"}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: "24px 28px 28px" }}>
          {error && (
            <div style={{
              background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b",
              borderRadius: 8, padding: "9px 12px", fontSize: 13, marginBottom: 16,
            }}>
              {error}
            </div>
          )}

          {tab === "register" && (
            <>
              <div style={{ marginBottom: 13 }}>
                <label style={lbl}>Full Name *</label>
                <input style={inp} type="text" value={fullName}
                  onChange={e => setFullName(e.target.value)} placeholder="Srinidhi Ravi" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 13 }}>
                <div>
                  <label style={lbl}>Phone <span style={{ color: "#94a3b8", fontWeight: 400 }}>(optional)</span></label>
                  <input style={inp} type="tel" value={phone}
                    onChange={e => setPhone(e.target.value)} placeholder="+91 98765 43210" />
                </div>
                <div>
                  <label style={lbl}>Language</label>
                  <select style={inp} value={language} onChange={e => setLanguage(e.target.value)}>
                    {["English", "Tamil", "Hindi", "Kannada", "Telugu", "Malayalam"].map(l => (
                      <option key={l}>{l}</option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}

          <div style={{ marginBottom: 13 }}>
            <label style={lbl}>Email Address *</label>
            <input style={inp} type="email" value={email}
              onChange={e => setEmail(e.target.value)} placeholder="caregiver@example.com" />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={lbl}>Password *</label>
            <input style={inp} type="password" value={password}
              onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
            {tab === "register" && (
              <p style={{ margin: "5px 0 0", fontSize: 11, color: "#94a3b8" }}>Minimum 6 characters</p>
            )}
          </div>

          <button type="submit" disabled={isSubmitting || isLoading} style={{
            width: "100%", padding: "12px", borderRadius: 9,
            background: (isSubmitting || isLoading) ? "#a5b4fc" : "#5b57d9",
            color: "white", border: "none", fontWeight: 700, fontSize: 14,
            cursor: (isSubmitting || isLoading) ? "not-allowed" : "pointer",
          }}>
            {isSubmitting ? "Processing…" : tab === "login" ? "Log In" : "Create Account & Set Up Care"}
          </button>
        </form>
      </div>
    </div>
  );
}
