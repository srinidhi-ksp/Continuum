import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabaseClient";
import {
  User,
  Globe,
  Bell,
  Mic,
  Shield,
  Save,
  CheckCircle,
  LogOut,
  Database,
} from "lucide-react";

export default function SettingsPage() {
  const { caregiverProfile, logout, reloadProfile } = useAuth();

  const [fullName, setFullName] = useState(caregiverProfile?.full_name || "");
  const [phone, setPhone] = useState(caregiverProfile?.phone || "");
  const [language, setLanguage] = useState(caregiverProfile?.language || "English");

  // Notification Preferences
  const [notifyMedication, setNotifyMedication] = useState(true);
  const [notifyCoordination, setNotifyCoordination] = useState(true);

  // Accessibility & Voice Preferences
  const [voiceInputEnabled, setVoiceInputEnabled] = useState(true);
  const [voiceSynthesisEnabled, setVoiceSynthesisEnabled] = useState(false);

  const [savedMsg, setSavedMsg] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      // Save caregiver preferences to localStorage
      const prefs = {
        fullName,
        phone,
        language,
        notifyMedication,
        notifyCoordination,
        voiceInputEnabled,
        voiceSynthesisEnabled,
      };
      localStorage.setItem("continuum_user_settings", JSON.stringify(prefs));

      if (!caregiverProfile?.caregiver_id) throw new Error("Caregiver profile is not loaded yet.");
      const { error } = await supabase.from("caregiver").update({
        full_name: fullName.trim(), phone: phone || null, language: language || "en",
        updated_at: new Date().toISOString(),
      }).eq("caregiver_id", caregiverProfile.caregiver_id);
      if (error) throw error;
      
      await reloadProfile();
      setSavedMsg("Settings and caregiver profile updated successfully!");
      setTimeout(() => setSavedMsg(""), 3500);
    } catch (err) {
      console.error("[Settings] Save error:", err);
    } finally {
      setIsSaving(false);
    }
  };



  const inputStyle = {
    width: "100%",
    border: "1px solid #dfe2e9",
    borderRadius: 9,
    padding: "10px 14px",
    fontSize: 13,
    outline: "none",
    background: "white",
    fontFamily: "inherit",
    boxSizing: "border-box",
  };

  const labelStyle = {
    fontSize: 12,
    fontWeight: 600,
    color: "#555b6d",
    display: "block",
    marginBottom: 6,
  };

  const sectionCardStyle = {
    background: "white",
    borderRadius: 16,
    padding: "24px",
    border: "1px solid #e5e9f2",
    boxShadow: "0 2px 10px rgba(0,0,0,0.03)",
    marginBottom: 20,
  };

  return (
    <div style={{ maxWidth: 880, margin: "0 auto", padding: "24px 20px 80px", fontFamily: "Inter, sans-serif" }}>
      {/* HEADER */}
      <div style={{ marginBottom: 24 }}>
        <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "var(--accent)" }}>
          Caregiver Settings & Preferences
        </p>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: "var(--text-primary)" }}>
          Settings & Profile
        </h1>
        <p style={{ margin: "6px 0 0", fontSize: 14, color: "var(--text-secondary)" }}>
          Manage your account profile, Indian language preferences, voice controls, and alert thresholds.
        </p>
      </div>

      {savedMsg && (
        <div style={{
          background: "var(--accent-subtle)", border: "1px solid var(--accent-light)", color: "var(--accent-dark)",
          borderRadius: 10, padding: "12px 16px", marginBottom: 20, fontSize: 13, fontWeight: 600,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <CheckCircle size={16} /> {savedMsg}
        </div>
      )}

      <form onSubmit={handleSave}>
        {/* 1. CAREGIVER PROFILE */}
        <div style={sectionCardStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, borderBottom: "1px solid #f1f4f9", paddingBottom: 14 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--accent-subtle)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <User size={18} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#172033" }}>Caregiver Profile</h2>
              <p style={{ margin: 0, fontSize: 12, color: "#8a90a0" }}>Your identity within the patient's care circle</p>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label style={labelStyle}>Full Name</label>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} style={inputStyle} required />
            </div>

            <div>
              <label style={labelStyle}>Email Address (Read-only)</label>
              <input value={caregiverProfile?.email || ""} disabled style={{ ...inputStyle, background: "#f8fafc", color: "#64748b" }} />
            </div>

            <div>
              <label style={labelStyle}>Phone Number</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} />
            </div>

            <div>
              <label style={labelStyle}>Caregiver Role</label>
              <div style={{ ...inputStyle, background: "#f8fafc", color: "#1e293b", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                <Shield size={14} color="var(--accent)" /> Main Caregiver (Primary)
              </div>
            </div>
          </div>
        </div>

        {/* 2. MULTILINGUAL SUPPORT & TRANSLATION */}
        <div style={sectionCardStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, borderBottom: "1px solid #f1f4f9", paddingBottom: 14 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "#ecfdf5", color: "#10b981", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Globe size={18} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#172033" }}>Multilingual & Language Support (Module 6)</h2>
              <p style={{ margin: 0, fontSize: 12, color: "#8a90a0" }}>Powered by IndicTrans2 for safe Indian-language guidance</p>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Primary Interface & Assistant Language</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              {[
                { id: "English", label: "English", sub: "Default interface" },
                { id: "Tamil", label: "தமிழ் (Tamil)", sub: "இந்திய மொழி ஆதரவு" },
                { id: "Hindi", label: "हिन्दी (Hindi)", sub: "भारतीय भाषा समर्थन" },
              ].map((lang) => (
                <div
                  key={lang.id}
                  onClick={() => setLanguage(lang.id)}
                  style={{
                    border: language === lang.id ? "2px solid var(--accent)" : "1.5px solid #e2e8f0",
                    background: language === lang.id ? "var(--accent-subtle)" : "white",
                    borderRadius: 12,
                    padding: "14px 16px",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 700, color: language === lang.id ? "var(--accent-dark)" : "#1e293b" }}>
                    {lang.label}
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>{lang.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 3. VOICE INPUT & ACCESSIBILITY */}
        <div style={sectionCardStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, borderBottom: "1px solid #f1f4f9", paddingBottom: 14 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "#eff6ff", color: "#3b82f6", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Mic size={18} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#172033" }}>Voice Dictation & Speech Input</h2>
              <p style={{ margin: 0, fontSize: 12, color: "#8a90a0" }}>Speech-to-text for hands-free care notes and questions</p>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={voiceInputEnabled}
                onChange={(e) => setVoiceInputEnabled(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: "var(--accent)" }}
              />
              <div>
                <span style={{ fontSize: 14, fontWeight: 600, color: "#1e293b" }}>Enable Microphone Dictation</span>
                <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>
                  Allows voice recording in Daily Care logs and the AI Assistant in English, Tamil, and Hindi.
                </p>
              </div>
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={voiceSynthesisEnabled}
                onChange={(e) => setVoiceSynthesisEnabled(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: "var(--accent)" }}
              />
              <div>
                <span style={{ fontSize: 14, fontWeight: 600, color: "#1e293b" }}>Enable Speech Playback (Listen to guidance)</span>
                <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>
                  Reads aloud responses from the caregiving assistant using browser text-to-speech.
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* 4. NOTIFICATION & COORDINATION PREFERENCES */}
        <div style={sectionCardStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, borderBottom: "1px solid #f1f4f9", paddingBottom: 14 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "#fef3c7", color: "#d97706", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Bell size={18} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#172033" }}>Notification Preferences</h2>
              <p style={{ margin: 0, fontSize: 12, color: "#8a90a0" }}>Control priority banners and care circle alerts</p>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={notifyMedication}
                onChange={(e) => setNotifyMedication(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: "var(--accent)" }}
              />
              <div>
                <span style={{ fontSize: 14, fontWeight: 600, color: "#1e293b" }}>Missed Medication Reminders</span>
                <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>Alert caregivers when a scheduled dose is overdue by &gt; 30 minutes.</p>
              </div>
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={notifyCoordination}
                onChange={(e) => setNotifyCoordination(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: "var(--accent)" }}
              />
              <div>
                <span style={{ fontSize: 14, fontWeight: 600, color: "#1e293b" }}>Workload Imbalance Alert (Module 8)</span>
                <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>
                  Notify the care circle when Care Coordination Score drops below 50 (elevated workload).
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* 5. DATABASE & SYSTEM STATUS */}
        <div style={sectionCardStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, borderBottom: "1px solid #f1f4f9", paddingBottom: 14 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "#f1f5f9", color: "#475569", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Database size={18} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#172033" }}>Database & System Environment</h2>
              <p style={{ margin: 0, fontSize: 12, color: "#8a90a0" }}>Active data adapter and testing utilities</p>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8fafc", padding: "14px 18px", borderRadius: 12, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>
                {"Supabase Cloud"}
              </div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                {"Application data is loaded from the configured Supabase project."}
              </div>
            </div>
            <span style={{
              background: "#dcfce7",
              color: "#15803d",
              fontSize: 11, fontWeight: 700, borderRadius: 20, padding: "3px 10px",
            }}>
              {"Cloud Active"}
            </span>
          </div>


        </div>

        {/* SUBMIT BUTTONS */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button
            type="button"
            onClick={() => logout()}
            style={{
              background: "#fee2e2", color: "#dc2626", border: "none", borderRadius: 10,
              padding: "12px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 8,
            }}
          >
            <LogOut size={16} /> Sign Out
          </button>

          <button
            type="submit"
            disabled={isSaving}
            style={{
              background: "var(--accent)", color: "white", border: "none", borderRadius: 10,
              padding: "12px 28px", fontSize: 14, fontWeight: 700, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 8, boxShadow: "0 4px 14px rgba(91,87,217,0.3)",
            }}
          >
            <Save size={16} /> {isSaving ? "Saving..." : "Save Preferences"}
          </button>
        </div>
      </form>
    </div>
  );
}
