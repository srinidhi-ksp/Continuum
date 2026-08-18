import { useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  MessageCircle,
  MoreHorizontal,
  Pill,
  Stethoscope,
  Utensils,
} from "lucide-react";

import { useNavigate } from "react-router-dom";


/* =====================================================
   MOCK TIMELINE DATA
   Later this will come from Supabase
===================================================== */

const timelineData = {
  "2026-08-18": [
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
      time: "06:00 PM",
      type: "Appointment",
      icon: <Stethoscope size={19} />,
      iconClass: "appointment-icon",
      title: "Appointment Reminder",
      description:
        "Neurology follow-up tomorrow at 10:30 AM.",
      caregiver: "CONTINUUM",
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


/* =====================================================
   TIMELINE PAGE
===================================================== */

function Timeline() {

  const navigate = useNavigate();

  const dateInputRef = useRef(null);

  const [selectedDate, setSelectedDate] = useState(
    "2026-08-18"
  );


  /* ---------------------------------------------
     Open native calendar
  --------------------------------------------- */

  const openCalendar = () => {
    if (dateInputRef.current) {
      dateInputRef.current.showPicker();
    }
  };


  /* ---------------------------------------------
     Date changed
  --------------------------------------------- */

  const handleDateChange = (event) => {
    setSelectedDate(event.target.value);
  };


  /* ---------------------------------------------
     Navigate to patient profile
  --------------------------------------------- */

  const handleViewPatient = () => {

    navigate("/patient", {
      state: {
        patientId: "lakshmi-ammal",
        patientName: "Lakshmi Ammal",
      },
    });

  };


  const events = timelineData[selectedDate] || [];


  return (
    <div className="timeline-page">

      {/* =========================================
          PAGE HEADER
      ========================================= */}

      <div className="timeline-page-header">

        <div>

          <span className="section-label">
            PATIENT TIMELINE
          </span>

          <h1>
            Care Timeline
          </h1>

          <p>
            A shared chronological record of Lakshmi Ammal's care.
          </p>

        </div>


        {/* DATE BUTTON */}

        <div className="timeline-date-wrapper">

          <button
            className="timeline-date-button"
            onClick={openCalendar}
          >

            <CalendarDays size={17} />

            {formatDay(selectedDate)}

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


      {/* =========================================
          PATIENT BAR
      ========================================= */}

      <div className="timeline-patient-bar">

        <div className="timeline-patient-left">

          <div className="timeline-patient-avatar">
            L
          </div>


          <div>

            <h2>
              Lakshmi Ammal
            </h2>

            <div className="timeline-patient-meta">

              <span>
                72 years
              </span>

              <span className="meta-dot">
                •
              </span>

              <span>
                Dementia
              </span>

              <span className="timeline-active-status">

                <span></span>

                Care circle active

              </span>

            </div>

          </div>

        </div>


        {/* VIEW PATIENT */}

        <button
          className="patient-link-button"
          onClick={handleViewPatient}
        >

          View Patient

          <ArrowRight size={15} />

        </button>

      </div>


      {/* =========================================
          DATE HEADING
      ========================================= */}

      <div className="timeline-date-heading">

        <div className="timeline-date-line"></div>


        <div className="timeline-date">

          <span>
            {formatDay(selectedDate)}
          </span>

          <small>
            {formatDisplayDate(selectedDate)}
          </small>

        </div>


        <div className="timeline-date-line"></div>

      </div>


      {/* =========================================
          TIMELINE
      ========================================= */}

      {events.length > 0 ? (

        <div className="timeline-container">

          {events.map((event, index) => (

            <TimelineEvent
              key={`${selectedDate}-${index}`}
              {...event}
            />

          ))}

        </div>

      ) : (

        /* =====================================
           EMPTY STATE
        ===================================== */

        <div className="timeline-empty">

          <div className="timeline-empty-icon">

            <Clock3 size={22} />

          </div>

          <h3>
            No care activity recorded
          </h3>

          <p>
            There are no timeline events recorded for{" "}
            {formatDisplayDate(selectedDate)}.
          </p>

        </div>

      )}


      {/* =========================================
          TIMELINE PRINCIPLE
      ========================================= */}

      <div className="timeline-principle">

        <div className="principle-icon">

          <Clock3 size={18} />

        </div>


        <div>

          <strong>
            One shared record of care
          </strong>

          <p>
            Every care activity is recorded as a timeline
            event, keeping the entire care circle informed
            without relying on separate conversations.
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
  comments,
  completed = false,
}) {

  return (

    <div className="timeline-event">


      {/* TIME */}

      <div className="timeline-event-time">
        {time}
      </div>


      {/* MARKER */}

      <div className="timeline-marker-column">

        <div
          className={`timeline-event-icon ${iconClass}`}
        >
          {icon}
        </div>

        <div className="timeline-connector"></div>

      </div>


      {/* EVENT CARD */}

      <div className="timeline-event-card">


        {/* HEADER */}

        <div className="timeline-event-header">

          <div>

            <span className="timeline-event-type">
              {type}
            </span>

            <h3>
              {title}
            </h3>

          </div>


          <button className="event-menu">

            <MoreHorizontal size={18} />

          </button>

        </div>


        {/* DESCRIPTION */}

        <p className="timeline-event-description">
          {description}
        </p>


        {/* FOOTER */}

        <div className="timeline-event-footer">

          <div className="event-caregiver">

            <div className="small-avatar">

              {caregiver === "CONTINUUM"
                ? "C"
                : caregiver.charAt(0)}

            </div>


            <span>

              Added by{" "}

              <strong>
                {caregiver}
              </strong>

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

        {comments.length > 0 && (

          <div className="event-comments">

            <div className="comments-heading">

              <MessageCircle size={15} />

              <span>

                {comments.length}{" "}

                {comments.length === 1
                  ? "Comment"
                  : "Comments"}

              </span>

            </div>


            {comments.map((comment, index) => (

              <div
                className="timeline-comment"
                key={index}
              >

                <div className="comment-avatar">

                  {comment.name.charAt(0)}

                </div>


                <div className="comment-content">

                  <strong>
                    {comment.name}
                  </strong>

                  <p>
                    {comment.text}
                  </p>

                </div>

              </div>

            ))}


            <button className="add-comment-link">

              <MessageCircle size={14} />

              Add comment

            </button>

          </div>

        )}

      </div>

    </div>
  );
}


export default Timeline;