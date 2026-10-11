import { useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function AuthModal({ isOpen, onClose }) {
  const { login, register } = useAuth();
  const [tab, setTab] = useState("login"); // 'login' | 'register'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      if (tab === "login") {
        if (!email || !password) {
          setError("Please enter your email and password.");
          setIsSubmitting(false);
          return;
        }
        await login(email, password);
        if (onClose) onClose();
      } else {
        if (!email || !password || !fullName) {
          setError("Full Name, Email, and Password are required for registration.");
          setIsSubmitting(false);
          return;
        }
        await register(email, password, fullName, phone);
        if (onClose) onClose();
      }
    } catch (err) {
      console.error("[AuthModal] Error:", err);
      setError(err.message || "Authentication failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTabSwitch = (newTab) => {
    setTab(newTab);
    setError("");
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.6)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        zIndex: 2000,
        fontFamily: "Inter, Arial, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 440,
          background: "white",
          borderRadius: 20,
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            background: "linear-gradient(135deg, #5b57d9 0%, #3c38b0 100%)",
            color: "white",
            padding: "24px 28px",
            textAlign: "center",
          }}
        >
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px", fontSize: 20, fontWeight: "bold" }}>
            C
          </div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>CONTINUUM</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, opacity: 0.9 }}>
            Woven Caregiver Intelligence
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid #e2e8f0" }}>
          <button
            type="button"
            onClick={() => handleTabSwitch("login")}
            style={{
              flex: 1,
              padding: "12px",
              border: "none",
              background: "white",
              fontSize: 14,
              fontWeight: 600,
              color: tab === "login" ? "#5b57d9" : "#64748b",
              borderBottom: `2px solid ${tab === "login" ? "#5b57d9" : "transparent"}`,
              cursor: "pointer",
            }}
          >
            Log In
          </button>
          <button
            type="button"
            onClick={() => handleTabSwitch("register")}
            style={{
              flex: 1,
              padding: "12px",
              border: "none",
              background: "white",
              fontSize: 14,
              fontWeight: 600,
              color: tab === "register" ? "#5b57d9" : "#64748b",
              borderBottom: `2px solid ${tab === "register" ? "#5b57d9" : "transparent"}`,
              cursor: "pointer",
            }}
          >
            Register
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: 28 }}>
          {error && (
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#991b1b",
                borderRadius: 9,
                padding: "10px 12px",
                fontSize: 13,
                marginBottom: 16,
              }}
            >
              {error}
            </div>
          )}

          {tab === "register" && (
            <>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 5 }}>
                  Full Name *
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Srinidhi Ravi"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 9,
                    border: "1px solid #cbd5e1",
                    fontSize: 14,
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 5 }}>
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 9,
                    border: "1px solid #cbd5e1",
                    fontSize: 14,
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </>
          )}

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 5 }}>
              Email Address *
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="caregiver@continuum.app"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 9,
                border: "1px solid #cbd5e1",
                fontSize: 14,
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 5 }}>
              Password *
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 9,
                border: "1px solid #cbd5e1",
                fontSize: 14,
                boxSizing: "border-box",
              }}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: 10,
              background: "#5b57d9",
              color: "white",
              border: "none",
              fontWeight: 600,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            {isSubmitting ? "Processing..." : tab === "login" ? "Log In" : "Register & Set Up Care"}
          </button>
        </form>
      </div>
    </div>
  );
}
