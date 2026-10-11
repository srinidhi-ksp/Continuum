import { useRef, useState, useEffect, useCallback } from "react";
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MessageCircle,
  Moon,
  MoreHorizontal,
  Pill,
  Smile,
  Sparkles,
  Stethoscope,
  Utensils,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePatient } from "../context/PatientContext";
import { fetchTimelineEvents, addTimelineComment } from "../lib/timelineApi";

function formatDateForInput(date) {
  return date.toISOString().split("T")[0];
}

function formatDisplayDate(dateString) {
  if (!dateString) return "";
  const date = new Date(`${dateString}T00:00:00`);
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatDay(dateString) {
  if (!dateString) return "";
  const today = formatDateForInput(new Date());
  if (dateString === today) return "Today";
  const date = new Date(`${dateString}T00:00:00`);
  return date.toLocaleDateString("en-IN", { weekday: "long" });
}

function shiftDate(dateString, days) {
  const dt = new Date(`${dateString}T00:00:00`);
  dt.setDate(dt.getDate() + days);
  const year = dt.getFullYear();
  const month = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const FILTER_CATEGORIES = [
  "All",
  "Medication",
  "Meals",
  "Symptoms",
  "Sleep",
  "Mood",
  "Appointments",
];

const TYPE_ICONS = {
  Food: <Utensils size={19} />,
  Meal: <Utensils size={19} />,
  Sleep: <Moon size={19} />,
  Medication: <Pill size={19} />,
  Mood: <Smile size={19} />,
  Symptom: <AlertCircle size={19} />,
  Appointment: <Stethoscope size={19} />,
};

const TYPE_CLASSES = {
  Food: "food-icon",
  Meal: "food-icon",
  Sleep: "sleep-icon",
  Medication: "medication-icon",
  Mood: "mood-icon",
  Symptom: "symptom-icon",
  Appointment: "appointment-icon",
};

function Timeline() {
  const navigate = useNavigate();
  const { currentPatient } = usePatient();
  const dateInputRef = useRef(null);

  const [selectedDate, setSelectedDate] = useState(formatDateForInput(new Date()));
  const [activeFilter, setActiveFilter] = useState("All");
  const [allEvents, setAllEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadEvents = useCallback(async () => {
    if (!currentPatient?.id) return;
    setLoading(true);
    try {
      const fetched = await fetchTimelineEvents(currentPatient.id);
      setAllEvents(fetched);
    } catch (err) {
      console.error("[Timeline] Error fetching events:", err);
    } finally {
      setLoading(false);
    }
  }, [currentPatient]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadEvents();
  }, [loadEvents]);

  const handleAddComment = async (eventId, text) => {
    try {
      const newComment = await addTimelineComment(eventId, text);
      setAllEvents((prev) =>
        prev.map((ev) =>
          ev.id === eventId
            ? { ...ev, comments: [...(ev.comments || []), newComment] }
            : ev
        )
      );
    } catch (err) {
      console.error("[Timeline] Failed to add comment:", err);
      alert("Failed to add comment: " + err.message);
    }
  };

  const openCalendar = () => {
    if (dateInputRef.current) {
      dateInputRef.current.showPicker();
    }
  };

  const handleDateChange = (event) => {
    setSelectedDate(event.target.value);
  };

  const handlePrevDay = () => setSelectedDate((prev) => shiftDate(prev, -1));
  const handleNextDay = () => setSelectedDate((prev) => shiftDate(prev, 1));

  const rawEvents = allEvents.filter((ev) => ev.dateKey === selectedDate);

  const filteredEvents = rawEvents.filter((event) => {
    if (activeFilter === "All") return true;
    if (activeFilter === "Meals") return event.type === "Food" || event.type === "Meal";
    if (activeFilter === "Symptoms") return event.type === "Symptom" || event.type === "Symptoms";
    if (activeFilter === "Appointments") return event.type === "Appointment" || event.type === "Appointments";
    return event.type === activeFilter;
  });

  return (
    <div className="timeline-page">
      {/* PAGE HEADER */}
      <div className="timeline-page-header">
        <div>
          <span className="section-label">PATIENT TIMELINE</span>
          <h1>Care Timeline</h1>
          <p>
            A shared chronological record of {currentPatient ? currentPatient.name : "Patient"}'s care.
          </p>
        </div>

        {/* DATE BUTTON WITH NAV ARROWS */}
        <div className="timeline-date-wrapper" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            className="timeline-date-button"
            style={{ padding: "8px 10px", minWidth: "auto" }}
            onClick={handlePrevDay}
            title="Previous Day"
          >
            <ChevronLeft size={16} />
          </button>

          <button className="timeline-date-button" onClick={openCalendar}>
            <CalendarDays size={17} />
            {formatDay(selectedDate)}
          </button>

          <button
            className="timeline-date-button"
            style={{ padding: "8px 10px", minWidth: "auto" }}
            onClick={handleNextDay}
            title="Next Day"
          >
            <ChevronRight size={16} />
          </button>

          <input
            ref={dateInputRef}
            type="date"
            value={selectedDate}
            onChange={handleDateChange}
            className="hidden-date-input"
          />
        </div>
      </div>

      {/* PATIENT BAR */}
      {currentPatient && (
        <div className="timeline-patient-bar">
          <div className="timeline-patient-left">
            <div className="timeline-patient-avatar">{currentPatient.name.charAt(0)}</div>
            <div>
              <h2>{currentPatient.name}</h2>
              <div className="timeline-patient-meta">
                <span>{currentPatient.age} years</span>
                <span className="meta-dot">•</span>
                <span>{currentPatient.condition}</span>
                <span className="timeline-active-status">
                  <span></span>
                  Care circle active
                </span>
              </div>
            </div>
          </div>

          <button className="patient-link-button" onClick={() => navigate("/patient")}>
            View Patient <ArrowRight size={15} />
          </button>
        </div>
      )}

      {/* DATE HEADING */}
      <div className="timeline-date-heading">
        <div className="timeline-date-line"></div>
        <div className="timeline-date">
          <span>{formatDay(selectedDate)}</span>
          <small>{formatDisplayDate(selectedDate)}</small>
        </div>
        <div className="timeline-date-line"></div>
      </div>

      {/* EVENT FILTER TABS */}
      <div
        className="timeline-filters"
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          marginBottom: 20,
        }}
      >
        {FILTER_CATEGORIES.map((cat) => {
          const isActive = activeFilter === cat;
          return (
            <button
              key={cat}
              onClick={() => setActiveFilter(cat)}
              style={{
                padding: "6px 14px",
                borderRadius: 20,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                border: "none",
                background: isActive ? "#5b57d9" : "#eeeff4",
                color: isActive ? "#ffffff" : "#555b6d",
                transition: "all 0.15s ease",
              }}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* TIMELINE EVENTS LIST */}
      {loading ? (
        <div className="timeline-empty">
          <p>Loading timeline events from Supabase…</p>
        </div>
      ) : filteredEvents.length > 0 ? (
        <div className="timeline-container">
          {filteredEvents.map((event) => (
            <TimelineEvent
              key={event.id}
              {...event}
              icon={TYPE_ICONS[event.type] || <Clock3 size={19} />}
              iconClass={TYPE_CLASSES[event.type] || "sleep-icon"}
              onAddComment={(text) => handleAddComment(event.id, text)}
            />
          ))}
        </div>
      ) : (
        <div className="timeline-empty">
          <div className="timeline-empty-icon">
            <Clock3 size={22} />
          </div>
          <h3>No care activity recorded</h3>
          <p>
            {rawEvents.length > 0
              ? `No ${activeFilter.toLowerCase()} events recorded for ${formatDisplayDate(selectedDate)}.`
              : `There are no timeline events recorded for ${formatDisplayDate(selectedDate)}.`}
          </p>
        </div>
      )}

      {/* TIMELINE PRINCIPLE */}
      <div className="timeline-principle">
        <div className="principle-icon">
          <Clock3 size={18} />
        </div>
        <div>
          <strong>One shared record of care</strong>
          <p>
            Every care activity is recorded as a timeline event, keeping the entire care circle informed without relying on separate conversations.
          </p>
        </div>
      </div>
    </div>
  );
}

function TimelineEvent({
  time,
  type,
  icon,
  iconClass,
  title,
  description,
  caregiver,
  comments = [],
  completed = false,
  isAutomated = false,
  countedInPattern = false,
  onAddComment,
}) {
  const isSystem = caregiver === "CONTINUUM" || isAutomated;
  const [commentOpen, setCommentOpen] = useState(false);
  const [draft, setDraft] = useState("");

  const handleSubmit = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onAddComment(trimmed);
    setDraft("");
    setCommentOpen(false);
  };

  return (
    <div className="timeline-event">
      <div className="timeline-event-time">{time}</div>

      <div className="timeline-marker-column">
        <div className={`timeline-event-icon ${iconClass}`}>{icon}</div>
        <div className="timeline-connector"></div>
      </div>

      <div className="timeline-event-card">
        <div className="timeline-event-header">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="timeline-event-type">{type}</span>
              {isSystem && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: "#6d738a",
                    background: "#f0f1f7",
                    borderRadius: 12,
                    padding: "2px 7px",
                    letterSpacing: "0.3px",
                  }}
                >
                  Automated
                </span>
              )}
            </div>
            <h3>{title}</h3>
          </div>

          <button className="event-menu">
            <MoreHorizontal size={18} />
          </button>
        </div>

        {description && <p className="timeline-event-description">{description}</p>}

        {(countedInPattern || type === "Symptom") && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              marginTop: 6,
              marginBottom: 8,
              fontSize: 11,
              fontWeight: 600,
              color: "#5b57d9",
              background: "#eeedff",
              borderRadius: 6,
              padding: "3px 8px",
            }}
          >
            <Sparkles size={13} />
            <span>Counted in today's care pattern</span>
          </div>
        )}

        <div className="timeline-event-footer">
          <div className="event-caregiver">
            <div className="small-avatar">{isSystem ? "C" : caregiver.charAt(0)}</div>
            <span>
              Added by <strong>{caregiver}</strong>
            </span>
          </div>

          {completed && (
            <div className="event-completed">
              <Check size={13} />
              Completed
            </div>
          )}
        </div>

        <div className={comments.length > 0 || commentOpen ? "event-comments" : undefined}>
          {comments.length > 0 && (
            <>
              <div className="comments-heading">
                <MessageCircle size={15} />
                <span>
                  {comments.length} {comments.length === 1 ? "Comment" : "Comments"}
                </span>
              </div>

              {comments.map((comment, index) => (
                <div className="timeline-comment" key={comment.id || index}>
                  <div className="comment-avatar">{comment.name.charAt(0)}</div>
                  <div className="comment-content">
                    <strong>{comment.name}</strong>
                    <p>{comment.text}</p>
                  </div>
                </div>
              ))}
            </>
          )}

          {commentOpen ? (
            <div style={{ display: "flex", gap: 8, marginTop: comments.length > 0 ? 10 : 0, alignItems: "flex-start" }}>
              <div className="comment-avatar" style={{ marginTop: 2 }}>You</div>
              <div style={{ flex: 1 }}>
                <textarea
                  autoFocus
                  rows={2}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                  placeholder="Add a comment…"
                  style={{
                    width: "100%",
                    padding: "7px 10px",
                    fontSize: 11,
                    border: "1px solid #d4d5e8",
                    borderRadius: 8,
                    resize: "none",
                    outline: "none",
                    background: "white",
                    lineHeight: 1.5,
                    fontFamily: "inherit",
                    color: "#374151",
                    boxSizing: "border-box",
                  }}
                />
                <div style={{ display: "flex", gap: 6, marginTop: 5 }}>
                  <button
                    onClick={handleSubmit}
                    style={{
                      padding: "5px 12px",
                      fontSize: 11,
                      fontWeight: 600,
                      background: "#5b57d9",
                      color: "white",
                      border: "none",
                      borderRadius: 7,
                      cursor: "pointer",
                    }}
                  >
                    Post
                  </button>
                  <button
                    onClick={() => {
                      setCommentOpen(false);
                      setDraft("");
                    }}
                    style={{
                      padding: "5px 10px",
                      fontSize: 11,
                      fontWeight: 600,
                      background: "transparent",
                      color: "#8a90a0",
                      border: "1px solid #e2e4ea",
                      borderRadius: 7,
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button
              className="add-comment-link"
              style={{ marginTop: comments.length > 0 ? 4 : 0 }}
              onClick={() => setCommentOpen(true)}
            >
              <MessageCircle size={14} />
              Add comment
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default Timeline;