import { supabase, getCaregiverId } from "./supabaseClient";
import { jsPDF } from "jspdf";

const BUCKET = "reports";

// ── Fetch all reports for a patient ──────────────────────────────────────────
export async function fetchHealthReports(patientId) {
  if (!patientId) return [];
  const { data, error } = await supabase
    .from("health_report")
    .select("*, generator:generated_by ( full_name )")
    .eq("patient_id", patientId)
    .order("generated_at", { ascending: false });

  if (error) {
    console.warn("[reportApi] fetch health_report failed:", error.message);
    return [];
  }
  return data || [];
}

// ── Collect data for the report ───────────────────────────────────────────────
export async function collectReportData({ patientId, startDate, endDate }) {
  const [patientRes, timelineRes, careLogsRes, medicationsRes, appointmentsRes, careCircleRes] =
    await Promise.all([
      supabase.from("patient").select("*").eq("patient_id", patientId).single(),
      supabase
        .from("time_event")
        .select("*, caregiver:caregiver_id ( full_name )")
        .eq("patient_id", patientId)
        .gte("created_at", startDate)
        .lte("created_at", endDate)
        .order("created_at", { ascending: false }),
      supabase
        .from("daily_care_log")
        .select("*, caregiver:caregiver_id ( full_name )")
        .eq("patient_id", patientId)
        .gte("created_at", startDate)
        .lte("created_at", endDate)
        .order("created_at", { ascending: false }),
      supabase.from("medication").select("*").eq("patient_id", patientId),
      supabase
        .from("appointment")
        .select("*")
        .eq("patient_id", patientId)
        .gte("appointment_date", startDate.split("T")[0])
        .lte("appointment_date", endDate.split("T")[0])
        .order("appointment_date", { ascending: true }),
      supabase
        .from("caregiver_pat")
        .select("role, caregiver:caregiver_id ( full_name, email )")
        .eq("patient_id", patientId)
        .eq("status", "active"),
    ]);

  return {
    patient: patientRes.data,
    timeline: timelineRes.data || [],
    careLogs: careLogsRes.data || [],
    medications: medicationsRes.data || [],
    appointments: appointmentsRes.data || [],
    careCircle: careCircleRes.data || [],
  };
}

// ── Collect data for weekly coordination report ───────────────────────────────
export async function collectWeeklyData(patientId) {
  const endDate = new Date().toISOString();
  const startDate = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

  const [metricsRes, careLogsRes, careCircleRes, medicationsRes] = await Promise.all([
    supabase
      .from("coordination_metric")
      .select("*")
      .eq("patient_id", patientId)
      .gte("predicted_at", startDate)
      .order("predicted_at", { ascending: true }),
    supabase
      .from("daily_care_log")
      .select("*, caregiver:caregiver_id ( full_name )")
      .eq("patient_id", patientId)
      .gte("created_at", startDate),
    supabase
      .from("caregiver_pat")
      .select("role, caregiver:caregiver_id ( full_name, email )")
      .eq("patient_id", patientId)
      .eq("status", "active"),
    supabase.from("medication").select("*").eq("patient_id", patientId).eq("active", true),
  ]);

  return {
    metrics: metricsRes.data || [],
    careLogs: careLogsRes.data || [],
    careCircle: careCircleRes.data || [],
    medications: medicationsRes.data || [],
    startDate,
    endDate,
  };
}

// ── PDF helpers ───────────────────────────────────────────────────────────────
function addPageHeader(doc, title, page, patientName) {
  doc.setFillColor(190, 91, 46);
  doc.rect(0, 0, 210, 18, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("CONTINUUM", 14, 12);
  doc.setFont("helvetica", "normal");
  doc.text(`${title}  ·  ${patientName}`, 50, 12);
  doc.text(`Page ${page}`, 196, 12, { align: "right" });
  doc.setTextColor(43, 38, 32);
}

function addSection(doc, label, yRef) {
  let y = yRef;
  if (y > 265) { doc.addPage(); y = 28; }
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(190, 91, 46);
  doc.text(label.toUpperCase(), 14, y);
  doc.setTextColor(43, 38, 32);
  doc.setFont("helvetica", "normal");
  return y + 6;
}

function addText(doc, text, x, yRef, maxWidth = 182) {
  let y = yRef;
  if (y > 268) { doc.addPage(); y = 28; }
  const lines = doc.splitTextToSize(text, maxWidth);
  doc.setFontSize(9);
  doc.text(lines, x, y);
  return y + lines.length * 5;
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

// ── Build Health Report PDF (blob) ────────────────────────────────────────────
export function buildHealthReportPDF(data, startDate, endDate) {
  const { patient, timeline, careLogs, medications, appointments, careCircle } = data;
  const patientName = patient?.full_name || "Patient";
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = 24;
  let page = 1;

  addPageHeader(doc, "Health Report", page, patientName);

  // ── Title block
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Patient Health Report", 14, y + 8);
  y += 14;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Period: ${fmtDate(startDate)} – ${fmtDate(endDate)}    Generated: ${fmtDate(new Date())}`, 14, y + 4);
  y += 12;

  // ── Patient info
  y = addSection(doc, "Patient Information", y);
  const info = [
    ["Name", patient?.full_name],
    ["Date of Birth", fmtDate(patient?.dob)],
    ["Gender", patient?.gender],
    ["Condition", patient?.condition_type],
    ["Blood Group", patient?.blood_group],
    ["Allergies", patient?.allergies || "None recorded"],
  ];
  info.forEach(([label, val]) => {
    if (y > 268) { doc.addPage(); page++; addPageHeader(doc, "Health Report", page, patientName); y = 28; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(`${label}:`, 14, y);
    doc.setFont("helvetica", "normal");
    doc.text(val || "—", 52, y);
    y += 5.5;
  });
  y += 4;

  // ── Care circle
  y = addSection(doc, "Care Circle", y);
  careCircle.forEach((cc) => {
    y = addText(doc, `• ${cc.caregiver?.full_name || "—"}  (${cc.role})`, 16, y);
  });
  if (careCircle.length === 0) y = addText(doc, "No linked caregivers.", 16, y);
  y += 4;

  // ── Medications
  y = addSection(doc, "Active Medications", y);
  medications.filter(m => m.active).forEach((m) => {
    y = addText(doc, `• ${m.medicine_name} ${m.dosage} — ${m.frequency}  (${m.purpose || m.instruction || ""})`, 16, y);
  });
  if (!medications.some(m => m.active)) y = addText(doc, "No active medications recorded.", 16, y);
  y += 4;

  // ── Appointments
  if (appointments.length > 0) {
    y = addSection(doc, "Appointments", y);
    appointments.forEach((a) => {
      y = addText(doc, `• ${fmtDate(a.appointment_date)}  Dr. ${a.doctor_name || "Unknown"} at ${a.hospital || "—"}${a.notes ? ` — ${a.notes}` : ""}`, 16, y);
    });
    y += 4;
  }

  // ── Daily care log (up to 30 entries)
  y = addSection(doc, "Daily Care Activity", y);
  const logSummary = {};
  careLogs.forEach((l) => {
    logSummary[l.type] = (logSummary[l.type] || 0) + 1;
  });
  Object.entries(logSummary).forEach(([type, count]) => {
    y = addText(doc, `• ${type}: ${count} log${count !== 1 ? "s" : ""} recorded`, 16, y);
  });
  if (careLogs.length === 0) y = addText(doc, "No care activity logged in this period.", 16, y);
  y += 4;

  // ── Recent care notes
  const noteLogs = careLogs.filter((l) => l.notes).slice(0, 15);
  if (noteLogs.length > 0) {
    y = addSection(doc, "Care Notes", y);
    noteLogs.forEach((l) => {
      y = addText(doc, `${fmtDate(l.created_at)}  [${l.type}] ${l.notes}  — ${l.caregiver?.full_name || "Caregiver"}`, 16, y);
    });
    y += 4;
  }

  // ── Timeline events (up to 20)
  const events = timeline.slice(0, 20);
  if (events.length > 0) {
    y = addSection(doc, "Timeline Events", y);
    events.forEach((ev) => {
      y = addText(doc, `• ${fmtDate(ev.created_at)}  ${ev.title}  — ${ev.caregiver?.full_name || "Caregiver"}`, 16, y);
    });
    y += 4;
  }

  // ── Disclaimer
  y = addSection(doc, "Important Notice", y);
  y = addText(
    doc,
    "This report contains recorded caregiving activity only. It does not constitute a medical diagnosis, clinical assessment, or prescription. Consult a qualified healthcare professional for medical advice.",
    16,
    y
  );

  return doc;
}

// ── Build Weekly Coordination Report PDF ──────────────────────────────────────
export function buildWeeklyReportPDF(data, patientName) {
  const { metrics, careLogs, careCircle, startDate, endDate } = data;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = 24;
  let page = 1;

  addPageHeader(doc, "Weekly Coordination Report", page, patientName);

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Weekly Coordination Report", 14, y + 8);
  y += 14;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Period: ${fmtDate(startDate)} – ${fmtDate(endDate)}    Generated: ${fmtDate(new Date())}`, 14, y + 4);
  y += 12;

  // ── Coordination score trend
  y = addSection(doc, "Coordination Score Trend  [Recorded ML output]", y);
  if (metrics.length === 0) {
    y = addText(doc, "No coordination scores recorded this week.", 16, y);
  } else {
    metrics.forEach((m) => {
      y = addText(doc, `${fmtDate(m.predicted_at)}  Score: ${m.score}/100  Risk: ${m.risk_level}`, 16, y);
    });
    const avg = Math.round(metrics.reduce((s, m) => s + m.score, 0) / metrics.length);
    y = addText(doc, `Average score this week: ${avg}/100`, 16, y + 2);
  }
  y += 4;

  // ── Activity summary
  y = addSection(doc, "Care Activity Summary  [Recorded data]", y);
  const logsByType = {};
  const logsByCaregiver = {};
  careLogs.forEach((l) => {
    logsByType[l.type] = (logsByType[l.type] || 0) + 1;
    const name = l.caregiver?.full_name || "Unknown";
    logsByCaregiver[name] = (logsByCaregiver[name] || 0) + 1;
  });
  y = addText(doc, `Total logs this week: ${careLogs.length}`, 16, y);
  Object.entries(logsByType).forEach(([type, count]) => {
    y = addText(doc, `  • ${type}: ${count}`, 16, y);
  });
  y += 4;

  // ── Task distribution
  y = addSection(doc, "Task Distribution Across Care Circle  [Recorded data]", y);
  if (Object.keys(logsByCaregiver).length === 0) {
    y = addText(doc, "No activity logged this week.", 16, y);
  } else {
    Object.entries(logsByCaregiver).forEach(([name, count]) => {
      y = addText(doc, `• ${name}: ${count} log${count !== 1 ? "s" : ""}`, 16, y);
    });
  }
  y += 4;

  // ── Care circle members
  y = addSection(doc, "Care Circle", y);
  careCircle.forEach((cc) => {
    y = addText(doc, `• ${cc.caregiver?.full_name || "—"}  (${cc.role})`, 16, y);
  });
  y += 4;

  // ── Supportive recommendations (from ML output — clearly labelled)
  const lastMetric = metrics[metrics.length - 1];
  if (lastMetric?.recommendation) {
    y = addSection(doc, "Coordination Recommendation  [ML-generated guidance — not medical advice]", y);
    y = addText(doc, lastMetric.recommendation, 16, y);
    y += 4;
  }

  // ── Disclaimer
  y = addSection(doc, "Important Notice", y);
  addText(
    doc,
    "This report is a coordination support tool. Coordination scores and recommendations are generated by a support model and represent coordination patterns only — not clinical judgements. Consult a healthcare professional for medical decisions.",
    16,
    y
  );

  return doc;
}

// ── Upload PDF to Supabase Storage ────────────────────────────────────────────
export async function uploadReportPDF(doc, fileName) {
  const pdfBlob = doc.output("blob");
  const filePath = `${fileName}-${Date.now()}.pdf`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, pdfBlob, { contentType: "application/pdf", upsert: false });

  if (uploadError) {
    // Storage bucket may not exist — fall back to data URL
    console.warn("[reportApi] Supabase storage upload failed:", uploadError.message);
    return null;
  }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
  return urlData?.publicUrl || null;
}

// ── Save health_report record ─────────────────────────────────────────────────
export async function saveHealthReport(patientId, fileUrl) {
  const caregiverId = getCaregiverId();
  const { data, error } = await supabase
    .from("health_report")
    .insert({
      patient_id: patientId,
      generated_by: caregiverId,
      file_url: fileUrl || null,
      generated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error("[reportApi] save health_report failed:", error);
    throw error;
  }
  return data;
}

// ── Generate + save health report (orchestrator) ──────────────────────────────
export async function generateHealthReport({ patient, startDate, endDate }) {
  const data = await collectReportData({
    patientId: patient.id || patient.patient_id,
    startDate: new Date(startDate).toISOString(),
    endDate: new Date(endDate + "T23:59:59").toISOString(),
  });

  const doc = buildHealthReportPDF(data, startDate, endDate);
  const fileName = `health-${(patient.name || patient.full_name || "patient").replace(/\s+/g, "-").toLowerCase()}`;
  const fileUrl = await uploadReportPDF(doc, fileName);
  const record = await saveHealthReport(patient.id || patient.patient_id, fileUrl);

  // Also trigger browser download regardless of storage
  doc.save(`${fileName}.pdf`);
  return { record, fileUrl };
}

// ── Generate + save weekly coordination report ────────────────────────────────
export async function generateWeeklyReport({ patient }) {
  const patientId = patient.id || patient.patient_id;
  const data = await collectWeeklyData(patientId);
  const patientName = patient.name || patient.full_name || "Patient";

  const doc = buildWeeklyReportPDF(data, patientName);
  const fileName = `weekly-${patientName.replace(/\s+/g, "-").toLowerCase()}`;
  const fileUrl = await uploadReportPDF(doc, fileName);
  const record = await saveHealthReport(patientId, fileUrl);

  doc.save(`${fileName}.pdf`);
  return { record, fileUrl };
}
