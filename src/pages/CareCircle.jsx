import { usePatient } from "../context/PatientContext";
import { threadColorFor, initialFor } from "../lib/caregiverColors";

// This page intentionally stays simple for now — it closes the dead
// sidebar link with real data (who's actually in the care circle) rather
// than a fabricated layout. Full redesign (invite flow, role editing,
// activity-per-caregiver) is its own pass, same as Patient/Medications/
// Daily Care/Timeline.
function CareCircle() {
  const { currentPatient, careCircle } = usePatient();

  return (
    <div className="wt-dashboard">
      <div>
        <p className="wt-eyebrow">Care circle</p>
        <h1 className="wt-greeting__title">
          Woven around {currentPatient ? currentPatient.name : "your patient"}
        </h1>
        <p className="wt-greeting__sub">
          Everyone currently coordinating this patient's care.
        </p>
      </div>

      <section className="wt-panel">
        {careCircle.length === 0 ? (
          <p className="wt-empty">No caregivers linked to this patient yet.</p>
        ) : (
          <ul className="wt-activity-list">
            {careCircle.map((c) => {
              const color = threadColorFor(c.id);
              return (
                <li key={c.id} className="wt-activity-item" style={{ borderLeftColor: color.line }}>
                  <div
                    className="wt-activity-item__marker"
                    style={{ background: color.bg, color: color.text, width: 40, height: 40, fontSize: 14 }}
                  >
                    {initialFor(c.name)}
                  </div>
                  <div className="wt-activity-item__body">
                    <p className="wt-activity-item__title">{c.name}</p>
                    <p className="wt-activity-item__meta wt-capitalize">{c.role || "caregiver"}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

export default CareCircle;
