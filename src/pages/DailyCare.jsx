import React, { useState } from "react";

export default function DailyCare() {
  const [careType, setCareType] = useState("Food");
  const [quantity, setQuantity] = useState("");
  const [symptoms, setSymptoms] = useState("");
  const [notes, setNotes] = useState("");

  const [logs, setLogs] = useState([
    {
      id: 1,
      type: "Food",
      quantity: "2 idlis + milk",
      symptoms: "None",
      notes: "Breakfast completed normally.",
      time: "08:00 AM",
      addedBy: "Meera",
    },
    {
      id: 2,
      type: "Medication",
      quantity: "Donepezil 5mg",
      symptoms: "None",
      notes: "Medicine taken on time.",
      time: "08:15 AM",
      addedBy: "Arjun",
    },
    {
      id: 3,
      type: "Water",
      quantity: "250 ml",
      symptoms: "None",
      notes: "Water intake recorded.",
      time: "10:30 AM",
      addedBy: "Meera",
    },
  ]);

  const handleAddLog = (e) => {
    e.preventDefault();

    if (!quantity.trim()) {
      alert("Please enter quantity.");
      return;
    }

    const newLog = {
      id: Date.now(),
      type: careType,
      quantity: quantity,
      symptoms: symptoms || "None",
      notes: notes || "No additional notes.",
      time: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      addedBy: "You",
    };

    setLogs([newLog, ...logs]);

    setQuantity("");
    setSymptoms("");
    setNotes("");

    alert("Daily care log added successfully.");
  };

  const getIcon = (type) => {
    if (type === "Food") return "🍴";
    if (type === "Water") return "💧";
    if (type === "Sleep") return "🌙";
    if (type === "Medication") return "💊";
    if (type === "Mood") return "🙂";
    return "📝";
  };

  return (
    <div className="daily-care-page">
      <style>{`
        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          font-family: Arial, Helvetica, sans-serif;
          background: #f7f8fc;
          color: #17233c;
        }

        .daily-care-page {
          min-height: 100vh;
          background: #f7f8fc;
        }

        /* TOP HEADER */

        .top-header {
          height: 70px;
          background: white;
          border-bottom: 1px solid #e5e7ef;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 32px;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 18px;
          font-weight: 700;
          letter-spacing: 1px;
        }

        .brand-icon {
          width: 34px;
          height: 34px;
          border-radius: 9px;
          background: #5b57d9;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 20px;
        }

        .header-icon {
          font-size: 21px;
          color: #697386;
        }

        .caregiver {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .avatar {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: #5b57d9;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
        }

        .caregiver-name {
          font-size: 14px;
          font-weight: 600;
        }

        .caregiver-role {
          font-size: 12px;
          color: #7b8495;
          margin-top: 2px;
        }

        /* MAIN */

        .main-content {
          max-width: 1120px;
          margin: 0 auto;
          padding: 38px 30px 60px;
        }

        .page-heading {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-bottom: 25px;
        }

        .small-title {
          font-size: 12px;
          color: #747c8e;
          letter-spacing: 1px;
          font-weight: 600;
          margin-bottom: 7px;
        }

        .page-title {
          margin: 0;
          font-size: 30px;
          font-weight: 700;
        }

        .page-description {
          margin-top: 7px;
          color: #697386;
          font-size: 14px;
        }

        /* PATIENT CARD */

        .patient-card {
          background: white;
          border: 1px solid #e2e5ed;
          border-radius: 16px;
          padding: 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 25px;
        }

        .patient-info {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .patient-avatar {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background: #eeeefe;
          color: #5b57d9;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          font-weight: 600;
        }

        .patient-name {
          font-size: 17px;
          font-weight: 700;
          margin-bottom: 5px;
        }

        .patient-details {
          font-size: 13px;
          color: #697386;
        }

        .active-status {
          color: #21a366;
          font-weight: 600;
          margin-left: 8px;
        }

        .view-patient {
          color: #5b57d9;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
        }

        /* TWO COLUMN */

        .content-grid {
          display: grid;
          grid-template-columns: 390px 1fr;
          gap: 24px;
          align-items: start;
        }

        /* FORM CARD */

        .form-card {
          background: white;
          border: 1px solid #e2e5ed;
          border-radius: 16px;
          padding: 24px;
        }

        .card-title {
          margin: 0;
          font-size: 19px;
          font-weight: 700;
        }

        .card-subtitle {
          color: #7a8394;
          font-size: 13px;
          margin-top: 6px;
          margin-bottom: 22px;
        }

        .form-group {
          margin-bottom: 17px;
        }

        .form-label {
          display: block;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 7px;
        }

        .required {
          color: #e25555;
        }

        .form-input,
        .form-select,
        .form-textarea {
          width: 100%;
          border: 1px solid #dfe3eb;
          border-radius: 9px;
          padding: 11px 12px;
          font-size: 14px;
          outline: none;
          background: white;
          color: #26324a;
        }

        .form-input:focus,
        .form-select:focus,
        .form-textarea:focus {
          border-color: #5b57d9;
          box-shadow: 0 0 0 2px rgba(91, 87, 217, 0.08);
        }

        .form-textarea {
          min-height: 80px;
          resize: vertical;
        }

        .add-button {
          width: 100%;
          border: none;
          background: #5b57d9;
          color: white;
          padding: 12px;
          border-radius: 9px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          margin-top: 4px;
        }

        .add-button:hover {
          background: #4e4ac6;
        }

        /* SUMMARY */

        .summary-row {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 10px;
          margin-bottom: 20px;
        }

        .summary-box {
          background: white;
          border: 1px solid #e2e5ed;
          border-radius: 12px;
          padding: 13px;
          text-align: center;
        }

        .summary-icon {
          font-size: 19px;
        }

        .summary-number {
          font-size: 18px;
          font-weight: 700;
          margin-top: 5px;
        }

        .summary-label {
          font-size: 11px;
          color: #7b8495;
          margin-top: 3px;
        }

        /* LOG CARD */

        .logs-card {
          background: white;
          border: 1px solid #e2e5ed;
          border-radius: 16px;
          padding: 24px;
        }

        .logs-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 22px;
        }

        .logs-count {
          color: #7b8495;
          font-size: 13px;
        }

        .log-item {
          display: grid;
          grid-template-columns: 65px 48px 1fr;
          gap: 15px;
          padding: 18px 0;
          border-bottom: 1px solid #edf0f4;
        }

        .log-item:last-child {
          border-bottom: none;
        }

        .log-time {
          font-size: 12px;
          color: #737c8d;
          padding-top: 7px;
        }

        .log-icon {
          width: 42px;
          height: 42px;
          border-radius: 11px;
          background: #f0efff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 19px;
        }

        .log-main {
          min-width: 0;
        }

        .log-type {
          font-size: 11px;
          color: #747c8e;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          font-weight: 600;
        }

        .log-title {
          font-size: 16px;
          font-weight: 700;
          margin-top: 4px;
        }

        .log-quantity {
          font-size: 13px;
          color: #5f697c;
          margin-top: 6px;
        }

        .log-details {
          background: #f8f9fc;
          border-radius: 9px;
          padding: 10px;
          margin-top: 10px;
          font-size: 12px;
          color: #657084;
        }

        .log-added {
          margin-top: 9px;
          font-size: 12px;
          color: #858d9c;
        }

        .log-added strong {
          color: #303a4f;
        }

        .empty-state {
          text-align: center;
          padding: 50px 20px;
          color: #7b8495;
        }

        /* RESPONSIVE */

        @media (max-width: 900px) {
          .content-grid {
            grid-template-columns: 1fr;
          }

          .summary-row {
            grid-template-columns: repeat(3, 1fr);
          }
        }

        @media (max-width: 600px) {
          .top-header {
            padding: 0 15px;
          }

          .caregiver-name,
          .caregiver-role {
            display: none;
          }

          .main-content {
            padding: 25px 15px 40px;
          }

          .page-heading {
            display: block;
          }

          .patient-card {
            align-items: flex-start;
          }

          .view-patient {
            display: none;
          }

          .summary-row {
            grid-template-columns: repeat(2, 1fr);
          }

          .log-item {
            grid-template-columns: 55px 42px 1fr;
            gap: 8px;
          }
        }
      `}</style>

      {/* HEADER */}
      <header className="top-header">
        <div className="brand">
          <div className="brand-icon">C</div>
          CONTINUUM
        </div>

        <div className="header-right">
          <div className="header-icon">⌕</div>
          <div className="header-icon">♧</div>

          <div className="caregiver">
            <div className="avatar">S</div>

            <div>
              <div className="caregiver-name">Srinidhi</div>
              <div className="caregiver-role">Caregiver</div>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="main-content">

        {/* PAGE TITLE */}
        <div className="page-heading">
          <div>
            <div className="small-title">DAILY CARE</div>

            <h1 className="page-title">
              Daily Care Log
            </h1>

            <div className="page-description">
              Record and monitor Lakshmi Ammal's daily care activities.
            </div>
          </div>
        </div>

        {/* PATIENT */}
        <div className="patient-card">
          <div className="patient-info">

            <div className="patient-avatar">
              L
            </div>

            <div>
              <div className="patient-name">
                Lakshmi Ammal
              </div>

              <div className="patient-details">
                72 years
                <span> • </span>
                Dementia

                <span className="active-status">
                  ● Care circle active
                </span>
              </div>
            </div>

          </div>

          <div className="view-patient">
            View Patient →
          </div>
        </div>

        {/* CONTENT */}
        <div className="content-grid">

          {/* ADD CARE LOG */}
          <section className="form-card">

            <h2 className="card-title">
              Add Daily Care
            </h2>

            <p className="card-subtitle">
              Record a new care activity for today.
            </p>

            <form onSubmit={handleAddLog}>

              {/* TYPE */}
              <div className="form-group">

                <label className="form-label">
                  Care Type <span className="required">*</span>
                </label>

                <select
                  className="form-select"
                  value={careType}
                  onChange={(e) => setCareType(e.target.value)}
                >
                  <option value="Food">Food</option>
                  <option value="Water">Water</option>
                  <option value="Sleep">Sleep</option>
                  <option value="Medication">Medication</option>
                  <option value="Mood">Mood</option>
                </select>

              </div>

              {/* QUANTITY */}
              <div className="form-group">

                <label className="form-label">
                  Quantity <span className="required">*</span>
                </label>

                <input
                  className="form-input"
                  type="text"
                  placeholder="Example: 250 ml, 2 tablets, 7 hours"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />

              </div>

              {/* SYMPTOMS */}
              <div className="form-group">

                <label className="form-label">
                  Symptoms
                </label>

                <input
                  className="form-input"
                  type="text"
                  placeholder="Example: Headache, fatigue, nausea"
                  value={symptoms}
                  onChange={(e) => setSymptoms(e.target.value)}
                />

              </div>

              {/* NOTES */}
              <div className="form-group">

                <label className="form-label">
                  Notes
                </label>

                <textarea
                  className="form-textarea"
                  placeholder="Add any additional observation..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />

              </div>

              <button
                className="add-button"
                type="submit"
              >
                + Add Care Log
              </button>

            </form>
          </section>

          {/* RIGHT SIDE */}
          <section>

            {/* SUMMARY */}
            <div className="summary-row">

              {[
                "Food",
                "Water",
                "Sleep",
                "Medication",
                "Mood",
              ].map((type) => {

                const count = logs.filter(
                  (log) => log.type === type
                ).length;

                return (
                  <div
                    className="summary-box"
                    key={type}
                  >
                    <div className="summary-icon">
                      {getIcon(type)}
                    </div>

                    <div className="summary-number">
                      {count}
                    </div>

                    <div className="summary-label">
                      {type}
                    </div>
                  </div>
                );
              })}

            </div>

            {/* LOGS */}
            <div className="logs-card">

              <div className="logs-header">

                <div>
                  <h2 className="card-title">
                    Today's Care Logs
                  </h2>

                  <div className="card-subtitle">
                    Recent activities recorded for the patient.
                  </div>
                </div>

                <div className="logs-count">
                  {logs.length} entries
                </div>

              </div>

              {logs.length === 0 ? (

                <div className="empty-state">
                  No care logs available for today.
                </div>

              ) : (

                logs.map((log) => (

                  <div
                    className="log-item"
                    key={log.id}
                  >

                    {/* TIME */}
                    <div className="log-time">
                      {log.time}
                    </div>

                    {/* ICON */}
                    <div className="log-icon">
                      {getIcon(log.type)}
                    </div>

                    {/* DETAILS */}
                    <div className="log-main">

                      <div className="log-type">
                        {log.type}
                      </div>

                      <div className="log-title">
                        {log.type} Logged
                      </div>

                      <div className="log-quantity">
                        {log.quantity}
                      </div>

                      <div className="log-details">
                        <strong>Symptoms:</strong>{" "}
                        {log.symptoms}
                        <br />
                        <br />
                        <strong>Notes:</strong>{" "}
                        {log.notes}
                      </div>

                      <div className="log-added">
                        Added by{" "}
                        <strong>{log.addedBy}</strong>
                      </div>

                    </div>

                  </div>

                ))

              )}

            </div>

          </section>

        </div>

      </main>
    </div>
  );
}