/* ============================================================
   garter.black · forum (f_ tables, /api/forum/*, /forum/*)
   Server side rendering + JSON API. Owned by the forum worker.
   ============================================================ */
import {
  clean, fail, json, readJSON, userSession, staffSession, signToken, readToken,
  hashPassword, verifyPassword, verifyGoogle, settings, audit, ipHash, limitOrFail,
  setCookie, clearCookie, injectMeta, esc, slugify,
} from "./lib.js";
import {
  md, txt, ago, hotOf, wilson, FLAIRS, KINDS, SORTS, WINDOWS, windowCutoff,
  contactRisk, minorsRisk, mentionNames, safeUrl, encCursor, decCursor,
} from "./forum-shared.js";
import * as R from "./forum-render.js";

const DAY = 86400000;

/* ============================================================
   SCHEMA (idempotent; applied once per isolate by index.js)
   ============================================================ */
export const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS f_boards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    desc TEXT NOT NULL DEFAULT '',
    pos INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS f_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    display TEXT NOT NULL,
    pass_hash TEXT,
    email TEXT,
    google_sub TEXT,
    role TEXT NOT NULL DEFAULT 'member',
    karma INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'live',
    banned_at TEXT, banned_by TEXT, ban_reason TEXT,
    created_at TEXT NOT NULL, last_seen TEXT
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS f_members_u ON f_members(username)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS f_members_g ON f_members(google_sub)`,
  `CREATE INDEX IF NOT EXISTS f_members_e ON f_members(email)`,
  `CREATE TABLE IF NOT EXISTS f_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    board_id INTEGER NOT NULL,
    author_id INTEGER NOT NULL,
    kind TEXT NOT NULL DEFAULT 'text',
    title TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    url TEXT,
    flair TEXT,
    brothel_id INTEGER,
    r_overall INTEGER, r_rooms INTEGER, r_service INTEGER, r_value INTEGER,
    worker_name TEXT, visit_month TEXT,
    status TEXT NOT NULL DEFAULT 'live',
    pin INTEGER NOT NULL DEFAULT 0,
    locked INTEGER NOT NULL DEFAULT 0,
    ups INTEGER NOT NULL DEFAULT 0, downs INTEGER NOT NULL DEFAULT 0,
    hot REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL, edited_at TEXT, ip TEXT,
    FOREIGN KEY (board_id) REFERENCES f_boards(id),
    FOREIGN KEY (author_id) REFERENCES f_members(id)
  )`,
  `CREATE INDEX IF NOT EXISTS f_posts_hot ON f_posts(status, hot)`,
  `CREATE INDEX IF NOT EXISTS f_posts_board ON f_posts(board_id, status, hot)`,
  `CREATE INDEX IF NOT EXISTS f_posts_new ON f_posts(status, created_at)`,
  `CREATE INDEX IF NOT EXISTS f_posts_auth ON f_posts(author_id, status, created_at)`,
  `CREATE INDEX IF NOT EXISTS f_posts_br ON f_posts(brothel_id, status, created_at)`,
  `CREATE TABLE IF NOT EXISTS f_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    parent_id INTEGER,
    author_id INTEGER NOT NULL,
    body TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'live',
    ups INTEGER NOT NULL DEFAULT 0, downs INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL, edited_at TEXT, ip TEXT,
    FOREIGN KEY (post_id) REFERENCES f_posts(id),
    FOREIGN KEY (author_id) REFERENCES f_members(id)
  )`,
  `CREATE INDEX IF NOT EXISTS f_comments_post ON f_comments(post_id, status, created_at)`,
  `CREATE INDEX IF NOT EXISTS f_comments_parent ON f_comments(parent_id)`,
  `CREATE INDEX IF NOT EXISTS f_comments_auth ON f_comments(author_id, status, created_at)`,
  `CREATE TABLE IF NOT EXISTS f_votes (
    member_id INTEGER NOT NULL, t TEXT NOT NULL, tid INTEGER NOT NULL, val INTEGER NOT NULL, at TEXT NOT NULL,
    PRIMARY KEY (member_id, t, tid)
  )`,
  `CREATE TABLE IF NOT EXISTS f_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER NOT NULL, t TEXT NOT NULL, tid INTEGER NOT NULL,
    reason TEXT, status TEXT NOT NULL DEFAULT 'open',
    created_at TEXT NOT NULL, decided_by TEXT, decided_at TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS f_reports_open ON f_reports(status, t, tid)`,
  `CREATE TABLE IF NOT EXISTS f_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_id INTEGER NOT NULL, to_id INTEGER NOT NULL, body TEXT NOT NULL,
    created_at TEXT NOT NULL, read_at TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS f_messages_to ON f_messages(to_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS f_messages_from ON f_messages(from_id, created_at)`,
  `CREATE TABLE IF NOT EXISTS f_blocks (
    member_id INTEGER NOT NULL, blocked_id INTEGER NOT NULL, at TEXT NOT NULL,
    PRIMARY KEY (member_id, blocked_id)
  )`,
  `CREATE TABLE IF NOT EXISTS f_subs (
    member_id INTEGER NOT NULL, t TEXT NOT NULL, tid INTEGER NOT NULL, at TEXT NOT NULL,
    PRIMARY KEY (member_id, t, tid)
  )`,
  `CREATE TABLE IF NOT EXISTS f_notifs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER NOT NULL, kind TEXT NOT NULL,
    post_id INTEGER, comment_id INTEGER, actor_id INTEGER,
    snippet TEXT, at TEXT NOT NULL, read_at TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS f_notifs_m ON f_notifs(member_id, at)`,
  `CREATE TABLE IF NOT EXISTS f_brothels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL, suburb TEXT, address TEXT, phone TEXT, website TEXT,
    hours TEXT, notes TEXT, sources TEXT, confidence TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS f_brothels_sub ON f_brothels(suburb, name)`,
  `CREATE TABLE IF NOT EXISTS f_suggestions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    brothel_id INTEGER NOT NULL, member_id INTEGER NOT NULL,
    body TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open',
    created_at TEXT NOT NULL, decided_by TEXT, decided_at TEXT
  )`,
  /* boards seed (idempotent) */
  `INSERT OR IGNORE INTO f_boards(slug,name,desc,pos,created_at) VALUES('general','General discussion','The floor. Anything on topic.',0,strftime('%Y-%m-%dT%H:%M:%SZ','now'))`,
  `INSERT OR IGNORE INTO f_boards(slug,name,desc,pos,created_at) VALUES('reviews','Field reports and reviews','Your own genuine experience only. Working names, never real ones.',1,strftime('%Y-%m-%dT%H:%M:%SZ','now'))`,
  `INSERT OR IGNORE INTO f_boards(slug,name,desc,pos,created_at) VALUES('whos-working','Who''s working','Who is on tonight, and where.',2,strftime('%Y-%m-%dT%H:%M:%SZ','now'))`,
  `INSERT OR IGNORE INTO f_boards(slug,name,desc,pos,created_at) VALUES('brothels','Brothel news and openings','Openings, closings and changes across Sydney.',3,strftime('%Y-%m-%dT%H:%M:%SZ','now'))`,
  `INSERT OR IGNORE INTO f_boards(slug,name,desc,pos,created_at) VALUES('escorts','Independent escorts','Independents and their updates.',4,strftime('%Y-%m-%dT%H:%M:%SZ','now'))`,
  `INSERT OR IGNORE INTO f_boards(slug,name,desc,pos,created_at) VALUES('massage','Massage parlours','Shops, services and notes.',5,strftime('%Y-%m-%dT%H:%M:%SZ','now'))`,
  `INSERT OR IGNORE INTO f_boards(slug,name,desc,pos,created_at) VALUES('newbies','New to it','Ask the questions you were afraid to ask.',6,strftime('%Y-%m-%dT%H:%M:%SZ','now'))`,
  `INSERT OR IGNORE INTO f_boards(slug,name,desc,pos,created_at) VALUES('lounge','The ladies'' lounge','For workers, by workers.',7,strftime('%Y-%m-%dT%H:%M:%SZ','now'))`,
  `INSERT OR IGNORE INTO f_boards(slug,name,desc,pos,created_at) VALUES('offtopic','Off topic','Everything else.',8,strftime('%Y-%m-%dT%H:%M:%SZ','now'))`,
  `INSERT OR IGNORE INTO f_boards(slug,name,desc,pos,created_at) VALUES('meta','Site feedback','Bugs, ideas and moderation notes.',9,strftime('%Y-%m-%dT%H:%M:%SZ','now'))`,
];

/* Full text search is created lazily so a missing FTS5 build cannot break the schema apply. */
const FTS_SQL = [
  `CREATE VIRTUAL TABLE IF NOT EXISTS f_fts USING fts5(title, body, content='f_posts', content_rowid='id')`,
  `CREATE TRIGGER IF NOT EXISTS f_fts_ai AFTER INSERT ON f_posts BEGIN INSERT INTO f_fts(rowid,title,body) VALUES (new.id,new.title,new.body); END`,
  `CREATE TRIGGER IF NOT EXISTS f_fts_ad AFTER DELETE ON f_posts BEGIN INSERT INTO f_fts(f_fts,rowid,title,body) VALUES ('delete',old.id,old.title,old.body); END`,
  `CREATE TRIGGER IF NOT EXISTS f_fts_au AFTER UPDATE OF title,body ON f_posts BEGIN INSERT INTO f_fts(f_fts,rowid,title,body) VALUES ('delete',old.id,old.title,old.body); INSERT INTO f_fts(rowid,title,body) VALUES (new.id,new.title,new.body); END`,
];
let FTS = null;
export async function readyAux(env) {
  if (FTS !== null) return FTS;
  try {
    await env.DB.batch(FTS_SQL.map((s) => env.DB.prepare(s)));
    FTS = true;
  } catch (e) {
    FTS = false; // search falls back to indexed LIKE
    console.log("forum: fts5 unavailable,", e && e.message);
  }
  return FTS;
}

/* ============================================================
   tiny caches
   ============================================================ */
let BOARDS = null, BOARDS_AT = 0;
async function getBoards(env) {
  if (BOARDS && Date.now() - BOARDS_AT < 30000) return BOARDS;
  const r = await env.DB.prepare("SELECT * FROM f_boards ORDER BY pos").all();
  BOARDS = r.results || [];
  BOARDS_AT = Date.now();
  return BOARDS;
}
let TOPS = null, TOPS_AT = 0;
async function getTopBrothels(env) {
  if (TOPS && Date.now() - TOPS_AT < 60000) return TOPS;
  const since = new Date(Date.now() - 30 * DAY).toISOString();
  const r = await env.DB.prepare(
    `SELECT b.id, b.slug, b.name, b.suburb, COUNT(p.id) AS n, AVG(p.r_overall) AS a
     FROM f_brothels b JOIN f_posts p ON p.brothel_id = b.id AND p.kind = 'review' AND p.status = 'live' AND p.created_at >= ?
     GROUP BY b.id ORDER BY n DESC, a DESC, b.name LIMIT 5`
  ).bind(since).all();
  TOPS = r.results || [];
  TOPS_AT = Date.now();
  return TOPS;
}
let SHELL = null, SHELL_AT = 0;
async function getShell(env, url) {
  if (SHELL && Date.now() - SHELL_AT < 30000) return SHELL;
  let r = await env.ASSETS.fetch(new Request(url.origin + "/forum/_shell"));
  if (!r.ok) r = await env.ASSETS.fetch(new Request(url.origin + "/forum/_shell.html"));
  if (!r.ok) fail(500, "The forum shell is not built yet.");
  SHELL = await r.text();
  SHELL_AT = Date.now();
  return SHELL;
}

/* ============================================================
   auth helpers
   ============================================================ */
async function memberBy(request, env) {
  const s = await userSession(request, env);
  if (!s || !s.uid) return null;
  const m = await env.DB.prepare("SELECT * FROM f_members WHERE id=?").bind(s.uid).first();
  if (!m || m.status === "deleted") return null;
  return m;
}
const pub = (m) => (m ? { id: m.id, u: m.username, role: m.role, karma: +m.karma || 0, created_at: m.created_at, status: m.status } : null);
function need(m) { if (!m) fail(401, "Sign in first"); return m; }
function live(m) { if (m.status === "banned") fail(403, "Your account is suspended"); return m; }

async function modWho(request, env) {
  const st = await staffSession(request, env);
  if (st) return { name: st.name || st.role || "staff", staff: true, member: null };
  const m = await memberBy(request, env);
  if (m && (m.role === "mod" || m.role === "admin") && m.status !== "banned") return { name: "u/" + m.username, staff: false, member: m };
  return null;
}

async function issueCookie(env, m) {
  const tok = await signToken(env, { uid: m.id, u: m.username, exp: Date.now() + 30 * DAY });
  return setCookie("gb_user", tok, 2592000);
}

/* ============================================================
   feed query (cursor paginated)
   ============================================================ */
const FEED_COLS = `p.id, p.board_id, p.author_id, p.kind, p.title, p.body, p.url, p.flair,
  p.brothel_id, p.r_overall, p.r_rooms, p.r_service, p.r_value, p.worker_name, p.visit_month,
  p.status, p.pin, p.locked, p.ups, p.downs, p.hot, p.created_at, p.edited_at,
  m.username, m.display, m.karma AS author_karma, m.status AS author_status,
  b.slug AS board_slug, b.name AS board_name, br.slug AS brothel_slug, br.name AS brothel_name,
  (SELECT COUNT(*) FROM f_comments c WHERE c.post_id = p.id AND c.status = 'live') AS ncomments,
  (SELECT val FROM f_votes v WHERE v.member_id = ? AND v.t = 'post' AND v.tid = p.id) AS my_vote`;

async function feedQuery(env, { boardId = null, sort = "hot", t = null, uid = 0, cursor = null, limit = 25 }) {
  const now = Date.now();
  const keyExpr = sort === "new" ? "p.created_at" : sort === "top" ? "(p.ups - p.downs)" : "p.hot";
  let cutoff = null;
  if (sort === "rising") cutoff = new Date(now - 3 * DAY).toISOString();
  else if (t) cutoff = windowCutoff(t, now);

  const binds = [uid];
  let where = "p.status = 'live'";
  if (boardId) { where += " AND p.board_id = ?"; binds.push(boardId); }
  if (cutoff) { where += " AND p.created_at >= ?"; binds.push(cutoff); }
  if (cursor && cursor.i) {
    where += ` AND (p.pin < ? OR (p.pin = ? AND (${keyExpr} < ? OR (${keyExpr} = ? AND p.id < ?))))`;
    binds.push(+cursor.p || 0, +cursor.p || 0, cursor.a, cursor.a, +cursor.i || 0);
  }
  binds.push(limit + 1);
  const sql = `SELECT ${FEED_COLS} FROM f_posts p
    JOIN f_members m ON m.id = p.author_id
    JOIN f_boards b ON b.id = p.board_id
    LEFT JOIN f_brothels br ON br.id = p.brothel_id
    WHERE ${where}
    ORDER BY p.pin DESC, ${keyExpr} DESC, p.id DESC LIMIT ?`;
  const r = await env.DB.prepare(sql).bind(...binds).all();
  const rows = r.results || [];
  const hasMore = rows.length > limit;
  const out = rows.slice(0, limit);
  const last = out[out.length - 1];
  const next = hasMore && last ? { p: +last.pin || 0, a: sort === "new" ? last.created_at : sort === "top" ? (+last.ups || 0) - (+last.downs || 0) : +last.hot, i: last.id } : null;
  return { rows: out, next };
}

/* ============================================================
   comments
   ============================================================ */
async function commentsFor(env, postId, uid, includePendingFor = 0, isMod = false) {
  const sql = `SELECT c.id, c.post_id, c.parent_id, c.author_id, c.body, c.status, c.ups, c.downs, c.created_at, c.edited_at,
      m.username, m.display, m.karma AS author_karma, m.status AS author_status,
      (SELECT val FROM f_votes v WHERE v.member_id = ? AND v.t = 'comment' AND v.tid = c.id) AS my_vote
    FROM f_comments c JOIN f_members m ON m.id = c.author_id
    WHERE c.post_id = ? AND (c.status = 'live' OR (c.status = 'pending' AND (c.author_id = ? OR ?)))
    ORDER BY c.created_at ASC LIMIT 1000`;
  const r = await env.DB.prepare(sql).bind(uid, postId, includePendingFor, isMod ? 1 : 0).all();
  const rows = (r.results || []).map((c) => ({ ...c, kids: [] }));
  const by = new Map(rows.map((c) => [c.id, c]));
  const roots = [];
  for (const c of rows) {
    if (c.parent_id && by.has(c.parent_id)) by.get(c.parent_id).kids.push(c);
    else roots.push(c);
  }
  return roots;
}

function sortTree(nodes, cs) {
  const cmp = {
    best: (a, b) => wilson(b.ups, b.downs) - wilson(a.ups, a.downs) || String(a.created_at).localeCompare(String(b.created_at)),
    top: (a, b) => ((+b.ups || 0) - (+b.downs || 0)) - ((+a.ups || 0) - (+a.downs || 0)) || String(a.created_at).localeCompare(String(b.created_at)),
    new: (a, b) => String(b.created_at).localeCompare(String(a.created_at)),
    old: (a, b) => String(a.created_at).localeCompare(String(b.created_at)),
  }[cs] || null;
  if (!cmp) return nodes;
  nodes.sort(cmp);
  for (const n of nodes) if (n.kids && n.kids.length) sortTree(n.kids, cs);
  return nodes;
}

/* ============================================================
   notify helper
   ============================================================ */
async function addNotifs(env, items) {
  if (!items || !items.length) return;
  const stmts = items.slice(0, 80).map((n) =>
    env.DB.prepare("INSERT INTO f_notifs(member_id, kind, post_id, comment_id, actor_id, snippet, at) VALUES(?,?,?,?,?,?,?)")
      .bind(n.member_id, n.kind, n.post_id || null, n.comment_id || null, n.actor_id || null, n.snippet || null, n.at || new Date().toISOString()));
  try { await env.DB.batch(stmts); } catch (e) { /* notifications never break the action */ }
}

/* ============================================================
   API
   ============================================================ */
export async function api(request, env, ctx, url) {
  await readyAux(env);
  const path = url.pathname.replace(/^\/api\/forum\/?/, "/");
  const seg = path.split("/").filter(Boolean);
  const method = request.method.toUpperCase();
  const m = await memberBy(request, env);

  /* ---- session ---- */
  if (path === "/me" && method === "GET") {
    const s = await settings(env);
    return json({ member: pub(m), google: !!s.google_client_id });
  }
  if (path === "/join" && method === "POST") {
    await limitOrFail(env, "join:" + (await ipHash(request, env)), 5, 3600);
    return await join(request, env);
  }
  if (path === "/login" && method === "POST") {
    await limitOrFail(env, "login:" + (await ipHash(request, env)), 10, 600);
    return await login(request, env);
  }
  if (path === "/logout" && method === "POST") {
    return json({ ok: true }, 200, { "set-cookie": clearCookie("gb_user") });
  }
  if (path === "/google" && method === "POST") return await googleStart(request, env);
  if (path === "/google/complete" && method === "POST") return await googleComplete(request, env);

  /* ---- feeds ---- */
  if (path === "/posts" && method === "GET") {
    const q = url.searchParams;
    const sort = SORTS.includes(q.get("sort")) ? q.get("sort") : "hot";
    const t = WINDOWS[q.get("t")] !== undefined ? q.get("t") : null;
    let boardId = null;
    const bs = q.get("board");
    if (bs) { const b = await boardBySlug(env, bs); if (b) boardId = b.id; }
    const cursor = decCursor(q.get("cursor"));
    const { rows, next } = await feedQuery(env, { boardId, sort, t, uid: m ? m.id : 0, cursor, limit: 25 });
    return json({ ok: true, html: R.feedRows(rows, m), next: next ? encCursor(next) : null });
  }

  /* ---- posts ---- */
  if (path === "/posts" && method === "POST") return await createPost(request, env, m);
  if (seg[0] === "posts" && seg[1] && seg[2] === "edit" && method === "POST") return await editPost(request, env, m, +seg[1]);
  if (seg[0] === "posts" && seg[1] && seg[2] === "delete" && method === "POST") return await deletePost(env, m, +seg[1]);
  if (seg[0] === "posts" && seg[1] && (seg[2] === "subscribe" || seg[2] === "unsubscribe") && method === "POST") return await subscribe(env, m, +seg[1], seg[2] === "subscribe");
  if (seg[0] === "posts" && seg[1] && seg[2] === "report" && method === "POST") return await report(request, env, m, "post", +seg[1]);

  /* ---- comments ---- */
  if (path === "/comments" && method === "GET") return await commentsMore(env, url, m);
  if (path === "/comments" && method === "POST") return await createComment(request, env, m);
  if (seg[0] === "comments" && seg[1] && seg[2] === "edit" && method === "POST") return await editComment(request, env, m, +seg[1]);
  if (seg[0] === "comments" && seg[1] && seg[2] === "delete" && method === "POST") return await deleteComment(env, m, +seg[1]);
  if (seg[0] === "comments" && seg[1] && seg[2] === "report" && method === "POST") return await report(request, env, m, "comment", +seg[1]);

  /* ---- votes ---- */
  if (path === "/vote" && method === "POST") return await vote(request, env, m);

  /* ---- brothels ---- */
  if (path === "/brothels" && method === "GET") return await brothelsApi(env, url);
  if (seg[0] === "brothels" && seg[1] && seg[2] === "suggest" && method === "POST") return await suggest(request, env, m, +seg[1]);

  /* ---- messages ---- */
  if (path === "/messages" && method === "GET") return await messagesMore(env, url, m);
  if (path === "/messages" && method === "POST") return await sendMessage(request, env, m);
  if (path === "/messages/block" && method === "POST") return await blockUser(request, env, m);

  /* ---- notifications ---- */
  if (path === "/notifications/read" && method === "POST") {
    need(m);
    await env.DB.prepare("UPDATE f_notifs SET read_at=? WHERE member_id=? AND read_at IS NULL").bind(new Date().toISOString(), m.id).run();
    return json({ ok: true });
  }

  /* ---- settings ---- */
  if (seg[0] === "settings" && seg[1] === "password" && method === "POST") return await setPassword(request, env, m);
  if (seg[0] === "settings" && seg[1] === "email" && method === "POST") return await setEmail(request, env, m);
  if (seg[0] === "settings" && seg[1] === "delete" && method === "POST") return await deleteAccount(request, env, m);

  /* ---- moderation ---- */
  if (path === "/mod/action" && method === "POST") return await modAction(request, env);

  /* ---- import ---- */
  if (path === "/admin/import" && method === "POST") return await importBrothels(request, env);

  return json({ error: "No such endpoint" }, 404);
}

/* ---------- auth ---------- */
async function join(request, env) {
  const b = await readJSON(request);
  const raw = clean(b.username, 30).trim();
  const username = raw.toLowerCase();
  if (!/^[a-z0-9_]{3,20}$/.test(username)) fail(400, "Username must be 3 to 20 characters: letters, numbers or underscore");
  if (["admin", "mod", "moderator", "system", "deleted", "garter", "blackgarter", "support", "staff", "hecate", "me"].includes(username)) fail(400, "That username is reserved");
  const password = String(b.password || "");
  if (password.length < 10 || password.length > 200) fail(400, "Password must be at least 10 characters");
  if (b.over18 !== true) fail(400, "You must be 18 or over and agree to the rules");
  const email = clean(b.email || "", 120).toLowerCase().trim();
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail(400, "That email does not look right");
  const dupe = await env.DB.prepare("SELECT id FROM f_members WHERE username=? OR (email IS NOT NULL AND email=?)").bind(username, email || null).first();
  if (dupe) fail(409, "That username or email is already taken");
  const hash = await hashPassword(password, 25000);
  const now = new Date().toISOString();
  const r = await env.DB.prepare("INSERT INTO f_members(username, display, pass_hash, email, role, karma, status, created_at, last_seen) VALUES(?,?,?,?,'member',0,'live',?,?)")
    .bind(username, raw.slice(0, 20), hash, email || null, now, now).run();
  const id = r.meta.last_row_id;
  const cookie = await issueCookie(env, { id, username });
  await audit(env, "u/" + username, "join", { id });
  return json({ ok: true, member: { id, u: username } }, 200, { "set-cookie": cookie });
}

async function login(request, env) {
  const b = await readJSON(request);
  const who = clean(b.username || "", 120).toLowerCase().trim();
  const password = String(b.password || "");
  if (!who || !password) fail(400, "Username and password required");
  const row = who.includes("@")
    ? await env.DB.prepare("SELECT * FROM f_members WHERE email=?").bind(who).first()
    : await env.DB.prepare("SELECT * FROM f_members WHERE username=?").bind(who).first();
  if (!row || row.status === "deleted") fail(401, "No account matches that");
  if (!row.pass_hash) fail(401, "This account signs in with Google");
  if (!(await verifyPassword(password, row.pass_hash))) fail(401, "No account matches that");
  await env.DB.prepare("UPDATE f_members SET last_seen=? WHERE id=?").bind(new Date().toISOString(), row.id).run();
  const cookie = await issueCookie(env, row);
  return json({ ok: true, member: pub(row) }, 200, { "set-cookie": cookie });
}

async function googleStart(request, env) {
  const s = await settings(env);
  const clientId = s.google_client_id;
  if (!clientId) fail(400, "Google sign in is not configured");
  const b = await readJSON(request);
  const info = await verifyGoogle(clean(b.credential, 8192), clientId);
  if (!info) fail(401, "Could not verify that Google account");
  let row = await env.DB.prepare("SELECT * FROM f_members WHERE google_sub=?").bind(info.sub).first();
  if (!row && info.email) row = await env.DB.prepare("SELECT * FROM f_members WHERE email=? AND status != 'deleted'").bind(info.email).first();
  if (row) {
    if (!row.google_sub) await env.DB.prepare("UPDATE f_members SET google_sub=? WHERE id=?").bind(info.sub, row.id).run();
    const cookie = await issueCookie(env, row);
    return json({ ok: true, member: pub(row) }, 200, { "set-cookie": cookie });
  }
  const temp = await signToken(env, { g: info.sub, e: info.email, exp: Date.now() + 15 * 60000 });
  return json({ ok: true, need_username: true, token: temp, email: info.email });
}

async function googleComplete(request, env) {
  const b = await readJSON(request);
  const t = await readToken(env, clean(b.token, 4096));
  if (!t || !t.g) fail(400, "That sign in link expired. Try again");
  const raw = clean(b.username, 30).trim();
  const username = raw.toLowerCase();
  if (!/^[a-z0-9_]{3,20}$/.test(username)) fail(400, "Username must be 3 to 20 characters: letters, numbers or underscore");
  const dupe = await env.DB.prepare("SELECT id FROM f_members WHERE username=? OR google_sub=?").bind(username, t.g).first();
  if (dupe) fail(409, "That username is already taken");
  const now = new Date().toISOString();
  const r = await env.DB.prepare("INSERT INTO f_members(username, display, google_sub, email, role, karma, status, created_at, last_seen) VALUES(?,?,?,?,'member',0,'live',?,?)")
    .bind(username, raw.slice(0, 20), t.g, t.e || null, now, now).run();
  const id = r.meta.last_row_id;
  const cookie = await issueCookie(env, { id, username });
  await audit(env, "u/" + username, "join:google", { id });
  return json({ ok: true, member: { id, u: username } }, 200, { "set-cookie": cookie });
}

/* ---------- boards & brothels ---------- */
async function boardBySlug(env, slug) {
  return await env.DB.prepare("SELECT * FROM f_boards WHERE slug=?").bind(clean(slug, 30).toLowerCase()).first();
}
async function brothelBySlugOrId(env, v) {
  const s = clean(v, 80);
  if (!s) return null;
  return await env.DB.prepare("SELECT * FROM f_brothels WHERE slug=? OR id=?").bind(s, /^\d+$/.test(s) ? +s : -1).first();
}

/* ---------- posts ---------- */
async function createPost(request, env, m) {
  need(m); live(m);
  await limitOrFail(env, "post:" + m.id, 10, 3600);
  const b = await readJSON(request);
  const board = await boardBySlug(env, b.board);
  if (!board) fail(400, "Pick a board");
  const kind = KINDS.includes(b.kind) ? b.kind : "text";
  const title = clean(b.title, 140).replace(/\s+/g, " ").trim();
  if (title.length < 3) fail(400, "Give it a real title");
  const body = clean(b.body, 8000);
  const flair = FLAIRS.includes(b.flair) ? b.flair : null;
  const now = new Date().toISOString();

  let url = null, brothel = null, r1 = null, r2 = null, r3 = null, r4 = null, worker = null, visit = null;
  if (kind === "link") {
    url = safeUrl(b.url);
    if (!url) fail(400, "A link post needs a http or https URL");
  }
  if (kind === "review") {
    brothel = await brothelBySlugOrId(env, b.brothel);
    if (!brothel) fail(400, "Pick the venue you are reviewing");
    const rate = (v) => { const n = Math.round(+v); return n >= 1 && n <= 5 ? n : null; };
    r1 = rate(b.overall); r2 = rate(b.rooms); r3 = rate(b.service); r4 = rate(b.value);
    if (!r1 || !r2 || !r3 || !r4) fail(400, "Rate overall, rooms, service and value from 1 to 5");
    worker = clean(b.worker_name, 40).replace(/\s+/g, " ").trim() || null;
    visit = /^\d{4}-\d{2}$/.test(String(b.visit_month || "")) ? b.visit_month : null;
  }
  if (kind === "text" && body.length < 2) fail(400, "Add some words to the post");

  let status = "live";
  const scan = kind === "link" ? title : title + "\n" + body;
  if (contactRisk(scan) || minorsRisk(scan)) status = "pending";
  if (kind === "link" && Date.now() - Date.parse(m.created_at) < DAY) status = "pending";

  const hot = hotOf(0, 0, now);
  const r = await env.DB.prepare(
    `INSERT INTO f_posts(board_id, author_id, kind, title, body, url, flair, brothel_id, r_overall, r_rooms, r_service, r_value, worker_name, visit_month, status, hot, created_at, ip)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(board.id, m.id, kind, title, body, url, flair, brothel ? brothel.id : null, r1, r2, r3, r4, worker, visit, status, hot, now, await ipHash(request, env)).run();
  const id = r.meta.last_row_id;
  return json({ ok: true, id, url: R.postHref({ id, title }), status });
}

async function editPost(request, env, m, id) {
  need(m);
  const post = await env.DB.prepare("SELECT * FROM f_posts WHERE id=?").bind(id).first();
  if (!post) fail(404, "No such post");
  if (post.author_id !== m.id) fail(403, "Not your post");
  if (post.status === "removed" || post.status === "deleted") fail(403, "That post is gone");
  const b = await readJSON(request);
  const title = b.title !== undefined ? clean(b.title, 140).replace(/\s+/g, " ").trim() : post.title;
  const body = b.body !== undefined ? clean(b.body, 8000) : post.body;
  if (title.length < 3) fail(400, "Give it a real title");
  let status = post.status;
  if (status === "live" && (contactRisk(title + "\n" + body) || minorsRisk(title + "\n" + body))) status = "pending";
  await env.DB.prepare("UPDATE f_posts SET title=?, body=?, status=?, edited_at=? WHERE id=?")
    .bind(title, body, status, new Date().toISOString(), id).run();
  return json({ ok: true, status, html: md(body) });
}

async function deletePost(env, m, id) {
  need(m);
  const post = await env.DB.prepare("SELECT * FROM f_posts WHERE id=?").bind(id).first();
  if (!post) fail(404, "No such post");
  if (post.author_id !== m.id && m.role !== "mod" && m.role !== "admin") fail(403, "Not your post");
  await env.DB.prepare("UPDATE f_posts SET status=? WHERE id=?").bind(m.role === "mod" || m.role === "admin" ? "removed" : "deleted", id).run();
  return json({ ok: true });
}

async function subscribe(env, m, id, on) {
  need(m);
  const post = await env.DB.prepare("SELECT id FROM f_posts WHERE id=?").bind(id).first();
  if (!post) fail(404, "No such post");
  if (on) {
    await env.DB.prepare("INSERT OR IGNORE INTO f_subs(member_id, t, tid, at) VALUES(?,?,?,?)").bind(m.id, "post", id, new Date().toISOString()).run();
  } else {
    await env.DB.prepare("DELETE FROM f_subs WHERE member_id=? AND t='post' AND tid=?").bind(m.id, id).run();
  }
  return json({ ok: true, on });
}

async function report(request, env, m, t, id) {
  need(m);
  await limitOrFail(env, "report:" + m.id, 20, 3600);
  const b = await readJSON(request);
  const reason = clean(b.reason, 300).replace(/\s+/g, " ").trim();
  const target = t === "post"
    ? await env.DB.prepare("SELECT id, author_id FROM f_posts WHERE id=?").bind(id).first()
    : await env.DB.prepare("SELECT id, author_id FROM f_comments WHERE id=?").bind(id).first();
  if (!target) fail(404, "Nothing to report");
  const dupe = await env.DB.prepare("SELECT id FROM f_reports WHERE member_id=? AND t=? AND tid=? AND status='open'").bind(m.id, t, id).first();
  if (dupe) return json({ ok: true, already: true });
  await env.DB.prepare("INSERT INTO f_reports(member_id, t, tid, reason, status, created_at) VALUES(?,?,?,?,'open',?)")
    .bind(m.id, t, id, reason || null, new Date().toISOString()).run();
  const cnt = await env.DB.prepare("SELECT COUNT(DISTINCT member_id) AS n FROM f_reports WHERE t=? AND tid=? AND status='open'").bind(t, id).first();
  if (+(cnt && cnt.n) >= 3) {
    if (t === "post") await env.DB.prepare("UPDATE f_posts SET status='pending' WHERE id=? AND status='live'").bind(id).run();
    else await env.DB.prepare("UPDATE f_comments SET status='pending' WHERE id=? AND status='live'").bind(id).run();
  }
  return json({ ok: true });
}

/* ---------- comments ---------- */
async function createComment(request, env, m) {
  need(m); live(m);
  await limitOrFail(env, "comment:" + m.id, 60, 3600);
  const b = await readJSON(request);
  const post = await env.DB.prepare("SELECT * FROM f_posts WHERE id=?").bind(+b.post || 0).first();
  if (!post || post.status !== "live") fail(404, "That thread is not open");
  if (post.locked) fail(403, "This thread is locked");
  const body = clean(b.body, 4000);
  if (body.length < 1) fail(400, "Say something first");
  let parent = null;
  if (+b.parent) {
    parent = await env.DB.prepare("SELECT id, author_id, status FROM f_comments WHERE id=? AND post_id=?").bind(+b.parent, post.id).first();
    if (!parent) fail(400, "That reply target is gone");
  }
  let status = "live";
  if (contactRisk(body) || minorsRisk(body)) status = "pending";
  const now = new Date().toISOString();
  const r = await env.DB.prepare("INSERT INTO f_comments(post_id, parent_id, author_id, body, status, created_at, ip) VALUES(?,?,?,?,?,?,?)")
    .bind(post.id, parent ? parent.id : null, m.id, body, status, now, await ipHash(request, env)).run();
  const id = r.meta.last_row_id;

  /* notifications: post author, parent author, mentions, thread subscribers */
  const rcpt = new Map();
  if (+post.author_id !== +m.id) rcpt.set(+post.author_id, "reply");
  if (parent && +parent.author_id !== +m.id && !rcpt.has(+parent.author_id)) rcpt.set(+parent.author_id, "reply");
  for (const name of mentionNames(body)) {
    const u = await env.DB.prepare("SELECT id FROM f_members WHERE username=? AND status='live'").bind(name).first();
    if (u && +u.id !== +m.id && !rcpt.has(+u.id)) rcpt.set(+u.id, "mention");
  }
  const subs = await env.DB.prepare("SELECT member_id FROM f_subs WHERE t='post' AND tid=? LIMIT 50").bind(post.id).all();
  for (const s of subs.results || []) if (+s.member_id !== +m.id && !rcpt.has(+s.member_id)) rcpt.set(+s.member_id, "sub");
  await addNotifs(env, [...rcpt.entries()].map(([member_id, kind]) => ({
    member_id, kind, post_id: post.id, comment_id: id, actor_id: m.id, snippet: txt(body, 120), at: now,
  })));

  const node = R.commentNode({ id, post_id: post.id, parent_id: parent ? parent.id : null, author_id: m.id, body, status, ups: 0, downs: 0, created_at: now, edited_at: null, username: m.username, author_karma: m.karma, author_status: m.status, my_vote: 0, kids: [] }, m, { locked: !!post.locked, mod: m.role === "mod" || m.role === "admin" });
  return json({ ok: true, id, status, html: node });
}

async function commentsMore(env, url, m) {
  const postId = +url.searchParams.get("post") || 0;
  const cs = ["best", "top", "new", "old"].includes(url.searchParams.get("cs")) ? url.searchParams.get("cs") : "best";
  const after = +url.searchParams.get("after") || 0;
  if (!postId) fail(400, "post required");
  const post = await env.DB.prepare("SELECT id, locked FROM f_posts WHERE id=?").bind(postId).first();
  if (!post) fail(404, "No such thread");
  const isMod = m && (m.role === "mod" || m.role === "admin");
  const roots = sortTree(await commentsFor(env, postId, m ? m.id : 0, m ? m.id : 0, isMod), cs);
  let start = 0;
  if (after) { const i = roots.findIndex((c) => +c.id === after); start = i >= 0 ? i + 1 : 0; }
  const chunk = roots.slice(start, start + 20);
  const last = chunk[chunk.length - 1];
  const more = roots.length > start + 20;
  return json({
    ok: true,
    html: R.commentTree(chunk, m, { locked: !!post.locked, mod: isMod }),
    next: more && last ? last.id : null,
  });
}

async function editComment(request, env, m, id) {
  need(m);
  const c = await env.DB.prepare("SELECT * FROM f_comments WHERE id=?").bind(id).first();
  if (!c) fail(404, "No such comment");
  if (c.author_id !== m.id) fail(403, "Not your comment");
  if (c.status === "deleted" || c.status === "removed") fail(403, "That comment is gone");
  const b = await readJSON(request);
  const body = clean(b.body, 4000);
  if (body.length < 1) fail(400, "Say something first");
  let status = c.status;
  if (status === "live" && (contactRisk(body) || minorsRisk(body))) status = "pending";
  await env.DB.prepare("UPDATE f_comments SET body=?, status=?, edited_at=? WHERE id=?").bind(body, status, new Date().toISOString(), id).run();
  return json({ ok: true, status, html: md(body) });
}

async function deleteComment(env, m, id) {
  need(m);
  const c = await env.DB.prepare("SELECT id, author_id FROM f_comments WHERE id=?").bind(id).first();
  if (!c) fail(404, "No such comment");
  if (c.author_id !== m.id) fail(403, "Not your comment");
  await env.DB.prepare("UPDATE f_comments SET status='deleted' WHERE id=?").bind(id).run();
  return json({ ok: true });
}

/* ---------- votes ---------- */
async function vote(request, env, m) {
  need(m); live(m);
  await limitOrFail(env, "vote:" + m.id, 600, 3600);
  const b = await readJSON(request);
  const t = b.t === "comment" ? "comment" : b.t === "post" ? "post" : null;
  const id = +b.id || 0;
  const val = +b.val;
  if (!t || !id || ![-1, 0, 1].includes(val)) fail(400, "Bad vote");
  const table = t === "post" ? "f_posts" : "f_comments";
  const target = await env.DB.prepare(`SELECT id, author_id, ups, downs, status, created_at FROM ${table} WHERE id=?`).bind(id).first();
  if (!target || target.status !== "live") fail(404, "That is not open for votes");
  const old = await env.DB.prepare("SELECT val FROM f_votes WHERE member_id=? AND t=? AND tid=?").bind(m.id, t, id).first();
  const oldVal = old ? old.val : 0;
  const newVal = val === 0 || oldVal === val ? 0 : val;
  const upD = (newVal === 1 ? 1 : 0) - (oldVal === 1 ? 1 : 0);
  const dnD = (newVal === -1 ? 1 : 0) - (oldVal === -1 ? 1 : 0);
  const kD = newVal - oldVal;
  const ups = (+target.ups || 0) + upD, downs = (+target.downs || 0) + dnD;
  const stmts = [];
  if (newVal === 0) stmts.push(env.DB.prepare("DELETE FROM f_votes WHERE member_id=? AND t=? AND tid=?").bind(m.id, t, id));
  else stmts.push(env.DB.prepare("INSERT INTO f_votes(member_id,t,tid,val,at) VALUES(?,?,?,?,?) ON CONFLICT(member_id,t,tid) DO UPDATE SET val=excluded.val, at=excluded.at").bind(m.id, t, id, newVal, new Date().toISOString()));
  if (t === "post") {
    stmts.push(env.DB.prepare("UPDATE f_posts SET ups=?, downs=?, hot=? WHERE id=?").bind(ups, downs, hotOf(ups, downs, target.created_at), id));
  } else {
    stmts.push(env.DB.prepare("UPDATE f_comments SET ups=?, downs=? WHERE id=?").bind(ups, downs, id));
  }
  if (kD !== 0 && +target.author_id !== +m.id) stmts.push(env.DB.prepare("UPDATE f_members SET karma=karma+? WHERE id=?").bind(kD, target.author_id));
  await env.DB.batch(stmts);
  return json({ ok: true, score: ups - downs, up: ups, down: downs, my: newVal });
}

/* ---------- brothels ---------- */
async function brothelsApi(env, url) {
  const q = clean(url.searchParams.get("q") || "", 80);
  if (url.searchParams.get("list") === "1") {
    const rows = q
      ? await env.DB.prepare("SELECT slug, name, suburb FROM f_brothels WHERE name LIKE ? OR suburb LIKE ? ORDER BY name LIMIT 10").bind(`%${q}%`, `%${q}%`).all()
      : await env.DB.prepare("SELECT slug, name, suburb FROM f_brothels ORDER BY name LIMIT 10").all();
    return json({ ok: true, list: rows.results || [] });
  }
  const rows = q
    ? await env.DB.prepare(`SELECT b.*, (SELECT COUNT(*) FROM f_posts p WHERE p.brothel_id=b.id AND p.kind='review' AND p.status='live') AS n FROM f_brothels b WHERE b.name LIKE ? OR b.suburb LIKE ? LIMIT 50`).bind(`%${q}%`, `%${q}%`).all()
    : { results: [] };
  return json({ ok: true, html: (rows.results || []).map(R.venueCard).join("") });
}

async function suggest(request, env, m, id) {
  need(m);
  const b = await readJSON(request);
  const br = await env.DB.prepare("SELECT id FROM f_brothels WHERE id=?").bind(id).first();
  if (!br) fail(404, "No such venue");
  const body = clean(b.body, 2000);
  if (body.length < 5) fail(400, "Tell us what should change");
  await env.DB.prepare("INSERT INTO f_suggestions(brothel_id, member_id, body, status, created_at) VALUES(?,?,?,'open',?)")
    .bind(id, m.id, body, new Date().toISOString()).run();
  return json({ ok: true });
}

/* ---------- messages ---------- */
async function messagesMore(env, url, m) {
  need(m);
  const withName = clean(url.searchParams.get("with") || "", 30).toLowerCase();
  const before = clean(url.searchParams.get("before") || "", 40);
  if (!withName) fail(400, "with required");
  const p = await env.DB.prepare("SELECT id, username FROM f_members WHERE username=? AND status != 'deleted'").bind(withName).first();
  if (!p) fail(404, "No such member");
  const binds = [m.id, p.id, p.id, m.id];
  let where = "((from_id=? AND to_id=?) OR (from_id=? AND to_id=?))";
  if (before) { where += " AND created_at < ?"; binds.push(before); }
  const r = await env.DB.prepare(`SELECT id, from_id, to_id, body, created_at, read_at FROM f_messages WHERE ${where} ORDER BY created_at DESC LIMIT 51`).bind(...binds).all();
  let rows = r.results || [];
  const more = rows.length > 50;
  rows = rows.slice(0, 50).reverse();
  const html = rows.map((x) => msgRow(x, m, p)).join("");
  return json({ ok: true, html, next: more && rows.length ? rows[0].created_at : null });
}
function msgRow(x, m, p) {
  const mine = +x.from_id === +m.id;
  return `<div class="fmsg-i${mine ? " me" : ""}"><div class="fmeta">${mine ? "you" : "u/" + esc(p.username)}<i>·</i><time datetime="${esc(x.created_at)}">${ago(x.created_at)}</time></div><div class="fbody">${md(x.body)}</div></div>`;
}

async function sendMessage(request, env, m) {
  need(m); live(m);
  await limitOrFail(env, "msg:" + m.id, 30, 3600);
  const b = await readJSON(request);
  const to = await env.DB.prepare("SELECT id, username FROM f_members WHERE username=? AND status='live'").bind(clean(b.to, 30).toLowerCase()).first();
  if (!to) fail(404, "No such member");
  if (+to.id === +m.id) fail(400, "You cannot message yourself");
  const blocked = await env.DB.prepare("SELECT 1 FROM f_blocks WHERE (member_id=? AND blocked_id=?) OR (member_id=? AND blocked_id=?)").bind(m.id, to.id, to.id, m.id).first();
  if (blocked) fail(403, "Messaging is blocked between you and that member");
  const body = clean(b.body, 4000);
  if (body.length < 1) fail(400, "Write something first");
  const now = new Date().toISOString();
  const r = await env.DB.prepare("INSERT INTO f_messages(from_id, to_id, body, created_at) VALUES(?,?,?,?)").bind(m.id, to.id, body, now).run();
  await addNotifs(env, [{ member_id: to.id, kind: "message", actor_id: m.id, snippet: txt(body, 120), at: now }]);
  return json({ ok: true, id: r.meta.last_row_id, html: msgRow({ id: r.meta.last_row_id, from_id: m.id, to_id: to.id, body, created_at: now }, m, to) });
}

async function blockUser(request, env, m) {
  need(m);
  const b = await readJSON(request);
  const who = await env.DB.prepare("SELECT id FROM f_members WHERE username=?").bind(clean(b.user, 30).toLowerCase()).first();
  if (!who) fail(404, "No such member");
  if (+who.id === +m.id) fail(400, "You cannot block yourself");
  if (b.on === false) await env.DB.prepare("DELETE FROM f_blocks WHERE member_id=? AND blocked_id=?").bind(m.id, who.id).run();
  else await env.DB.prepare("INSERT OR IGNORE INTO f_blocks(member_id, blocked_id, at) VALUES(?,?,?)").bind(m.id, who.id, new Date().toISOString()).run();
  return json({ ok: true, on: b.on !== false });
}

/* ---------- settings ---------- */
async function setPassword(request, env, m) {
  need(m);
  const b = await readJSON(request);
  if (m.pass_hash && !(await verifyPassword(String(b.old || ""), m.pass_hash))) fail(403, "Current password is wrong");
  const pw = String(b.password || "");
  if (pw.length < 10 || pw.length > 200) fail(400, "Password must be at least 10 characters");
  await env.DB.prepare("UPDATE f_members SET pass_hash=? WHERE id=?").bind(await hashPassword(pw, 25000), m.id).run();
  return json({ ok: true });
}
async function setEmail(request, env, m) {
  need(m);
  const b = await readJSON(request);
  const email = clean(b.email || "", 120).toLowerCase().trim();
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail(400, "That email does not look right");
  if (email) {
    const dupe = await env.DB.prepare("SELECT id FROM f_members WHERE email=? AND id != ?").bind(email, m.id).first();
    if (dupe) fail(409, "That email is already in use");
  }
  await env.DB.prepare("UPDATE f_members SET email=? WHERE id=?").bind(email || null, m.id).run();
  return json({ ok: true });
}
async function deleteAccount(request, env, m) {
  need(m);
  const b = await readJSON(request);
  if (b.confirm !== true) fail(400, "Tick the confirm box");
  if (m.pass_hash && !(await verifyPassword(String(b.password || ""), m.pass_hash))) fail(403, "Password is wrong");
  await env.DB.prepare("UPDATE f_members SET status='deleted', pass_hash=NULL, email=NULL, google_sub=NULL WHERE id=?").bind(m.id).run();
  await audit(env, "u/" + m.username, "delete-account", { id: m.id });
  return json({ ok: true }, 200, { "set-cookie": clearCookie("gb_user") });
}

/* ---------- moderation ---------- */
async function modAction(request, env) {
  const who = await modWho(request, env);
  if (!who) fail(403, "Moderation access required");
  const b = await readJSON(request);
  const act = clean(b.act, 20);
  const kind = clean(b.kind, 10);
  const id = clean(b.id, 60);
  const reason = clean(b.reason, 300).replace(/\s+/g, " ").trim();
  const now = new Date().toISOString();
  const numId = +id;

  if (kind === "post") {
    if (!["approve", "remove", "restore", "lock", "unlock", "pin", "unpin"].includes(act)) fail(400, "Bad action");
    const p = await env.DB.prepare("SELECT id FROM f_posts WHERE id=?").bind(numId).first();
    if (!p) fail(404, "No such post");
    if (act === "approve") await env.DB.prepare("UPDATE f_posts SET status='live' WHERE id=?").bind(numId).run();
    if (act === "remove") {
      await env.DB.prepare("UPDATE f_posts SET status='removed' WHERE id=?").bind(numId).run();
      await env.DB.prepare("UPDATE f_reports SET status='resolved', decided_by=?, decided_at=? WHERE t='post' AND tid=? AND status='open'").bind(who.name, now, numId).run();
    }
    if (act === "restore") await env.DB.prepare("UPDATE f_posts SET status='live' WHERE id=?").bind(numId).run();
    if (act === "lock" || act === "unlock") await env.DB.prepare("UPDATE f_posts SET locked=? WHERE id=?").bind(act === "lock" ? 1 : 0, numId).run();
    if (act === "pin" || act === "unpin") await env.DB.prepare("UPDATE f_posts SET pin=? WHERE id=?").bind(act === "pin" ? 1 : 0, numId).run();
  } else if (kind === "comment") {
    if (!["approve", "remove", "restore"].includes(act)) fail(400, "Bad action");
    const c = await env.DB.prepare("SELECT id FROM f_comments WHERE id=?").bind(numId).first();
    if (!c) fail(404, "No such comment");
    if (act === "approve" || act === "restore") await env.DB.prepare("UPDATE f_comments SET status='live' WHERE id=?").bind(numId).run();
    if (act === "remove") {
      await env.DB.prepare("UPDATE f_comments SET status='removed' WHERE id=?").bind(numId).run();
      await env.DB.prepare("UPDATE f_reports SET status='resolved', decided_by=?, decided_at=? WHERE t='comment' AND tid=? AND status='open'").bind(who.name, now, numId).run();
    }
  } else if (kind === "member") {
    const t = await env.DB.prepare("SELECT * FROM f_members WHERE id=?").bind(numId).first();
    if (!t) fail(404, "No such member");
    if (who.member && +t.id === +who.member.id) fail(400, "Not yourself");
    if ((t.role === "mod" || t.role === "admin") && !who.staff && !(who.member && who.member.role === "admin")) fail(403, "Only staff can manage moderators");
    if (act === "ban") {
      if (!reason) fail(400, "A ban needs a reason");
      await env.DB.prepare("UPDATE f_members SET status='banned', banned_at=?, banned_by=?, ban_reason=? WHERE id=?").bind(now, who.name, reason, numId).run();
    }
    if (act === "unban") await env.DB.prepare("UPDATE f_members SET status='live', banned_at=NULL, banned_by=NULL, ban_reason=NULL WHERE id=?").bind(numId).run();
    if (act === "makemod") await env.DB.prepare("UPDATE f_members SET role='mod' WHERE id=? AND role='member'").bind(numId).run();
    if (act === "demote") await env.DB.prepare("UPDATE f_members SET role='member' WHERE id=? AND role='mod'").bind(numId).run();
  } else if (kind === "report") {
    const [t, tid] = String(id).split(":");
    if (act === "dismiss" || act === "resolve") {
      await env.DB.prepare("UPDATE f_reports SET status='resolved', decided_by=?, decided_at=? WHERE t=? AND tid=? AND status='open'").bind(who.name, now, clean(t, 10), +tid || 0).run();
    } else fail(400, "Bad action");
  } else if (kind === "suggestion") {
    if (!["accept", "decline"].includes(act)) fail(400, "Bad action");
    await env.DB.prepare("UPDATE f_suggestions SET status=?, decided_by=?, decided_at=? WHERE id=?").bind(act === "accept" ? "accepted" : "declined", who.name, now, numId).run();
  } else fail(400, "Bad kind");

  await audit(env, who.name, "mod:" + act, { kind, id, reason: reason || undefined });
  return json({ ok: true, act, kind, id });
}

/* ---------- directory import ---------- */
async function importBrothels(request, env) {
  const who = await staffSession(request, env);
  if (!who) fail(401, "Staff session or AI bearer required");
  const arr = await readJSON(request, 2 * 1024 * 1024);
  if (!Array.isArray(arr)) fail(400, "Send a JSON array of venues");
  const now = new Date().toISOString();
  let imported = 0, skipped = 0;
  for (const raw of arr.slice(0, 2000)) {
    if (!raw || typeof raw !== "object") { skipped++; continue; }
    const name = clean(raw.name, 120).replace(/\s+/g, " ").trim();
    if (!name) { skipped++; continue; }
    const slug = slugify(name, 70);
    const suburb = clean(raw.suburb, 60).replace(/\s+/g, " ").trim() || null;
    const address = clean(raw.address, 200).replace(/\s+/g, " ").trim() || null;
    const phone = clean(raw.phone, 40).trim() || null;
    const website = safeUrl(raw.website) || null;
    const hours = clean(raw.hours, 200) || null;
    const notes = clean(raw.notes, 1000) || null;
    const confidence = ["low", "medium", "high"].includes(String(raw.confidence || "").toLowerCase()) ? String(raw.confidence).toLowerCase() : "medium";
    const sources = Array.isArray(raw.sources) ? JSON.stringify(raw.sources).slice(0, 2000) : clean(raw.sources, 2000) || null;
    const existing = await env.DB.prepare("SELECT id, status FROM f_brothels WHERE slug=?").bind(slug).first();
    const status = existing && existing.status === "closed" ? "closed" : confidence === "low" ? "unverified" : "open";
    if (existing) {
      await env.DB.prepare("UPDATE f_brothels SET name=?, suburb=?, address=?, phone=?, website=?, hours=?, notes=?, sources=?, confidence=?, status=?, updated_at=? WHERE id=?")
        .bind(name, suburb, address, phone, website, hours, notes, sources, confidence, status, now, existing.id).run();
    } else {
      await env.DB.prepare("INSERT INTO f_brothels(slug, name, suburb, address, phone, website, hours, notes, sources, confidence, status, created_at, updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)")
        .bind(slug, name, suburb, address, phone, website, hours, notes, sources, confidence, status, now, now).run();
    }
    imported++;
  }
  await audit(env, who.name || "staff", "import:brothels", { imported, skipped });
  return json({ ok: true, imported, skipped });
}

/* ============================================================
   PAGES (SSR)
   ============================================================ */
export async function page(request, env, ctx, url) {
  const p = url.pathname;
  if (p === "/forum/_shell" || p === "/forum/_shell.html") return null; // static asset
  await readyAux(env);
  const m = await memberBy(request, env);
  const path = p.replace(/\/+$/, "") || "/forum";
  const s = await settings(env);

  if (path === "/forum/all.rss") return await rssPage(env, url);

  const base = {
    url, path, member: m, boards: await getBoards(env), google: s.google_client_id || "",
    topBrothels: await getTopBrothels(env), barBase: "/forum",
  };
  const render = (r, status) => renderShell(env, url, { ...r, member: m }, status);

  /* front page */
  if (path === "/forum") {
    const sort = SORTS.includes(url.searchParams.get("sort")) ? url.searchParams.get("sort") : "hot";
    const { rows, next } = await feedQuery(env, { sort, uid: m ? m.id : 0, limit: 25 });
    const qs = (c) => `/api/forum/posts?sort=${sort}${c ? "&cursor=" + encodeURIComponent(c) : ""}`;
    const out = R.frontPage({ ...base, sort, posts: rows, moreUrl: next ? qs(encCursor(next)) : null });
    return await render(out);
  }

  /* everything, ranked */
  if (path === "/forum/all") {
    const sort = SORTS.includes(url.searchParams.get("sort")) ? url.searchParams.get("sort") : "top";
    const t = WINDOWS[url.searchParams.get("t")] !== undefined ? url.searchParams.get("t") : "week";
    const { rows, next } = await feedQuery(env, { sort, t, uid: m ? m.id : 0, limit: 25 });
    const qs = (c) => `/api/forum/posts?sort=${sort}&t=${t}${c ? "&cursor=" + encodeURIComponent(c) : ""}`;
    const out = R.allPage({ ...base, sort, t, posts: rows, moreUrl: next ? qs(encCursor(next)) : null });
    return await render(out);
  }

  /* one board */
  const bm = /^\/forum\/b\/([a-z0-9_-]{1,30})$/.exec(path);
  if (bm) {
    const board = await boardBySlug(env, bm[1]);
    if (!board) return await render(R.notFound(base));
    const sort = SORTS.includes(url.searchParams.get("sort")) ? url.searchParams.get("sort") : "hot";
    const { rows, next } = await feedQuery(env, { boardId: board.id, sort, uid: m ? m.id : 0, limit: 25 });
    const qs = (c) => `/api/forum/posts?board=${board.slug}&sort=${sort}${c ? "&cursor=" + encodeURIComponent(c) : ""}`;
    const out = R.boardPage({ ...base, barBase: `/forum/b/${board.slug}`, board, sort, posts: rows, moreUrl: next ? qs(encCursor(next)) : null });
    return await render(out);
  }

  /* post */
  const pm = /^\/forum\/p\/(\d+)(?:-[a-z0-9-]*)?$/.exec(path);
  if (pm) {
    const post = await env.DB.prepare(
      `SELECT p.*, m.username, m.karma AS author_karma, m.status AS author_status, b.slug AS board_slug, b.name AS board_name,
        br.slug AS brothel_slug, br.name AS brothel_name,
        (SELECT COUNT(*) FROM f_comments c WHERE c.post_id = p.id AND c.status = 'live') AS ncomments,
        (SELECT val FROM f_votes v WHERE v.member_id = ? AND v.t = 'post' AND v.tid = p.id) AS my_vote
       FROM f_posts p JOIN f_members m ON m.id = p.author_id JOIN f_boards b ON b.id = p.board_id
       LEFT JOIN f_brothels br ON br.id = p.brothel_id WHERE p.id = ?`
    ).bind(m ? m.id : 0, +pm[1]).first();
    if (!post || post.status === "deleted") return await render(R.notFound(base));
    const isMod = !!m && (m.role === "mod" || m.role === "admin");
    const isAuthor = !!m && +m.id === +post.author_id;
    if ((post.status === "pending" || post.status === "removed") && !isAuthor && !isMod) return await render(R.notFound(base));
    const cs = ["best", "top", "new", "old"].includes(url.searchParams.get("cs")) ? url.searchParams.get("cs") : "best";
    const allRoots = sortTree(await commentsFor(env, post.id, m ? m.id : 0, m ? m.id : 0, isMod), cs);
    const roots = allRoots.slice(0, 20);
    const moreComments = allRoots.length > 20;
    const subscribed = m ? !!(await env.DB.prepare("SELECT 1 FROM f_subs WHERE member_id=? AND t='post' AND tid=?").bind(m.id, post.id).first()) : false;
    const brothel = post.brothel_id ? await env.DB.prepare("SELECT * FROM f_brothels WHERE id=?").bind(post.brothel_id).first() : null;
    const out = R.postPage({ ...base, post, roots, csort: cs, ncomments: +post.ncomments || 0, subscribed, mod: isMod, brothel, moreComments, lastRoot: roots.length ? roots[roots.length - 1].id : 0 });
    return await render(out);
  }

  /* submit */
  if (path === "/forum/submit") {
    if (!m) return redirectLogin(url);
    const preset = {
      board: clean(url.searchParams.get("board") || "", 30) || null,
      kind: KINDS.includes(url.searchParams.get("kind")) ? url.searchParams.get("kind") : "text",
      brothel: null,
    };
    const bslug = clean(url.searchParams.get("brothel") || "", 80);
    if (bslug) preset.brothel = await brothelBySlugOrId(env, bslug);
    const out = R.submitPage({ ...base, preset });
    return await render(out);
  }

  /* directory */
  if (path === "/forum/brothels") {
    const q = clean(url.searchParams.get("q") || "", 80);
    const suburb = clean(url.searchParams.get("suburb") || "", 60);
    const sort = ["rating", "reviews", "name", "newest"].includes(url.searchParams.get("sort")) ? url.searchParams.get("sort") : "rating";
    const rows = await directoryQuery(env, { q, suburb, sort });
    const subs = await env.DB.prepare("SELECT DISTINCT suburb FROM f_brothels WHERE suburb IS NOT NULL AND suburb != '' ORDER BY suburb").all();
    const out = R.directoryPage({ ...base, rows: rows.results || [], q, suburb, sort, suburbs: (subs.results || []).map((x) => x.suburb) });
    return await render(out);
  }

  /* venue */
  const vm = /^\/forum\/brothels\/([a-z0-9-]{1,80})$/.exec(path);
  if (vm) {
    const b = await env.DB.prepare("SELECT * FROM f_brothels WHERE slug=?").bind(vm[1]).first();
    if (!b) return await render(R.notFound(base));
    const stats = await env.DB.prepare(
      `SELECT COUNT(*) AS count, AVG(r_overall) AS avg, AVG(r_rooms) AS rooms, AVG(r_service) AS service, AVG(r_value) AS value
       FROM f_posts WHERE brothel_id=? AND kind='review' AND status='live'`
    ).bind(b.id).first();
    const reviews = await env.DB.prepare(
      `SELECT p.id, p.title, p.body, p.kind, p.flair, p.ups, p.downs, p.r_overall, p.r_rooms, p.r_service, p.r_value, p.worker_name, p.visit_month, p.created_at, p.edited_at, p.pin, p.locked, p.status, p.author_id,
        m.username, m.display, m.karma AS author_karma, m.status AS author_status,
        ? AS brothel_slug, ? AS brothel_name, 'reviews' AS board_slug, 'reviews' AS board_name,
        (SELECT COUNT(*) FROM f_comments c WHERE c.post_id=p.id AND c.status='live') AS ncomments, 0 AS my_vote
       FROM f_posts p JOIN f_members m ON m.id=p.author_id WHERE p.brothel_id=? AND p.kind='review' AND p.status='live' ORDER BY p.created_at DESC LIMIT 30`
    ).bind(b.slug, b.name, b.id).all();
    const threads = await env.DB.prepare(
      `SELECT p.id, p.title, p.body, p.kind, p.flair, p.ups, p.downs, p.created_at, p.edited_at, p.pin, p.locked, p.status, p.author_id,
        m.username, m.display, m.karma AS author_karma, m.status AS author_status,
        b2.slug AS board_slug, b2.name AS board_name, ? AS brothel_slug, ? AS brothel_name,
        (SELECT COUNT(*) FROM f_comments c WHERE c.post_id=p.id AND c.status='live') AS ncomments, 0 AS my_vote
       FROM f_posts p JOIN f_members m ON m.id=p.author_id JOIN f_boards b2 ON b2.id=p.board_id
       WHERE p.brothel_id=? AND p.kind != 'review' AND p.status='live' ORDER BY p.created_at DESC LIMIT 10`
    ).bind(b.slug, b.name, b.id).all();
    const out = R.venuePage({ ...base, b, stats, reviews: reviews.results || [], threads: threads.results || [] });
    return await render(out);
  }

  /* member profile */
  const um = /^\/forum\/u\/([A-Za-z0-9_%]{3,60})$/.exec(path);
  if (um) {
    const uname = decodeURIComponent(um[1]).toLowerCase();
    const profile = await env.DB.prepare("SELECT * FROM f_members WHERE username=? AND status != 'deleted'").bind(uname).first();
    if (!profile) return await render(R.notFound(base));
    const tab = url.searchParams.get("tab") === "comments" ? "comments" : "posts";
    let posts = [], comments = [];
    if (tab === "posts") {
      const r = await env.DB.prepare(
        `SELECT p.id, p.title, p.body, p.kind, p.flair, p.url, p.brothel_id, p.r_overall, p.r_rooms, p.r_service, p.r_value, p.worker_name, p.visit_month, p.ups, p.downs, p.created_at, p.edited_at, p.pin, p.locked, p.status, p.author_id,
          m.username, m.display, m.karma AS author_karma, m.status AS author_status,
          b.slug AS board_slug, b.name AS board_name, br.slug AS brothel_slug, br.name AS brothel_name,
          (SELECT COUNT(*) FROM f_comments c WHERE c.post_id=p.id AND c.status='live') AS ncomments,
          (SELECT val FROM f_votes v WHERE v.member_id=? AND v.t='post' AND v.tid=p.id) AS my_vote
         FROM f_posts p JOIN f_members m ON m.id=p.author_id JOIN f_boards b ON b.id=p.board_id LEFT JOIN f_brothels br ON br.id=p.brothel_id
         WHERE p.author_id=? AND p.status='live' ORDER BY p.created_at DESC LIMIT 50`
      ).bind(m ? m.id : 0, profile.id).all();
      posts = r.results || [];
    } else {
      const r = await env.DB.prepare(
        `SELECT c.id, c.post_id, c.body, c.created_at, p.title AS post_title
         FROM f_comments c JOIN f_posts p ON p.id=c.post_id AND p.status='live'
         WHERE c.author_id=? AND c.status='live' ORDER BY c.created_at DESC LIMIT 50`
      ).bind(profile.id).all();
      comments = r.results || [];
    }
    const out = R.memberPage({ ...base, profile, tab, posts, comments });
    return await render(out);
  }

  /* messages */
  if (path === "/forum/messages") {
    if (!m) return redirectLogin(url);
    const partners = await env.DB.prepare(
      `SELECT m2.id, m2.username, MAX(msg.created_at) AS last,
        SUM(CASE WHEN msg.to_id=? AND msg.from_id=m2.id AND msg.read_at IS NULL THEN 1 ELSE 0 END) AS unread
       FROM f_messages msg
       JOIN f_members m2 ON m2.id = CASE WHEN msg.from_id=? THEN msg.to_id ELSE msg.from_id END
       WHERE (msg.from_id=? OR msg.to_id=?)
         AND m2.id NOT IN (SELECT blocked_id FROM f_blocks WHERE member_id=?)
         AND m2.id NOT IN (SELECT member_id FROM f_blocks WHERE blocked_id=?)
       GROUP BY m2.id ORDER BY last DESC LIMIT 50`
    ).bind(m.id, m.id, m.id, m.id, m.id, m.id).all();
    let withM = null, conv = [], blocked = false, blockedBoth = false;
    const wname = clean(url.searchParams.get("with") || "", 30).toLowerCase();
    if (wname) {
      withM = await env.DB.prepare("SELECT id, username FROM f_members WHERE username=? AND status != 'deleted'").bind(wname).first();
      if (withM) {
        const iBlocked = await env.DB.prepare("SELECT 1 FROM f_blocks WHERE member_id=? AND blocked_id=?").bind(m.id, withM.id).first();
        const theyBlocked = await env.DB.prepare("SELECT 1 FROM f_blocks WHERE member_id=? AND blocked_id=?").bind(withM.id, m.id).first();
        blocked = !!iBlocked; blockedBoth = !!iBlocked || !!theyBlocked;
        const r = await env.DB.prepare("SELECT id, from_id, to_id, body, created_at, read_at FROM f_messages WHERE ((from_id=? AND to_id=?) OR (from_id=? AND to_id=?)) ORDER BY created_at ASC LIMIT 100")
          .bind(m.id, withM.id, withM.id, m.id).all();
        conv = (r.results || []).filter((x) => !(iBlocked && +x.from_id === +withM.id));
        conv = conv.map((x) => ({ ...x, username: withM.username }));
        await env.DB.prepare("UPDATE f_messages SET read_at=? WHERE to_id=? AND from_id=? AND read_at IS NULL").bind(new Date().toISOString(), m.id, withM.id).run();
      }
    }
    const out = R.messagesPage({ ...base, partners: partners.results || [], with: withM, conv, blocked, blockedBoth });
    return await render(out);
  }

  /* notifications */
  if (path === "/forum/notifications") {
    if (!m) return redirectLogin(url);
    const r = await env.DB.prepare(
      `SELECT n.*, a.username AS actor FROM f_notifs n LEFT JOIN f_members a ON a.id=n.actor_id WHERE n.member_id=? ORDER BY n.at DESC LIMIT 100`
    ).bind(m.id).all();
    const out = R.notificationsPage({ ...base, items: r.results || [] });
    return await render(out);
  }

  /* search */
  if (path === "/forum/search") {
    const q = clean(url.searchParams.get("q") || "", 80);
    let posts = [], venues = [];
    if (q) {
      posts = await searchPosts(env, q, m);
      const r = await env.DB.prepare(
        `SELECT b.*, (SELECT COUNT(*) FROM f_posts p WHERE p.brothel_id=b.id AND p.kind='review' AND p.status='live') AS n
         FROM f_brothels b WHERE b.name LIKE ? OR b.suburb LIKE ? ORDER BY b.name LIMIT 30`
      ).bind(`%${q}%`, `%${q}%`).all();
      venues = r.results || [];
    }
    const out = R.searchPage({ ...base, q, posts, venues });
    return await render(out);
  }

  /* rules */
  if (path === "/forum/rules") return await render(R.rulesPage(base));

  /* mod */
  if (path === "/forum/mod") {
    const who = await modWho(request, env);
    if (!who) {
      if (!m) return redirectLogin(url);
      return await render(R.notFound(base), 403);
    }
    const reports = await env.DB.prepare(
      `SELECT r.t, r.tid, r.reason, r.created_at, mm.username,
        (SELECT COUNT(*) FROM f_reports r2 WHERE r2.t=r.t AND r2.tid=r.tid AND r2.status='open') AS n
       FROM f_reports r LEFT JOIN f_members mm ON mm.id=r.member_id WHERE r.status='open' ORDER BY r.created_at DESC LIMIT 50`
    ).all();
    const rep = [];
    for (const r of reports.results || []) {
      let preview = "";
      if (r.t === "post") { const x = await env.DB.prepare("SELECT title, body FROM f_posts WHERE id=?").bind(r.tid).first(); preview = x ? x.title + " " + txt(x.body, 100) : "(gone)"; }
      else { const x = await env.DB.prepare("SELECT body FROM f_comments WHERE id=?").bind(r.tid).first(); preview = x ? txt(x.body, 120) : "(gone)"; }
      rep.push({ ...r, preview });
    }
    const pp = await env.DB.prepare("SELECT id, title, body, created_at, (SELECT username FROM f_members WHERE id=author_id) AS username FROM f_posts WHERE status='pending' ORDER BY created_at DESC LIMIT 40").all();
    const pc = await env.DB.prepare("SELECT id, body, created_at, (SELECT username FROM f_members WHERE id=author_id) AS username FROM f_comments WHERE status='pending' ORDER BY created_at DESC LIMIT 40").all();
    const sg = await env.DB.prepare("SELECT s.*, b.name AS brothel_name, (SELECT username FROM f_members WHERE id=s.member_id) AS username FROM f_suggestions s LEFT JOIN f_brothels b ON b.id=s.brothel_id WHERE s.status='open' ORDER BY s.created_at DESC LIMIT 40").all();
    const mem = await env.DB.prepare("SELECT id, username, role, karma, status, created_at FROM f_members WHERE status != 'deleted' ORDER BY created_at DESC LIMIT 100").all();
    const out = R.modPage({ ...base, reports: rep, pendingPosts: pp.results || [], pendingComments: pc.results || [], suggestions: sg.results || [], members: mem.results || [] });
    return await render(out);
  }

  /* login */
  if (path === "/forum/login") {
    const out = R.loginPage(base);
    return await render(out);
  }

  /* settings */
  if (path === "/forum/settings") {
    if (!m) return redirectLogin(url);
    const out = R.settingsPage({ ...base, member: m });
    return await render(out);
  }

  return await render(R.notFound(base));
}

/* ---------- page helpers ---------- */
function redirectLogin(url) {
  const next = url.pathname + (url.search || "");
  return Response.redirect(url.origin + "/forum/login?next=" + encodeURIComponent(next), 302);
}

function directoryQuery(env, { q, suburb, sort }) {
  const binds = [];
  let where = "1=1";
  if (q) { where += " AND (b.name LIKE ? OR b.suburb LIKE ? OR b.address LIKE ?)"; binds.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  if (suburb) { where += " AND b.suburb = ?"; binds.push(suburb); }
  const order = sort === "reviews" ? "n DESC, b.name"
    : sort === "name" ? "b.name COLLATE NOCASE"
    : sort === "newest" ? "b.updated_at DESC"
    : "ravg IS NULL, ravg DESC, n DESC, b.name";
  const sql = `SELECT b.*, COUNT(p.id) AS n, AVG(p.r_overall) AS ravg, MAX(p.created_at) AS last_at
    FROM f_brothels b LEFT JOIN f_posts p ON p.brothel_id=b.id AND p.kind='review' AND p.status='live'
    WHERE ${where} GROUP BY b.id ORDER BY ${order} LIMIT 200`;
  return env.DB.prepare(sql).bind(...binds).all();
}

async function searchPosts(env, q, m) {
  const uid = m ? m.id : 0;
  const cols = `p.id, p.board_id, p.author_id, p.kind, p.title, p.body, p.url, p.flair, p.brothel_id, p.r_overall, p.r_rooms, p.r_service, p.r_value, p.worker_name, p.visit_month, p.status, p.pin, p.locked, p.ups, p.downs, p.hot, p.created_at, p.edited_at,
    mm.username, mm.display, mm.karma AS author_karma, mm.status AS author_status,
    b.slug AS board_slug, b.name AS board_name, br.slug AS brothel_slug, br.name AS brothel_name,
    (SELECT COUNT(*) FROM f_comments c WHERE c.post_id=p.id AND c.status='live') AS ncomments,
    (SELECT val FROM f_votes v WHERE v.member_id=? AND v.t='post' AND v.tid=p.id) AS my_vote`;
  if (await readyAux(env)) {
    const terms = q.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((t) => t.length >= 2).slice(0, 8);
    if (terms.length) {
      const match = terms.map((t) => `"${t}"*`).join(" ");
      try {
        const r = await env.DB.prepare(`SELECT ${cols} FROM f_fts JOIN f_posts p ON p.id=f_fts.rowid JOIN f_members mm ON mm.id=p.author_id JOIN f_boards b ON b.id=p.board_id LEFT JOIN f_brothels br ON br.id=p.brothel_id WHERE f_fts MATCH ? AND p.status='live' ORDER BY rank LIMIT 30`).bind(uid, match).all();
        return r.results || [];
      } catch (e) { /* fall through to LIKE */ }
    }
  }
  const like = `%${q.replace(/[%_\\]/g, " ").trim()}%`;
  const joins = `FROM f_posts p JOIN f_members mm ON mm.id=p.author_id JOIN f_boards b ON b.id=p.board_id LEFT JOIN f_brothels br ON br.id=p.brothel_id`;
  const r = await env.DB.prepare(`SELECT ${cols} ${joins} WHERE p.status='live' AND (p.title LIKE ? OR p.body LIKE ?) ORDER BY p.hot DESC LIMIT 30`).bind(uid, like, like).all();
  return r.results || [];
}

async function rssPage(env, url) {
  const r = await env.DB.prepare(
    `SELECT p.id, p.title, p.body, p.created_at FROM f_posts p WHERE p.status='live' ORDER BY p.created_at DESC LIMIT 30`
  ).all();
  const xml = R.rssFeed(r.results || [], url.origin);
  return new Response(xml, { headers: { "content-type": "application/rss+xml; charset=utf-8", "cache-control": "no-cache" } });
}

async function renderShell(env, url, r, status) {
  const shell = await getShell(env, url);
  let res = new Response(shell, { status: status || r.status || 200, headers: { "content-type": "text/html; charset=utf-8" } });
  res = new HTMLRewriter().on("#forum-root", { element(e) { e.setInnerContent(r.html, { html: true }); } }).transform(res);
  if (r.robots) res = new HTMLRewriter().on('meta[name="robots"]', { element(e) { e.setAttribute("content", r.robots); } }).transform(res);
  const boot = { member: r.member ? { id: r.member.id, u: r.member.username, role: r.member.role } : null, google: r.google || "" };
  res = injectMeta(res, { title: r.title, desc: r.desc, canonical: r.canonical, jsonld: r.jsonld, bootstrap: boot });
  return res;
}
