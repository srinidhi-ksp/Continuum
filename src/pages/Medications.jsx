import React, { useState } from "react";
import { usePatient } from "../context/PatientContext";
import { PlusCircle, Pill, CheckCircle, XCircle, Edit2, X } from "lucide-react";

const EMPTY_MED = {
  name: "", brand: "", dosage: "", frequency: "Once daily",
  scheduledTime: "", startDate: "", endDate: "", purpose: "", active: true,
};

const FREQUENCIES = [
  "Once daily", "Twice daily", "3x daily", "4x daily",
  "Every 6 hours", "Every 8 hours", "As needed", "Weekly",
];

function Medications() {
  const { currentPatient, currentMedications, setCurrentMedications } = usePatient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null); // medication id being edited
  const [form, setForm] = useState(EMPTY_MED);
  const [filterActive, setFilterActive] = useState("all"); // all | active | inactive

  const activeMeds = currentMedications.filter(m => m.active);
  const inactiveMeds = currentMedications.filter(m => !m.active);
  const displayed =
    filterActive === "active" ? activeMeds :
    filterActive === "inactive" ? inactiveMeds :
    currentMedications;

  const openAdd = () => { setForm(EMPTY_MED); setEditing(null); setShowForm(true); };
  const openEdit = (med) => { setForm({ ...med }); setEditing(med.id); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditing(null); };

  const handleChange = (e) => setForm(p => ({ ...p, [e.target.name]: e.target.value }));
  const handleToggle = (id) =>
    setCurrentMedications(prev => prev.map(m => m.id === id ? { ...m, active: !m.active } : m));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name || !form.dosage) { alert("Medicine name and dosage are required."); return; }
    if (editing) {
      setCurrentMedications(prev => prev.map(m => m.id === editing ? { ...form, id: editing } : m));
    } else {
      setCurrentMedications(prev => [{ ...form, id: `m-${Date.now()}` }, ...prev]);
    }
    closeForm();
  };

  const inputStyle = {
    width: "100%", border: "1px solid #dfe2e9", borderRadius: 9,
    padding: "10px 12px", fontSize: 13, outline: "none", background: "white",
    fontFamily: "inherit", boxSizing: "border-box",
  };
  const labelStyle = { fontSize: 12, fontWeight: 600, color: "#555b6d", display: "block", marginBottom: 5 };

  return (
    <div style={{ padding: 32, minHeight: "100%", background: "#f7f8fc", fontFamily: "Inter, Arial, sans-serif", boxSizing: "border-box" }}>

      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: "#172033" }}>Medications</h1>
          <p style={{ margin: "6px 0 0", color: "#72798a", fontSize: 14 }}>
            Managing medications for <strong>{currentPatient.name}</strong>
          </p>
        </div>
        <button
          onClick={openAdd}
          style={{ display: "flex", alignItems: "center", gap: 7, background: "#5b57d9", color: "white", border: "none", borderRadius: 10, padding: "11px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
        >
          <PlusCircle size={17} /> Add Medication
        </button>
      </div>

      {/* STATS ROW */}
      <div style={{ display: "flex", gap: 14, marginBottom: 24 }}>
        {[
          { label: "Total", count: currentMedications.length, color: "#5b57d9", bg: "#eeedff" },
          { label: "Active", count: activeMeds.length, color: "#1a9a5c", bg: "#e8f8f0" },
          { label: "Inactive", count: inactiveMeds.length, color: "#777e8e", bg: "#f0f1f5" },
        ].map(s => (
          <div key={s.label} style={{ background: "white", border: "1px solid #e4e6ed", borderRadius: 12, padding: "14px 20px", minWidth: 100 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#8a90a0", letterSpacing: "0.5px", marginBottom: 4 }}>{s.label.toUpperCase()}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.count}</div>
          </div>
        ))}
      </div>

      {/* FILTER TABS */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
        {["all", "active", "inactive"].map(f => (
          <button
            key={f}
            onClick={() => setFilterActive(f)}
            style={{
              padding: "7px 16px", borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: "pointer", border: "none",
              background: filterActive === f ? "#5b57d9" : "#eeeff4",
              color: filterActive === f ? "white" : "#555b6d",
            }}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* MEDICATION LIST */}
      {displayed.length === 0 ? (
        <div style={{ background: "white", border: "1px solid #e4e6ed", borderRadius: 16, padding: "50px 20px", textAlign: "center", color: "#8a90a0" }}>
          <Pill size={32} style={{ marginBottom: 12, opacity: 0.4 }} />
          <p style={{ margin: 0, fontSize: 15 }}>No medications in this category.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {displayed.map(med => (
            <div key={med.id} style={{
              background: "white", border: `1px solid ${med.active ? "#e4e6ed" : "#eceef3"}`,
              borderRadius: 14, padding: "18px 22px",
              opacity: med.active ? 1 : 0.65,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center",
                    background: med.active ? "#eeedff" : "#f0f1f5", flexShrink: 0,
                  }}>
                    <Pill size={20} color={med.active ? "#5b57d9" : "#9199a8"} />
                  </div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#172033" }}>{med.name}</h3>
                      <span style={{ fontSize: 11, fontWeight: 700, color: med.active ? "#1a9a5c" : "#777e8e", background: med.active ? "#e8f8f0" : "#eceef3", borderRadius: 20, padding: "2px 8px" }}>
                        {med.active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    {med.brand && <div style={{ fontSize: 12, color: "#8a90a0", marginTop: 2 }}>Brand: {med.brand}</div>}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => openEdit(med)} style={{ background: "#f3f4f8", border: "none", borderRadius: 8, padding: "7px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: "#555b6d" }}>
                    <Edit2 size={13} /> Edit
                  </button>
                  <button
                    onClick={() => handleToggle(med.id)}
                    style={{ background: med.active ? "#fff3f3" : "#e8f8f0", border: "none", borderRadius: 8, padding: "7px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: med.active ? "#d45c5c" : "#1a9a5c" }}
                  >
                    {med.active ? <><XCircle size={13} /> Deactivate</> : <><CheckCircle size={13} /> Activate</>}
                  </button>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginTop: 16 }}>
                {[
                  { label: "DOSAGE", value: med.dosage },
                  { label: "FREQUENCY", value: med.frequency },
                  { label: "SCHEDULED TIME", value: med.scheduledTime || "—" },
                  { label: "START DATE", value: med.startDate ? new Date(med.startDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—" },
                ].map(item => (
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

      {/* ADD / EDIT MODAL */}
      {showForm && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(18,23,37,0.42)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 1000 }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) closeForm(); }}
        >
          <div style={{ width: "100%", maxWidth: 640, maxHeight: "90vh", overflowY: "auto", background: "white", borderRadius: 18, padding: 28, boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
              <h2 style={{ margin: 0, fontSize: 20 }}>{editing ? "Edit Medication" : "Add Medication"}</h2>
              <button onClick={closeForm} style={{ width: 34, height: 34, border: "none", borderRadius: "50%", background: "#f1f2f6", cursor: "pointer", fontSize: 17, color: "#656b7a", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                {[
                  { label: "Medicine Name *", name: "name", placeholder: "e.g. Donepezil", full: false },
                  { label: "Brand Name", name: "brand", placeholder: "e.g. Aricept", full: false },
                  { label: "Dosage *", name: "dosage", placeholder: "e.g. 10mg", full: false },
                  { label: "Scheduled Time", name: "scheduledTime", placeholder: "e.g. 08:00 AM", full: false },
                  { label: "Start Date", name: "startDate", type: "date", full: false },
                  { label: "End Date", name: "endDate", type: "date", full: false },
                ].map(f => (
                  <div key={f.name} style={f.full ? { gridColumn: "1 / -1" } : {}}>
                    <label style={labelStyle}>{f.label}</label>
                    <input
                      name={f.name} type={f.type || "text"}
                      value={form[f.name]} onChange={handleChange}
                      placeholder={f.placeholder}
                      style={inputStyle}
                    />
                  </div>
                ))}

                <div>
                  <label style={labelStyle}>Frequency</label>
                  <select name="frequency" value={form.frequency} onChange={handleChange} style={inputStyle}>
                    {FREQUENCIES.map(f => <option key={f}>{f}</option>)}
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Status</label>
                  <select name="active" value={String(form.active)} onChange={(e) => setForm(p => ({ ...p, active: e.target.value === "true" }))} style={inputStyle}>
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={labelStyle}>Purpose / Description</label>
                  <textarea
                    name="purpose" value={form.purpose} onChange={handleChange}
                    placeholder="Reason this medication is prescribed..."
                    style={{ ...inputStyle, minHeight: 72, resize: "vertical" }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 22 }}>
                <button type="button" onClick={closeForm} style={{ border: "1px solid #dedfe6", background: "white", color: "#656b7a", borderRadius: 9, padding: "10px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  Cancel
                </button>
                <button type="submit" style={{ background: "#5b57d9", color: "white", border: "none", borderRadius: 9, padding: "10px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  {editing ? "Save Changes" : "Add Medication"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Medications;
