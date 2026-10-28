import { useState, useEffect, useCallback } from "react";
import { usePatient } from "../context/PatientContext";
import { useAuth } from "../context/AuthContext";
import { threadColorFor, initialFor } from "../lib/caregiverColors";
import {
  fetchCareCircleMembers,
  updateCareCircleMember,
  removeCareCircleMember,
  routeAlert,
  CARE_RESPONSIBILITIES,
} from "../lib/careCircleApi";
import { createInvitation } from "../lib/invitationApi";
import {
  UserPlus,
  Bell,
  Copy,
  Edit2,
  Trash2,
  X,
  AlertTriangle,
  Check,
} from "lucide-react";

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

const ROLES = ["primary", "family", "external"];

export default function CareCircle() {
  const { currentPatient, reloadPatientDetail } = usePatient();
  const { caregiverProfile } = useAuth();

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingMember, setEditingMember] = useState(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteRelation, setInviteRelation] = useState("Family Member");
  const [inviteRole, setInviteRole] = useState("family");
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePhone, setInvitePhone] = useState("");
  const [generatedInvite, setGeneratedInvite] = useState(null);
  const [copied, setCopied] = useState(false);

  // Alert Routing Test State
  const [routedAlertResult, setRoutedAlertResult] = useState(null);

  const loadMembers = useCallback(async () => {
    if (!currentPatient?.id) return;
    setLoading(true);
    try {
      const list = await fetchCareCircleMembers(currentPatient.id);
      setMembers(list);
    } catch (err) {
      console.error("[CareCircle] Failed to load members:", err);
    } finally {
      setLoading(false);
    }
  }, [currentPatient]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadMembers();
  }, [loadMembers]);

  const handleCreateInvite = async (e) => {
    e.preventDefault();
    if (!currentPatient?.id || !caregiverProfile?.caregiver_id) return;

    try {
      const res = await createInvitation({
        patientId: currentPatient.id,
        invitedBy: caregiverProfile.caregiver_id,
        email: inviteEmail || null,
        phone: invitePhone || null,
        relationship: inviteRelation,
        role: inviteRole,
      });
      setGeneratedInvite(res);
    } catch (err) {
      console.error("[CareCircle] Failed to generate invite:", err);
    }
  };

  const handleSaveMemberEdit = async (e) => {
    e.preventDefault();
    if (!editingMember || !currentPatient?.id) return;

    try {
      await updateCareCircleMember(currentPatient.id, editingMember.id, {
        role: editingMember.role,
        relationship: editingMember.relationship,
        alertPreference: editingMember.alertPreference,
        alertPriority: Number(editingMember.alertPriority),
        assignedResponsibilities: editingMember.assignedResponsibilities,
      });

      setEditingMember(null);
      await loadMembers();
      if (reloadPatientDetail) reloadPatientDetail();
    } catch (err) {
      console.error("[CareCircle] Failed to update member:", err);
    }
  };

  const handleRemoveMember = async (caregiverId) => {
    if (!window.confirm("Are you sure you want to remove this caregiver from the Care Circle?")) {
      return;
    }
    try {
      await removeCareCircleMember(currentPatient.id, caregiverId);
      await loadMembers();
      if (reloadPatientDetail) reloadPatientDetail();
    } catch (err) {
      console.error("[CareCircle] Failed to remove member:", err);
    }
  };

  const handleTestAlertRouting = async () => {
    if (!currentPatient?.id) return;
    const res = await routeAlert(currentPatient.id, {
      title: "Elevated Risk Detected",
      severity: "high",
      message: "Coordination metrics indicate high workload & missed afternoon doses.",
    });
    setRoutedAlertResult(res);
  };

  const toggleResponsibility = (resp) => {
    if (!editingMember) return;
    const current = editingMember.assignedResponsibilities || [];
    const exists = current.includes(resp);
    const updated = exists ? current.filter((r) => r !== resp) : [...current, resp];
    setEditingMember({ ...editingMember, assignedResponsibilities: updated });
  };

  return (
    <div className="wt-dashboard" style={{ padding: 32, background: "#f7f8fc", minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <div>
          <p className="wt-eyebrow">Care circle</p>
          <h1 className="wt-greeting__title" style={{ margin: 0, fontSize: 28, fontWeight: 700, color: "#172033" }}>
            Woven around {currentPatient ? currentPatient.name : "your patient"}
          </h1>
          <p className="wt-greeting__sub" style={{ margin: "6px 0 0", color: "#72798a", fontSize: 14 }}>
            Everyone currently coordinating this patient's daily care, tasks, and alerts.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={handleTestAlertRouting}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              background: "#fff0f0",
              color: "#d45c5c",
              border: "1px solid #fecaca",
              borderRadius: 10,
              padding: "10px 16px",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <AlertTriangle size={16} /> Alert Priority Routing
          </button>
          <button
            onClick={() => {
              setGeneratedInvite(null);
              setInviteEmail("");
              setInvitePhone("");
              setShowInviteModal(true);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              background: "#5b57d9",
              color: "white",
              border: "none",
              borderRadius: 10,
              padding: "10px 18px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <UserPlus size={17} /> Invite Caregiver
          </button>
        </div>
      </div>

      {/* Alert Routing Results Banner */}
      {routedAlertResult && (
        <div
          style={{
            background: "#fff5f5",
            border: "1px solid #f87171",
            borderRadius: 14,
            padding: 20,
            marginBottom: 24,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#991b1b", fontWeight: 700, fontSize: 15 }}>
              <AlertTriangle size={18} /> Priority Alert Routing Simulation
            </div>
            <button
              onClick={() => setRoutedAlertResult(null)}
              style={{ border: "none", background: "transparent", color: "#991b1b", cursor: "pointer", fontSize: 16 }}
            >
              ×
            </button>
          </div>
          <p style={{ margin: "0 0 12px", fontSize: 13, color: "#7f1d1d" }}>
            <strong>Alert Trigger:</strong> {routedAlertResult.alert.title} — {routedAlertResult.alert.message}
          </p>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#991b1b", marginBottom: 6 }}>ROUTING QUEUE (BY PRIORITY ORDER):</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {routedAlertResult.routedTo.map((item, idx) => (
              <div
                key={item.caregiverId}
                style={{
                  background: "white",
                  border: "1px solid #fca5a5",
                  borderRadius: 8,
                  padding: "6px 12px",
                  fontSize: 12,
                  color: "#991b1b",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span style={{ fontWeight: 800, background: "#fee2e2", borderRadius: 4, padding: "2px 6px" }}>
                  #{idx + 1} (Priority {item.priority})
                </span>
                <strong>{item.name}</strong>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Members Grid / List */}
      <section className="wt-panel" style={{ background: "white", borderRadius: 16, border: "1px solid #e4e6ed", padding: 24 }}>
        {loading ? (
          <p className="wt-empty">Loading care circle members…</p>
        ) : members.length === 0 ? (
          <p className="wt-empty">No caregivers linked to this patient yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {members.map((m) => {
              const color = threadColorFor(m.id);
              return (
                <div
                  key={m.id}
                  style={{
                    background: "white",
                    border: "1px solid #e4e6ed",
                    borderLeft: `5px solid ${color.line}`,
                    borderRadius: 14,
                    padding: 20,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                      <div
                        className="wt-activity-item__marker"
                        style={{
                          background: color.bg,
                          color: color.text,
                          width: 48,
                          height: 48,
                          fontSize: 18,
                          fontWeight: 700,
                          borderRadius: "50%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {initialFor(m.name)}
                      </div>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#172033" }}>{m.name}</h3>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: m.role === "primary" ? "#5b57d9" : "#64748b",
                              background: m.role === "primary" ? "#eeedff" : "#f1f5f9",
                              borderRadius: 20,
                              padding: "2px 10px",
                              textTransform: "uppercase",
                              letterSpacing: "0.5px",
                            }}
                          >
                            {m.role}
                          </span>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              color: "#16a34a",
                              background: "#dcfce7",
                              borderRadius: 20,
                              padding: "2px 8px",
                            }}
                          >
                            {m.relationship}
                          </span>
                        </div>
                        {m.email && <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>{m.email}</div>}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => setEditingMember({ ...m })}
                        style={{
                          background: "#f1f5f9",
                          border: "none",
                          borderRadius: 8,
                          padding: "8px 12px",
                          fontSize: 12,
                          fontWeight: 600,
                          color: "#475569",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <Edit2 size={13} /> Edit Role & Tasks
                      </button>
                      {m.role !== "primary" && (
                        <button
                          onClick={() => handleRemoveMember(m.id)}
                          style={{
                            background: "#fef2f2",
                            border: "none",
                            borderRadius: 8,
                            padding: "8px 12px",
                            fontSize: 12,
                            fontWeight: 600,
                            color: "#ef4444",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <Trash2 size={13} /> Remove
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Attributes row: Alert priority & Assigned responsibilities */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "220px 1fr",
                      gap: 14,
                      marginTop: 16,
                      background: "#f8fafc",
                      borderRadius: 10,
                      padding: "12px 16px",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", letterSpacing: "0.5px", marginBottom: 4 }}>
                        ALERT ROUTING PRIORITY
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", display: "flex", alignItems: "center", gap: 6 }}>
                        <Bell size={14} color="#5b57d9" /> Priority Order #{m.alertPriority} ({m.alertPreference})
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", letterSpacing: "0.5px", marginBottom: 4 }}>
                        ASSIGNED CARE RESPONSIBILITIES
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {m.assignedResponsibilities.length === 0 ? (
                          <span style={{ fontSize: 12, color: "#94a3b8" }}>No specific responsibilities assigned yet</span>
                        ) : (
                          m.assignedResponsibilities.map((resp) => (
                            <span
                              key={resp}
                              style={{
                                fontSize: 11,
                                fontWeight: 600,
                                background: "white",
                                border: "1px solid #cbd5e1",
                                color: "#334155",
                                borderRadius: 6,
                                padding: "2px 8px",
                              }}
                            >
                              {resp}
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* EDIT MEMBER MODAL */}
      {editingMember && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            zIndex: 1000,
          }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setEditingMember(null);
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 540,
              maxHeight: "90vh",
              overflowY: "auto",
              background: "white",
              borderRadius: 18,
              padding: 28,
              boxShadow: "0 20px 50px rgba(0,0,0,0.15)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 20, color: "#0f172a" }}>Edit Care Circle Member</h2>
              <button
                onClick={() => setEditingMember(null)}
                style={{
                  width: 32,
                  height: 32,
                  border: "none",
                  borderRadius: "50%",
                  background: "#f1f5f9",
                  cursor: "pointer",
                }}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveMemberEdit}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 6 }}>
                  Member Name
                </label>
                <input
                  type="text"
                  disabled
                  value={editingMember.name}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#f8fafc", fontSize: 14 }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 6 }}>
                    Relationship to Patient
                  </label>
                  <select
                    value={editingMember.relationship}
                    onChange={(e) => setEditingMember({ ...editingMember, relationship: e.target.value })}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 14, background: "white" }}
                  >
                    {RELATIONSHIPS.map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 6 }}>
                    Role
                  </label>
                  <select
                    value={editingMember.role}
                    onChange={(e) => setEditingMember({ ...editingMember, role: e.target.value })}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 14, background: "white" }}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r.charAt(0).toUpperCase() + r.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 6 }}>
                    Alert Routing Priority Order
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={editingMember.alertPriority}
                    onChange={(e) => setEditingMember({ ...editingMember, alertPriority: e.target.value })}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 14 }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 6 }}>
                    Alert Preference
                  </label>
                  <select
                    value={editingMember.alertPreference}
                    onChange={(e) => setEditingMember({ ...editingMember, alertPreference: e.target.value })}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 14, background: "white" }}
                  >
                    <option value="all">All Alerts</option>
                    <option value="high_priority">High Priority Only</option>
                    <option value="none">Disabled</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 8 }}>
                  Assigned Responsibilities
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {CARE_RESPONSIBILITIES.map((resp) => {
                    const isAssigned = (editingMember.assignedResponsibilities || []).includes(resp);
                    return (
                      <button
                        key={resp}
                        type="button"
                        onClick={() => toggleResponsibility(resp)}
                        style={{
                          padding: "8px 12px",
                          borderRadius: 8,
                          border: `1px solid ${isAssigned ? "#5b57d9" : "#cbd5e1"}`,
                          background: isAssigned ? "#eeedff" : "white",
                          color: isAssigned ? "#5b57d9" : "#475569",
                          fontSize: 13,
                          fontWeight: isAssigned ? 600 : 400,
                          cursor: "pointer",
                          textAlign: "left",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        {resp} {isAssigned && <Check size={14} />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
                  style={{ padding: "10px 18px", borderRadius: 8, border: "1px solid #cbd5e1", background: "white", color: "#475569", fontWeight: 600, cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: "10px 18px", borderRadius: 8, background: "#5b57d9", color: "white", border: "none", fontWeight: 600, cursor: "pointer" }}
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* GENERATE INVITE MODAL */}
      {showInviteModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            zIndex: 1000,
          }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowInviteModal(false);
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 500,
              background: "white",
              borderRadius: 18,
              padding: 28,
              boxShadow: "0 20px 50px rgba(0,0,0,0.15)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <h2 style={{ margin: 0, fontSize: 20, color: "#0f172a" }}>Invite Caregiver</h2>
              <button
                onClick={() => setShowInviteModal(false)}
                style={{ width: 32, height: 32, border: "none", borderRadius: "50%", background: "#f1f5f9", cursor: "pointer" }}
              >
                <X size={16} />
              </button>
            </div>

            {generatedInvite ? (
              <div style={{ textAlign: "center", padding: "10px 0" }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>🎉</div>
                <h3 style={{ margin: "0 0 6px", color: "#0f172a" }}>Secure Invite Generated</h3>
                <p style={{ color: "#64748b", fontSize: 13, marginBottom: 20 }}>
                  Share this secure link with the caregiver to join <strong>{currentPatient?.name}</strong>'s Care Circle without exposing raw patient data.
                </p>
                <div
                  style={{
                    background: "#f8fafc",
                    border: "1px solid #cbd5e1",
                    borderRadius: 10,
                    padding: "10px 14px",
                    fontSize: 12,
                    color: "#334155",
                    wordBreak: "break-all",
                    marginBottom: 16,
                  }}
                >
                  {generatedInvite.shareableUrl}
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(generatedInvite.shareableUrl);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: 10,
                    background: "#5b57d9",
                    color: "white",
                    border: "none",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  {copied ? <><Check size={16} /> Copied to Clipboard!</> : <><Copy size={16} /> Copy Invite Link</>}
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateInvite}>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 6 }}>
                    Relationship to Patient
                  </label>
                  <select
                    value={inviteRelation}
                    onChange={(e) => setInviteRelation(e.target.value)}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 14, background: "white" }}
                  >
                    {RELATIONSHIPS.map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 6 }}>
                    Invite Role
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 14, background: "white" }}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r.charAt(0).toUpperCase() + r.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 6 }}>
                    Invite by Email (Optional)
                  </label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="caregiver@example.com"
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 14 }}
                  />
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 6 }}>
                    Or Phone (Optional)
                  </label>
                  <input
                    type="tel"
                    value={invitePhone}
                    onChange={(e) => setInvitePhone(e.target.value)}
                    placeholder="+91 90000 11122"
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 14 }}
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setShowInviteModal(false)}
                    style={{ padding: "10px 18px", borderRadius: 8, border: "1px solid #cbd5e1", background: "white", color: "#475569", fontWeight: 600, cursor: "pointer" }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{ padding: "10px 18px", borderRadius: 8, background: "#5b57d9", color: "white", border: "none", fontWeight: 600, cursor: "pointer" }}
                  >
                    Generate Secure Invite Link
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
