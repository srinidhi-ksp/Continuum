// src/lib/localSupabaseClient.js
// Persistent Local Client for CONTINUUM
// Provides full offline/local reactivity with localStorage persistence,
// pre-seeded with project data from continuum_seed.sql.

import {
  caregivers as seedCaregivers,
  patients as seedPatients,
  caregiverPat as seedCaregiverPat,
  emergencyContacts as seedEmergencyContacts,
  medications as seedMedications,
  medicationSchedules as seedMedicationSchedules,
  dailyCareLogs as seedDailyCareLogs,
  timeEvents as seedTimeEvents,
  timelineComments as seedTimelineComments,
  careCircleInvites as seedCareCircleInvites,
  coordinationMetrics as seedCoordinationMetrics,
  scenarioCards as seedScenarioCards,
  scenarioOptions as seedScenarioOptions,
  scenarioAttempts as seedScenarioAttempts,
  healthReports as seedHealthReports,
} from "../test/fixtures";

const STORAGE_KEY_PREFIX = "continuum_local_db_";

function loadTable(tableName, defaultData) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREFIX + tableName);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn(`[LocalSupabase] Error loading table ${tableName}:`, e);
  }
  return JSON.parse(JSON.stringify(defaultData));
}

function saveTable(tableName, data) {
  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + tableName, JSON.stringify(data));
  } catch (e) {
    console.warn(`[LocalSupabase] Error saving table ${tableName}:`, e);
  }
}

// Seed appointments (Table 3.8)
const seedAppointments = [
  {
    appointment_id: "88888888-8888-8888-8888-888888888801",
    patient_id: "22222222-2222-2222-2222-222222222201",
    doctor_name: "Dr. Meenakshi Sundaram",
    specialty: "Neurology",
    location: "Apollo Hospital, Greams Road, Chennai",
    appointment_time: new Date(Date.now() + 3 * 86400000).toISOString(),
    notes: "Quarterly cognitive assessment & Donepezil dosage review.",
    status: "upcoming",
    reminder_sent: false,
    created_at: new Date().toISOString(),
  },
  {
    appointment_id: "88888888-8888-8888-8888-888888888802",
    patient_id: "22222222-2222-2222-2222-222222222201",
    doctor_name: "Dr. K. Ramanathan",
    specialty: "Geriatric Care",
    location: "Fortis Malar, Adyar",
    appointment_time: new Date(Date.now() + 12 * 86400000).toISOString(),
    notes: "Routine vitals, blood pressure, and mobility checkup.",
    status: "upcoming",
    reminder_sent: false,
    created_at: new Date().toISOString(),
  },
  {
    appointment_id: "88888888-8888-8888-8888-888888888803",
    patient_id: "22222222-2222-2222-2222-222222222202",
    doctor_name: "Dr. S. Venkatesh",
    specialty: "Movement Disorders",
    location: "MIOT International, Manapakkam",
    appointment_time: new Date(Date.now() + 5 * 86400000).toISOString(),
    notes: "Gait assessment, rigidity, and tremor control check.",
    status: "upcoming",
    reminder_sent: false,
    created_at: new Date().toISOString(),
  },
];

let idCounter = 2000;
const PK_COLUMN = {
  patient: "patient_id",
  caregiver: "caregiver_id",
  emergency_contact: "contact_id",
  medication: "medication_id",
  medication_schedule: "schedule_id",
  medication_log: "log_id",
  daily_care_log: "log_id",
  coordination_metric: "metric_id",
  care_circle_invite: "invite_id",
  time_event: "event_id",
  timeline_commend: "commend_id",
  scenario_card: "scenario_id",
  scenario_option: "option_id",
  scenario_attempt: "attempt_id",
  health_report: "report_id",
  appointment: "appointment_id",
  caregiver_pat: null,
  invitation: "invitation_id",
  caregiver_sleep_log: "sleep_id",
  care_alert: "alert_id",
  notification: "notification_id",
  login_audit: "audit_id",
  care_task_template: "template_id",
  care_task: "task_id",
  care_task_history: "history_id",
  task_suggestion: "suggestion_id",
};

class LocalQuery {
  constructor(table, client) {
    this.table = table;
    this.client = client;
    this.filters = [];
    this._select = "*";
    this._selectOpts = {};
    this._order = null;
    this._limit = null;
    this._single = false;
    this._mode = "select";
    this._payload = null;
  }

  select(cols = "*", opts = {}) {
    this._select = cols;
    this._selectOpts = opts;
    return this;
  }
  eq(col, val) {
    this.filters.push((r) => r[col] === val);
    return this;
  }
  neq(col, val) {
    this.filters.push((r) => r[col] !== val);
    return this;
  }
  in(col, vals) {
    this.filters.push((r) => vals && vals.includes(r[col]));
    return this;
  }
  is(col, val) {
    this.filters.push((r) => (val === null ? r[col] == null : r[col] === val));
    return this;
  }
  gte(col, val) {
    this.filters.push((r) => r[col] >= val);
    return this;
  }
  lte(col, val) {
    this.filters.push((r) => r[col] <= val);
    return this;
  }
  order(col, { ascending = true } = {}) {
    this._order = { col, ascending };
    return this;
  }
  limit(n) {
    this._limit = n;
    return this;
  }
  single() {
    this._single = true;
    return this;
  }
  maybeSingle() {
    this._single = true;
    return this;
  }
  insert(payload) {
    this._mode = "insert";
    this._payload = payload;
    return this;
  }
  upsert(payload) {
    this._mode = "upsert";
    this._payload = payload;
    return this;
  }
  update(payload) {
    this._mode = "update";
    this._payload = payload;
    return this;
  }
  delete() {
    this._mode = "delete";
    return this;
  }

  _applyFilters(rows) {
    return this.filters.reduce((acc, fn) => acc.filter(fn), rows);
  }

  _resolve() {
    const store = this.client.getTable(this.table);

    if (this._mode === "insert" || this._mode === "upsert") {
      const pkCol = PK_COLUMN[this.table];
      const items = Array.isArray(this._payload) ? this._payload : [this._payload];
      const inserted = [];

      for (const item of items) {
        const row = { ...item };
        if (pkCol && !row[pkCol]) {
          row[pkCol] = `loc-${this.table}-${Date.now()}-${idCounter++}`;
        }
        if (!row.created_at) row.created_at = new Date().toISOString();

        if (this._mode === "upsert" && pkCol && row[pkCol]) {
          const idx = store.findIndex((r) => r[pkCol] === row[pkCol]);
          if (idx >= 0) {
            store[idx] = { ...store[idx], ...row };
            inserted.push(store[idx]);
            continue;
          }
        }
        store.push(row);
        inserted.push(row);
      }

      this.client.saveTable(this.table);
      const out = this._single ? inserted[0] : (Array.isArray(this._payload) ? inserted : inserted[0]);
      return { data: out, error: null };
    }

    if (this._mode === "update") {
      const matched = this._applyFilters(store);
      matched.forEach((r) => Object.assign(r, this._payload, { updated_at: new Date().toISOString() }));
      this.client.saveTable(this.table);
      if (this._single) return { data: matched[0] ?? null, error: null };
      return { data: matched, error: null };
    }

    if (this._mode === "delete") {
      const matched = this._applyFilters(store);
      matched.forEach((r) => {
        const idx = store.indexOf(r);
        if (idx >= 0) store.splice(idx, 1);
      });
      this.client.saveTable(this.table);
      return { data: matched, error: null };
    }

    // Select mode
    let rows = this._applyFilters(store);

    if (this._order) {
      const { col, ascending } = this._order;
      rows = [...rows].sort((a, b) => {
        if (a[col] === b[col]) return 0;
        const gt = a[col] > b[col];
        return ascending ? (gt ? 1 : -1) : gt ? -1 : 1;
      });
    }

    if (this._selectOpts.count === "exact" && this._selectOpts.head) {
      return { count: rows.length, data: null, error: null };
    }

    if (this._limit != null) rows = rows.slice(0, this._limit);

    // Embed foreign key relationships if requested
    rows = rows.map((r) => {
      const row = { ...r };
      if (this._select.includes("caregiver:caregiver_id") || this._select.includes("inviter:invited_by")) {
        const cgId = row.caregiver_id || row.invited_by;
        const cg = this.client.getTable("caregiver").find((c) => c.caregiver_id === cgId) || null;
        row.caregiver = cg ? { ...cg } : null;
        row.inviter = cg ? { ...cg } : null;
      }
      if (this._select.includes("patient:patient_id")) {
        const pt = this.client.getTable("patient").find((p) => p.patient_id === row.patient_id) || null;
        row.patient = pt ? { ...pt } : null;
      }
      return row;
    });

    if (this._single) return { data: rows[0] ?? null, error: null };
    return { data: rows, error: null };
  }

  then(resolve, reject) {
    try {
      resolve(this._resolve());
    } catch (err) {
      if (reject) reject(err);
      else resolve({ data: null, error: err });
    }
  }
}

export class LocalSupabaseClient {
  constructor() {
    this.tables = {
      caregiver: loadTable("caregiver", seedCaregivers).map((row) => ({ ...row, auth_user_id: row.auth_user_id || row.caregiver_id })),
      patient: loadTable("patient", seedPatients),
      caregiver_pat: loadTable("caregiver_pat", seedCaregiverPat),
      emergency_contact: loadTable("emergency_contact", seedEmergencyContacts),
      medication: loadTable("medication", seedMedications),
      medication_schedule: loadTable("medication_schedule", seedMedicationSchedules),
      medication_log: loadTable("medication_log", []),
      daily_care_log: loadTable("daily_care_log", seedDailyCareLogs),
      time_event: loadTable("time_event", seedTimeEvents),
      timeline_commend: loadTable("timeline_commend", seedTimelineComments),
      invitation: loadTable("invitation", []),
      caregiver_sleep_log: loadTable("caregiver_sleep_log", []),
      care_alert: loadTable("care_alert", []),
      notification: loadTable("notification", []),
      login_audit: loadTable("login_audit", []),
      care_task_template: loadTable("care_task_template", []),
      care_task: loadTable("care_task", []),
      care_task_history: loadTable("care_task_history", []),
      task_suggestion: loadTable("task_suggestion", []),
      role_permission: loadTable("role_permission", []),
      care_circle_invite: loadTable("care_circle_invite", seedCareCircleInvites),
      coordination_metric: loadTable("coordination_metric", seedCoordinationMetrics),
      scenario_card: loadTable("scenario_card", seedScenarioCards),
      scenario_option: loadTable("scenario_option", seedScenarioOptions),
      scenario_attempt: loadTable("scenario_attempt", seedScenarioAttempts),
      health_report: loadTable("health_report", seedHealthReports),
      appointment: loadTable("appointment", seedAppointments),
    };

    // Restore or initialize active session
    let initialSession = null;
    try {
      const savedAuth = localStorage.getItem("continuum_local_session");
      if (savedAuth) {
        initialSession = JSON.parse(savedAuth);
      }
    } catch (e) {
      console.warn("[LocalSupabase] Could not load saved session:", e);
    }

    this._session = initialSession;
    this._listeners = new Set();
  }

  getTable(name) {
    if (!this.tables[name]) this.tables[name] = [];
    return this.tables[name];
  }

  saveTable(name) {
    saveTable(name, this.tables[name] || []);
  }

  from(table) {
    return new LocalQuery(table, this);
  }

  get auth() {
    const self = this;
    return {
      async getSession() {
        return { data: { session: self._session }, error: null };
      },
      async getUser() {
        return { data: { user: self._session?.user || null }, error: null };
      },
      async signInWithPassword({ email }) {
        const caregivers = self.getTable("caregiver");
        let cg = caregivers.find((c) => c.email?.toLowerCase() === email?.toLowerCase());
        if (!cg) {
          return { data: { user: null, session: null }, error: new Error("Invalid login credentials") };
        }
        const user = {
          id: cg.caregiver_id,
          email: cg.email,
          user_metadata: { full_name: cg.full_name, phone: cg.phone, language: cg.language || "English" },
        };
        self._session = { user, access_token: "local-token-" + Date.now() };
        localStorage.setItem("continuum_local_session", JSON.stringify(self._session));
        self._notifyAuthChange("SIGNED_IN", self._session);
        return { data: { user, session: self._session }, error: null };
      },
      async signUp({ email, options }) {
        const caregivers = self.getTable("caregiver");
        const existing = caregivers.find((c) => c.email?.toLowerCase() === email?.toLowerCase());
        if (existing) {
          return { data: { user: null, session: null }, error: new Error("User already registered") };
        }
        const userId = `cg-${Date.now()}-${idCounter++}`;
        const newCaregiver = {
          caregiver_id: userId,
          auth_user_id: userId,
          full_name: options?.data?.full_name || email.split("@")[0],
          email,
          phone: options?.data?.phone || "",
          language: options?.data?.language || "English",
          created_at: new Date().toISOString(),
        };
        caregivers.push(newCaregiver);
        self.saveTable("caregiver");

        const user = {
          id: userId,
          email,
          user_metadata: { full_name: newCaregiver.full_name, phone: newCaregiver.phone, language: newCaregiver.language },
        };
        self._session = { user, access_token: "local-token-" + Date.now() };
        localStorage.setItem("continuum_local_session", JSON.stringify(self._session));
        self._notifyAuthChange("SIGNED_IN", self._session);
        return { data: { user, session: self._session }, error: null };
      },
      async signOut() {
        self._session = null;
        localStorage.removeItem("continuum_local_session");
        self._notifyAuthChange("SIGNED_OUT", null);
        return { error: null };
      },
      onAuthStateChange(callback) {
        self._listeners.add(callback);
        return {
          data: {
            subscription: {
              unsubscribe() {
                self._listeners.delete(callback);
              },
            },
          },
        };
      },
    };
  }

  _notifyAuthChange(event, session) {
    this._listeners.forEach((fn) => {
      try {
        fn(event, session);
      } catch (err) {
        console.error("[LocalSupabase] Auth listener error:", err);
      }
    });
  }

  resetAll() {
    Object.keys(this.tables).forEach((k) => localStorage.removeItem(STORAGE_KEY_PREFIX + k));
    localStorage.removeItem("continuum_local_session");
    this.tables = {
      caregiver: seedCaregivers.map((row) => ({ ...row, auth_user_id: row.auth_user_id || row.caregiver_id })),
      patient: seedPatients,
      caregiver_pat: seedCaregiverPat,
      emergency_contact: seedEmergencyContacts,
      medication: seedMedications,
      medication_schedule: seedMedicationSchedules,
      medication_log: [],
      daily_care_log: seedDailyCareLogs,
      time_event: seedTimeEvents,
      timeline_commend: seedTimelineComments,
      invitation: [],
      caregiver_sleep_log: [],
      care_alert: [],
      notification: [],
      login_audit: [],
      care_task_template: [],
      care_task: [],
      care_task_history: [],
      task_suggestion: [],
      role_permission: [],
      care_circle_invite: seedCareCircleInvites,
      coordination_metric: seedCoordinationMetrics,
      scenario_card: seedScenarioCards,
      scenario_option: seedScenarioOptions,
      scenario_attempt: seedScenarioAttempts,
      health_report: seedHealthReports,
      appointment: seedAppointments,
    };
    this._session = null;
    this._notifyAuthChange("SIGNED_OUT", null);
  }
}

export const localSupabase = new LocalSupabaseClient();
