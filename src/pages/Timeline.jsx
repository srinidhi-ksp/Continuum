import { useRef, useState } from "react";
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


/* =====================================================
   MOCK TIMELINE DATA
===================================================== */

const timelineData = {
  "2026-08-18": [
    {
      time: "07:10 AM",
      type: "Sleep",
      icon: <Moon size={19} />,
      iconClass: "sleep-icon",
      title: "Sleep Logged",
      description: "7 hours 20 minutes · Wake 07:10 AM",
      caregiver: "Priya",
      comments: [],
    },
    {
      time: "08:00 AM",
      type: "Food",
      icon: <Utensils size={19} />,
      iconClass: "food-icon",
      title: "Breakfast Logged",
      description: "2 idlis + milk",
      caregiver: "Meera",
      comments: [
        {
          name: "Meera",
          text: "Breakfast was completed normally.",
        },
      ],
    },
    {
      time: "08:15 AM",
      type: "Medication",
      icon: <Pill size={19} />,
      iconClass: "medication-icon",
      title: "Medicine Taken",
      description: "Donepezil 5mg — Taken",
      caregiver: "Arjun",
      completed: true,
      comments: [],
    },
    {
      time: "11:00 AM",
      type: "Symptom",
      icon: <AlertCircle size={19} />,
      iconClass: "symptom-icon",
      title: "Symptom Observed",
      description:
        "Patient appeared confused and asked the same question repeatedly.",
      caregiver: "Meera",
      countedInPattern: true,
      comments: [
        {
          name: "Meera",
          text: "This happened twice today.",
        },
        {
          name: "Arjun",
          text: "I will mention this during tomorrow's doctor visit.",
        },
      ],
    },
    {
      time: "02:30 PM",
      type: "Mood",
      icon: <Smile size={19} />,
      iconClass: "mood-icon",
      title: "Mood Observed",
      description: "Calm and cheerful after afternoon indoor activities.",
      caregiver: "Meera",
      comments: [],
    },
    {
      time: "06:00 PM",
      type: "Appointment",
      icon: <Stethoscope size={19} />,
      iconClass: "appointment-icon",
      title: "Appointment Reminder",
      description:
        "Neurology follow-up tomorrow at 10:30 AM.",
      caregiver: "CONTINUUM",
      isAutomated: true,
      comments: [],
    },
  ],

  "2026-08-17": [
    {
      time: "08:10 AM",
      type: "Food",
      icon: <Utensils size={19} />,
      iconClass: "food-icon",
      title: "Breakfast Logged",
      description: "2 dosas + tea",
      caregiver: "Meera",
      comments: [],
    },
    {
      time: "09:00 AM",
      type: "Medication",
      icon: <Pill size={19} />,
      iconClass: "medication-icon",
      title: "Medicine Taken",
      description: "Donepezil 5mg — Taken",
      caregiver: "Meera",
      completed: true,
      comments: [],
    },
    {
      time: "01:00 PM",
      type: "Food",
      icon: <Utensils size={19} />,
      iconClass: "food-icon",
      title: "Lunch Logged",
      description: "Rice, vegetables and curd",
      caregiver: "Arjun",
      comments: [],
    },
  ],

  "2026-08-16": [
    {
      time: "08:30 AM",
      type: "Medication",
      icon: <Pill size={19} />,
      iconClass: "medication-icon",
      title: "Medicine Taken",
      description: "Donepezil 5mg — Taken",
      caregiver: "Arjun",
      completed: true,
      comments: [],
    },
    {
      time: "02:00 PM",
      type: "Symptom",
      icon: <AlertCircle size={19} />,
      iconClass: "symptom-icon",
      title: "Mood Change Observed",
      description:
        "Patient appeared slightly restless during the afternoon.",
      caregiver: "Meera",
      countedInPattern: true,
      comments: [
        {
          name: "Meera",
          text: "She became calm after resting.",
        },
      ],
    },
  ],
};


/* =====================================================
   DATE HELPERS
===================================================== */

function formatDateForInput(date) {
  return date.toISOString().split("T")[0];
}


function formatDisplayDate(dateString) {
  const date = new Date(`${dateString}T00:00:00`);

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}


function formatDay(dateString) {
  const today = formatDateForInput(new Date());

  if (dateString === today) {
    return "Today";
  }

  const date = new Date(`${dateString}T00:00:00`);

  return date.toLocaleDateString("en-IN", {
    weekday: "long",
  });
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


/* =====================================================
   TIMELINE PAGE
===================================================== */

function Timeline() {
  const navigate = useNavigate();
  const { currentPatient } = usePatient();

  const dateInputRef = useRef(null);

  const [selectedDate, setSelectedDate] = useState("2026-08-18");
  const [activeFilter, setActiveFilter] = useState("All");

  // Local mutable copy of timeline data so comments can be appended
  const [events, setEvents] = useState(timelineData);

  const handleAddComment = (date, eventIndex, text) => {
    setEvents((prev) => {
      const dateCopy = (prev[date] || []).map((ev, i) =>
        i === eventIndex
          ? { ...ev, comments: [...ev.comments, { name: "Srinidhi", text }] }
          : ev
      );
      return { ...prev, [date]: dateCopy };
    });
  };

  const openCalendar = () => {
    if (dateInputRef.current) {
      dateInputRef.current.showPicker();
    }
  };

  const handleDateChange = (event) => {
    setSelectedDate(event.target.value);
  };

  const handlePrevDay = () => {
    setSelectedDate((prev) => shiftDate(prev, -1));
  };

  const handleNextDay = () => {
    setSelectedDate((prev) => shiftDate(prev, 1));
  };

  const handleViewPatient = () => {
    navigate("/patient");
  };

  const rawEvents = (events[selectedDate] || []);

  const filteredEvents = rawEvents
    .map((event, originalIndex) => ({ ...event, _originalIndex: originalIndex }))
    .filter((event) => {
      if (activeFilter === "All") return true;
      if (activeFilter === "Meals") return event.type === "Food" || event.type === "Meals";
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
            A shared chronological record of {currentPatient.name}'s care.
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

          {/* Hidden native date picker */}
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
      <div className="timeline-patient-bar">
        <div className="timeline-patient-left">
          <div className="timeline-patient-avatar">
            {currentPatient.name.charAt(0)}
          </div>

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

        <button className="patient-link-button" onClick={handleViewPatient}>
          View Patient
          <ArrowRight size={15} />
        </button>
      </div>


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
      {filteredEvents.length > 0 ? (
        <div className="timeline-container">
          {filteredEvents.map((event) => (
            <TimelineEvent
              key={`${selectedDate}-${event._originalIndex}`}
              {...event}
              onAddComment={(text) => handleAddComment(selectedDate, event._originalIndex, text)}
            />
          ))}
        </div>
      ) : (
        /* EMPTY STATE */
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
            Every care activity is recorded as a timeline event, keeping the entire
            care circle informed without relying on separate conversations.
          </p>
        </div>
      </div>

    </div>
  );
}


/* =====================================================
   TIMELINE EVENT COMPONENT
===================================================== */

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

      {/* TIME */}
      <div className="timeline-event-time">{time}</div>

      {/* MARKER */}
      <div className="timeline-marker-column">
        <div className={`timeline-event-icon ${iconClass}`}>{icon}</div>
        <div className="timeline-connector"></div>
      </div>

      {/* EVENT CARD */}
      <div className="timeline-event-card">

        {/* HEADER */}
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

        {/* DESCRIPTION */}
        <p className="timeline-event-description">{description}</p>

        {/* PATTERN TAG (For missed meds, symptoms, etc.) */}
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

        {/* FOOTER */}
        <div className="timeline-event-footer">
          <div className="event-caregiver">
            <div className="small-avatar">
              {isSystem ? "C" : caregiver.charAt(0)}
            </div>
            <span>
              Added by <strong>{caregiver}</strong>
            </span>
          </div>

          {completed && (
            <div className="event-completed">
              <Check size={13} />
              Taken
            </div>
          )}
        </div>

        {/* COMMENTS */}
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
                <div className="timeline-comment" key={index}>
                  <div className="comment-avatar">{comment.name.charAt(0)}</div>
                  <div className="comment-content">
                    <strong>{comment.name}</strong>
                    <p>{comment.text}</p>
                  </div>
                </div>
              ))}
            </>
          )}

          {/* Inline compose form */}
          {commentOpen ? (
            <div style={{ display: "flex", gap: 8, marginTop: comments.length > 0 ? 10 : 0, alignItems: "flex-start" }}>
              <div className="comment-avatar" style={{ marginTop: 2 }}>S</div>
              <div style={{ flex: 1 }}>
                <textarea
                  autoFocus
                  rows={2}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
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
                    onClick={() => { setCommentOpen(false); setDraft(""); }}
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