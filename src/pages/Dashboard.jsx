import { Link } from "react-router-dom";
import {
  ArrowRight, AlertTriangle, Users, CheckCircle, RefreshCw,
  Plus, Check, Play, UserCheck, X
} from "lucide-react";
import { usePatient } from "../context/PatientContext";
import { useAuth } from "../context/AuthContext";
import { threadColorFor, initialFor } from "../lib/caregiverColors";
import { careLogTitle } from "../lib/mappers";
import { recalculateCoordinationScore, computeLiveStrainAndScore } from "../lib/coordinationApi";
import { assignTask, reassignTask, setTaskStatus } from "../lib/taskApi";
import { useState } from "react";

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

// ── Priority Banner — shown only when risk is elevated ───────────────────────
function PriorityBanner({ recommendation, missedCount, careCircle }) {
  return (
    <div
      className="wt-priority-banner"
      style={{
        background: "var(--warning-bg)",
        border: "1.5px solid var(--warning)",
        borderRadius: "var(--radius-md)",
        padding: "var(--space-4) var(--space-5)",
        marginBottom: "var(--space-5)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <AlertTriangle size={18} color="var(--warning)" />
        <span style={{ fontWeight: 700, fontSize: 14, color: "var(--warning)" }}>Priority Now</span>
      </div>

      {missedCount > 0 && (
        <p style={{ fontSize: 13, color: "var(--text-primary)" }}>
          <strong>{missedCount} task{missedCount !== 1 ? "s" : ""}</strong> missed today — check Today's Care for details.
        </p>
      )}

      <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>{recommendation}</p>

      {careCircle.length > 1 && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
          <Users size={14} color="var(--text-faint)" />
          <span style={{ fontSize: 12, color: "var(--text-faint)" }}>
            Suggested: share upcoming tasks with{" "}
            {careCircle
              .filter((c) => c.role !== "primary")
              .slice(0, 2)
              .map((c) => c.name.split(" ")[0])
              .join(" or ")}.
          </span>
        </div>
      )}

      <p style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 4 }}>
        Dashboard simplified because coordination workload is elevated. When coordination improves, the full view returns.
      </p>
    </div>
  );
}

function isTaskOverdue(task) {
  if (!task.due_at) return false;
  if (task.status === "completed" || task.status === "cancelled") return false;
  return new Date(task.due_at) < new Date();
}

function Dashboard() {
  const {
    currentPatient,
    careCircle,
    coordinationMetric,
    currentLogs,
    todaysReminders,
    patientTasks,
    myTasks,
    isDetailLoading,
    reloadPatientDetail,
    reloadPatientTasks,
  } = usePatient();
  const { caregiverProfile, user, session } = useAuth();

  const [isRecalculating, setIsRecalculating] = useState(false);
  const [recalculateError, setRecalculateError] = useState("");
  const [recalculateNotice, setRecalculateNotice] = useState("");

  // Tasks state
  const [taskTab, setTaskTab] = useState("my"); // "my" | "all"
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [reassigningTask, setReassigningTask] = useState(null);
  const [reassignTargetCaregiver, setReassignTargetCaregiver] = useState("");
  const [taskActionLoading, setTaskActionLoading] = useState(false);
  const [taskActionError, setTaskActionError] = useState("");

  // New task form state
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDesc, setNewTaskDesc] = useState("");
  const [newTaskCategory, setNewTaskCategory] = useState("medication");
  const [newTaskPriority, setNewTaskPriority] = useState("normal");
  const [newTaskDue, setNewTaskDue] = useState("");
  const [newTaskAssignee, setNewTaskAssignee] = useState("");
  const [newTaskEssential, setNewTaskEssential] = useState(false);

  // Action Path suggestions state
  const [actionDecisions, setActionDecisions] = useState({});
  const handleDecision = (actionId, decision) => {
    setActionDecisions((prev) => ({ ...prev, [actionId]: decision }));
  };

  if (!currentPatient) return (
    <section style={{ padding: 32, maxWidth: 760, margin: "0 auto" }}>
      <h1>Welcome to Continuum</h1>
      <p>No patient is linked to your caregiver account yet. Your dashboard will populate from Supabase after you create a patient care circle or accept an invitation.</p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Link to="/patient" className="wt-button">Set up a patient</Link>
        <Link to="/care-circle" className="wt-button wt-button-secondary">Join or manage a care circle</Link>
      </div>
    </section>
  );

  const isPrimaryCaregiver = careCircle.some(
    (c) => c.id === caregiverProfile?.caregiver_id && c.role === "primary"
  ) || currentPatient?.created_by === caregiverProfile?.caregiver_id;

  // Live Score and Strain Index calculation over rolling 7-day window
  const liveStats = computeLiveStrainAndScore(coordinationMetric?.features, careCircle.length);
  const score = coordinationMetric?.score ?? liveStats.score;
  const strainIndex = liveStats.strainIndex;
  const riskLevel = coordinationMetric?.risk_level ?? liveStats.riskLevel;
  const recommendation =
    coordinationMetric?.recommendation ??
    "Care coordination is active. Monitor daily care logging and task distribution.";

  const isElevated = riskLevel === "elevated" || strainIndex > 50;

  const completed = todaysReminders.filter((r) => r.status === "completed").length;
  const upcoming = todaysReminders.filter((r) => r.status === "upcoming").length;
  const missed = todaysReminders.filter((r) => r.status === "missed").length;

  const recentActivity = currentLogs.slice(0, isElevated ? 3 : 4);
  const firstName = currentPatient?.name ? currentPatient.name.split(" ")[0] : "Caregiver";
  const caregiverFirst = caregiverProfile?.full_name?.split(" ")[0] || "Caregiver";

  async function handleRecalculateScore() {
    if (!currentPatient?.id) return;
    setIsRecalculating(true);
    setRecalculateError("");
    setRecalculateNotice("");
    try {
      await recalculateCoordinationScore({
        patientId: currentPatient.id,
        caregiverId: caregiverProfile?.caregiver_id,
        accessToken: session?.access_token,
      });
      await reloadPatientDetail();
      setRecalculateNotice("Score recalculated.");
    } catch (error) {
      setRecalculateError(error.message || "Could not recalculate the score.");
    } finally {
      setIsRecalculating(false);
    }
  }

  // Task Actions
  async function handleSetTaskStatus(taskId, status) {
    setTaskActionLoading(true);
    setTaskActionError("");
    try {
      await setTaskStatus({ taskId, status });
      await reloadPatientTasks?.();
    } catch (err) {
      setTaskActionError(err.message || "Failed to update task status.");
    } finally {
      setTaskActionLoading(false);
    }
  }

  async function handleCreateTask(e) {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    setTaskActionLoading(true);
    setTaskActionError("");
    try {
      await assignTask({
        patientId: currentPatient.id,
        title: newTaskTitle,
        description: newTaskDesc,
        category: newTaskCategory,
        priority: newTaskPriority,
        dueAt: newTaskDue ? new Date(newTaskDue).toISOString() : null,
        assignedTo: newTaskAssignee || null,
        isEssential: newTaskEssential,
      });
      setShowAssignModal(false);
      setNewTaskTitle("");
      setNewTaskDesc("");
      setNewTaskDue("");
      await reloadPatientTasks?.();
    } catch (err) {
      setTaskActionError(err.message || "Failed to assign task.");
    } finally {
      setTaskActionLoading(false);
    }
  }

  async function handleReassignSubmit(e) {
    e.preventDefault();
    if (!reassigningTask || !reassignTargetCaregiver) return;
    setTaskActionLoading(true);
    setTaskActionError("");
    try {
      await reassignTask({
        taskId: reassigningTask.task_id,
        newAssigneeId: reassignTargetCaregiver,
      });
      setReassigningTask(null);
      setReassignTargetCaregiver("");
      await reloadPatientTasks?.();
    } catch (err) {
      setTaskActionError(err.message || "Failed to reassign task.");
    } finally {
      setTaskActionLoading(false);
    }
  }

  const priorityReminders = isElevated
    ? todaysReminders.filter((r) => r.status === "missed" || r.status === "upcoming").slice(0, 4)
    : todaysReminders;

  const displayedTasks = taskTab === "my" ? myTasks : patientTasks;
  const overdueCount = displayedTasks.filter(isTaskOverdue).length;

  // Rule-based Action Engine suggestions
  const suggestedActions = [
    {
      id: "action-rebalance",
      title: "Workload Task Rebalancing",
      description: "Evening care and medication tasks can be shared across family caregivers to alleviate elevated strain.",
      category: "Workload Balance",
      severity: liveStats.factors.taskImbalance > 30 ? "high" : "normal",
    },
    {
      id: "action-sleep",
      title: "Sleep Log Record Request",
      description: "Night rest data assists the coordination model in monitoring recovery and fatigue levels.",
      category: "Wellbeing Monitoring",
      severity: liveStats.factors.sleepDisruption > 40 ? "high" : "normal",
    },
    {
      id: "action-routine",
      title: "Medication Window Adherence",
      description: "Ensure morning and evening doses are logged within the allowable 30-minute grace window.",
      category: "Adherence Assurance",
      severity: liveStats.factors.missedOverdue > 20 ? "high" : "normal",
    },
  ];

  return (
    <div className="wt-dashboard">
      {/* ---------- Greeting ---------- */}
      <div className="wt-greeting">
        <div>
          <p className="wt-eyebrow">Care overview</p>
          <h1 className="wt-greeting__title">{greetingForNow()}, {caregiverFirst}</h1>
          <p className="wt-greeting__sub">
            Here's how {firstName}'s care is woven together today.
          </p>
        </div>
        <Link to="/timeline" className="wt-btn wt-btn--ghost">
          View timeline <ArrowRight size={16} />
        </Link>
      </div>

      {/* ---------- Elevated priority banner ---------- */}
      {isElevated && (
        <PriorityBanner
          recommendation={recommendation}
          missedCount={missed}
          careCircle={careCircle}
        />
      )}

      {/* ---------- Patient strip ---------- */}
      <div className="wt-patient-strip">
        <div className="wt-patient-strip__identity">
          <div className="wt-patient-avatar">{initialFor(currentPatient?.name || "P")}</div>
          <div>
            <p className="wt-eyebrow">Patient</p>
            <h2>{currentPatient?.name || "No Patient Selected"}</h2>
            <p className="wt-patient-strip__meta">
              {currentPatient?.age ? `${currentPatient.age} years · ` : ""}{currentPatient?.condition || "No details"}
            </p>
            <span
              className={`wt-status wt-status--${
                currentPatient?.status === "Attention" ? "attention" : "stable"
              }`}
            >
              <span className="wt-status__dot" />
              {currentPatient?.careCircleActive ? "Care circle active" : "No active circle"}
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
          <p className="wt-patient-strip__value">{currentPatient?.lastActivity || "None yet"}</p>
          <Link to="/patient" className="wt-link">
            View profile <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      {/* ---------- Today's care + coordination score ---------- */}
      <div className={`wt-grid${isElevated ? " wt-grid--elevated" : ""}`}>
        <div className="wt-card" style={isElevated && missed > 0 ? { borderColor: "var(--danger)", borderWidth: 2 } : {}}>
          <p className="wt-eyebrow">Today's care</p>
          <p className="wt-card__big">{todaysReminders.length}</p>
          <p className="wt-card__label">total tasks today</p>
          <div className="wt-card__footer">
            <span className="wt-pill wt-pill--success">
              <CheckCircle size={11} style={{ marginRight: 3 }} />
              {completed} completed
            </span>
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
              <svg className="wt-pulseline" viewBox="0 0 220 32" preserveAspectRatio="none" aria-hidden="true">
                <polyline
                  points="0,20 24,20 34,6 44,28 56,14 70,20 110,20 122,8 134,26 148,16 160,20 220,20"
                  fill="none"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <p className="wt-card__label wt-capitalize">{riskLevel} risk · Strain Index: {strainIndex}/100</p>
              {!isElevated && <p className="wt-card__note">{recommendation}</p>}
            </>
          ) : (
            <p className="wt-card__label">No coordination score yet today.</p>
          )}
          <button
            type="button"
            className="wt-btn wt-btn--ghost"
            onClick={handleRecalculateScore}
            disabled={isRecalculating || !user?.id || !session?.access_token}
          >
            <RefreshCw size={15} className={isRecalculating ? "wt-spin" : ""} />
            {isRecalculating ? "Recalculating…" : "Recalculate Score"}
          </button>
          {recalculateError && <p className="wt-card__note" role="alert">{recalculateError}</p>}
          {recalculateNotice && <p className="wt-card__note" role="status">{recalculateNotice}</p>}
        </div>
      </div>

      {/* ---------- Action Path & Contributing Factors ---------- */}
      <section className="wt-panel" style={{ padding: "var(--space-5)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)", flexWrap: "wrap", gap: 12 }}>
          <div>
            <p className="wt-eyebrow">Care Action Path</p>
            <h3 style={{ margin: 0 }}>Strain Index & Action Engine</h3>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span className={`wt-pill wt-pill--${riskLevel === "low" ? "success" : riskLevel === "elevated" ? "danger" : "neutral"}`}>
              Strain: {strainIndex} / 100 ({riskLevel})
            </span>
            <span className="wt-pill wt-pill--neutral">Rolling 7-day window</span>
          </div>
        </div>

        {/* Factors Breakdown */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: "var(--space-5)" }}>
          <div style={{ background: "var(--background)", padding: "10px 14px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
            <span style={{ fontSize: 11, color: "var(--text-faint)", fontWeight: 600 }}>Missed / Overdue (25%)</span>
            <p style={{ margin: "4px 0 0", fontSize: 16, fontWeight: 700, color: liveStats.factors.missedOverdue > 25 ? "var(--danger)" : "var(--text-primary)" }}>
              {liveStats.factors.missedOverdue}%
            </p>
          </div>
          <div style={{ background: "var(--background)", padding: "10px 14px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
            <span style={{ fontSize: 11, color: "var(--text-faint)", fontWeight: 600 }}>Workload Volume (20%)</span>
            <p style={{ margin: "4px 0 0", fontSize: 16, fontWeight: 700 }}>{liveStats.factors.workload}%</p>
          </div>
          <div style={{ background: "var(--background)", padding: "10px 14px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
            <span style={{ fontSize: 11, color: "var(--text-faint)", fontWeight: 600 }}>Night Interruptions (15%)</span>
            <p style={{ margin: "4px 0 0", fontSize: 16, fontWeight: 700, color: liveStats.factors.nightInterruptions > 30 ? "var(--warning)" : "var(--text-primary)" }}>
              {liveStats.factors.nightInterruptions}%
            </p>
          </div>
          <div style={{ background: "var(--background)", padding: "10px 14px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
            <span style={{ fontSize: 11, color: "var(--text-faint)", fontWeight: 600 }}>Sleep Disruption (15%)</span>
            <p style={{ margin: "4px 0 0", fontSize: 16, fontWeight: 700 }}>
              {typeof liveStats.factors.sleepDisruption === "number" ? `${liveStats.factors.sleepDisruption}%` : liveStats.factors.sleepDisruption}
            </p>
          </div>
          <div style={{ background: "var(--background)", padding: "10px 14px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
            <span style={{ fontSize: 11, color: "var(--text-faint)", fontWeight: 600 }}>Task Imbalance (15%)</span>
            <p style={{ margin: "4px 0 0", fontSize: 16, fontWeight: 700 }}>{liveStats.factors.taskImbalance}%</p>
          </div>
          <div style={{ background: "var(--background)", padding: "10px 14px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
            <span style={{ fontSize: 11, color: "var(--text-faint)", fontWeight: 600 }}>Late Logging (10%)</span>
            <p style={{ margin: "4px 0 0", fontSize: 16, fontWeight: 700 }}>{liveStats.factors.lateLogging}%</p>
          </div>
        </div>

        {/* Suggested Actions with Accept/Decline */}
        <div>
          <p className="wt-eyebrow" style={{ marginBottom: 8 }}>Suggested Actions (Accept / Decline)</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {suggestedActions.map((act) => {
              const decision = actionDecisions[act.id];
              return (
                <div
                  key={act.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px 16px",
                    background: "var(--surface)",
                    border: "1px solid var(--border-strong)",
                    borderRadius: "var(--radius-md)",
                    flexWrap: "wrap",
                    gap: 12,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 260 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{act.title}</span>
                      <span className="wt-pill wt-pill--neutral" style={{ fontSize: 10 }}>{act.category}</span>
                      {act.severity === "high" && <span className="wt-pill wt-pill--danger" style={{ fontSize: 10 }}>Priority</span>}
                    </div>
                    <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>{act.description}</p>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {decision ? (
                      <span className={`wt-pill wt-pill--${decision === "accepted" ? "success" : "neutral"}`}>
                        {decision === "accepted" ? "✓ Accepted" : "Declined"}
                      </span>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="wt-btn wt-btn--primary"
                          style={{ padding: "6px 14px", fontSize: 12 }}
                          onClick={() => handleDecision(act.id, "accepted")}
                        >
                          <Check size={13} /> Accept
                        </button>
                        <button
                          type="button"
                          className="wt-btn wt-btn--ghost"
                          style={{ padding: "6px 14px", fontSize: 12 }}
                          onClick={() => handleDecision(act.id, "declined")}
                        >
                          <X size={13} /> Decline
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ---------- Tasks Management Section ---------- */}
      <section className="wt-panel" style={{ padding: "var(--space-5)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)", flexWrap: "wrap", gap: 12 }}>
          <div>
            <p className="wt-eyebrow">Care Tasks</p>
            <h3 style={{ margin: 0 }}>
              {taskTab === "my" ? "My Assigned Tasks" : "Shared Circle Tasks"} ({displayedTasks.length})
            </h3>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ display: "flex", background: "var(--background)", borderRadius: "var(--radius-full)", padding: 3, border: "1px solid var(--border)" }}>
              <button
                type="button"
                className={`wt-btn ${taskTab === "my" ? "wt-btn--primary" : "wt-btn--ghost"}`}
                style={{ padding: "6px 14px", fontSize: 12, border: "none" }}
                onClick={() => setTaskTab("my")}
              >
                My Tasks ({myTasks.length})
              </button>
              <button
                type="button"
                className={`wt-btn ${taskTab === "all" ? "wt-btn--primary" : "wt-btn--ghost"}`}
                style={{ padding: "6px 14px", fontSize: 12, border: "none" }}
                onClick={() => setTaskTab("all")}
              >
                Shared Circle ({patientTasks.length})
              </button>
            </div>

            {isPrimaryCaregiver && (
              <button
                type="button"
                className="wt-btn wt-btn--primary"
                style={{ padding: "8px 16px", fontSize: 13 }}
                onClick={() => setShowAssignModal(true)}
              >
                <Plus size={15} /> Assign Task
              </button>
            )}
          </div>
        </div>

        {taskActionError && (
          <div className="wt-form-error" role="alert" style={{ marginBottom: 16 }}>
            {taskActionError}
          </div>
        )}

        {overdueCount > 0 && (
          <div style={{ padding: "8px 14px", background: "var(--danger-bg)", color: "var(--danger)", borderRadius: "var(--radius-sm)", marginBottom: 14, fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
            <AlertTriangle size={15} />
            <span><strong>{overdueCount} task{overdueCount !== 1 ? "s" : ""} overdue</strong> — requires prompt attention.</span>
          </div>
        )}

        {displayedTasks.length === 0 ? (
          <p className="wt-empty">
            {taskTab === "my" ? "You have no tasks assigned right now." : "No care tasks logged for this circle."}
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {displayedTasks.map((t) => {
              const overdue = isTaskOverdue(t);
              const isMine = t.assigned_to === caregiverProfile?.caregiver_id;
              const assigneeName = t.assignee?.full_name || "Unassigned";

              return (
                <div
                  key={t.task_id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "14px 18px",
                    background: "var(--surface)",
                    borderRadius: "var(--radius-md)",
                    border: overdue ? "1.5px solid var(--danger)" : "1px solid var(--border)",
                    boxShadow: "var(--shadow-sm)",
                    flexWrap: "wrap",
                    gap: 12,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 260 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, fontSize: 15 }}>{t.title}</span>
                      <span className="wt-pill wt-pill--neutral" style={{ fontSize: 10, textTransform: "capitalize" }}>
                        {t.category || "General"}
                      </span>
                      {t.priority === "high" && (
                        <span className="wt-pill wt-pill--danger" style={{ fontSize: 10 }}>High</span>
                      )}
                      {t.is_essential && (
                        <span className="wt-pill wt-pill--success" style={{ fontSize: 10 }}>Essential</span>
                      )}
                      {overdue && (
                        <span className="wt-pill wt-pill--danger" style={{ fontSize: 10 }}>Overdue</span>
                      )}
                    </div>

                    {t.description && (
                      <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 6px" }}>
                        {t.description}
                      </p>
                    )}

                    <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 12, color: "var(--text-faint)" }}>
                      <span>Assigned to: <strong>{assigneeName}</strong></span>
                      {t.due_at && (
                        <span>Due: {new Date(t.due_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {/* Status Display */}
                    <span
                      className={`wt-pill wt-pill--${
                        t.status === "completed" ? "success" : t.status === "in_progress" ? "warning" : "neutral"
                      }`}
                      style={{ textTransform: "capitalize" }}
                    >
                      {t.status === "in_progress" ? "In Progress" : t.status}
                    </span>

                    {/* Member action buttons on My Tasks */}
                    {isMine && t.status !== "completed" && (
                      <>
                        {t.status === "pending" && (
                          <button
                            type="button"
                            className="wt-btn wt-btn--ghost"
                            style={{ padding: "6px 12px", fontSize: 12 }}
                            onClick={() => handleSetTaskStatus(t.task_id, "in_progress")}
                            disabled={taskActionLoading}
                          >
                            <Play size={12} /> Start
                          </button>
                        )}
                        <button
                          type="button"
                          className="wt-btn wt-btn--primary"
                          style={{ padding: "6px 12px", fontSize: 12 }}
                          onClick={() => handleSetTaskStatus(t.task_id, "completed")}
                          disabled={taskActionLoading}
                        >
                          <Check size={12} /> Complete
                        </button>
                      </>
                    )}

                    {/* Primary Caregiver Reassign Button */}
                    {isPrimaryCaregiver && t.status !== "completed" && (
                      <button
                        type="button"
                        className="wt-btn wt-btn--ghost"
                        style={{ padding: "6px 12px", fontSize: 12 }}
                        onClick={() => {
                          setReassigningTask(t);
                          setReassignTargetCaregiver(t.assigned_to || "");
                        }}
                        disabled={taskActionLoading}
                      >
                        <UserCheck size={12} /> Reassign
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

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
              <p className="wt-eyebrow">{isElevated ? "Urgent" : "Upcoming"}</p>
              <h3>Today's reminders</h3>
            </div>
            {isElevated && (
              <Link to="/daily-care" className="wt-link">
                Log care <ArrowRight size={14} />
              </Link>
            )}
          </div>

          {priorityReminders.length === 0 ? (
            <p className="wt-empty">No medications scheduled today.</p>
          ) : (
            <ul className="wt-reminder-list">
              {priorityReminders.map((r) => (
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

      {/* ---------- Modal: Assign New Task ---------- */}
      {showAssignModal && (
        <div className="wt-modal-overlay">
          <div className="wt-modal">
            <div className="wt-modal-header">
              <h2>Assign Care Task</h2>
              <button
                type="button"
                className="wt-modal-close"
                onClick={() => setShowAssignModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTask}>
              <div className="wt-form-grid">
                <div className="wt-form-group wt-form-group--full">
                  <label>Task Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Afternoon Physiotherapy Exercises"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                  />
                </div>

                <div className="wt-form-group">
                  <label>Category</label>
                  <select
                    value={newTaskCategory}
                    onChange={(e) => setNewTaskCategory(e.target.value)}
                  >
                    <option value="medication">Medication</option>
                    <option value="meal">Meal</option>
                    <option value="activity">Activity</option>
                    <option value="daily_log">Daily Care</option>
                    <option value="appointment">Appointment</option>
                  </select>
                </div>

                <div className="wt-form-group">
                  <label>Priority</label>
                  <select
                    value={newTaskPriority}
                    onChange={(e) => setNewTaskPriority(e.target.value)}
                  >
                    <option value="high">High</option>
                    <option value="normal">Normal</option>
                    <option value="low">Low</option>
                  </select>
                </div>

                <div className="wt-form-group">
                  <label>Assign To (Active Circle Member)</label>
                  <select
                    value={newTaskAssignee}
                    onChange={(e) => setNewTaskAssignee(e.target.value)}
                  >
                    <option value="">Leave Unassigned (Shared)</option>
                    {careCircle.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.role || "Member"})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="wt-form-group">
                  <label>Due Time</label>
                  <input
                    type="datetime-local"
                    value={newTaskDue}
                    onChange={(e) => setNewTaskDue(e.target.value)}
                  />
                </div>

                <div className="wt-form-group wt-form-group--full">
                  <label>Description / Care Instructions</label>
                  <textarea
                    placeholder="Specific instructions or reminders for the assigned caregiver..."
                    value={newTaskDesc}
                    onChange={(e) => setNewTaskDesc(e.target.value)}
                  />
                </div>

                <div className="wt-form-group wt-form-group--full" style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <input
                    type="checkbox"
                    id="newTaskEssential"
                    checked={newTaskEssential}
                    onChange={(e) => setNewTaskEssential(e.target.checked)}
                  />
                  <label htmlFor="newTaskEssential" style={{ cursor: "pointer", margin: 0 }}>
                    Essential care task (requires primary caregiver approval before reassigning)
                  </label>
                </div>
              </div>

              <div className="wt-modal-actions">
                <button
                  type="button"
                  className="wt-btn wt-btn--ghost"
                  onClick={() => setShowAssignModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="wt-btn wt-btn--primary"
                  disabled={taskActionLoading || !newTaskTitle.trim()}
                >
                  {taskActionLoading ? "Assigning…" : "Create & Assign Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------- Modal: Reassign Task ---------- */}
      {reassigningTask && (
        <div className="wt-modal-overlay">
          <div className="wt-modal wt-modal--narrow">
            <div className="wt-modal-header">
              <h2>Reassign Task</h2>
              <button
                type="button"
                className="wt-modal-close"
                onClick={() => setReassigningTask(null)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleReassignSubmit}>
              <p style={{ fontSize: 14, margin: "0 0 16px" }}>
                Reassign <strong>"{reassigningTask.title}"</strong> to an active care circle member:
              </p>

              <div className="wt-form-group" style={{ marginBottom: 20 }}>
                <label>Select Assignee</label>
                <select
                  required
                  value={reassignTargetCaregiver}
                  onChange={(e) => setReassignTargetCaregiver(e.target.value)}
                >
                  <option value="">Select a caregiver...</option>
                  {careCircle.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.role || "Member"})
                    </option>
                  ))}
                </select>
              </div>

              <div className="wt-modal-actions">
                <button
                  type="button"
                  className="wt-btn wt-btn--ghost"
                  onClick={() => setReassigningTask(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="wt-btn wt-btn--primary"
                  disabled={taskActionLoading || !reassignTargetCaregiver}
                >
                  {taskActionLoading ? "Reassigning…" : "Confirm Reassignment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
