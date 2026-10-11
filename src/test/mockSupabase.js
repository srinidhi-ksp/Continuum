// Enhanced Mock Query Builder for Vitest testing
let idCounter = 1000;
const PK_COLUMN = {
  patient: "patient_id",
  caregiver: "caregiver_id",
  emergency_contact: "contact_id",
  medication: "medication_id",
  medication_schedule: "schedule_id",
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
  caregiver_pat: null, // composite PK — no auto-ID needed
};

function embedRelations(table, row, selectString, caregivers, patients) {
  if (!selectString) return row;
  let out = { ...row };
  if (selectString.includes("caregiver:caregiver_id") || selectString.includes("inviter:invited_by")) {
    const cgId = row.caregiver_id || row.invited_by;
    const caregiver = caregivers?.find((c) => c.caregiver_id === cgId) || null;
    out.caregiver = caregiver ? { ...caregiver } : null;
    out.inviter = caregiver ? { ...caregiver } : null;
  }
  if (selectString.includes("patient:patient_id")) {
    const patient = patients?.find((p) => p.patient_id === row.patient_id) || null;
    out.patient = patient ? { ...patient } : null;
  }
  return out;
}

class MockQuery {
  constructor(table, store, caregiversRef, patientsRef) {
    this.table = table;
    this.store = store;
    this.caregiversRef = caregiversRef;
    this.patientsRef = patientsRef;
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
    if (this._mode === "insert" || this._mode === "upsert") {
      const pkCol = PK_COLUMN[this.table];
      const row = { ...this._payload };
      if (pkCol && !row[pkCol]) row[pkCol] = `mock-${this.table}-${idCounter++}`;

      if (this._mode === "upsert" && pkCol && row[pkCol]) {
        const idx = this.store.findIndex((r) => r[pkCol] === row[pkCol]);
        if (idx >= 0) {
          this.store[idx] = { ...this.store[idx], ...row };
          const out = this._single ? this.store[idx] : [this.store[idx]];
          return { data: out, error: null };
        }
      }

      this.store.push(row);
      const out = this._single ? row : [row];
      return { data: out, error: null };
    }

    if (this._mode === "update") {
      const matched = this._applyFilters(this.store);
      matched.forEach((r) => Object.assign(r, this._payload));
      if (this._single) return { data: matched[0] ?? null, error: null };
      return { data: matched, error: null };
    }

    if (this._mode === "delete") {
      const matched = this._applyFilters(this.store);
      matched.forEach((r) => {
        const idx = this.store.indexOf(r);
        if (idx >= 0) this.store.splice(idx, 1);
      });
      return { data: matched, error: null };
    }

    let rows = this._applyFilters(this.store);

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

    rows = rows.map((r) =>
      embedRelations(this.table, { ...r }, this._select, this.caregiversRef, this.patientsRef)
    );

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

export function createMockSupabase(fixtureTables) {
  const tables = { ...fixtureTables };

  // Pre-authenticate as the first fixture caregiver so RequireAuth passes
  const firstCg = (fixtureTables.caregiver || [])[0];
  const mockUser = firstCg
    ? { id: firstCg.caregiver_id, email: firstCg.email, user_metadata: { full_name: firstCg.full_name } }
    : null;
  let mockSession = mockUser ? { user: mockUser, access_token: "mock-token" } : null;

  return {
    from(table) {
      if (!tables[table]) tables[table] = [];
      return new MockQuery(table, tables[table], tables.caregiver || [], tables.patient || []);
    },
    auth: {
      async getSession() {
        return { data: { session: mockSession }, error: null };
      },
      async signUp({ email, options }) {
        const userId = `mock-user-${idCounter++}`;
        const user = { id: userId, email, user_metadata: options?.data || {} };
        mockSession = { user, access_token: "mock-token" };

        if (!tables.caregiver) tables.caregiver = [];
        tables.caregiver.push({
          caregiver_id: userId,
          full_name: options?.data?.full_name || email.split("@")[0],
          email,
          phone: options?.data?.phone || null,
        });

        return { data: { user, session: mockSession }, error: null };
      },
      async signInWithPassword({ email }) {
        let cg = (tables.caregiver || []).find((c) => c.email === email);
        if (!cg) {
          cg = {
            caregiver_id: `mock-user-${idCounter++}`,
            full_name: email.split("@")[0],
            email,
          };
          if (!tables.caregiver) tables.caregiver = [];
          tables.caregiver.push(cg);
        }
        const user = { id: cg.caregiver_id, email: cg.email };
        mockSession = { user, access_token: "mock-token" };
        return { data: { user, session: mockSession }, error: null };
      },
      async signOut() {
        mockSession = null;
        return { error: null };
      },
      onAuthStateChange() {
        return {
          data: {
            subscription: {
              unsubscribe() {},
            },
          },
        };
      },
    },
    _tables: tables,
  };
}
