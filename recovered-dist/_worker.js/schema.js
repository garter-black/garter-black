/* garter.black · core + roster schema. Applied idempotently once per isolate (see index.js). */
export const CORE_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS staff (email TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'staff', added_by TEXT, added_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS log (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, who TEXT, action TEXT NOT NULL, detail TEXT)`,
  `CREATE INDEX IF NOT EXISTS log_at ON log(at)`,
  `CREATE TABLE IF NOT EXISTS throttle (k TEXT PRIMARY KEY, n INTEGER NOT NULL, reset_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS ladies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    age INTEGER CHECK (age IS NULL OR (age >= 18 AND age <= 80)),
    height_cm INTEGER CHECK (height_cm IS NULL OR (height_cm BETWEEN 120 AND 220)),
    weight_kg INTEGER CHECK (weight_kg IS NULL OR (weight_kg BETWEEN 35 AND 200)),
    dress TEXT, bust TEXT, hair TEXT, nationality TEXT, languages TEXT,
    services TEXT NOT NULL DEFAULT '[]',
    bio TEXT,
    photos TEXT NOT NULL DEFAULT '[]',
    active INTEGER NOT NULL DEFAULT 1,
    last_worked TEXT,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, created_by TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS roster (
    day TEXT NOT NULL, lady_id INTEGER NOT NULL, pos INTEGER NOT NULL DEFAULT 0,
    start TEXT, end TEXT, arrived_at TEXT, note TEXT, updated_at TEXT, updated_by TEXT,
    PRIMARY KEY (day, lady_id),
    FOREIGN KEY (lady_id) REFERENCES ladies(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS roster_lady ON roster(lady_id, day)`,
  `CREATE TABLE IF NOT EXISTS enquiries (
    id INTEGER PRIMARY KEY AUTOINCREMENT, lady_id INTEGER, name TEXT, channel TEXT NOT NULL, handle TEXT NOT NULL,
    message TEXT, notify INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL DEFAULT 'new',
    created_at TEXT NOT NULL, notified_at TEXT, ip TEXT,
    FOREIGN KEY (lady_id) REFERENCES ladies(id) ON DELETE SET NULL
  )`,
  `CREATE INDEX IF NOT EXISTS enq_lady ON enquiries(lady_id, status)`,
  `CREATE TABLE IF NOT EXISTS outbox (
    id INTEGER PRIMARY KEY AUTOINCREMENT, enquiry_id INTEGER, lady_id INTEGER, channel TEXT NOT NULL, handle TEXT NOT NULL,
    body TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'queued', created_at TEXT NOT NULL, sent_at TEXT, sent_by TEXT, error TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS outbox_status ON outbox(status, created_at)`,
  `CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT, lady_id INTEGER NOT NULL, rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    body TEXT, name TEXT, status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL, ip TEXT, decided_by TEXT, decided_at TEXT,
    FOREIGN KEY (lady_id) REFERENCES ladies(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS rev_lady ON reviews(lady_id, status)`,
  `CREATE TABLE IF NOT EXISTS tips (
    id INTEGER PRIMARY KEY AUTOINCREMENT, ref TEXT NOT NULL UNIQUE, lady_id INTEGER, lady_name TEXT,
    amount_cents INTEGER NOT NULL, currency TEXT NOT NULL DEFAULT 'aud',
    tipper TEXT, message TEXT, status TEXT NOT NULL DEFAULT 'created',
    stripe_pi TEXT UNIQUE, fee_cents INTEGER,
    reception TEXT, cleaners TEXT, roster_day TEXT,
    lady_cents INTEGER, reception_cents INTEGER, cleaners_cents INTEGER, management_cents INTEGER, owner_cents INTEGER,
    payout_status TEXT NOT NULL DEFAULT 'owed',
    created_at TEXT NOT NULL, paid_at TEXT, ip TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS tips_day ON tips(roster_day, status)`,
];
