// A minimal stand-in for the Supabase JS query builder — just enough of
// its chainable API (select/eq/in/is/gte/order/limit/single/insert/update
// + basic foreign-table embedding) to run the real PatientContext and
// patientApi code against in-memory fixtures instead of a live project.
// Not a general-purpose Supabase mock — scoped to exactly the query
// shapes this app actually issues.

let idCounter = 1000;
const PK_COLUMN = {
  patient: "patient_id",
  emergency_contact: "contact_id",
  medication: "medication_id",
  medication_schedule: "schedule_id",
  daily_care_log: "log_id",
  coordination_metric: "metric_id",
};

function embedRelations(table, row, selectString, caregivers) {
  if (!selectString || !selectString.includes("caregiver:caregiver_id")) return row;
  const caregiver = caregivers?.find((c) => c.caregiver_id === row.caregiver_id) || null;
  return { ...row, caregiver: caregiver ? { ...caregiver } : null };
}

class MockQuery {
  constructor(table, store, caregiversRef) {
    this.table = table;
    this.store = store;
    this.caregiversRef = caregiversRef;
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
    this.filters.push((r) => vals.includes(r[col]));
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
  update(payload) {
    this._mode = "update";
    this._payload = payload;
    return this;
  }

  _applyFilters(rows) {
    return this.filters.reduce((acc, fn) => acc.filter(fn), rows);
  }

  _resolve() {
    if (this._mode === "insert") {
      const pkCol = PK_COLUMN[this.table];
      const row = { ...this._payload };
      if (pkCol && !row[pkCol]) row[pkCol] = `mock-${this.table}-${idCounter++}`;
      this.store.push(row);
      const out = this._single ? row : [row];
      return { data: out, error: null };
    }

    if (this._mode === "update") {
      const matched = this._applyFilters(this.store);
      matched.forEach((r) => Object.assign(r, this._payload));
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

    rows = rows.map((r) => embedRelations(this.table, { ...r }, this._select, this.caregiversRef));

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
  return {
    from(table) {
      if (!tables[table]) tables[table] = [];
      return new MockQuery(table, tables[table], tables.caregiver || []);
    },
    _tables: tables, // exposed for test assertions
  };
}
