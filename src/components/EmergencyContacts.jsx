/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from "react";
import { Phone, PlusCircle, Pencil, Trash2, ArrowDown, ArrowUp, ShieldAlert } from "lucide-react";
import {
  fetchEmergencyContacts,
  addEmergencyContact,
  updateEmergencyContact,
  deleteEmergencyContact,
} from "../lib/emergencyContactApi";

const EMPTY_FORM = { name: "", relation: "", phone: "", priority: "" };

function ContactForm({ initial, onSave, onCancel, isSaving }) {
  const [form, setForm] = useState(initial || EMPTY_FORM);
  const [err, setErr] = useState("");

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) { setErr("Contact name is required."); return; }
    setErr("");
    await onSave(form);
  }

  const inp = {
    width: "100%",
    padding: "8px 11px",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
    fontSize: 13,
    background: "var(--surface)",
    color: "var(--text-primary)",
    outline: "none",
  };
  const lbl = {
    display: "block",
    fontSize: 11,
    fontWeight: 600,
    color: "var(--text-secondary)",
    marginBottom: 4,
  };

  return (
    <form onSubmit={handleSubmit}
      style={{
        background: "var(--surface-warm)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        padding: 16,
        marginBottom: 12,
      }}
    >
      {err && (
        <p style={{ fontSize: 12, color: "var(--danger)", marginBottom: 10 }}>{err}</p>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
        <div>
          <label style={lbl}>Name *</label>
          <input style={inp} name="name" value={form.name} onChange={handleChange} placeholder="Dr. Meenakshi" />
        </div>
        <div>
          <label style={lbl}>Relationship</label>
          <input style={inp} name="relation" value={form.relation} onChange={handleChange} placeholder="Neurologist" />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
        <div>
          <label style={lbl}>Phone</label>
          <input style={inp} name="phone" value={form.phone} onChange={handleChange} placeholder="+91 98765 43210" type="tel" />
        </div>
        <div>
          <label style={lbl}>Priority (1 = highest)</label>
          <input style={inp} name="priority" value={form.priority} onChange={handleChange} placeholder="1" type="number" min="1" />
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" disabled={isSaving} className="wt-btn wt-btn--primary wt-btn--sm">
          {isSaving ? "Saving…" : "Save Contact"}
        </button>
        <button type="button" className="wt-btn wt-btn--ghost wt-btn--sm" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function EmergencyContacts({ patientId }) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = () => setRefreshKey((k) => k + 1);

  useEffect(() => {
    if (!patientId) return;
    let cancelled = false;
    setLoading(true);
    fetchEmergencyContacts(patientId)
      .then((data) => { if (!cancelled) setContacts(data); })
      .catch((e) => { if (!cancelled) setError(e.message || "Failed to load contacts."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [patientId, refreshKey]);

  async function handleAdd(form) {
    setIsSaving(true);
    try {
      await addEmergencyContact({
        patientId,
        name: form.name,
        relation: form.relation,
        phone: form.phone,
        priority: form.priority ? Number(form.priority) : contacts.length + 1,
      });
      setShowAddForm(false);
      refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleEdit(contactId, form) {
    setIsSaving(true);
    try {
      await updateEmergencyContact(contactId, {
        name: form.name,
        relation: form.relation,
        phone: form.phone,
        priority: form.priority ? Number(form.priority) : undefined,
      });
      setEditingId(null);
      refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(contactId) {
    if (!window.confirm("Remove this emergency contact?")) return;
    try {
      await deleteEmergencyContact(contactId);
      refresh();
    } catch (e) {
      setError(e.message);
    }
  }

  async function shiftPriority(contact, direction) {
    const newPriority = contact.priority + direction;
    if (newPriority < 1) return;
    try {
      await updateEmergencyContact(contact.contact_id, { priority: newPriority });
      refresh();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="wt-panel" style={{ marginTop: 24 }}>
      <div className="wt-panel__header">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ShieldAlert size={18} color="var(--danger)" />
          <div>
            <p className="wt-eyebrow">Emergency</p>
            <h3>Emergency Contacts</h3>
          </div>
        </div>
        <button
          className="wt-btn wt-btn--ghost wt-btn--sm"
          onClick={() => { setShowAddForm(true); setEditingId(null); }}
        >
          <PlusCircle size={14} style={{ marginRight: 4 }} /> Add Contact
        </button>
      </div>

      {error && (
        <p style={{ fontSize: 12, color: "var(--danger)", marginBottom: 8 }}>{error}</p>
      )}

      {showAddForm && (
        <ContactForm
          onSave={handleAdd}
          onCancel={() => setShowAddForm(false)}
          isSaving={isSaving}
        />
      )}

      {loading ? (
        <p className="wt-empty">Loading contacts…</p>
      ) : contacts.length === 0 ? (
        <p className="wt-empty">No emergency contacts added yet.</p>
      ) : (
        <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
          {contacts.map((c) => (
            <li key={c.contact_id}>
              {editingId === c.contact_id ? (
                <ContactForm
                  initial={{ name: c.name, relation: c.relation || "", phone: c.phone || "", priority: String(c.priority) }}
                  onSave={(form) => handleEdit(c.contact_id, form)}
                  onCancel={() => setEditingId(null)}
                  isSaving={isSaving}
                />
              ) : (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 14px",
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-sm)",
                  }}
                >
                  <div
                    style={{
                      width: 28, height: 28, borderRadius: "50%",
                      background: c.priority === 1 ? "var(--danger-bg)" : "var(--background)",
                      color: c.priority === 1 ? "var(--danger)" : "var(--text-secondary)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontWeight: 700, fontSize: 12, flexShrink: 0,
                    }}
                  >
                    {c.priority}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 600, fontSize: 13, margin: 0 }}>{c.name}</p>
                    <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>
                      {c.relation || "—"}
                      {c.phone && (
                        <span>
                          {" · "}
                          <Phone size={10} style={{ verticalAlign: "middle", marginRight: 2 }} />
                          {c.phone}
                        </span>
                      )}
                    </p>
                  </div>

                  <div style={{ display: "flex", gap: 4 }}>
                    <button title="Increase priority" className="wt-btn wt-btn--ghost wt-btn--sm" style={{ padding: "4px 6px" }} onClick={() => shiftPriority(c, -1)} disabled={c.priority <= 1}>
                      <ArrowUp size={13} />
                    </button>
                    <button title="Decrease priority" className="wt-btn wt-btn--ghost wt-btn--sm" style={{ padding: "4px 6px" }} onClick={() => shiftPriority(c, 1)}>
                      <ArrowDown size={13} />
                    </button>
                    <button className="wt-btn wt-btn--ghost wt-btn--sm" style={{ padding: "4px 6px" }} onClick={() => setEditingId(c.contact_id)}>
                      <Pencil size={13} />
                    </button>
                    <button className="wt-btn wt-btn--ghost wt-btn--sm" style={{ padding: "4px 6px", color: "var(--danger)" }} onClick={() => handleDelete(c.contact_id)}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
