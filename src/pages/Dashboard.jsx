import {
  ArrowRight,
  Bell,
  Check,
  Clock3,
  Pill,
  Utensils,
  Moon,
  Sparkles,
  Users,
  AlertTriangle,
} from "lucide-react";

function Dashboard() {
  return (
    <div className="dashboard">

      {/* Header */}
      <div className="dashboard-header">
        <div>
          <h1>Good evening, Srinidhi 👋</h1>
          <p>Here's your care overview for today.</p>
        </div>

        <button className="view-timeline-btn">
          View Timeline
          <ArrowRight size={17} />
        </button>
      </div>


      {/* Patient Overview */}
      <section className="patient-overview dashboard-card">

        <div className="patient-info">

          <div className="patient-avatar">
            L
          </div>

          <div>
            <span className="section-label">PATIENT</span>

            <h2>Lakshmi Krishnan</h2>

            <p>72 years · Dementia</p>

            <div className="patient-status">
              <span className="status-dot"></span>
              Care circle active
            </div>
          </div>

        </div>

        <div className="patient-meta">

          <div>
            <span>CAREGIVERS</span>
            <strong>
              <Users size={16} />
              3
            </strong>
          </div>

          <div>
            <span>LAST ACTIVITY</span>
            <strong>
              <Clock3 size={16} />
              8 min ago
            </strong>
          </div>

        </div>

        <button className="profile-link">
          View Profile
          <ArrowRight size={16} />
        </button>

      </section>


      {/* Top Statistics */}
      <section className="dashboard-stats">

        {/* Reminders */}
        <div className="dashboard-card stat-card">

          <div className="stat-card-header">
            <div className="stat-icon reminder-icon">
              <Bell size={19} />
            </div>

            <span className="section-label">TODAY'S CARE</span>
          </div>

          <div className="stat-number">
            3
          </div>

          <p>reminders remaining</p>

          <div className="stat-footer">
            <span className="success-text">
              <Check size={14} />
              2 completed
            </span>

            <span>1 upcoming</span>
          </div>

        </div>


        {/* Care Score */}
        <div className="dashboard-card score-card">

          <div className="stat-card-header">
            <div className="stat-icon score-icon">
              <Sparkles size={19} />
            </div>

            <span className="section-label">
              CARE COORDINATION
            </span>
          </div>

          <div className="score-content">

            <div>
              <div className="score-number">
                78<span>/100</span>
              </div>

              <div className="score-status">
                <span className="status-dot"></span>
                Moderate workload
              </div>
            </div>

            <div className="score-circle">
              <div className="score-circle-inner">
                78
              </div>
            </div>

          </div>

          <p className="score-description">
            Your care coordination looks manageable today.
          </p>

        </div>

      </section>

    
      {/* Main Content */}
      <section className="dashboard-main-grid">

        {/* Recent Activity */}
        <div className="dashboard-card activity-card">

          <div className="card-heading">

            <div>
              <span className="section-label">RECENT ACTIVITY</span>
              <h2>Timeline</h2>
            </div>

            <button className="text-button">
              View all
              <ArrowRight size={15} />
            </button>

          </div>


          <div className="timeline-list">

            {/* Medication */}
            <div className="timeline-item">

              <div className="timeline-icon medication">
                <Pill size={18} />
              </div>

              <div className="timeline-content">
                <h3>Medication taken</h3>
                <p>Donepezil 10mg</p>
                <span>Priya · 8:05 PM</span>
              </div>

              <div className="timeline-check">
                <Check size={15} />
              </div>

            </div>


            {/* Meal */}
            <div className="timeline-item">

              <div className="timeline-icon meal">
                <Utensils size={18} />
              </div>

              <div className="timeline-content">
                <h3>Dinner completed</h3>
                <p>Meal logged successfully</p>
                <span>Arun · 7:30 PM</span>
              </div>

            </div>


            {/* Sleep */}
            <div className="timeline-item">

              <div className="timeline-icon sleep">
                <Moon size={18} />
              </div>

              <div className="timeline-content">
                <h3>Sleep logged</h3>
                <p>7 hours 20 minutes</p>
                <span>Priya · 7:10 AM</span>
              </div>

            </div>

          </div>

        </div>


        {/* AI Insight */}
        <div className="dashboard-card ai-card">

          <div className="ai-header">

            <div className="ai-icon">
              <Sparkles size={20} />
            </div>

            <div>
              <span className="section-label">AI INSIGHT</span>
              <h2>Care Pattern</h2>
            </div>

          </div>


          <div className="ai-content">

            <p>
              Your care activity has been consistent today.
              Medication and meal entries were logged on time.
            </p>

            <div className="ai-highlight">
              <Sparkles size={16} />

              <span>
                3 care activities completed
              </span>
            </div>

          </div>


          <button className="ai-action">
            View activity summary
            <ArrowRight size={16} />
          </button>

        </div>

      </section>


      {/* Today's Reminders */}
      <section className="dashboard-card reminders-card">

        <div className="card-heading">

          <div>
            <span className="section-label">UPCOMING</span>
            <h2>Today's reminders</h2>
          </div>

          <button className="text-button">
            View all
            <ArrowRight size={15} />
          </button>

        </div>


        <div className="reminder-list">

          <div className="reminder-item">

            <div className="reminder-icon-box">
              <Pill size={18} />
            </div>

            <div className="reminder-info">
              <h3>Donepezil</h3>
              <p>Medication · 10mg</p>
            </div>

            <div className="reminder-time">
              <span>8:00 PM</span>
              <small>Upcoming</small>
            </div>

          </div>


          <div className="reminder-item completed">

            <div className="reminder-icon-box">
              <Check size={18} />
            </div>

            <div className="reminder-info">
              <h3>Lunch</h3>
              <p>Meal · Completed</p>
            </div>

            <div className="reminder-time">
              <span>1:00 PM</span>
              <small>Completed</small>
            </div>

          </div>


          <div className="reminder-item">

            <div className="reminder-icon-box">
              <Clock3 size={18} />
            </div>

            <div className="reminder-info">
              <h3>Evening walk</h3>
              <p>Mobility · 15 minutes</p>
            </div>

            <div className="reminder-time">
              <span>6:30 PM</span>
              <small>Upcoming</small>
            </div>

          </div>

        </div>

      </section>


      {/* Adaptive Dashboard Preview */}
      <section className="adaptive-banner">

        <div className="adaptive-icon">
          <AlertTriangle size={20} />
        </div>

        <div>
          <strong>Dashboard adapts when care workload increases</strong>

          <p>
            If coordination risk becomes elevated, CONTINUUM will
            simplify this dashboard and prioritize tasks that need attention.
          </p>
        </div>

      </section>

    </div>
  );
}

export default Dashboard;