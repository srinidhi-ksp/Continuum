import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePatient } from "../context/PatientContext";
import { createPatient, updatePatient } from "../lib/patientApi";
import { initialFor } from "../lib/caregiverColors";
import "../styles/patient.css";

const EMPTY_FORM = {
  name: "",
  dob: "",
  gender: "Female",
  condition: "",
  bloodGroup: "",
  allergies: "",
  phone: "",
  emergencyContact: "",
  relationship: "",
  emergencyPhone: "",
  notes: "",
};

function Patient() {
  const { patients, currentPatientId, setCurrentPatientId, reloadPatients } = usePatient();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingPatient, setEditingPatient] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Post-save flow
  const [showSuccess, setShowSuccess] = useState(false);
  const [newlySavedPatient, setNewlySavedPatient] = useState(null);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteSent, setInviteSent] = useState(false);

  const filteredPatients = useMemo(() => {
    return patients.filter(
      (patient) =>
        patient.name.toLowerCase().includes(search.toLowerCase()) ||
        patient.condition.toLowerCase().includes(search.toLowerCase())
    );
  }, [patients, search]);

  const openAddForm = () => {
    setForm(EMPTY_FORM);
    setFormError("");
    setEditingPatient(null);
    setShowAddForm(true);
  };

  const openEditForm = (patient) => {
    setForm({
      name: patient.name,
      dob: patient.dob || "",
      gender: patient.gender || "Female",
      condition: patient.condition,
      bloodGroup: patient.bloodGroup || "",
      allergies: patient.allergies || "",
      phone: patient.phone || "",
      emergencyContact: patient.emergencyContact === "Not added" ? "" : patient.emergencyContact,
      relationship: patient.relationship === "Not added" ? "" : patient.relationship,
      emergencyPhone: patient.emergencyPhone || "",
      notes: patient.notes === "No notes added." ? "" : patient.notes,
    });
    setFormError("");
    setEditingPatient(patient);
    setShowAddForm(true);
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.name || !form.dob || !form.condition) {
      setFormError("Please fill in Full Name, Date of Birth and Medical Condition.");
      return;
    }

    setFormError("");
    setIsSaving(true);
    try {
      if (editingPatient) {
        await updatePatient(editingPatient.id, form);
        await reloadPatients();
        setShowAddForm(false);
        setEditingPatient(null);
      } else {
        const newPatientRow = await createPatient(form);
        await reloadPatients();
        setCurrentPatientId(newPatientRow.patient_id);
        setShowAddForm(false);
        setNewlySavedPatient({ id: newPatientRow.patient_id, name: newPatientRow.full_name });
        setShowSuccess(true);
      }
      setForm(EMPTY_FORM);
    } catch (err) {
      console.error("[Patient] Failed to save patient:", err);
      setFormError(err.message || "Something went wrong saving this patient. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const switchPatient = (patient) => {
    setCurrentPatientId(patient.id);
    setSelectedPatient(null);
    navigate("/");
  };

  return (
    <div className="wt-patient-page">
      <div className="wt-patient-page__header">
        <div>
          <h1>Patients</h1>
          <p>Manage patients connected to your care circle.</p>
        </div>
        <button className="wt-btn wt-btn--primary" onClick={openAddForm}>
          + Add Patient
        </button>
      </div>

      <div className="wt-patient-toolbar">
        <div className="wt-search">
          <span>⌕</span>
          <input
            type="text"
            placeholder="Search patient or condition..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="wt-patient-count">
          {filteredPatients.length} patient{filteredPatients.length !== 1 ? "s" : ""}
        </div>
      </div>

      {filteredPatients.length === 0 ? (
        <p className="wt-empty">No patients found. Try another search or add a new patient.</p>
      ) : (
        <div className="wt-patient-grid">
          {filteredPatients.map((patient) => {
            const isCurrent = patient.id === currentPatientId;
            return (
              <div key={patient.id} className={`wt-patient-card ${isCurrent ? "wt-patient-card--current" : ""}`}>
                <div className="wt-patient-card__top">
                  <div className="wt-patient-card__identity">
                    <div className="wt-patient-avatar wt-patient-avatar--card">{initialFor(patient.name)}</div>
                    <div>
                      <h2>{patient.name}</h2>
                      <p className="wt-patient-card__meta">
                        {patient.age} years · {patient.gender}
                      </p>
                      <p className="wt-patient-card__meta">{patient.condition}</p>
                    </div>
                  </div>
                  <span className={`wt-status wt-status--${patient.status === "Attention" ? "attention" : "stable"}`}>
                    <span className="wt-status__dot" />
                    {patient.status}
                  </span>
                </div>

                <div className="wt-patient-card__stats">
                  <div className="wt-patient-card__stat">
                    <span>Medication</span>
                    <strong>{patient.medication}</strong>
                  </div>
                  <div className="wt-patient-card__stat">
                    <span>Last activity</span>
                    <strong>{patient.lastActivity}</strong>
                  </div>
                </div>

                <div className="wt-progress">
                  <div className="wt-progress__label">
                    <span>Today's care completion</span>
                    <strong>{patient.careCompletion}%</strong>
                  </div>
                  <div className="wt-progress__track">
                    <div className="wt-progress__fill" style={{ width: `${patient.careCompletion}%` }} />
                  </div>
                </div>

                <div className="wt-patient-card__footer">
                  <span className="wt-patient-card__meta">
                    {patient.careCircleActive ? "Care circle active" : "No active caregivers"}
                  </span>
                  {isCurrent && <span className="wt-badge">Current patient</span>}
                  <div className="wt-patient-card__actions">
                    <button className="wt-btn wt-btn--ghost wt-btn--sm" onClick={() => openEditForm(patient)}>
                      Edit
                    </button>
                    <button className="wt-btn wt-btn--ghost wt-btn--sm" onClick={() => setSelectedPatient(patient)}>
                      View Profile
                    </button>
                    {!isCurrent && (
                      <button className="wt-btn wt-btn--primary wt-btn--sm" onClick={() => switchPatient(patient)}>
                        Switch
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ADD / EDIT PATIENT MODAL */}
      {showAddForm && (
        <div
          className="wt-modal-overlay"
          onMouseDown={(event) => event.target === event.currentTarget && setShowAddForm(false)}
        >
          <div className="wt-modal">
            <div className="wt-modal-header">
              <h2>{editingPatient ? "Edit Patient" : "Add Patient"}</h2>
              <button className="wt-modal-close" onClick={() => setShowAddForm(false)}>
                ×
              </button>
            </div>

            {formError && <p className="wt-form-error">{formError}</p>}

            <form onSubmit={handleSubmit}>
              <div className="wt-form-grid">
                <div className="wt-form-group wt-form-group--full">
                  <label>Full Name *</label>
                  <input name="name" value={form.name} onChange={handleChange} placeholder="Enter patient name" />
                </div>

                <div className="wt-form-group">
                  <label>Date of Birth *</label>
                  <input type="date" name="dob" value={form.dob} onChange={handleChange} />
                </div>

                <div className="wt-form-group">
                  <label>Gender</label>
                  <select name="gender" value={form.gender} onChange={handleChange}>
                    <option>Female</option>
                    <option>Male</option>
                    <option>Other</option>
                  </select>
                </div>

                <div className="wt-form-group">
                  <label>Medical Condition *</label>
                  <input name="condition" value={form.condition} onChange={handleChange} placeholder="Example: Dementia" />
                </div>

                <div className="wt-form-group">
                  <label>Blood Group</label>
                  <select name="bloodGroup" value={form.bloodGroup} onChange={handleChange}>
                    <option value="">Select blood group</option>
                    {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((g) => (
                      <option key={g}>{g}</option>
                    ))}
                  </select>
                </div>

                <div className="wt-form-group">
                  <label>Phone</label>
                  <input name="phone" value={form.phone} onChange={handleChange} placeholder="+91 XXXXX XXXXX" />
                </div>

                <div className="wt-form-group wt-form-group--full">
                  <label>Allergies</label>
                  <input
                    name="allergies"
                    value={form.allergies}
                    onChange={handleChange}
                    placeholder="Example: Penicillin, Aspirin (or None known)"
                  />
                </div>

                <div className="wt-form-group">
                  <label>Emergency Contact Name</label>
                  <input
                    name="emergencyContact"
                    value={form.emergencyContact}
                    onChange={handleChange}
                    placeholder="Contact name"
                  />
                </div>

                <div className="wt-form-group">
                  <label>Relationship</label>
                  <select name="relationship" value={form.relationship} onChange={handleChange}>
                    <option value="">Select relationship</option>
                    <option>Son</option>
                    <option>Daughter</option>
                    <option>Wife</option>
                    <option>Husband</option>
                    <option>Mother</option>
                    <option>Father</option>
                    <option>Sibling</option>
                    <option>Other</option>
                  </select>
                </div>

                <div className="wt-form-group">
                  <label>Emergency Contact Phone</label>
                  <input
                    name="emergencyPhone"
                    value={form.emergencyPhone}
                    onChange={handleChange}
                    placeholder="+91 XXXXX XXXXX"
                  />
                </div>

                <div className="wt-form-group wt-form-group--full">
                  <label>Medical Notes / Care Preferences</label>
                  <textarea
                    name="notes"
                    value={form.notes}
                    onChange={handleChange}
                    placeholder="Add important care preferences or medical notes..."
                  />
                </div>
              </div>

              <div className="wt-modal-actions">
                <button
                  type="button"
                  className="wt-btn wt-btn--ghost"
                  onClick={() => setShowAddForm(false)}
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button type="submit" className="wt-btn wt-btn--primary" disabled={isSaving}>
                  {isSaving ? "Saving…" : editingPatient ? "Save Changes" : "Save Patient"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PATIENT PROFILE MODAL */}
      {selectedPatient && (
        <div
          className="wt-modal-overlay"
          onMouseDown={(event) => event.target === event.currentTarget && setSelectedPatient(null)}
        >
          <div className="wt-modal">
            <div className="wt-modal-header">
              <h2>Patient Profile</h2>
              <button className="wt-modal-close" onClick={() => setSelectedPatient(null)}>
                ×
              </button>
            </div>

            <div className="wt-profile-top">
              <div className="wt-patient-avatar wt-patient-avatar--lg">{initialFor(selectedPatient.name)}</div>
              <div>
                <h2>{selectedPatient.name}</h2>
                <p>
                  {selectedPatient.age} years · {selectedPatient.gender} · {selectedPatient.condition}
                </p>
                <span className={`wt-status wt-status--${selectedPatient.status === "Attention" ? "attention" : "stable"}`}>
                  <span className="wt-status__dot" />
                  {selectedPatient.status}
                </span>
              </div>
            </div>

            <div className="wt-profile-section">
              <h3>Personal Information</h3>
              <div className="wt-profile-info-grid">
                <div className="wt-profile-info">
                  <span>Date of Birth</span>
                  <strong>{selectedPatient.dob || "—"}</strong>
                </div>
                <div className="wt-profile-info">
                  <span>Phone</span>
                  <strong>{selectedPatient.phone || "—"}</strong>
                </div>
                <div className="wt-profile-info">
                  <span>Emergency Contact</span>
                  <strong>{selectedPatient.emergencyContact}</strong>
                </div>
                <div className="wt-profile-info">
                  <span>Relationship</span>
                  <strong>{selectedPatient.relationship}</strong>
                </div>
              </div>
            </div>

            <div className="wt-profile-section">
              <h3>Care Overview</h3>
              <div className="wt-profile-info-grid">
                <div className="wt-profile-info">
                  <span>Today's completion</span>
                  <strong>{selectedPatient.careCompletion}%</strong>
                </div>
                <div className="wt-profile-info">
                  <span>Medication</span>
                  <strong>{selectedPatient.medication}</strong>
                </div>
              </div>
            </div>

            <div className="wt-profile-section">
              <h3>Current Care Plan</h3>
              {selectedPatient.carePlan.length === 0 ? (
                <p className="wt-empty">No care activities added yet.</p>
              ) : (
                selectedPatient.carePlan.map((item, index) => (
                  <div className="wt-care-plan-row" key={index}>
                    <span>{item.name}</span>
                    <span
                      className={`wt-status-tag--${
                        item.status === "Completed" ? "completed" : item.status === "Missed" ? "missed" : "pending"
                      }`}
                    >
                      {item.status === "Completed" ? "✓ Completed" : item.status === "Missed" ? "✕ Missed" : "○ Pending"}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="wt-profile-section">
              <h3>Care Notes</h3>
              <div className="wt-profile-note">{selectedPatient.notes}</div>
            </div>

            <div className="wt-modal-actions">
              <button className="wt-btn wt-btn--ghost" onClick={() => setSelectedPatient(null)}>
                Close
              </button>
              {selectedPatient.id !== currentPatientId && (
                <button className="wt-btn wt-btn--primary" onClick={() => switchPatient(selectedPatient)}>
                  Switch to Patient
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* POST-SAVE SUCCESS MODAL */}
      {showSuccess && newlySavedPatient && (
        <div className="wt-modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && setShowSuccess(false)}>
          <div className="wt-modal wt-modal--narrow" style={{ textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>✅</div>
            <h2 style={{ marginBottom: 8 }}>Patient Created Successfully</h2>
            <p style={{ color: "var(--text-secondary)", marginBottom: 24, fontSize: 14 }}>
              <strong>{newlySavedPatient.name}</strong> has been added to your care circle. Invite family members or
              other caregivers to help coordinate care.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button className="wt-btn wt-btn--ghost" onClick={() => setShowSuccess(false)}>
                Do This Later
              </button>
              <button
                className="wt-btn wt-btn--primary"
                onClick={() => {
                  setShowSuccess(false);
                  setInviteSent(false);
                  setInviteEmail("");
                  setInvitePhone("");
                  setShowInvite(true);
                }}
              >
                Invite Caregiver
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INVITE CAREGIVER MODAL
          NOTE: no email/SMS provider is wired up yet, so this generates a
          shareable link only — nothing is actually sent. Same behavior as
          before this pass; wiring a real provider (e.g. Resend) is a
          separate, scoped piece of work. */}
      {showInvite && newlySavedPatient && (
        <div
          className="wt-modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setShowInvite(false);
              setInviteSent(false);
            }
          }}
        >
          <div className="wt-modal wt-modal--narrow">
            <div className="wt-modal-header">
              <h2>Invite a Caregiver</h2>
              <button
                className="wt-modal-close"
                onClick={() => {
                  setShowInvite(false);
                  setInviteSent(false);
                }}
              >
                ×
              </button>
            </div>

            {inviteSent ? (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>🎉</div>
                <h3 style={{ marginBottom: 8 }}>Invite Link Created</h3>
                <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 20 }}>
                  Share this link with the caregiver to join {newlySavedPatient.name}'s care circle. They'll still
                  need to be added to the care circle once they sign up — there's no automatic linking yet.
                </p>
                <div className="wt-invite-link">
                  https://continuum.care/join/{newlySavedPatient.id}
                </div>
                <button
                  className="wt-btn wt-btn--primary"
                  style={{ width: "100%" }}
                  onClick={() =>
                    navigator.clipboard?.writeText(`https://continuum.care/join/${newlySavedPatient.id}`)
                  }
                >
                  Copy Care Link
                </button>
              </div>
            ) : (
              <>
                <p style={{ color: "var(--text-secondary)", fontSize: 13, marginBottom: 18 }}>
                  Patient: <strong>{newlySavedPatient.name}</strong>
                </p>

                <div className="wt-form-group">
                  <label>Invite by Email</label>
                  <input
                    type="email"
                    placeholder="caregiver@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>

                <div className="wt-form-group" style={{ marginTop: 12 }}>
                  <label>Or by Phone</label>
                  <input
                    type="tel"
                    placeholder="+91 XXXXX XXXXX"
                    value={invitePhone}
                    onChange={(e) => setInvitePhone(e.target.value)}
                  />
                </div>

                <div className="wt-modal-actions">
                  <button
                    className="wt-btn wt-btn--ghost"
                    onClick={() => {
                      setShowInvite(false);
                      setInviteSent(false);
                    }}
                  >
                    Cancel
                  </button>
                  <button className="wt-btn wt-btn--primary" onClick={() => setInviteSent(true)}>
                    Send Invitation
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Patient;
