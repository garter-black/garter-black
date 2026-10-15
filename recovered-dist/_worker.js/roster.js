/* ============================================================
   garter.black · roster.js
   The house: ladies, today and tomorrow, arrivals, enquiries and
   "tell me when she's in", reviews, Stripe tips with the 80/5/5/5/5
   split, staff sign in (password, Google, AI bearer), settings.
   ============================================================ */
import {
  json, fail, readJSON, clean, slugify, nowIso, rosterDay, dayLabel, shiftMinutes, nowShiftMinutes,
  signToken, setCookie, clearCookie, staffSession, requireStaff, verifyGoogle, safeEqual,
  ipHash, limitOrFail, settings, invalidateSettings, audit, telegram, sendEmail, injectMeta, randomToken, hmac, esc,
} from "./lib.js";

const SPLIT = [
  ["lady", 0.80, "to her"],
  ["reception", 0.05, "reception on shift"],
  ["cleaners", 0.05, "cleaners today"],
  ["management", 0.05, "management"],
  ["owner", 0.05, "building and website"],
];
const CHANNELS = ["whatsapp", "telegram", "sms", "call", "email"];
const SETTING_KEYS = ["desk_reception", "desk_cleaners", "phone", "tel", "whatsapp", "email", "google_client_id",
  "tip_presets", "tip_min", "tip_max", "telegram_chat_id", "notify_from"];

/* ---------- shaping ---------- */
const parseJ = (s, d) => { try { return JSON.parse(s); } catch { return d; } };
const photoUrls = (photos) => parseJ(photos, []).map((p) => ({
  k: p.k, s: `/media/${p.k}-s.webp`, l: `/media/${p.k}-l.webp`, w: p.w || null, h: p.h || null,
}));
function cardOf(l, r, nowMin, isToday) {
  const ph = photoUrls(l.photos);
  const st = r ? shiftMinutes(r.start) : null, en = r ? shiftMinutes(r.end) : null;
  let onNow = false;
  if (isToday && r && r.arrived_at) {
    onNow = st == null || en == null ? true : (en > st ? nowMin >= st - 30 && nowMin < en : true);
  }
  return {
    id: l.id, slug: l.slug, name: l.name, age: l.age, nationality: l.nationality || "",
    photo: ph[0] ? ph[0].s : null, photoL: ph[0] ? ph[0].l : null,
    start: r ? r.start : null, end: r ? r.end : null, arrived: !!(r && r.arrived_at), onNow,
    rating: l.r_avg ? { avg: Math.round(l.r_avg * 10) / 10, count: l.r_count } : null,
  };
}
const RATING_JOIN = `LEFT JOIN (SELECT lady_id, AVG(rating) r_avg, COUNT(*) r_count FROM reviews WHERE status='approved' GROUP BY lady_id) rv ON rv.lady_id = l.id`;

async function dayList(env, day) {
  const res = await env.DB.prepare(
    `SELECT l.*, rv.r_avg, rv.r_count, r.start, r.end, r.arrived_at, r.pos, r.note FROM roster r JOIN ladies l ON l.id = r.lady_id ${RATING_JOIN}
     WHERE r.day = ? AND l.active = 1 ORDER BY r.pos, l.name`).bind(day).all();
  return res.results || [];
}
async function publicRoster(env) {
  const today = rosterDay(0), tomorrow = rosterDay(1), nowMin = nowShiftMinutes();
  const [a, b] = await Promise.all([dayList(env, today), dayList(env, tomorrow)]);
  const t = a.map((x) => cardOf(x, x, nowMin, true));
  t.sort((p, q) => (q.onNow ? 1 : 0) - (p.onNow ? 1 : 0));
  return {
    today: { day: today, label: dayLabel(today), list: t },
    tomorrow: { day: tomorrow, label: dayLabel(tomorrow), list: b.map((x) => cardOf(x, x, nowMin, false)) },
    updated: nowIso(),
  };
}

function splitOf(cents) {
  const out = {}; let used = 0;
  for (const [k, f] of SPLIT.slice(0, 4)) { out[k] = Math.round(cents * f); used += out[k]; }
  out.owner = cents - used;
  return out;
}

async function ladyBySlug(env, slug) {
  return await env.DB.prepare(`SELECT l.*, rv.r_avg, rv.r_count FROM ladies l ${RATING_JOIN} WHERE l.slug = ? AND l.active = 1`).bind(slug).first();
}

async function profileOf(env, l) {
  const today = rosterDay(0), tomorrow = rosterDay(1), nowMin = nowShiftMinutes();
  const [shifts, reviews, s] = await Promise.all([
    env.DB.prepare(`SELECT day, start, end, arrived_at FROM roster WHERE lady_id = ? AND day >= ? ORDER BY day LIMIT 6`).bind(l.id, today).all(),
    env.DB.prepare(`SELECT rating, body, name, created_at FROM reviews WHERE lady_id = ? AND status = 'approved' ORDER BY created_at DESC LIMIT 30`).bind(l.id).all(),
    settings(env),
  ]);
  const sh = (shifts.results || []);
  const t = sh.find((x) => x.day === today), tm = sh.find((x) => x.day === tomorrow);
  const card = cardOf(l, t || null, nowMin, !!t);
  const next = sh.find((x) => x.day > tomorrow);
  return {
    id: l.id, slug: l.slug, name: l.name, age: l.age, height_cm: l.height_cm, weight_kg: l.weight_kg,
    dress: l.dress || "", bust: l.bust || "", hair: l.hair || "", nationality: l.nationality || "", languages: l.languages || "",
    services: parseJ(l.services, []), bio: l.bio || "", photos: photoUrls(l.photos),
    rating: card.rating, reviews: reviews.results || [],
    today: t ? { day: today, label: dayLabel(today), start: t.start, end: t.end, arrived: !!t.arrived_at, onNow: card.onNow } : null,
    tomorrow: tm ? { day: tomorrow, label: dayLabel(tomorrow), start: tm.start, end: tm.end } : null,
    next: next ? { day: next.day, label: dayLabel(next.day), start: next.start, end: next.end } : null,
    lastWorked: l.last_worked ? dayLabel(l.last_worked) : null,
    house: { phone: s.phone, tel: s.tel, whatsapp: s.whatsapp },
    tip: {
      presets: String(s.tip_presets || "20,50,100").split(",").map((x) => +x).filter((x) => x > 0),
      min: +s.tip_min || 10, max: +s.tip_max || 2000,
      split: SPLIT.map(([k, f, label]) => ({ k, pct: Math.round(f * 100), label })),
      /* Hosted Checkout works with the secret key alone, so tips are on when the key is set.
         The publishable key is only passed through if one is configured, for other pages. */
      enabled: !!env.STRIPE_SECRET_KEY, pk: env.STRIPE_PUBLISHABLE_KEY || "",
    },
  };
}

/* ---------- validation ---------- */
function validHandle(channel, h) {
  h = clean(h, 120);
  if (!h) return null;
  if (channel === "email") return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(h) ? h.toLowerCase() : null;
  if (channel === "telegram") { const u = h.replace(/^@/, ""); return /^[A-Za-z0-9_]{4,32}$/.test(u) ? "@" + u : (/^\+?[\d\s()-]{8,20}$/.test(h) ? h.replace(/[^\d+]/g, "") : null); }
  let d = h.replace(/[^\d+]/g, "");
  if (/^0[2-9]\d{8}$/.test(d)) d = "+61" + d.slice(1);          /* Australian local to international */
  else if (/^61\d{9}$/.test(d)) d = "+" + d;
  return /^\+?\d{8,15}$/.test(d) ? d : null;
}
function intOrNull(v, lo, hi) {
  if (v === "" || v == null) return null;
  const n = Math.round(+v); if (!Number.isFinite(n) || n < lo || n > hi) return undefined; return n;
}
function hm(v) { if (!v) return null; const m = /^(\d{1,2}):(\d{2})$/.exec(String(v).trim()); if (!m || +m[1] > 23 || +m[2] > 59) return undefined; return m[1].padStart(2, "0") + ":" + m[2]; }

function ladyFields(b, partial) {
  const o = {};
  const put = (k, v) => { if (v !== undefined) o[k] = v; };
  if (!partial || "name" in b) { const n = clean(b.name, 40); if (!n) fail(400, "A working name is needed"); o.name = n; }
  if ("age" in b) { const a = intOrNull(b.age, 18, 80); if (a === undefined) fail(400, "Age must be 18 or over"); put("age", a); }
  if ("height_cm" in b) { const a = intOrNull(b.height_cm, 120, 220); if (a === undefined) fail(400, "Height is in cm (120 to 220)"); put("height_cm", a); }
  if ("weight_kg" in b) { const a = intOrNull(b.weight_kg, 35, 200); if (a === undefined) fail(400, "Weight is in kg (35 to 200)"); put("weight_kg", a); }
  for (const k of ["dress", "bust", "hair", "nationality", "languages"]) if (k in b) put(k, clean(b[k], 60) || null);
  if ("bio" in b) put("bio", clean(b.bio, 1200) || null);
  if ("services" in b) {
    const arr = (Array.isArray(b.services) ? b.services : String(b.services || "").split(/[,\n]/)).map((x) => clean(x, 40)).filter(Boolean).slice(0, 30);
    put("services", JSON.stringify([...new Set(arr)]));
  }
  if ("active" in b) put("active", b.active ? 1 : 0);
  return o;
}

/* ---------- Stripe ---------- */
function form(obj, prefix = "", out = []) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === "object" && !Array.isArray(v)) form(v, key, out);
    else if (Array.isArray(v)) v.forEach((x, i) => {
      const ik = `${key}[${i}]`;
      if (x !== null && typeof x === "object") form(x, ik, out);
      else out.push(`${encodeURIComponent(ik)}=${encodeURIComponent(x)}`);
    });
    else out.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`);
  }
  return out.join("&");
}
async function stripe(env, method, path, body, idem) {
  const h = { authorization: "Bearer " + env.STRIPE_SECRET_KEY, "stripe-version": "2024-06-20" };
  if (body) h["content-type"] = "application/x-www-form-urlencoded";
  if (idem) h["idempotency-key"] = idem;
  const r = await fetch("https://api.stripe.com/v1/" + path, { method, headers: h, body: body ? form(body) : undefined });
  const j = await r.json();
  if (!r.ok) { console.error("stripe", path, r.status, j && j.error && j.error.message); fail(502, (j.error && j.error.message) || "Payment service unavailable"); }
  return j;
}
async function markTipPaid(env, pi) {
  if (!pi || pi.status !== "succeeded") return false;
  let fee = null;
  try {
    const ch = pi.latest_charge && typeof pi.latest_charge === "object" ? pi.latest_charge : null;
    if (ch && ch.balance_transaction && typeof ch.balance_transaction === "object") fee = ch.balance_transaction.fee;
  } catch {}
  const r = await env.DB.prepare(`UPDATE tips SET status='paid', paid_at=COALESCE(paid_at, ?), fee_cents=COALESCE(?, fee_cents) WHERE stripe_pi=? AND status!='paid'`)
    .bind(nowIso(), fee, pi.id).run();
  if (r.meta && r.meta.changes) {
    const t = await env.DB.prepare(`SELECT * FROM tips WHERE stripe_pi=?`).bind(pi.id).first();
    if (t) await telegram(env, `Tip received: $${(t.amount_cents / 100).toFixed(2)} for ${t.lady_name}. Her 80%: $${(t.lady_cents / 100).toFixed(2)}.${t.tipper ? " From " + t.tipper + "." : ""}${t.message ? " Note: " + t.message : ""}`);
  }
  return true;
}
/* A paid Checkout Session is the source of truth. Idempotent: only the first
   transition from a non paid state flips the ledger and pings the desk. */
async function markSessionPaid(env, cs) {
  if (!cs || cs.payment_status !== "paid") return false;
  const pi = cs.payment_intent && typeof cs.payment_intent === "object" ? cs.payment_intent : null;
  const piId = pi ? pi.id : (typeof cs.payment_intent === "string" ? cs.payment_intent : null);
  let fee = null;
  try {
    const ch = pi && pi.latest_charge && typeof pi.latest_charge === "object" ? pi.latest_charge : null;
    if (ch && ch.balance_transaction && typeof ch.balance_transaction === "object") fee = ch.balance_transaction.fee;
  } catch {}
  const r = await env.DB.prepare(`UPDATE tips SET status='paid', paid_at=COALESCE(paid_at, ?), fee_cents=COALESCE(?, fee_cents),
      stripe_pi=COALESCE(stripe_pi, ?) WHERE ref=? AND status!='paid'`)
    .bind(nowIso(), fee, piId, cs.client_reference_id || null).run();
  if (r.meta && r.meta.changes) {
    const t = await env.DB.prepare(`SELECT * FROM tips WHERE ref=?`).bind(cs.client_reference_id).first();
    if (t) await telegram(env, `Tip received: $${(t.amount_cents / 100).toFixed(2)} for ${t.lady_name}. Her 80%: $${(t.lady_cents / 100).toFixed(2)}.${t.tipper ? " From " + t.tipper + "." : ""}${t.message ? " Note: " + t.message : ""}`);
  }
  return true;
}
async function verifyStripeSig(env, raw, header) {
  if (!env.STRIPE_WEBHOOK_SECRET || !header) return false;
  const parts = Object.fromEntries(header.split(",").map((x) => x.split("=")));
  const t = parts.t, v1 = header.split(",").filter((x) => x.startsWith("v1=")).map((x) => x.slice(3));
  if (!t || !v1.length || Math.abs(Date.now() / 1000 - +t) > 600) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.STRIPE_WEBHOOK_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${raw}`));
  const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return v1.some((x) => safeEqual(x, hex));
}

/* ---------- notifications when she arrives ---------- */
function notifyText(lady, s) {
  return `Hi, it's The Black Garter. ${lady.name} has just arrived and is in tonight. Call or text ${s.phone} to book, or WhatsApp wa.me/${s.whatsapp}. Reply STOP and we won't message again.`;
}
function sendLink(channel, handle, text) {
  const t = encodeURIComponent(text);
  if (channel === "whatsapp") return `https://wa.me/${handle.replace(/[^\d]/g, "")}?text=${t}`;
  if (channel === "sms") return `sms:${handle}?&body=${t}`;
  if (channel === "call") return `tel:${handle}`;
  if (channel === "email") return `mailto:${handle}?subject=${encodeURIComponent("She's in tonight")}&body=${t}`;
  if (channel === "telegram") return handle.startsWith("@") ? `https://t.me/${handle.slice(1)}` : `tg://resolve?phone=${handle.replace(/[^\d]/g, "")}`;
  return null;
}
async function queueArrivalNotices(env, ctx, lady, who) {
  const s = await settings(env);
  const enq = await env.DB.prepare(`SELECT * FROM enquiries WHERE lady_id = ? AND notify = 1 AND status IN ('new','waiting') ORDER BY created_at`).bind(lady.id).all();
  const list = enq.results || [];
  if (!list.length) return 0;
  const text = notifyText(lady, s), now = nowIso();
  const stmts = [];
  for (const e of list) {
    stmts.push(env.DB.prepare(`INSERT INTO outbox(enquiry_id, lady_id, channel, handle, body, status, created_at) VALUES(?,?,?,?,?, 'queued', ?)`)
      .bind(e.id, lady.id, e.channel, e.handle, text, now));
    stmts.push(env.DB.prepare(`UPDATE enquiries SET status='notified', notified_at=? WHERE id=?`).bind(now, e.id));
  }
  await env.DB.batch(stmts);
  /* email goes out automatically; the rest wait for a tap at the desk (or Cassandra) */
  ctx.waitUntil((async () => {
    const q = await env.DB.prepare(`SELECT * FROM outbox WHERE lady_id=? AND status='queued' AND channel='email'`).bind(lady.id).all();
    for (const o of q.results || []) {
      const r = await sendEmail(env, o.handle, `${lady.name} is in tonight · The Black Garter`, o.body);
      await env.DB.prepare(`UPDATE outbox SET status=?, sent_at=?, sent_by=?, error=? WHERE id=?`)
        .bind(r.ok ? "sent" : "queued", r.ok ? nowIso() : null, r.ok ? "email" : null, r.ok ? null : r.error, o.id).run();
    }
    const left = await env.DB.prepare(`SELECT channel, handle FROM outbox WHERE lady_id=? AND status='queued'`).bind(lady.id).all();
    const n = (left.results || []).length;
    await telegram(env, `${lady.name} has arrived (${who}).` + (n ? ` ${n} customer${n > 1 ? "s" : ""} asked to be told. Open garter.black/roster, Notify tab, and tap send.` : ""));
  })());
  return list.length;
}

/* ---------- staff board ---------- */
async function board(env) {
  const today = rosterDay(0), tomorrow = rosterDay(1), nowMin = nowShiftMinutes();
  const cutoff = new Date(Date.now() - 90 * 86400000).toISOString();
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM enquiries WHERE created_at < ?`).bind(cutoff),
    env.DB.prepare(`DELETE FROM outbox WHERE created_at < ?`).bind(cutoff),
  ]);
  const [ladies, a, b, counts, s] = await Promise.all([
    env.DB.prepare(`SELECT l.*, rv.r_avg, rv.r_count FROM ladies l ${RATING_JOIN} ORDER BY l.active DESC, COALESCE(l.last_worked,'') DESC, l.name`).all(),
    env.DB.prepare(`SELECT * FROM roster WHERE day=? ORDER BY pos`).bind(today).all(),
    env.DB.prepare(`SELECT * FROM roster WHERE day=? ORDER BY pos`).bind(tomorrow).all(),
    env.DB.prepare(`SELECT
        (SELECT COUNT(*) FROM enquiries WHERE status IN ('new','waiting')) AS enquiries,
        (SELECT COUNT(*) FROM outbox WHERE status='queued') AS outbox,
        (SELECT COUNT(*) FROM reviews WHERE status='pending') AS reviews,
        (SELECT COUNT(*) FROM tips WHERE status='paid' AND roster_day=?) AS tips_today,
        (SELECT COALESCE(SUM(amount_cents),0) FROM tips WHERE status='paid' AND roster_day=?) AS tips_today_cents`).bind(today, today).first(),
    settings(env),
  ]);
  const L = (ladies.results || []).map((l) => ({
    id: l.id, slug: l.slug, name: l.name, age: l.age, height_cm: l.height_cm, weight_kg: l.weight_kg, dress: l.dress, bust: l.bust,
    hair: l.hair, nationality: l.nationality, languages: l.languages, services: parseJ(l.services, []), bio: l.bio,
    photos: photoUrls(l.photos), active: !!l.active, last_worked: l.last_worked, created_at: l.created_at,
    rating: l.r_avg ? { avg: Math.round(l.r_avg * 10) / 10, count: l.r_count } : null,
  }));
  const mapDay = (rows) => (rows.results || []).map((r) => ({ id: r.lady_id, start: r.start, end: r.end, arrived: !!r.arrived_at, arrived_at: r.arrived_at, note: r.note }));
  return {
    now: nowIso(), nowMin, ladies: L,
    days: { today: { day: today, label: dayLabel(today), list: mapDay(a) }, tomorrow: { day: tomorrow, label: dayLabel(tomorrow), list: mapDay(b) } },
    desk: { reception: s.desk_reception, cleaners: s.desk_cleaners }, counts,
  };
}

async function rosterText(env) {
  const r = await publicRoster(env);
  const line = (x) => `· ${x.name}${x.start ? " " + x.start + (x.end ? " to " + x.end : "") : ""}${x.arrived ? " (in)" : ""}`;
  return `THE BLACK GARTER · roster\n\nToday ${r.today.label}\n${r.today.list.map(line).join("\n") || "· nobody yet"}\n\nTomorrow ${r.tomorrow.label}\n${r.tomorrow.list.map(line).join("\n") || "· nobody yet"}\n\ngarter.black/#roster`;
}

/* ============================================================
   API
   ============================================================ */
export async function api(request, env, ctx, url) {
  const p = url.pathname, m = request.method;
  const seg = p.split("/").filter(Boolean); /* ["api", ...] */

  /* ----- public ----- */
  if (p === "/api/roster" && m === "GET") return json(await publicRoster(env), 200, { "cache-control": "public, max-age=15" });

  if (p === "/api/ladies" && m === "GET") {
    const sort = url.searchParams.get("sort") === "name" ? "l.name" : "COALESCE(l.last_worked,'') DESC, l.name";
    const res = await env.DB.prepare(`SELECT l.*, rv.r_avg, rv.r_count FROM ladies l ${RATING_JOIN} WHERE l.active=1 ORDER BY ${sort}`).all();
    const today = rosterDay(0), tomorrow = rosterDay(1);
    const on = await env.DB.prepare(`SELECT lady_id, day FROM roster WHERE day IN (?,?)`).bind(today, tomorrow).all();
    const tset = new Set(), mset = new Set();
    for (const r of on.results || []) (r.day === today ? tset : mset).add(r.lady_id);
    return json({
      today, tomorrow,
      list: (res.results || []).map((l) => ({ ...cardOf(l, null, 0, false), today: tset.has(l.id), tomorrow: mset.has(l.id), lastWorked: l.last_worked ? dayLabel(l.last_worked) : null })),
    }, 200, { "cache-control": "public, max-age=30" });
  }

  if (seg[1] === "ladies" && seg[2] && m === "GET") {
    const l = await ladyBySlug(env, seg[2]);
    if (!l) fail(404, "Not found");
    return json(await profileOf(env, l), 200, { "cache-control": "public, max-age=15" });
  }

  if (p === "/api/enquiry" && m === "POST") {
    const b = await readJSON(request);
    if (b.website) return json({ ok: true }); /* honeypot */
    const ip = await ipHash(request, env);
    await limitOrFail(env, "enq:" + ip, 6, 3600);
    const l = await ladyBySlug(env, clean(b.slug, 80));
    if (!l) fail(404, "That profile is no longer on the roster");
    const channel = CHANNELS.includes(b.channel) ? b.channel : fail(400, "Choose how we should reach you");
    const handle = validHandle(channel, b.handle);
    if (!handle) fail(400, channel === "email" ? "That email address doesn't look right" : channel === "telegram" ? "Add your Telegram @username or number" : "Add a mobile number we can reach");
    if (!b.consent) fail(400, "Tick the box so we can contact you");
    const name = clean(b.name, 40) || null, message = clean(b.message, 800) || null, notify = b.notify ? 1 : 0;
    await env.DB.prepare(`INSERT INTO enquiries(lady_id, name, channel, handle, message, notify, status, created_at, ip) VALUES(?,?,?,?,?,?, 'new', ?, ?)`)
      .bind(l.id, name, channel, handle, message, notify, nowIso(), ip).run();
    ctx.waitUntil(telegram(env, `New enquiry for ${l.name} via ${channel}${name ? " from " + name : ""}${notify ? " · wants to be told when she arrives" : ""}.${message ? "\n\"" + message + "\"" : ""}\nReply from garter.black/roster, Enquiries tab.`));
    return json({ ok: true, notify: !!notify });
  }

  if (p === "/api/review" && m === "POST") {
    const b = await readJSON(request);
    if (b.website) return json({ ok: true });
    const ip = await ipHash(request, env);
    await limitOrFail(env, "rev:" + ip, 3, 86400);
    const l = await ladyBySlug(env, clean(b.slug, 80));
    if (!l) fail(404, "Not found");
    const rating = Math.round(+b.rating);
    if (!(rating >= 1 && rating <= 5)) fail(400, "Pick one to five stars");
    const body = clean(b.body, 1000) || null;
    if (body && /(\+?\d[\d\s-]{7,}\d)|@[\w.-]+\.\w/.test(body)) fail(400, "Leave phone numbers and emails out of feedback");
    await env.DB.prepare(`INSERT INTO reviews(lady_id, rating, body, name, status, created_at, ip) VALUES(?,?,?,?, 'pending', ?, ?)`)
      .bind(l.id, rating, body, clean(b.name, 40) || null, nowIso(), ip).run();
    ctx.waitUntil(telegram(env, `New ${rating} star feedback for ${l.name} waiting for approval (garter.black/roster, Feedback tab).`));
    return json({ ok: true });
  }

  if (p === "/api/tip/intent" && m === "POST") {
    if (!env.STRIPE_SECRET_KEY) fail(503, "Tips are switching on shortly");
    const b = await readJSON(request);
    const ip = await ipHash(request, env);
    await limitOrFail(env, "tip:" + ip, 12, 3600);
    const l = await ladyBySlug(env, clean(b.slug, 80));
    if (!l) fail(404, "Not found");
    const s = await settings(env);
    const min = +s.tip_min || 10, max = +s.tip_max || 2000;
    const cents = Math.round(Math.round(+b.amount * 100) / 100 * 100);
    if (!Number.isFinite(cents) || cents < Math.max(50, Math.round(min * 100)) || cents > Math.round(max * 100))
      fail(400, `Tips are $${min} to $${max}`);
    const sp = splitOf(cents), ref = "GB" + randomToken(6).replace(/[^A-Za-z0-9]/g, "").slice(0, 8).toUpperCase();
    const tipper = clean(b.tipper, 40) || null, message = clean(b.message, 280) || null;
    /* Hosted Checkout: card, Link, Apple Pay and Google Pay on Stripe's page, no publishable key needed.
       The tip row is written first as 'created' so the webhook and confirm can both find it by ref. */
    await env.DB.prepare(`INSERT INTO tips(ref, lady_id, lady_name, amount_cents, tipper, message, status, stripe_pi, reception, cleaners, roster_day,
        lady_cents, reception_cents, cleaners_cents, management_cents, owner_cents, created_at, ip)
        VALUES(?,?,?,?,?,?, 'created', NULL, ?,?,?, ?,?,?,?,?, ?,?)`)
      .bind(ref, l.id, l.name, cents, tipper, message, s.desk_reception || null, s.desk_cleaners || null, rosterDay(0),
        sp.lady, sp.reception, sp.cleaners, sp.management, sp.owner, nowIso(), ip).run();
    const back = `${SITE}/ladies/${encodeURIComponent(l.slug)}?tip=${encodeURIComponent(ref)}`;
    let cs;
    try {
      cs = await stripe(env, "POST", "checkout/sessions", {
        mode: "payment",
        ui_mode: "hosted_page",
        success_url: back + "&session_id={CHECKOUT_SESSION_ID}",
        cancel_url: back + "&cancelled=1",
        client_reference_id: ref,
        customer_creation: "if_required",
        line_items: [{
          quantity: 1,
          price_data: {
            currency: "aud",
            unit_amount: cents,
            product_data: { name: `Tip for ${l.name}`, description: "Eighty percent to her, the rest to the house team" },
          },
        }],
        metadata: { ref, lady: l.name, lady_slug: l.slug, lady_cents: String(sp.lady), split: "80/5/5/5/5" },
      }, "tip-" + ref);
    } catch (e) {
      /* Payment setup failed: park the row so the ledger is honest and the ref is not reused blindly. */
      await env.DB.prepare(`UPDATE tips SET status='failed' WHERE ref=? AND status='created'`).bind(ref).run();
      throw e;
    }
    await env.DB.prepare(`UPDATE tips SET stripe_pi=? WHERE ref=?`).bind(cs.id, ref).run();
    return json({ ref, url: cs.url, amount: cents, split: sp });
  }

  if (p === "/api/tip/confirm" && m === "POST") {
    const b = await readJSON(request);
    const t = await env.DB.prepare(`SELECT * FROM tips WHERE ref=?`).bind(clean(b.ref, 20)).first();
    if (!t) fail(404, "Unknown tip");
    /* Never trust a client success flag: the desk asks Stripe directly, every time, until it is paid. */
    if (t.status !== "paid" && t.stripe_pi) {
      const cs = await stripe(env, "GET", `checkout/sessions/${t.stripe_pi}?expand[]=payment_intent.latest_charge.balance_transaction`);
      await markSessionPaid(env, cs);
      if (cs.payment_status !== "paid") return json({ status: cs.status === "expired" ? "expired" : "pending" });
    } else if (t.status !== "paid") {
      return json({ status: "pending" });
    }
    return json({ status: "succeeded", lady: t.lady_name, amount: t.amount_cents, lady_cents: t.lady_cents });
  }

  if (p === "/api/stripe/webhook" && m === "POST") {
    const raw = await request.text();
    if (!(await verifyStripeSig(env, raw, request.headers.get("stripe-signature")))) return json({ error: "bad signature" }, 400);
    let ev; try { ev = JSON.parse(raw); } catch { return json({ error: "bad body" }, 400); }
    const obj = ev && ev.data && ev.data.object || {};
    if (ev.type === "checkout.session.completed" || ev.type === "checkout.session.async_payment_succeeded") {
      const cs = await stripe(env, "GET", `checkout/sessions/${obj.id}?expand[]=payment_intent.latest_charge.balance_transaction`);
      await markSessionPaid(env, cs);
    } else if (ev.type === "checkout.session.expired") {
      await env.DB.prepare(`UPDATE tips SET status='expired' WHERE stripe_pi=? AND status='created'`).bind(obj.id).run();
    } else if (ev.type === "payment_intent.succeeded") {
      const pi = await stripe(env, "GET", `payment_intents/${obj.id}?expand[]=latest_charge.balance_transaction`);
      await markTipPaid(env, pi);
    } else if (ev.type === "payment_intent.payment_failed") {
      await env.DB.prepare(`UPDATE tips SET status='failed' WHERE stripe_pi=? AND status='created'`).bind(obj.id).run();
    } else if (ev.type === "charge.refunded") {
      await env.DB.prepare(`UPDATE tips SET status='refunded', payout_status='owed' WHERE (stripe_pi=? OR stripe_pi=?)`)
        .bind(obj.payment_intent, obj.id).run();
    }
    return json({ received: true });
  }

  /* ----- staff sign in ----- */
  if (p === "/api/staff/config" && m === "GET") {
    const s = await settings(env);
    return json({ googleClientId: s.google_client_id || "", passwordEnabled: !!env.ROSTER_PASSWORD });
  }
  if (p === "/api/staff/login" && m === "POST") {
    const b = await readJSON(request);
    const ip = await ipHash(request, env);
    await limitOrFail(env, "slogin:" + ip, 8, 900);
    if (!env.ROSTER_PASSWORD || !safeEqual(String(b.password || ""), env.ROSTER_PASSWORD)) fail(401, "That password isn't right");
    const name = clean(b.name, 40) || "Desk";
    const tok = await signToken(env, { name, role: "staff", via: "password", exp: Date.now() + 14 * 86400000 });
    await audit(env, name, "staff.login", { via: "password" });
    return json({ ok: true, name }, 200, { "set-cookie": setCookie("gb_staff", tok, 14 * 86400) });
  }
  if (p === "/api/staff/google" && m === "POST") {
    const b = await readJSON(request);
    const ip = await ipHash(request, env);
    await limitOrFail(env, "slogin:" + ip, 8, 900);
    const s = await settings(env);
    const g = await verifyGoogle(b.credential, s.google_client_id);
    if (!g) fail(401, "Google sign in didn't verify");
    const owners = String(env.OWNER_EMAILS || "").toLowerCase().split(/[,\s]+/).filter(Boolean);
    let row = await env.DB.prepare(`SELECT * FROM staff WHERE email=?`).bind(g.email).first();
    if (!row && owners.includes(g.email)) row = { email: g.email, name: g.name || "Owner", role: "owner" };
    if (!row) fail(403, `${g.email} isn't on the team list yet. Ask the desk to add it, or use the house password.`);
    const tok = await signToken(env, { name: row.name, email: g.email, role: row.role, via: "google", exp: Date.now() + 30 * 86400000 });
    await audit(env, row.name, "staff.login", { via: "google", email: g.email });
    return json({ ok: true, name: row.name }, 200, { "set-cookie": setCookie("gb_staff", tok, 30 * 86400) });
  }
  if (p === "/api/staff/logout" && m === "POST") return json({ ok: true }, 200, { "set-cookie": clearCookie("gb_staff") });

  /* ----- staff (cookie or AI bearer) ----- */
  if (seg[1] !== "staff") fail(404, "Not found");
  const me = await requireStaff(request, env);
  const who = me.name + (me.ai ? " (AI)" : "");

  if (p === "/api/staff/me") return json({ name: me.name, role: me.role, email: me.email || null, ai: !!me.ai });
  if (p === "/api/staff/board" && m === "GET") return json(await board(env));

  /* roster for a day: replace the whole ordered list */
  if (seg[2] === "roster" && seg[3] && m === "PUT") {
    const day = seg[3];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) fail(400, "Bad day");
    const today = rosterDay(0);
    const span = (Date.parse(day) - Date.parse(today)) / 86400000;
    if (span < -1 || span > 14) fail(400, "Roster can be set from yesterday to two weeks ahead");
    const b = await readJSON(request);
    const list = Array.isArray(b.list) ? b.list.slice(0, 80) : fail(400, "Missing list");
    const ids = [];
    for (const x of list) {
      const id = +x.id; if (!(id > 0)) fail(400, "Bad lady id");
      const st = hm(x.start), en = hm(x.end);
      if (st === undefined || en === undefined) fail(400, "Times look like 20:00");
      ids.push({ id, start: st, end: en, note: clean(x.note, 120) || null });
    }
    const existing = await env.DB.prepare(`SELECT lady_id FROM roster WHERE day=?`).bind(day).all();
    const keep = new Set(ids.map((x) => x.id));
    const stmts = [];
    for (const r of existing.results || []) if (!keep.has(r.lady_id)) stmts.push(env.DB.prepare(`DELETE FROM roster WHERE day=? AND lady_id=?`).bind(day, r.lady_id));
    const now = nowIso();
    ids.forEach((x, i) => {
      stmts.push(env.DB.prepare(`INSERT INTO roster(day, lady_id, pos, start, end, note, updated_at, updated_by) VALUES(?,?,?,?,?,?,?,?)
        ON CONFLICT(day, lady_id) DO UPDATE SET pos=excluded.pos, start=excluded.start, end=excluded.end, note=excluded.note, updated_at=excluded.updated_at, updated_by=excluded.updated_by`)
        .bind(day, x.id, i, x.start, x.end, x.note, now, who));
      if (day <= today) stmts.push(env.DB.prepare(`UPDATE ladies SET last_worked=? WHERE id=? AND (last_worked IS NULL OR last_worked < ?)`).bind(day, x.id, day));
    });
    if (stmts.length) await env.DB.batch(stmts);
    await audit(env, who, "roster.set", { day, ladies: ids.map((x) => x.id) });
    return json({ ok: true, day, count: ids.length });
  }

  if (p === "/api/staff/arrived" && m === "POST") {
    const b = await readJSON(request);
    const day = rosterDay(0), id = +b.id;
    const l = await env.DB.prepare(`SELECT * FROM ladies WHERE id=?`).bind(id).first();
    if (!l) fail(404, "No such lady");
    const row = await env.DB.prepare(`SELECT * FROM roster WHERE day=? AND lady_id=?`).bind(day, id).first();
    if (!row) {
      if (!b.arrived) return json({ ok: true });
      const pos = await env.DB.prepare(`SELECT COALESCE(MAX(pos),-1)+1 n FROM roster WHERE day=?`).bind(day).first();
      await env.DB.prepare(`INSERT INTO roster(day, lady_id, pos, updated_at, updated_by) VALUES(?,?,?,?,?)`).bind(day, id, pos.n, nowIso(), who).run();
    }
    await env.DB.prepare(`UPDATE roster SET arrived_at=?, updated_at=?, updated_by=? WHERE day=? AND lady_id=?`)
      .bind(b.arrived ? nowIso() : null, nowIso(), who, day, id).run();
    if (b.arrived) await env.DB.prepare(`UPDATE ladies SET last_worked=? WHERE id=?`).bind(day, id).run();
    const n = b.arrived ? await queueArrivalNotices(env, ctx, l, who) : 0;
    await audit(env, who, b.arrived ? "lady.arrived" : "lady.unarrived", { id, name: l.name, notices: n });
    return json({ ok: true, notices: n });
  }

  /* ladies */
  if (p === "/api/staff/ladies" && m === "POST") {
    const b = await readJSON(request);
    const f = ladyFields(b, false);
    let slug = slugify(f.name, 40), i = 1;
    while (await env.DB.prepare(`SELECT 1 FROM ladies WHERE slug=?`).bind(slug).first()) slug = slugify(f.name, 40) + "-" + (++i);
    const now = nowIso();
    const cols = ["slug", "created_at", "updated_at", "created_by", ...Object.keys(f)];
    const vals = [slug, now, now, who, ...Object.values(f)];
    const r = await env.DB.prepare(`INSERT INTO ladies(${cols.join(",")}) VALUES(${cols.map(() => "?").join(",")})`).bind(...vals).run();
    await audit(env, who, "lady.create", { id: r.meta.last_row_id, name: f.name });
    return json({ ok: true, id: r.meta.last_row_id, slug });
  }
  if (seg[2] === "ladies" && seg[3] && !seg[4]) {
    const id = +seg[3];
    const l = await env.DB.prepare(`SELECT * FROM ladies WHERE id=?`).bind(id).first();
    if (!l) fail(404, "No such lady");
    if (m === "PATCH") {
      const b = await readJSON(request);
      const f = ladyFields(b, true);
      if (f.name && f.name !== l.name && b.renameSlug) {
        let slug = slugify(f.name, 40), i = 1;
        while (await env.DB.prepare(`SELECT 1 FROM ladies WHERE slug=? AND id!=?`).bind(slug, id).first()) slug = slugify(f.name, 40) + "-" + (++i);
        f.slug = slug;
      }
      if (!Object.keys(f).length) return json({ ok: true });
      f.updated_at = nowIso();
      await env.DB.prepare(`UPDATE ladies SET ${Object.keys(f).map((k) => k + "=?").join(",")} WHERE id=?`).bind(...Object.values(f), id).run();
      await audit(env, who, "lady.update", { id, fields: Object.keys(f) });
      return json({ ok: true, slug: f.slug || l.slug });
    }
    if (m === "DELETE") {
      for (const ph of parseJ(l.photos, [])) await env.MEDIA.delete([ph.k + "-s.webp", ph.k + "-l.webp"]);
      await env.DB.batch([
        env.DB.prepare(`DELETE FROM roster WHERE lady_id=?`).bind(id),
        env.DB.prepare(`DELETE FROM reviews WHERE lady_id=?`).bind(id),
        env.DB.prepare(`DELETE FROM ladies WHERE id=?`).bind(id),
      ]);
      await audit(env, who, "lady.delete", { id, name: l.name });
      return json({ ok: true });
    }
  }
  /* photos: multipart with files "l" (large) and "s" (small), both already resized and EXIF free (client side canvas) */
  if (seg[2] === "ladies" && seg[4] === "photos") {
    const id = +seg[3];
    const l = await env.DB.prepare(`SELECT * FROM ladies WHERE id=?`).bind(id).first();
    if (!l) fail(404, "No such lady");
    let photos = parseJ(l.photos, []);
    if (m === "POST" && !seg[5]) {
      if (photos.length >= 8) fail(400, "Eight photos is the limit");
      const fd = await request.formData();
      const L = fd.get("l"), S = fd.get("s");
      if (!L || !S || typeof L === "string") fail(400, "Missing image");
      const okType = (f) => ["image/webp", "image/jpeg", "image/png"].includes(f.type);
      if (!okType(L) || !okType(S)) fail(400, "Images must be webp, jpeg or png");
      if (L.size > 5 * 1024 * 1024 || S.size > 2 * 1024 * 1024) fail(400, "Image too large");
      const k = `ladies/${id}/${Date.now().toString(36)}${randomToken(4).replace(/[^A-Za-z0-9]/g, "")}`;
      await env.MEDIA.put(k + "-l.webp", L.stream(), { httpMetadata: { contentType: L.type, cacheControl: "public, max-age=31536000, immutable" } });
      await env.MEDIA.put(k + "-s.webp", S.stream(), { httpMetadata: { contentType: S.type, cacheControl: "public, max-age=31536000, immutable" } });
      photos.push({ k, w: +fd.get("w") || null, h: +fd.get("h") || null });
      await env.DB.prepare(`UPDATE ladies SET photos=?, updated_at=? WHERE id=?`).bind(JSON.stringify(photos), nowIso(), id).run();
      await audit(env, who, "lady.photo.add", { id, k });
      return json({ ok: true, photos: photoUrls(JSON.stringify(photos)) });
    }
    if (m === "PUT" && seg[5] === "order") {
      const b = await readJSON(request);
      const order = Array.isArray(b.keys) ? b.keys : [];
      const byK = new Map(photos.map((x) => [x.k, x]));
      const next = order.map((k) => byK.get(k)).filter(Boolean);
      for (const x of photos) if (!next.includes(x)) next.push(x);
      await env.DB.prepare(`UPDATE ladies SET photos=?, updated_at=? WHERE id=?`).bind(JSON.stringify(next), nowIso(), id).run();
      return json({ ok: true, photos: photoUrls(JSON.stringify(next)) });
    }
    if (m === "DELETE" && seg[5]) {
      const k = decodeURIComponent(seg.slice(5).join("/"));
      if (!photos.some((x) => x.k === k)) fail(404, "No such photo");
      await env.MEDIA.delete([k + "-s.webp", k + "-l.webp"]);
      photos = photos.filter((x) => x.k !== k);
      await env.DB.prepare(`UPDATE ladies SET photos=?, updated_at=? WHERE id=?`).bind(JSON.stringify(photos), nowIso(), id).run();
      await audit(env, who, "lady.photo.delete", { id, k });
      return json({ ok: true, photos: photoUrls(JSON.stringify(photos)) });
    }
  }

  /* enquiries and the notify queue */
  if (p === "/api/staff/enquiries" && m === "GET") {
    const st = url.searchParams.get("status");
    const q = st ? `WHERE e.status=?` : `WHERE e.status IN ('new','waiting')`;
    const stmt = env.DB.prepare(`SELECT e.*, l.name lady_name, l.slug lady_slug FROM enquiries e LEFT JOIN ladies l ON l.id=e.lady_id ${q} ORDER BY e.created_at DESC LIMIT 200`);
    const res = await (st ? stmt.bind(st) : stmt).all();
    const s = await settings(env);
    return json({ list: (res.results || []).map((e) => ({ ...e, ip: undefined,
      reply: sendLink(e.channel, e.handle, `Hi${e.name ? " " + e.name : ""}, it's The Black Garter about ${e.lady_name || "your enquiry"}. `) })) });
  }
  if (seg[2] === "enquiries" && seg[3] && m === "PATCH") {
    const b = await readJSON(request);
    const st = ["new", "waiting", "notified", "done"].includes(b.status) ? b.status : fail(400, "Bad status");
    await env.DB.prepare(`UPDATE enquiries SET status=? WHERE id=?`).bind(st, +seg[3]).run();
    await audit(env, who, "enquiry.status", { id: +seg[3], status: st });
    return json({ ok: true });
  }
  if (p === "/api/staff/outbox" && m === "GET") {
    const st = url.searchParams.get("status") || "queued";
    const res = await env.DB.prepare(`SELECT o.*, l.name lady_name FROM outbox o LEFT JOIN ladies l ON l.id=o.lady_id WHERE o.status=? ORDER BY o.created_at DESC LIMIT 200`).bind(st).all();
    return json({ list: (res.results || []).map((o) => ({ ...o, link: sendLink(o.channel, o.handle, o.body) })) });
  }
  if (seg[2] === "outbox" && seg[3] && m === "POST") {
    const b = await readJSON(request);
    const st = ["sent", "skipped", "failed", "queued"].includes(b.status) ? b.status : "sent";
    await env.DB.prepare(`UPDATE outbox SET status=?, sent_at=?, sent_by=?, error=? WHERE id=?`)
      .bind(st, st === "sent" ? nowIso() : null, who, clean(b.error, 200) || null, +seg[3]).run();
    return json({ ok: true });
  }

  /* reviews */
  if (p === "/api/staff/reviews" && m === "GET") {
    const st = url.searchParams.get("status") || "pending";
    const res = await env.DB.prepare(`SELECT r.id, r.rating, r.body, r.name, r.status, r.created_at, l.name lady_name, l.slug lady_slug FROM reviews r JOIN ladies l ON l.id=r.lady_id WHERE r.status=? ORDER BY r.created_at DESC LIMIT 200`).bind(st).all();
    return json({ list: res.results || [] });
  }
  if (seg[2] === "reviews" && seg[3] && m === "POST") {
    const b = await readJSON(request);
    const st = ["approved", "rejected", "pending"].includes(b.status) ? b.status : fail(400, "Bad status");
    await env.DB.prepare(`UPDATE reviews SET status=?, decided_by=?, decided_at=? WHERE id=?`).bind(st, who, nowIso(), +seg[3]).run();
    await audit(env, who, "review." + st, { id: +seg[3] });
    return json({ ok: true });
  }

  /* tips ledger */
  if (p === "/api/staff/tips" && m === "GET") {
    const from = url.searchParams.get("from") || rosterDay(-30), to = url.searchParams.get("to") || rosterDay(0);
    const res = await env.DB.prepare(`SELECT id, ref, lady_name, amount_cents, fee_cents, tipper, message, status, reception, cleaners, roster_day,
      lady_cents, reception_cents, cleaners_cents, management_cents, owner_cents, payout_status, created_at, paid_at
      FROM tips WHERE roster_day BETWEEN ? AND ? AND status IN ('paid','refunded') ORDER BY created_at DESC LIMIT 500`).bind(from, to).all();
    const list = res.results || [];
    const owed = {};
    const add = (k, c) => { if (!k) return; owed[k] = (owed[k] || 0) + c; };
    for (const t of list) if (t.status === "paid" && t.payout_status === "owed") {
      add("Lady · " + t.lady_name, t.lady_cents); add("Reception · " + (t.reception || "unassigned"), t.reception_cents);
      add("Cleaners · " + (t.cleaners || "unassigned"), t.cleaners_cents); add("Management", t.management_cents); add("Building and website", t.owner_cents);
    }
    return json({ from, to, list, owed, fees: list.reduce((a, t) => a + (t.fee_cents || 0), 0) });
  }
  if (seg[2] === "tips" && seg[3] && m === "POST") {
    const b = await readJSON(request);
    const st = b.payout_status === "paid" ? "paid" : "owed";
    await env.DB.prepare(`UPDATE tips SET payout_status=? WHERE id=?`).bind(st, +seg[3]).run();
    await audit(env, who, "tip.payout", { id: +seg[3], st });
    return json({ ok: true });
  }

  /* settings and team */
  if (p === "/api/staff/settings") {
    if (m === "GET") return json(await settings(env, true));
    if (m === "PUT") {
      const b = await readJSON(request);
      const stmts = [];
      for (const k of SETTING_KEYS) if (k in b) stmts.push(env.DB.prepare(`INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`).bind(k, clean(b[k], 300)));
      if (stmts.length) await env.DB.batch(stmts);
      invalidateSettings();
      await audit(env, who, "settings.update", Object.keys(b).filter((k) => SETTING_KEYS.includes(k)));
      return json(await settings(env, true));
    }
  }
  if (p === "/api/staff/team") {
    if (m === "GET") return json({ list: (await env.DB.prepare(`SELECT email, name, role, added_by, added_at FROM staff ORDER BY name`).all()).results || [] });
    if (m === "POST") {
      const b = await readJSON(request);
      const email = clean(b.email, 120).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) fail(400, "That email doesn't look right");
      const role = ["staff", "manager", "reception", "recruiter", "owner"].includes(b.role) ? b.role : "staff";
      await env.DB.prepare(`INSERT INTO staff(email,name,role,added_by,added_at) VALUES(?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET name=excluded.name, role=excluded.role`)
        .bind(email, clean(b.name, 40) || email.split("@")[0], role, who, nowIso()).run();
      await audit(env, who, "team.add", { email, role });
      return json({ ok: true });
    }
    if (m === "DELETE") {
      const email = clean(url.searchParams.get("email"), 120).toLowerCase();
      await env.DB.prepare(`DELETE FROM staff WHERE email=?`).bind(email).run();
      await audit(env, who, "team.remove", { email });
      return json({ ok: true });
    }
  }
  if (p === "/api/staff/log" && m === "GET") {
    const res = await env.DB.prepare(`SELECT at, who, action, detail FROM log ORDER BY id DESC LIMIT ?`).bind(Math.min(500, +url.searchParams.get("limit") || 150)).all();
    return json({ list: res.results || [] });
  }
  if (p === "/api/staff/announce" && m === "POST") {
    const text = await rosterText(env);
    const sent = await telegram(env, text);
    await audit(env, who, "roster.announce", { telegram: sent });
    return json({ ok: true, text, telegram: sent, whatsapp: "https://wa.me/?text=" + encodeURIComponent(text) });
  }
  fail(404, "Not found");
}

/* ============================================================
   /ladies/<slug> page: shell + real meta + boot data
   ============================================================ */
export async function page(request, env, ctx, url) {
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0] !== "ladies" || parts.length !== 2) return null;
  const slug = decodeURIComponent(parts[1]).toLowerCase();
  if (slug.startsWith("_")) return new Response("Not found", { status: 404 });
  const shell = await env.ASSETS.fetch(new Request(url.origin + "/ladies/_profile", { headers: request.headers }));
  const l = await ladyBySlug(env, slug);
  if (!l) {
    const r = injectMeta(shell, { title: "Not on the roster · The Black Garter", desc: "This profile is no longer on the roster.", bootstrap: { missing: true } });
    return new Response(r.body, { status: 404, headers: r.headers });
  }
  const prof = await profileOf(env, l);
  const bits = [prof.age && prof.age + "", prof.nationality].filter(Boolean).join(", ");
  const when = prof.today ? (prof.today.onNow ? "On now" : "On today") : prof.tomorrow ? "On tomorrow" : "On the roster";
  return injectMeta(shell, {
    title: `${l.name} · The Black Garter, Rockdale`,
    desc: `${l.name}${bits ? ", " + bits : ""}. ${when} at The Black Garter, Rockdale. Call or text the house to book.`,
    image: prof.photos[0] ? prof.photos[0].l : "/assets/black-room.jpg",
    canonical: "/ladies/" + l.slug,
    jsonld: { "@context": "https://schema.org", "@type": "ProfilePage", name: l.name, url: "https://garter.black/ladies/" + l.slug },
    bootstrap: { profile: prof },
  });
}
