import React, { useMemo, useState } from "react";

const initialPatients = [
  {
    id: 1,
    name: "Lakshmi Krishnan",
    age: 72,
    gender: "Female",
    condition: "Dementia",
    status: "Stable",
    careCompletion: 78,
    medication: "2 / 3",
    lastActivity: "8 min ago",
    phone: "+91 98765 43210",
    emergencyContact: "Arun Krishnan",
    relationship: "Son",
    dob: "12 June 1954",
    notes:
      "Requires assistance with medication, meals and evening mobility activities.",
    carePlan: [
      { name: "Morning medication", status: "Completed" },
      { name: "Breakfast", status: "Completed" },
      { name: "Afternoon medication", status: "Pending" },
      { name: "Evening walk", status: "Pending" },
    ],
  },
  {
    id: 2,
    name: "Meena Bala",
    age: 68,
    gender: "Female",
    condition: "Parkinson's",
    status: "Stable",
    careCompletion: 84,
    medication: "3 / 3",
    lastActivity: "25 min ago",
    phone: "+91 98432 11223",
    emergencyContact: "Priya Bala",
    relationship: "Daughter",
    dob: "14 May 1958",
    notes:
      "Needs support with mobility and medication reminders during the day.",
    carePlan: [
      { name: "Morning medication", status: "Completed" },
      { name: "Breakfast", status: "Completed" },
      { name: "Afternoon medication", status: "Completed" },
      { name: "Evening walk", status: "Pending" },
    ],
  },
  {
    id: 3,
    name: "Ravi Kumar",
    age: 76,
    gender: "Male",
    condition: "Stroke Recovery",
    status: "Attention",
    careCompletion: 54,
    medication: "1 / 3",
    lastActivity: "42 min ago",
    phone: "+91 97865 22110",
    emergencyContact: "Anitha Kumar",
    relationship: "Wife",
    dob: "28 February 1950",
    notes:
      "Requires regular mobility assistance and close monitoring of daily activities.",
    carePlan: [
      { name: "Morning medication", status: "Completed" },
      { name: "Breakfast", status: "Missed" },
      { name: "Afternoon medication", status: "Pending" },
      { name: "Physiotherapy", status: "Pending" },
    ],
  },
];

function Patient() {
  const [patients, setPatients] = useState(initialPatients);
  const [search, setSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingPatient, setEditingPatient] = useState(null);

  const [form, setForm] = useState({
    name: "",
    age: "",
    gender: "Female",
    condition: "",
    phone: "",
    emergencyContact: "",
    relationship: "",
    notes: "",
  });

  const filteredPatients = useMemo(() => {
    return patients.filter(
      (patient) =>
        patient.name.toLowerCase().includes(search.toLowerCase()) ||
        patient.condition.toLowerCase().includes(search.toLowerCase())
    );
  }, [patients, search]);

  const resetForm = () => {
    setForm({
      name: "",
      age: "",
      gender: "Female",
      condition: "",
      phone: "",
      emergencyContact: "",
      relationship: "",
      notes: "",
    });
  };

  const openAddForm = () => {
    resetForm();
    setEditingPatient(null);
    setShowAddForm(true);
  };

  const openEditForm = (patient) => {
    setForm({
      name: patient.name,
      age: patient.age,
      gender: patient.gender,
      condition: patient.condition,
      phone: patient.phone,
      emergencyContact: patient.emergencyContact,
      relationship: patient.relationship,
      notes: patient.notes,
    });

    setEditingPatient(patient);
    setShowAddForm(true);
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!form.name || !form.age || !form.condition) {
      alert("Please fill in Name, Age and Condition.");
      return;
    }

    if (editingPatient) {
      setPatients((previous) =>
        previous.map((patient) =>
          patient.id === editingPatient.id
            ? {
                ...patient,
                ...form,
                age: Number(form.age),
              }
            : patient
        )
      );
    } else {
      const newPatient = {
        id: Date.now(),
        name: form.name,
        age: Number(form.age),
        gender: form.gender,
        condition: form.condition,
        status: "Stable",
        careCompletion: 0,
        medication: "0 / 0",
        lastActivity: "Just now",
        phone: form.phone || "Not added",
        emergencyContact: form.emergencyContact || "Not added",
        relationship: form.relationship || "Not added",
        dob: "Not added",
        notes: form.notes || "No notes added.",
        carePlan: [],
      };

      setPatients((previous) => [newPatient, ...previous]);
    }

    setShowAddForm(false);
    setEditingPatient(null);
    resetForm();
  };

  const switchPatient = (patient) => {
    setSelectedPatient(patient);

    // This is currently frontend-only.
    // Later you can store the selected patient in a global context
    // and show the same patient across Dashboard, Daily Care and Timeline.
  };

  return (
    <div className="patient-page">
      <style>{`
        .patient-page {
          min-height: 100%;
          padding: 32px;
          background: #f7f8fc;
          color: #172033;
          box-sizing: border-box;
          font-family: Inter, Arial, sans-serif;
        }

        .patient-page *,
        .patient-page *::before,
        .patient-page *::after {
          box-sizing: border-box;
        }

        .patient-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
          margin-bottom: 28px;
        }

        .patient-title {
          margin: 0;
          font-size: 30px;
          font-weight: 700;
        }

        .patient-subtitle {
          margin: 7px 0 0;
          color: #72798a;
          font-size: 14px;
        }

        .add-patient-button {
          border: none;
          border-radius: 10px;
          background: #5b57d9;
          color: white;
          padding: 12px 18px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: 0.2s;
        }

        .add-patient-button:hover {
          background: #4945c5;
          transform: translateY(-1px);
        }

        .patient-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          margin-bottom: 20px;
        }

        .search-box {
          width: 100%;
          max-width: 420px;
          position: relative;
        }

        .search-box span {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: #969cac;
          font-size: 16px;
        }

        .search-box input {
          width: 100%;
          border: 1px solid #e0e3eb;
          border-radius: 10px;
          background: white;
          padding: 12px 14px 12px 40px;
          outline: none;
          font-size: 14px;
        }

        .search-box input:focus {
          border-color: #7773e5;
          box-shadow: 0 0 0 3px rgba(91, 87, 217, 0.08);
        }

        .patient-count {
          color: #777e8e;
          font-size: 13px;
        }

        .patient-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 18px;
        }

        .patient-card {
          background: white;
          border: 1px solid #e4e6ed;
          border-radius: 16px;
          padding: 22px;
          box-shadow: 0 2px 10px rgba(31, 35, 52, 0.03);
        }

        .patient-card-top {
          display: flex;
          justify-content: space-between;
          gap: 14px;
        }

        .patient-identity {
          display: flex;
          gap: 14px;
          align-items: center;
        }

        .patient-avatar {
          width: 50px;
          height: 50px;
          border-radius: 50%;
          background: #eeedff;
          color: #5b57d9;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          font-weight: 700;
          flex-shrink: 0;
        }

        .patient-name {
          margin: 0;
          font-size: 17px;
          font-weight: 700;
        }

        .patient-basic {
          margin: 5px 0 0;
          color: #777e8e;
          font-size: 13px;
        }

        .status {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 9px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 600;
          white-space: nowrap;
        }

        .status::before {
          content: "";
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: currentColor;
        }

        .status.stable {
          color: #269565;
          background: #eaf8f1;
        }

        .status.attention {
          color: #b97a18;
          background: #fff5df;
        }

        .patient-stats {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          margin: 22px 0;
        }

        .stat-box {
          background: #f8f9fc;
          border-radius: 10px;
          padding: 13px;
        }

        .stat-label {
          color: #8a90a0;
          font-size: 11px;
          margin-bottom: 5px;
        }

        .stat-value {
          font-size: 16px;
          font-weight: 700;
        }

        .progress-wrapper {
          margin-bottom: 18px;
        }

        .progress-header {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          color: #777e8e;
          margin-bottom: 7px;
        }

        .progress-bar {
          width: 100%;
          height: 7px;
          background: #eceef3;
          border-radius: 20px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: #5b57d9;
          border-radius: inherit;
        }

        .patient-card-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          padding-top: 16px;
          border-top: 1px solid #eef0f4;
        }

        .last-activity {
          color: #8a90a0;
          font-size: 11px;
        }

        .card-actions {
          display: flex;
          gap: 8px;
        }

        .secondary-button,
        .primary-outline-button {
          border: 1px solid #dedfea;
          background: white;
          color: #53506f;
          border-radius: 8px;
          padding: 8px 11px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }

        .primary-outline-button {
          color: #5b57d9;
          border-color: #d8d6f7;
          background: #f7f6ff;
        }

        .secondary-button:hover,
        .primary-outline-button:hover {
          background: #f3f3fb;
        }

        .empty-state {
          background: white;
          border: 1px solid #e5e7ed;
          border-radius: 15px;
          padding: 60px 20px;
          text-align: center;
          color: #7c8291;
        }

        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(18, 23, 37, 0.42);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          z-index: 1000;
        }

        .modal {
          width: 100%;
          max-width: 720px;
          max-height: 90vh;
          overflow-y: auto;
          background: white;
          border-radius: 18px;
          padding: 26px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.15);
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 22px;
        }

        .modal-header h2 {
          margin: 0;
          font-size: 21px;
        }

        .close-button {
          width: 34px;
          height: 34px;
          border: none;
          border-radius: 50%;
          background: #f1f2f6;
          cursor: pointer;
          font-size: 17px;
          color: #656b7a;
        }

        .form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .form-group.full {
          grid-column: 1 / -1;
        }

        .form-group label {
          font-size: 12px;
          font-weight: 600;
          color: #555b6d;
        }

        .form-group input,
        .form-group select,
        .form-group textarea {
          border: 1px solid #dfe2e9;
          border-radius: 9px;
          padding: 11px 12px;
          outline: none;
          font-size: 13px;
          font-family: inherit;
          background: white;
        }

        .form-group textarea {
          min-height: 80px;
          resize: vertical;
        }

        .form-group input:focus,
        .form-group select:focus,
        .form-group textarea:focus {
          border-color: #6d69dc;
          box-shadow: 0 0 0 3px rgba(91, 87, 217, 0.08);
        }

        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 24px;
        }

        .cancel-button,
        .save-button {
          border-radius: 9px;
          padding: 11px 18px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }

        .cancel-button {
          border: 1px solid #dedfe6;
          background: white;
          color: #656b7a;
        }

        .save-button {
          border: none;
          background: #5b57d9;
          color: white;
        }

        .profile-modal {
          max-width: 760px;
        }

        .profile-top {
          display: flex;
          align-items: center;
          gap: 16px;
          padding-bottom: 20px;
          border-bottom: 1px solid #eceef3;
        }

        .large-avatar {
          width: 66px;
          height: 66px;
          border-radius: 50%;
          background: #eeedff;
          color: #5b57d9;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 23px;
          font-weight: 700;
        }

        .profile-name {
          margin: 0;
          font-size: 22px;
        }

        .profile-condition {
          margin: 5px 0;
          color: #777e8e;
          font-size: 13px;
        }

        .profile-section {
          margin-top: 24px;
        }

        .profile-section h3 {
          margin: 0 0 14px;
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.6px;
          color: #73798a;
        }

        .profile-info-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }

        .profile-info {
          background: #f8f9fc;
          padding: 13px;
          border-radius: 9px;
        }

        .profile-info span {
          display: block;
          color: #8a90a0;
          font-size: 11px;
          margin-bottom: 4px;
        }

        .profile-info strong {
          font-size: 13px;
        }

        .care-plan {
          border: 1px solid #eceef3;
          border-radius: 10px;
          overflow: hidden;
        }

        .care-plan-row {
          display: flex;
          justify-content: space-between;
          gap: 15px;
          padding: 13px 15px;
          border-bottom: 1px solid #eceef3;
          font-size: 13px;
        }

        .care-plan-row:last-child {
          border-bottom: none;
        }

        .completed {
          color: #279766;
          font-weight: 600;
        }

        .pending {
          color: #a87920;
          font-weight: 600;
        }

        .missed {
          color: #d45c5c;
          font-weight: 600;
        }

        .profile-note {
          background: #f8f9fc;
          padding: 14px;
          border-radius: 10px;
          color: #676d7c;
          font-size: 13px;
          line-height: 1.6;
        }

        @media (max-width: 900px) {
          .patient-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 650px) {
          .patient-page {
            padding: 20px;
          }

          .patient-header,
          .patient-toolbar {
            flex-direction: column;
            align-items: stretch;
          }

          .form-grid,
          .profile-info-grid {
            grid-template-columns: 1fr;
          }

          .form-group.full {
            grid-column: auto;
          }

          .patient-card-footer {
            align-items: flex-start;
            flex-direction: column;
          }
        }
      `}</style>

      <div className="patient-header">
        <div>
          <h1 className="patient-title">Patients</h1>
          <p className="patient-subtitle">
            Manage patients connected to your care circle.
          </p>
        </div>

        <button className="add-patient-button" onClick={openAddForm}>
          + Add Patient
        </button>
      </div>

      <div className="patient-toolbar">
        <div className="search-box">
          <span>⌕</span>

          <input
            type="text"
            placeholder="Search patient or condition..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className="patient-count">
          {filteredPatients.length} patient
          {filteredPatients.length !== 1 ? "s" : ""}
        </div>
      </div>

      {filteredPatients.length === 0 ? (
        <div className="empty-state">
          <h3>No patients found</h3>
          <p>Try another search or add a new patient.</p>
        </div>
      ) : (
        <div className="patient-grid">
          {filteredPatients.map((patient) => (
            <div className="patient-card" key={patient.id}>
              <div className="patient-card-top">
                <div className="patient-identity">
                  <div className="patient-avatar">
                    {patient.name.charAt(0)}
                  </div>

                  <div>
                    <h2 className="patient-name">{patient.name}</h2>

                    <p className="patient-basic">
                      {patient.age} years • {patient.gender}
                    </p>

                    <p className="patient-basic">
                      {patient.condition}
                    </p>
                  </div>
                </div>

                <span
                  className={`status ${
                    patient.status === "Attention"
                      ? "attention"
                      : "stable"
                  }`}
                >
                  {patient.status}
                </span>
              </div>

              <div className="patient-stats">
                <div className="stat-box">
                  <div className="stat-label">Medication</div>
                  <div className="stat-value">
                    {patient.medication}
                  </div>
                </div>

                <div className="stat-box">
                  <div className="stat-label">Last activity</div>
                  <div className="stat-value">
                    {patient.lastActivity}
                  </div>
                </div>
              </div>

              <div className="progress-wrapper">
                <div className="progress-header">
                  <span>Today's care completion</span>
                  <strong>{patient.careCompletion}%</strong>
                </div>

                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${patient.careCompletion}%` }}
                  />
                </div>
              </div>

              <div className="patient-card-footer">
                <span className="last-activity">
                  Care circle active
                </span>

                <div className="card-actions">
                  <button
                    className="secondary-button"
                    onClick={() => openEditForm(patient)}
                  >
                    Edit
                  </button>

                  <button
                    className="secondary-button"
                    onClick={() => setSelectedPatient(patient)}
                  >
                    View Profile
                  </button>

                  <button
                    className="primary-outline-button"
                    onClick={() => switchPatient(patient)}
                  >
                    Switch
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ADD / EDIT PATIENT MODAL */}
      {showAddForm && (
        <div
          className="modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowAddForm(false);
            }
          }}
        >
          <div className="modal">
            <div className="modal-header">
              <h2>
                {editingPatient ? "Edit Patient" : "Add Patient"}
              </h2>

              <button
                className="close-button"
                onClick={() => setShowAddForm(false)}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Full Name *</label>

                  <input
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="Enter patient name"
                  />
                </div>

                <div className="form-group">
                  <label>Age *</label>

                  <input
                    type="number"
                    name="age"
                    value={form.age}
                    onChange={handleChange}
                    placeholder="Enter age"
                    min="1"
                  />
                </div>

                <div className="form-group">
                  <label>Gender</label>

                  <select
                    name="gender"
                    value={form.gender}
                    onChange={handleChange}
                  >
                    <option>Female</option>
                    <option>Male</option>
                    <option>Other</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Medical Condition *</label>

                  <input
                    name="condition"
                    value={form.condition}
                    onChange={handleChange}
                    placeholder="Example: Dementia"
                  />
                </div>

                <div className="form-group">
                  <label>Phone</label>

                  <input
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    placeholder="+91 XXXXX XXXXX"
                  />
                </div>

                <div className="form-group">
                  <label>Emergency Contact</label>

                  <input
                    name="emergencyContact"
                    value={form.emergencyContact}
                    onChange={handleChange}
                    placeholder="Contact name"
                  />
                </div>

                <div className="form-group">
                  <label>Relationship</label>

                  <select
                    name="relationship"
                    value={form.relationship}
                    onChange={handleChange}
                  >
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

                <div className="form-group full">
                  <label>Care Notes</label>

                  <textarea
                    name="notes"
                    value={form.notes}
                    onChange={handleChange}
                    placeholder="Add important care preferences or notes..."
                  />
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="cancel-button"
                  onClick={() => setShowAddForm(false)}
                >
                  Cancel
                </button>

                <button type="submit" className="save-button">
                  {editingPatient ? "Save Changes" : "Save Patient"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PATIENT PROFILE MODAL */}
      {selectedPatient && (
        <div
          className="modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedPatient(null);
            }
          }}
        >
          <div className="modal profile-modal">
            <div className="modal-header">
              <h2>Patient Profile</h2>

              <button
                className="close-button"
                onClick={() => setSelectedPatient(null)}
              >
                ×
              </button>
            </div>

            <div className="profile-top">
              <div className="large-avatar">
                {selectedPatient.name.charAt(0)}
              </div>

              <div>
                <h2 className="profile-name">
                  {selectedPatient.name}
                </h2>

                <p className="profile-condition">
                  {selectedPatient.age} years •{" "}
                  {selectedPatient.gender} •{" "}
                  {selectedPatient.condition}
                </p>

                <span
                  className={`status ${
                    selectedPatient.status === "Attention"
                      ? "attention"
                      : "stable"
                  }`}
                >
                  {selectedPatient.status}
                </span>
              </div>
            </div>

            <div className="profile-section">
              <h3>Personal Information</h3>

              <div className="profile-info-grid">
                <div className="profile-info">
                  <span>Date of Birth</span>
                  <strong>{selectedPatient.dob}</strong>
                </div>

                <div className="profile-info">
                  <span>Phone</span>
                  <strong>{selectedPatient.phone}</strong>
                </div>

                <div className="profile-info">
                  <span>Emergency Contact</span>
                  <strong>
                    {selectedPatient.emergencyContact}
                  </strong>
                </div>

                <div className="profile-info">
                  <span>Relationship</span>
                  <strong>{selectedPatient.relationship}</strong>
                </div>
              </div>
            </div>

            <div className="profile-section">
              <h3>Care Overview</h3>

              <div className="profile-info-grid">
                <div className="profile-info">
                  <span>Today's completion</span>
                  <strong>
                    {selectedPatient.careCompletion}%
                  </strong>
                </div>

                <div className="profile-info">
                  <span>Medication</span>
                  <strong>{selectedPatient.medication}</strong>
                </div>
              </div>
            </div>

            <div className="profile-section">
              <h3>Current Care Plan</h3>

              <div className="care-plan">
                {selectedPatient.carePlan.length === 0 ? (
                  <div className="care-plan-row">
                    <span>No care activities added yet.</span>
                  </div>
                ) : (
                  selectedPatient.carePlan.map((item, index) => (
                    <div className="care-plan-row" key={index}>
                      <span>{item.name}</span>

                      <span
                        className={
                          item.status === "Completed"
                            ? "completed"
                            : item.status === "Missed"
                            ? "missed"
                            : "pending"
                        }
                      >
                        {item.status === "Completed"
                          ? "✓ Completed"
                          : item.status === "Missed"
                          ? "✕ Missed"
                          : "○ Pending"}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="profile-section">
              <h3>Care Notes</h3>

              <div className="profile-note">
                {selectedPatient.notes}
              </div>
            </div>

            <div className="modal-actions">
              <button
                className="cancel-button"
                onClick={() => setSelectedPatient(null)}
              >
                Close
              </button>

              <button
                className="save-button"
                onClick={() => switchPatient(selectedPatient)}
              >
                Switch to Patient
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Patient;