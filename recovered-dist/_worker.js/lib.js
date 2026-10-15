/* ============================================================
   garter.black · shared server library
   Used by roster.js (house, staff, tips) and forum.js (forum).
   ============================================================ */

export const SITE = "https://garter.black";
const enc = new TextEncoder();

/* ---------- responses ---------- */
const SEC = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-frame-options": "SAMEORIGIN",
  "permissions-policy": "camera=(), microphone=(self), geolocation=(), payment=(self \"https://js.stripe.com\")",
};
export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...SEC, ...headers },
  });
}
export const bad = (error, status = 400, extra = {}) => json({ error, ...extra }, status);
export function htmlResponse(html, status = 200, headers = {}) {
  return new Response(html, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache", ...SEC, ...headers } });
}
export function withSec(res) {
  const r = new Response(res.body, res);
  for (const [k, v] of Object.entries(SEC)) if (!r.headers.has(k)) r.headers.set(k, v);
  return r;
}
export class HttpError extends Error {
  constructor(status, msg) { super(msg); this.status = status; }
}
export const fail = (status, msg) => { throw new HttpError(status, msg); };

export async function readJSON(request, max = 64 * 1024) {
  const len = +(request.headers.get("content-length") || 0);
  if (len > max) fail(413, "Too large");
  const t = await request.text();
  if (t.length > max) fail(413, "Too large");
  try { return t ? JSON.parse(t) : {}; } catch { fail(400, "Bad JSON"); }
}

/* ---------- text ---------- */
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export function slugify(s, max = 60) {
  return String(s || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, max) || "x";
}
export function clean(s, max = 2000) {
  return String(s ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim().slice(0, max);
}
export const nowIso = () => new Date().toISOString();

/* ---------- Sydney time and the 4am roster day ---------- */
const SYD = new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
export function sydParts(d = new Date()) {
  const p = Object.fromEntries(SYD.formatToParts(d).map((x) => [x.type, x.value]));
  const h = +p.hour % 24;
  return { y: +p.year, m: +p.month, d: +p.day, h, mi: +p.minute, date: `${p.year}-${p.month}-${p.day}` };
}
function addDays(ymd, n) {
  const [y, m, d] = ymd.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}
/** Roster days run 4am to 4am Sydney time. offset 0 = today, 1 = tomorrow. */
export function rosterDay(offset = 0, now = new Date()) {
  const p = sydParts(now);
  const base = p.h < 4 ? addDays(p.date, -1) : p.date;
  return addDays(base, offset);
}
/** Minutes since the roster day started (4am = 0). Times like "02:00" count past midnight. */
export function shiftMinutes(hm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm || ""); if (!m) return null;
  let v = (+m[1]) * 60 + (+m[2]) - 240; if (v < 0) v += 1440; return v;
}
export function nowShiftMinutes(now = new Date()) {
  const p = sydParts(now); let v = p.h * 60 + p.mi - 240; if (v < 0) v += 1440; return v;
}
export function dayLabel(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Intl.DateTimeFormat("en-AU", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(new Date(Date.UTC(y, m - 1, d)));
}

/* ---------- crypto ---------- */
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
const keyCache = new Map();
async function hmacKey(secret) {
  if (!keyCache.has(secret)) keyCache.set(secret, await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]));
  return keyCache.get(secret);
}
export async function hmac(secret, data) { return b64u(await crypto.subtle.sign("HMAC", await hmacKey(secret), enc.encode(data))); }
export async function sha256hex(s) {
  const b = await crypto.subtle.digest("SHA-256", typeof s === "string" ? enc.encode(s) : s);
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
export function safeEqual(a, b) {
  a = String(a); b = String(b); let r = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) r |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return r === 0;
}
export function randomToken(bytes = 24) { const a = new Uint8Array(bytes); crypto.getRandomValues(a); return b64u(a); }

/** Signed token: base64url(json).sig */
export async function signToken(env, payload) {
  const body = b64u(enc.encode(JSON.stringify(payload)));
  return body + "." + (await hmac(env.SESSION_SECRET, body));
}
export async function readToken(env, tok) {
  if (!tok || !env.SESSION_SECRET) return null;
  const parts = String(tok).split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  if (!body || !sig) return null;
  if (!safeEqual(sig, await hmac(env.SESSION_SECRET, body))) return null;
  try {
    const p = JSON.parse(new TextDecoder().decode(unb64u(body)));
    if (p === null || typeof p !== "object" || Array.isArray(p)) return null;
    if (p.exp && p.exp < Date.now()) return null;
    return p;
  } catch { return null; }
}

/** PBKDF2 password hashing: "pbkdf2$iter$salt$hash" */
export async function hashPassword(pw, iter = 100000) {
  const salt = new Uint8Array(16); crypto.getRandomValues(salt);
  const k = await crypto.subtle.importKey("raw", enc.encode(pw), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: iter }, k, 256);
  return `pbkdf2$${iter}$${b64u(salt)}$${b64u(bits)}`;
}
export async function verifyPassword(pw, stored) {
  const [alg, iter, salt, hash] = String(stored || "").split("$");
  if (alg !== "pbkdf2") return false;
  const k = await crypto.subtle.importKey("raw", enc.encode(pw), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: unb64u(salt), iterations: +iter }, k, 256);
  return safeEqual(b64u(bits), hash);
}

/* ---------- cookies ---------- */
export function cookies(request) {
  const out = {}; const h = request.headers.get("cookie") || "";
  h.split(/;\s*/).forEach((p) => { const i = p.indexOf("="); if (i > 0) out[p.slice(0, i)] = decodeURIComponent(p.slice(i + 1)); });
  return out;
}
export function setCookie(name, value, maxAgeSec, path = "/") {
  return `${name}=${encodeURIComponent(value)}; Path=${path}; Max-Age=${maxAgeSec}; HttpOnly; Secure; SameSite=Lax`;
}
export const clearCookie = (name, path = "/") => `${name}=; Path=${path}; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;

/* ---------- sessions ---------- */
/** Staff (roster admin). Cookie gb_staff, or Authorization: Bearer <AI_TOKEN> for Hecate, Cassandra and other AIs. */
export async function staffSession(request, env) {
  const auth = request.headers.get("authorization") || "";
  if (auth.startsWith("Bearer ") && env.AI_TOKEN && safeEqual(auth.slice(7).trim(), env.AI_TOKEN)) {
    const who = clean(request.headers.get("x-agent-name") || "AI", 40) || "AI";
    return { name: who, role: "ai", ai: true };
  }
  return await readToken(env, cookies(request).gb_staff);
}
export async function requireStaff(request, env) {
  const s = await staffSession(request, env);
  if (!s) fail(401, "Sign in to the roster first");
  return s;
}
/** Forum member. Cookie gb_user = signed {uid, u, exp}. */
export async function userSession(request, env) {
  return await readToken(env, cookies(request).gb_user);
}

/* ---------- Google Sign-In (ID token from Google Identity Services) ---------- */
export async function verifyGoogle(idToken, clientId) {
  if (!idToken || !clientId) return null;
  const r = await fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(idToken));
  if (!r.ok) return null;
  const t = await r.json();
  if (t.aud !== clientId) return null;
  if (!["accounts.google.com", "https://accounts.google.com"].includes(t.iss)) return null;
  if (+t.exp * 1000 < Date.now()) return null;
  if (String(t.email_verified) !== "true") return null;
  return { sub: t.sub, email: String(t.email).toLowerCase(), name: t.name || "", picture: t.picture || "" };
}

/* ---------- abuse control ---------- */
export async function ipHash(request, env) {
  const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "0";
  return (await sha256hex((env.SESSION_SECRET || "s") + "|" + ip)).slice(0, 24);
}
/** Fixed window limiter in D1. Returns true if allowed. */
export async function throttle(env, key, limit, windowSec) {
  const now = Math.floor(Date.now() / 1000);
  const row = await env.DB.prepare("SELECT n, reset_at FROM throttle WHERE k=?").bind(key).first();
  if (!row || row.reset_at <= now) {
    await env.DB.prepare("INSERT INTO throttle(k,n,reset_at) VALUES(?,1,?) ON CONFLICT(k) DO UPDATE SET n=1, reset_at=excluded.reset_at").bind(key, now + windowSec).run();
    return true;
  }
  if (row.n >= limit) return false;
  await env.DB.prepare("UPDATE throttle SET n=n+1 WHERE k=?").bind(key).run();
  return true;
}
export async function limitOrFail(env, key, limit, windowSec) {
  if (!(await throttle(env, key, limit, windowSec))) fail(429, "Slow down a little and try again shortly");
}

/* ---------- settings (key/value, cached per isolate for 20s) ---------- */
let SET = null, SET_AT = 0;
export const SETTING_DEFAULTS = {
  /* Shop and reception line. Recruitment keeps its own number (recruit_* below). */
  phone: "0412 216 197", tel: "+61412216197", whatsapp: "61412216197", email: "0@black.industries",
  recruit_phone: "0451 700 056", recruit_tel: "+61451700056", recruit_whatsapp: "61451700056",
  address: "17 to 19 The Seven Ways, Rockdale NSW 2216",
  desk_reception: "", desk_cleaners: "",
  google_client_id: "", tip_presets: "20,50,100", tip_min: "10", tip_max: "2000",
  telegram_chat_id: "", notify_from: "The Black Garter <desk@garter.black>",
};
export async function settings(env, fresh = false) {
  if (!fresh && SET && Date.now() - SET_AT < 20000) return SET;
  const rows = await env.DB.prepare("SELECT key, value FROM settings").all();
  SET = { ...SETTING_DEFAULTS };
  for (const r of rows.results || []) SET[r.key] = r.value;
  if (env.GOOGLE_CLIENT_ID && !SET.google_client_id) SET.google_client_id = env.GOOGLE_CLIENT_ID;
  SET_AT = Date.now();
  return SET;
}
export function invalidateSettings() { SET = null; }

export async function audit(env, who, action, detail) {
  try {
    await env.DB.prepare("INSERT INTO log(at, who, action, detail) VALUES(?,?,?,?)")
      .bind(nowIso(), String(who || "?").slice(0, 60), action, typeof detail === "string" ? detail.slice(0, 2000) : JSON.stringify(detail).slice(0, 2000)).run();
  } catch (e) { /* logging never breaks a request */ }
}

/* ---------- Telegram (Cassandra, staff chat) ---------- */
export async function telegram(env, text) {
  const s = await settings(env);
  const chat = s.telegram_chat_id || env.TELEGRAM_CHAT_ID;
  if (!env.TELEGRAM_BOT_TOKEN || !chat) return false;
  try {
    const r = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chat, text: text.slice(0, 4000), disable_web_page_preview: true }),
    });
    return r.ok;
  } catch { return false; }
}

/* ---------- email (Resend) ---------- */
export async function sendEmail(env, to, subject, text) {
  if (!env.RESEND_API_KEY) return { ok: false, error: "email not configured" };
  const s = await settings(env);
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { authorization: "Bearer " + env.RESEND_API_KEY, "content-type": "application/json" },
    body: JSON.stringify({ from: s.notify_from, to: [to], subject, text }),
  });
  return r.ok ? { ok: true } : { ok: false, error: "resend " + r.status + " " + (await r.text()).slice(0, 200) };
}

/* ---------- media (R2) ---------- */
export async function serveMedia(request, env, key) {
  const obj = await env.MEDIA.get(key);
  if (!obj) return new Response("Not found", { status: 404 });
  const h = new Headers();
  obj.writeHttpMetadata(h);
  h.set("etag", obj.httpEtag);
  h.set("cache-control", "public, max-age=31536000, immutable");
  h.set("x-content-type-options", "nosniff");
  if (request.headers.get("if-none-match") === obj.httpEtag) return new Response(null, { status: 304, headers: h });
  return new Response(obj.body, { headers: h });
}

/* ---------- HTML meta injection for server-routed shells ---------- */
export function injectMeta(res, { title, desc, image, canonical, jsonld, bootstrap }) {
  let rw = new HTMLRewriter();
  if (title) rw = rw.on("title", { element(e) { e.setInnerContent(title); } })
    .on('meta[property="og:title"]', { element(e) { e.setAttribute("content", title); } });
  if (desc) rw = rw.on('meta[name="description"]', { element(e) { e.setAttribute("content", desc); } })
    .on('meta[property="og:description"]', { element(e) { e.setAttribute("content", desc); } });
  if (image) rw = rw.on('meta[property="og:image"]', { element(e) { e.setAttribute("content", image.startsWith("http") ? image : SITE + image); } });
  if (canonical) rw = rw.on('link[rel="canonical"]', { element(e) { e.setAttribute("href", SITE + canonical); } })
    .on('meta[property="og:url"]', { element(e) { e.setAttribute("content", SITE + canonical); } });
  if (jsonld || bootstrap) rw = rw.on("head", { element(e) {
    if (jsonld) e.append(`<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, "\\u003c")}</script>`, { html: true });
    if (bootstrap) e.append(`<script>window.__BOOT__=${JSON.stringify(bootstrap).replace(/</g, "\\u003c")};</script>`, { html: true });
  } });
  const out = rw.transform(res);
  const r = new Response(out.body, out);
  r.headers.set("cache-control", "no-cache");
  r.headers.delete("content-length");
  return r;
}
