import { useState } from "react";
import { usePatient } from "../context/PatientContext";
import {
  createMedication,
  updateMedication,
  toggleMedicationActive,
  logMedicationDose,
} from "../lib/medicationApi";
import {
  createAppointment,
  deleteAppointment,
} from "../lib/appointmentApi";
import {
  PlusCircle,
  Pill,
  CheckCircle,
  XCircle,
  Edit2,
  X,
  Check,
  AlertCircle,
  Calendar,
  MapPin,
  Stethoscope,
  Trash2,
} from "lucide-react";

const EMPTY_MED = {
  name: "", brand: "", dosage: "", frequency: "Once daily",
  scheduledTime: "", startDate: "", endDate: "", purpose: "", active: true,
};

const EMPTY_APPT = {
  doctor_name: "",
  specialty: "Neurology",
  location: "",
  appointment_time: "",
  notes: "",
  status: "upcoming",
};

const FREQUENCIES = [
  "Once daily", "Twice daily", "3x daily", "4x daily",
  "Every 6 hours", "Every 8 hours", "As needed", "Weekly",
];

const SPECIALTIES = [
  "Neurology", "Geriatric Care", "General Medicine", "Psychiatry",
  "Cardiology", "Physiotherapy", "Orthopedics", "Other",
];

export default function Medications() {
  const { currentPatient, currentMedications, currentAppointments, reloadPatientDetail } = usePatient();
  const [activeTab, setActiveTab] = useState("medications"); // "medications" | "appointments"

  // Medication States
  const [showMedForm, setShowMedForm] = useState(false);
  const [editingMed, setEditingMed] = useState(null);
  const [medForm, setMedForm] = useState(EMPTY_MED);
  const [filterActive, setFilterActive] = useState("all");
  const [submittingMed, setSubmittingMed] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  // Appointment States
  const [showApptForm, setShowApptForm] = useState(false);
  const [apptForm, setApptForm] = useState(EMPTY_APPT);
  const [submittingAppt, setSubmittingAppt] = useState(false);
  const [filterAppt, setFilterAppt] = useState("upcoming"); // "upcoming" | "all" | "completed"

  const activeMeds = currentMedications.filter((m) => m.active);
  const inactiveMeds = currentMedications.filter((m) => !m.active);
  const displayedMeds =
    filterActive === "active" ? activeMeds :
    filterActive === "inactive" ? inactiveMeds :
    currentMedications;

  const upcomingAppts = (currentAppointments || []).filter((a) => a.status === "upcoming");
  const displayedAppts = (currentAppointments || []).filter((a) => {
    if (filterAppt === "upcoming") return a.status === "upcoming";
    if (filterAppt === "completed") return a.status === "completed";
    return true;
  });

  const openAddMed = () => { setMedForm(EMPTY_MED); setEditingMed(null); setShowMedForm(true); };
  const openEditMed = (med) => { setMedForm({ ...med }); setEditingMed(med.id); setShowMedForm(true); };
  const closeMedForm = () => { setShowMedForm(false); setEditingMed(null); };

  const handleMedChange = (e) => setMedForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  const handleApptChange = (e) => setApptForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleToggleMed = async (id, currentActive) => {
    try {
      await toggleMedicationActive(id, !currentActive);
      if (reloadPatientDetail) await reloadPatientDetail();
    } catch (err) {
      console.error("[Medications] Failed to toggle active status:", err);
      alert("Failed to update medication status.");
    }
  };

  const handleMarkDose = async (med, status) => {
    if (!currentPatient?.id) return;
    try {
      await logMedicationDose({
        patientId: currentPatient.id,
        medicationId: med.id,
        medName: med.name,
        medDosage: med.dosage,
        status: status,
      });
      setStatusMsg(`Dose recorded as ${status} for ${med.name}`);
      setTimeout(() => setStatusMsg(""), 3500);
      if (reloadPatientDetail) await reloadPatientDetail();
    } catch (err) {
      console.error("[Medications] Failed to log dose:", err);
      alert("Failed to log dose: " + err.message);
    }
  };

  const handleMedSubmit = async (e) => {
    e.preventDefault();
    if (!medForm.name || !medForm.dosage) { alert("Medicine name and dosage are required."); return; }
    if (!currentPatient?.id) { alert("Please select a patient."); return; }

    setSubmittingMed(true);
    try {
      if (editingMed) {
        await updateMedication(editingMed, { ...medForm, patientId: currentPatient.id });
      } else {
        await createMedication({ ...medForm, patientId: currentPatient.id });
      }
      if (reloadPatientDetail) await reloadPatientDetail();
      closeMedForm();
      setStatusMsg(`Medication ${editingMed ? "updated" : "saved"} successfully.`);
      setTimeout(() => setStatusMsg(""), 3000);
    } catch (err) {
      console.error("[Medications] Failed to save medication:", err);
      alert("Failed to save medication: " + err.message);
    } finally {
      setSubmittingMed(false);
    }
  };

  const handleApptSubmit = async (e) => {
    e.preventDefault();
    if (!apptForm.doctor_name || !apptForm.appointment_time) {
      alert("Doctor name and appointment date/time are required.");
      return;
    }
    if (!currentPatient?.id) { alert("Please select a patient."); return; }

    setSubmittingAppt(true);
    try {
      await createAppointment(currentPatient.id, apptForm);
      if (reloadPatientDetail) await reloadPatientDetail();
      setShowApptForm(false);
      setApptForm(EMPTY_APPT);
      setStatusMsg(`Appointment with ${apptForm.doctor_name} scheduled.`);
      setTimeout(() => setStatusMsg(""), 3500);
    } catch (err) {
      console.error("[Medications] Failed to create appointment:", err);
      alert("Failed to schedule appointment: " + err.message);
    } finally {
      setSubmittingAppt(false);
    }
  };



  const handleDeleteAppt = async (apptId) => {
    if (!confirm("Are you sure you want to remove this appointment?")) return;
    try {
      await deleteAppointment(apptId);
      if (reloadPatientDetail) await reloadPatientDetail();
    } catch (err) {
      console.error("[Medications] Failed to delete appointment:", err);
      alert("Error deleting appointment.");
    }
  };

  const inputStyle = {
    width: "100%", border: "1px solid #dfe2e9", borderRadius: 9,
    padding: "10px 12px", fontSize: 13, outline: "none", background: "white",
    fontFamily: "inherit", boxSizing: "border-box",
  };
  const labelStyle = { fontSize: 12, fontWeight: 600, color: "#555b6d", display: "block", marginBottom: 5 };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 20px 80px", fontFamily: "Inter, sans-serif" }}>
      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: "var(--accent)" }}>
            Module 4 · Healthcare Management
          </p>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: "var(--text-primary)" }}>
            Medications & Appointments
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: 14, color: "var(--text-secondary)" }}>
            Prescriptions, dose reminders, and doctor consultations for <strong>{currentPatient?.name || "Patient"}</strong>
          </p>
        </div>

        {activeTab === "medications" ? (
          <button
            onClick={openAddMed}
            style={{
              background: "var(--accent)", color: "white", border: "none", borderRadius: 10,
              padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 8, boxShadow: "0 4px 12px rgba(91,87,217,0.25)",
            }}
          >
            <PlusCircle size={16} /> Add Medication
          </button>
        ) : (
          <button
            onClick={() => { setApptForm(EMPTY_APPT); setShowApptForm(true); }}
            style={{
              background: "var(--accent)", color: "white", border: "none", borderRadius: 10,
              padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 8, boxShadow: "0 4px 12px rgba(91,87,217,0.25)",
            }}
          >
            <PlusCircle size={16} /> Schedule Appointment
          </button>
        )}
      </div>

      {/* FEEDBACK STATUS TOAST */}
      {statusMsg && (
        <div style={{
          background: "var(--accent-subtle)", border: "1px solid var(--accent-light)", color: "var(--accent-dark)",
          borderRadius: 10, padding: "10px 16px", marginBottom: 20, fontSize: 13, fontWeight: 600,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <CheckCircle size={16} /> {statusMsg}
        </div>
      )}

      {/* MODULE TABS */}
      <div style={{ display: "flex", gap: 10, borderBottom: "1.5px solid #e5e9f2", marginBottom: 22, paddingBottom: 10 }}>
        <button
          onClick={() => setActiveTab("medications")}
          style={{
            background: activeTab === "medications" ? "var(--accent)" : "#f1f4f9",
            color: activeTab === "medications" ? "white" : "#475569",
            border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700,
            cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
          }}
        >
          <Pill size={15} /> Medications ({currentMedications.length})
        </button>

        <button
          onClick={() => setActiveTab("appointments")}
          style={{
            background: activeTab === "appointments" ? "var(--accent)" : "#f1f4f9",
            color: activeTab === "appointments" ? "white" : "#475569",
            border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700,
            cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
          }}
        >
          <Stethoscope size={15} /> Doctor Appointments
          {upcomingAppts.length > 0 && (
            <span style={{
              background: activeTab === "appointments" ? "rgba(255,255,255,0.3)" : "var(--accent)",
              color: "white", borderRadius: 12, padding: "1px 7px", fontSize: 11, fontWeight: 800,
            }}>
              {upcomingAppts.length}
            </span>
          )}
        </button>
      </div>

      {/* ──────────────── TAB 1: MEDICATIONS ──────────────── */}
      {activeTab === "medications" && (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
            {[
              { id: "all", label: `All (${currentMedications.length})` },
              { id: "active", label: `Active (${activeMeds.length})` },
              { id: "inactive", label: `Inactive (${inactiveMeds.length})` },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilterActive(f.id)}
                style={{
                  background: filterActive === f.id ? "#172033" : "#f1f4f9",
                  color: filterActive === f.id ? "white" : "#555b6d",
                  border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {displayedMeds.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px", background: "white", borderRadius: 14, border: "1.5px dashed #dfe2e9" }}>
              <Pill size={36} color="#9aa1b2" style={{ marginBottom: 12 }} />
              <h3 style={{ margin: "0 0 6px", fontSize: 16, color: "#172033" }}>No medications found</h3>
              <p style={{ margin: 0, fontSize: 13, color: "#8a90a0" }}>Click "Add Medication" above to set up prescriptions and reminders.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {displayedMeds.map((med) => (
                <div
                  key={med.id}
                  style={{
                    background: "white", borderRadius: 14, padding: "18px 20px", border: "1px solid #e5e9f2",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.03)", opacity: med.active ? 1 : 0.72,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: 10, background: med.active ? "#eef0fc" : "#f3f4f8",
                        display: "flex", alignItems: "center", justifyContent: "center", color: med.active ? "var(--accent)" : "#8a90a0",
                      }}>
                        <Pill size={20} />
                      </div>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#172033" }}>{med.name}</h3>
                          <span style={{
                            fontSize: 11, fontWeight: 700, color: med.active ? "#1a9a5c" : "#777e8e",
                            background: med.active ? "#e8f8f0" : "#eceef3", borderRadius: 20, padding: "2px 8px",
                          }}>
                            {med.active ? "Active" : "Inactive"}
                          </span>
                        </div>
                        {med.brand && <div style={{ fontSize: 12, color: "#8a90a0", marginTop: 2 }}>Brand: {med.brand}</div>}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      {med.active && (
                        <>
                          <button
                            onClick={() => handleMarkDose(med, "Taken")}
                            style={{ background: "#e8f8f0", border: "none", borderRadius: 8, padding: "7px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: "#1a9a5c" }}
                          >
                            <Check size={13} /> Mark Taken
                          </button>
                          <button
                            onClick={() => handleMarkDose(med, "Missed")}
                            style={{ background: "#fff5df", border: "none", borderRadius: 8, padding: "7px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: "#b97a18" }}
                          >
                            <AlertCircle size={13} /> Mark Missed
                          </button>
                        </>
                      )}
                      <button onClick={() => openEditMed(med)} style={{ background: "#f3f4f8", border: "none", borderRadius: 8, padding: "7px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: "#555b6d" }}>
                        <Edit2 size={13} /> Edit
                      </button>
                      <button
                        onClick={() => handleToggleMed(med.id, med.active)}
                        style={{
                          background: med.active ? "#fff3f3" : "#e8f8f0", border: "none", borderRadius: 8,
                          padding: "7px 10px", cursor: "pointer", display: "flex", alignItems: "center",
                          gap: 5, fontSize: 12, fontWeight: 600, color: med.active ? "#d45c5c" : "#1a9a5c",
                        }}
                      >
                        {med.active ? <><XCircle size={13} /> Deactivate</> : <><CheckCircle size={13} /> Activate</>}
                      </button>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginTop: 16 }}>
                    {[
                      { label: "DOSAGE", value: med.dosage },
                      { label: "FREQUENCY", value: med.frequency },
                      { label: "SCHEDULED TIME", value: med.scheduledTime || "—" },
                      { label: "START DATE", value: med.startDate ? new Date(med.startDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—" },
                    ].map((item) => (
                      <div key={item.label} style={{ background: "#f8f9fc", borderRadius: 9, padding: "10px 12px" }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "#8a90a0", letterSpacing: "0.5px", marginBottom: 4 }}>{item.label}</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#172033" }}>{item.value}</div>
                      </div>
                    ))}
                  </div>

                  {med.purpose && (
                    <div style={{ marginTop: 12, background: "#f8f9fc", borderRadius: 9, padding: "10px 14px", fontSize: 13, color: "#555b6d" }}>
                      <strong style={{ color: "#8a90a0", fontSize: 11, letterSpacing: "0.4px" }}>PURPOSE: </strong>{med.purpose}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ──────────────── TAB 2: DOCTOR APPOINTMENTS ──────────────── */}
      {activeTab === "appointments" && (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
            {[
              { id: "upcoming", label: `Upcoming (${upcomingAppts.length})` },
              { id: "completed", label: `Completed (${(currentAppointments || []).filter((a) => a.status === "completed").length})` },
              { id: "all", label: `All (${(currentAppointments || []).length})` },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilterAppt(f.id)}
                style={{
                  background: filterAppt === f.id ? "#172033" : "#f1f4f9",
                  color: filterAppt === f.id ? "white" : "#555b6d",
                  border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {displayedAppts.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px", background: "white", borderRadius: 14, border: "1.5px dashed #dfe2e9" }}>
              <Calendar size={36} color="#9aa1b2" style={{ marginBottom: 12 }} />
              <h3 style={{ margin: "0 0 6px", fontSize: 16, color: "#172033" }}>No appointments in this view</h3>
              <p style={{ margin: 0, fontSize: 13, color: "#8a90a0" }}>Click "Schedule Appointment" to record a doctor or clinic visit.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {displayedAppts.map((appt) => {
                const dateObj = new Date(appt.appointment_time);
                const isUpcoming = appt.status === "upcoming";
                const isPast = dateObj < new Date() && isUpcoming;

                return (
                  <div
                    key={appt.appointment_id}
                    style={{
                      background: "white", borderRadius: 14, padding: "18px 20px", border: "1px solid #e5e9f2",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.03)", opacity: 1,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{
                          width: 44, height: 44, borderRadius: 12,
                          background: isUpcoming ? "var(--accent-subtle)" : "#f1f4f9",
                          color: isUpcoming ? "var(--accent)" : "#64748b",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          <Stethoscope size={22} />
                        </div>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#172033" }}>
                              {appt.doctor_name}
                            </h3>
                            <span style={{
                              fontSize: 11, fontWeight: 700,
                              color: appt.status === "completed" ? "#1a9a5c" : appt.status === "cancelled" ? "#94a3b8" : isPast ? "#dc2626" : "var(--accent)",
                              background: appt.status === "completed" ? "#e8f8f0" : appt.status === "cancelled" ? "#f1f5f9" : isPast ? "#fee2e2" : "var(--accent-subtle)",
                              borderRadius: 20, padding: "2px 8px",
                            }}>
                              {appt.status === "completed" ? "Completed" : appt.status === "cancelled" ? "Cancelled" : isPast ? "Due / Overdue" : "Upcoming"}
                            </span>
                          </div>
                          <div style={{ fontSize: 13, color: "#64748b", marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
                            <span>{appt.specialty || "Medical Specialist"}</span>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <button
                          onClick={() => handleDeleteAppt(appt.appointment_id)}
                          style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "7px 10px", cursor: "pointer", color: "#94a3b8" }}
                          title="Delete record"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, marginTop: 16 }}>
                      <div style={{ background: "#f8f9fc", borderRadius: 9, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                        <Calendar size={16} color="var(--accent)" />
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: "#8a90a0", textTransform: "uppercase" }}>Date & Time</div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#172033" }}>
                            {dateObj.toLocaleDateString("en-IN", { weekday: "short", month: "short", day: "numeric", year: "numeric" })} at {dateObj.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </div>
                      </div>

                      <div style={{ background: "#f8f9fc", borderRadius: 9, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                        <MapPin size={16} color="var(--accent)" />
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: "#8a90a0", textTransform: "uppercase" }}>Location</div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#172033" }}>
                            {appt.location || "Not specified"}
                          </div>
                        </div>
                      </div>
                    </div>

                    {appt.notes && (
                      <div style={{ marginTop: 12, background: "#f8f9fc", borderRadius: 9, padding: "10px 14px", fontSize: 13, color: "#555b6d" }}>
                        <strong style={{ color: "#8a90a0", fontSize: 11, letterSpacing: "0.4px" }}>CONSULTATION NOTES: </strong>
                        {appt.notes}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ──────────────── MODAL: ADD / EDIT MEDICATION ──────────────── */}
      {showMedForm && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(18,23,37,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 1000 }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) closeMedForm(); }}
        >
          <div style={{ width: "100%", maxWidth: 600, maxHeight: "90vh", overflowY: "auto", background: "white", borderRadius: 18, padding: 28, boxShadow: "0 20px 60px rgba(0,0,0,0.18)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>{editingMed ? "Edit Medication" : "Add Medication"}</h2>
              <button onClick={closeMedForm} style={{ background: "none", border: "none", cursor: "pointer", color: "#8a90a0" }}><X size={20} /></button>
            </div>

            <form onSubmit={handleMedSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Medicine Name *</label>
                  <input name="name" value={medForm.name} onChange={handleMedChange} placeholder="e.g. Donepezil" required style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Brand Name</label>
                  <input name="brand" value={medForm.brand} onChange={handleMedChange} placeholder="e.g. Aricept" style={inputStyle} />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Dosage *</label>
                  <input name="dosage" value={medForm.dosage} onChange={handleMedChange} placeholder="e.g. 10mg, 1 tablet" required style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Frequency</label>
                  <select name="frequency" value={medForm.frequency} onChange={handleMedChange} style={inputStyle}>
                    {FREQUENCIES.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label style={labelStyle}>Scheduled Daily Time(s)</label>
                <input name="scheduledTime" value={medForm.scheduledTime} onChange={handleMedChange} placeholder="e.g. 08:00 AM, 08:00 PM" style={inputStyle} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Start Date</label>
                  <input type="date" name="startDate" value={medForm.startDate} onChange={handleMedChange} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>End Date (if temporary)</label>
                  <input type="date" name="endDate" value={medForm.endDate} onChange={handleMedChange} style={inputStyle} />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Medical Purpose / Clinical Notes</label>
                <textarea name="purpose" value={medForm.purpose} onChange={handleMedChange} rows={3} placeholder="Why is this prescribed? Any specific meal instructions?" style={{ ...inputStyle, resize: "vertical" }} />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
                <button type="button" onClick={closeMedForm} style={{ padding: "10px 18px", border: "1px solid #dfe2e9", borderRadius: 9, background: "white", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                <button type="submit" disabled={submittingMed} style={{ padding: "10px 22px", border: "none", borderRadius: 9, background: "var(--accent)", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  {submittingMed ? "Saving..." : editingMed ? "Update" : "Save Medication"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ──────────────── MODAL: SCHEDULE APPOINTMENT ──────────────── */}
      {showApptForm && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(18,23,37,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 1000 }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setShowApptForm(false); }}
        >
          <div style={{ width: "100%", maxWidth: 600, maxHeight: "90vh", overflowY: "auto", background: "white", borderRadius: 18, padding: 28, boxShadow: "0 20px 60px rgba(0,0,0,0.18)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Schedule Doctor Appointment</h2>
              <button onClick={() => setShowApptForm(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#8a90a0" }}><X size={20} /></button>
            </div>

            <form onSubmit={handleApptSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Doctor / Consultant Name *</label>
                  <input name="doctor_name" value={apptForm.doctor_name} onChange={handleApptChange} placeholder="e.g. Dr. Meenakshi Sundaram" required style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Medical Specialty</label>
                  <select name="specialty" value={apptForm.specialty} onChange={handleApptChange} style={inputStyle}>
                    {SPECIALTIES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Appointment Date & Time *</label>
                  <input type="datetime-local" name="appointment_time" value={apptForm.appointment_time} onChange={handleApptChange} required style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Clinic / Hospital Location</label>
                  <input name="location" value={apptForm.location} onChange={handleApptChange} placeholder="e.g. Apollo Hospital, Chennai" style={inputStyle} />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Consultation Agenda & Notes</label>
                <textarea name="notes" value={apptForm.notes} onChange={handleApptChange} rows={3} placeholder="e.g. Regular cognitive checkup, dosage evaluation, blood pressure" style={{ ...inputStyle, resize: "vertical" }} />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
                <button type="button" onClick={() => setShowApptForm(false)} style={{ padding: "10px 18px", border: "1px solid #dfe2e9", borderRadius: 9, background: "white", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                <button type="submit" disabled={submittingAppt} style={{ padding: "10px 22px", border: "none", borderRadius: 9, background: "var(--accent)", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  {submittingAppt ? "Scheduling..." : "Schedule Appointment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
