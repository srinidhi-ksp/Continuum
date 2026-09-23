import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { usePatient } from "../context/PatientContext";
import { threadColorFor, initialFor } from "../lib/caregiverColors";
import { careLogTitle } from "../lib/mappers";

function greetingForNow() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function CaregiverThread({ caregiver }) {
  const color = threadColorFor(caregiver.id);
  return (
    <div
      className="wt-caregiver-chip"
      style={{ background: color.bg, color: color.text }}
      title={`${caregiver.name}${caregiver.role ? ` · ${caregiver.role}` : ""}`}
    >
      {initialFor(caregiver.name)}
    </div>
  );
}

function Dashboard() {
  const { currentPatient, careCircle, coordinationMetric, currentLogs, todaysReminders, isDetailLoading } =
    usePatient();

  // MainLayout already blocks rendering until a patient exists — this is
  // just a defensive fallback, not the real empty-state UI.
  if (!currentPatient) return null;

  const score = coordinationMetric?.score ?? null;
  const riskLevel = coordinationMetric?.risk_level ?? null;
  const recommendation =
    coordinationMetric?.recommendation ??
    "No coordination insight yet — check back once today's activity is logged.";

  const completed = todaysReminders.filter((r) => r.status === "completed").length;
  const upcoming = todaysReminders.filter((r) => r.status === "upcoming").length;
  const missed = todaysReminders.filter((r) => r.status === "missed").length;

  const recentActivity = currentLogs.slice(0, 4);
  const firstName = currentPatient.name.split(" ")[0];

  return (
    <div className="wt-dashboard">
      {/* ---------- Greeting ---------- */}
      <div className="wt-greeting">
        <div>
          <p className="wt-eyebrow">Care overview</p>
          <h1 className="wt-greeting__title">{greetingForNow()}, Srinidhi</h1>
          <p className="wt-greeting__sub">
            Here's how {firstName}'s care is woven together today.
          </p>
        </div>
        <Link to="/timeline" className="wt-btn wt-btn--ghost">
          View timeline <ArrowRight size={16} />
        </Link>
      </div>

      {/* ---------- Patient strip ---------- */}
      <div className="wt-patient-strip">
        <div className="wt-patient-strip__identity">
          <div className="wt-patient-avatar">{initialFor(currentPatient.name)}</div>
          <div>
            <p className="wt-eyebrow">Patient</p>
            <h2>{currentPatient.name}</h2>
            <p className="wt-patient-strip__meta">
              {currentPatient.age} years · {currentPatient.condition}
            </p>
            <span
              className={`wt-status wt-status--${
                currentPatient.status === "Attention" ? "attention" : "stable"
              }`}
            >
              <span className="wt-status__dot" />
              {currentPatient.careCircleActive ? "Care circle active" : "No active caregivers"}
            </span>
          </div>
        </div>

        <div className="wt-patient-strip__threads">
          <p className="wt-eyebrow">Woven by</p>
          <div className="wt-thread-stack">
            {careCircle.length === 0 ? (
              <span className="wt-patient-strip__meta">No caregivers yet</span>
            ) : (
              careCircle.map((c) => <CaregiverThread key={c.id} caregiver={c} />)
            )}
          </div>
          <p className="wt-patient-strip__meta">
            {careCircle.length} caregiver{careCircle.length !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="wt-patient-strip__activity">
          <p className="wt-eyebrow">Last activity</p>
          <p className="wt-patient-strip__value">{currentPatient.lastActivity}</p>
          <Link to="/patient" className="wt-link">
            View profile <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      {/* ---------- Today's care + coordination score ---------- */}
      <div className="wt-grid">
        <div className="wt-card">
          <p className="wt-eyebrow">Today's care</p>
          <p className="wt-card__big">{todaysReminders.length}</p>
          <p className="wt-card__label">total tasks today</p>
          <div className="wt-card__footer">
            <span className="wt-pill wt-pill--success">{completed} completed</span>
            {upcoming > 0 && <span className="wt-pill wt-pill--neutral">{upcoming} upcoming</span>}
            {missed > 0 && <span className="wt-pill wt-pill--danger">{missed} missed</span>}
          </div>
        </div>

        <div className={`wt-card wt-card--score wt-card--score-${riskLevel || "none"}`}>
          <p className="wt-eyebrow">Care coordination</p>
          {score !== null ? (
            <>
              <p className="wt-card__big">
                <span>{score}</span>
                <span className="wt-card__big-unit">/100</span>
              </p>
              {/* Decorative "thread" motif — not a chart of real history yet.
                  Once coordination_metric has several days of rows per
                  patient, swap this for a real sparkline of past scores. */}
              <svg className="wt-pulseline" viewBox="0 0 220 32" preserveAspectRatio="none" aria-hidden="true">
                <polyline
                  points="0,20 24,20 34,6 44,28 56,14 70,20 110,20 122,8 134,26 148,16 160,20 220,20"
                  fill="none"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <p className="wt-card__label wt-capitalize">{riskLevel} risk</p>
              <p className="wt-card__note">{recommendation}</p>
            </>
          ) : (
            <p className="wt-card__label">No coordination score yet today.</p>
          )}
        </div>
      </div>

      {/* ---------- Recent activity + today's reminders ---------- */}
      <div className="wt-two-col">
        <section className="wt-panel">
          <div className="wt-panel__header">
            <div>
              <p className="wt-eyebrow">Recent activity</p>
              <h3>Woven timeline</h3>
            </div>
            <Link to="/timeline" className="wt-link">
              View all <ArrowRight size={14} />
            </Link>
          </div>

          {isDetailLoading && recentActivity.length === 0 ? (
            <p className="wt-empty">Loading recent activity…</p>
          ) : recentActivity.length === 0 ? (
            <p className="wt-empty">Nothing logged yet today.</p>
          ) : (
            <ul className="wt-activity-list">
              {recentActivity.map((log) => {
                const color = threadColorFor(log.caregiver_id);
                return (
                  <li
                    key={log.log_id}
                    className="wt-activity-item"
                    style={{ borderLeftColor: color.line }}
                  >
                    <div
                      className="wt-activity-item__marker"
                      style={{ background: color.bg, color: color.text }}
                    >
                      {initialFor(log.caregiver?.full_name)}
                    </div>
                    <div className="wt-activity-item__body">
                      <p className="wt-activity-item__title">{careLogTitle(log)}</p>
                      {log.notes && <p className="wt-activity-item__notes">{log.notes}</p>}
                      <p className="wt-activity-item__meta">
                        {log.caregiver?.full_name || "Unknown"} ·{" "}
                        {new Date(log.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="wt-panel wt-panel--reminders">
          <div className="wt-panel__header">
            <div>
              <p className="wt-eyebrow">Upcoming</p>
              <h3>Today's reminders</h3>
            </div>
          </div>

          {todaysReminders.length === 0 ? (
            <p className="wt-empty">No medications scheduled today.</p>
          ) : (
            <ul className="wt-reminder-list">
              {todaysReminders.map((r) => (
                <li key={r.id} className={`wt-reminder wt-reminder--${r.status}`}>
                  <span className="wt-reminder__time">{r.time}</span>
                  <div className="wt-reminder__body">
                    <p className="wt-reminder__title">{r.title}</p>
                    <p className="wt-reminder__subtitle">{r.subtitle}</p>
                  </div>
                  <span className="wt-reminder__status">{r.status}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

export default Dashboard;
