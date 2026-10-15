/* ============================================================
   garter.black · forum shared helpers (pure, no DB access)
   Imported by forum.js (routes) and forum-render.js (SSR).
   ============================================================ */
import { esc } from "./lib.js";

export const FLAIRS = ["Review", "Question", "News", "Discussion", "Warning", "Meta"];
export const KINDS = ["text", "link", "review"];
export const SORTS = ["hot", "new", "top", "rising"];
export const WINDOWS = { today: 86400, week: 604800, month: 2592000, year: 31536000, all: 0 };

const BOLD = /\*\*([^*\n]+)\*\*/g;
const ITAL = /(^|[^*])\*([^*\n]+)\*(?!\*)/g;
const URLRE = /https?:\/\/[^\s<]+/g;

function inline(s) {
  s = s.replace(BOLD, "<b>$1</b>");
  s = s.replace(ITAL, "$1<i>$2</i>");
  s = s.replace(URLRE, (u) => {
    let t = u, trail = "";
    const m = t.match(/[.,;:!?)\]]+$/);
    if (m) { trail = m[0]; t = t.slice(0, -trail.length); }
    return `<a href="${t}" target="_blank" rel="nofollow ugc noopener">${t}</a>${trail}`;
  });
  return s;
}

/** Escape first, then a tiny safe markdown: **bold** *italic* > quote, line breaks, autolinked URLs. */
export function md(src) {
  const s = esc(String(src ?? ""));
  const lines = s.split(/\r?\n/);
  const out = [];
  let para = [], quote = [];
  const flushP = () => { if (para.length) { out.push("<p>" + para.join("<br>") + "</p>"); para = []; } };
  const flushQ = () => { if (quote.length) { out.push("<blockquote><p>" + quote.join("<br>") + "</p></blockquote>"); quote = []; } };
  for (const line of lines) {
    if (/^&gt;\s?/.test(line)) { flushP(); quote.push(inline(line.replace(/^&gt;\s?/, ""))); }
    else if (line.trim() === "") { flushP(); flushQ(); }
    else { flushQ(); para.push(inline(line)); }
  }
  flushP(); flushQ();
  return out.join("") || "<p></p>";
}

/** Plain text for excerpts and meta descriptions. Operates on RAW text. */
export function txt(src, n = 180) {
  let s = String(src ?? "")
    .replace(/^&gt;\s?/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/[*_`#]/g, "")
    .replace(/https?:\/\/\S+/g, "link")
    .replace(/\s+/g, " ")
    .trim();
  if (n > 0 && s.length > n) {
    s = s.slice(0, n);
    const sp = s.lastIndexOf(" ");
    if (sp > n * 0.6) s = s.slice(0, sp);
    s = s.trim() + "…";
  }
  return s;
}

/* ---------- time ---------- */
export function ago(iso, now = Date.now()) {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (isNaN(t)) return "";
  const s = Math.max(0, Math.floor((now - t) / 1000));
  if (s < 90) return "just now";
  if (s < 3600) return Math.floor(s / 60) + "m ago";
  if (s < 86400) return Math.floor(s / 3600) + "h ago";
  if (s < 2592000) return Math.floor(s / 86400) + "d ago";
  if (s < 31536000) return Math.floor(s / 2592000) + "mo ago";
  return Math.floor(s / 31536000) + "y ago";
}
export function fmtDay(iso) {
  try { return new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Sydney", day: "numeric", month: "short", year: "numeric" }).format(new Date(iso)); } catch { return ""; }
}
export function fmtMonth(ym) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(ym || ""));
  if (!m) return String(ym || "");
  const names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const i = +m[2] - 1;
  return (names[i] || "") + " " + m[1];
}
export function windowCutoff(t, now = Date.now()) {
  const key = WINDOWS[String(t)] !== undefined ? String(t) : "week";
  const w = WINDOWS[key];
  if (!w) return null;
  return new Date(now - w * 1000).toISOString();
}

/* ---------- ranking ---------- */
/** Reddit hot: sign * log10(max(|ups-downs|,1)) + (created_epoch - 1134028003)/45000 */
export function hotOf(ups, downs, createdIso) {
  const d = (+ups || 0) - (+downs || 0);
  return Math.sign(d) * Math.log10(Math.max(Math.abs(d), 1)) + (Date.parse(createdIso) / 1000 - 1134028003) / 45000;
}
/** Wilson lower bound, 95%. */
export function wilson(ups, downs) {
  const n = (+ups || 0) + (+downs || 0);
  if (!n) return 0;
  const p = (+ups || 0) / n, z = 1.96, z2 = z * z;
  return (p + z2 / (2 * n) - z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n)) / (1 + z2 / n);
}

/* ---------- ranks ---------- */
const RANKS = [[2000, "Legend"], [500, "Veteran"], [100, "Trusted"], [10, "Regular"], [0, "Newcomer"]];
export function rankOf(karma) {
  const k = +karma || 0;
  for (const [min, name] of RANKS) if (k >= min) return name;
  return "Newcomer";
}

/* ---------- text safety ---------- */
const MINOR = /\b(teens?|teenagers?|school ?girls?|underage|under ?age|under ?18|young ?looking|barely ?legal|high ?school|lolitas?|lolis?|jailbait|pre ?teens?)\b/i;
const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
export const minorsRisk = (s) => MINOR.test(String(s || ""));
export function contactRisk(s) {
  const t = String(s || "");
  if (EMAIL.test(t)) return true;
  const runs = t.match(/(?:\+?\d[\d\s().-]{5,}\d)/g) || [];
  for (const r of runs) {
    const digits = (r.match(/\d/g) || []).length;
    if (digits >= 9 && digits <= 15) return true;
  }
  return false;
}
export function mentionNames(s) {
  const out = new Set();
  const re = /@([a-z0-9_]{3,20})/gi;
  let m;
  const t = String(s || "");
  while ((m = re.exec(t)) && out.size < 20) out.add(m[1].toLowerCase());
  return [...out];
}
export function safeUrl(u) {
  const s = String(u || "").trim();
  if (!/^https?:\/\/[^\s]+$/i.test(s) || s.length > 300) return "";
  return s;
}

/* ---------- display ---------- */
export function serverStars(v, outOf = 5) {
  const val = Math.max(0, Math.min(outOf, +v || 0));
  let stars = "";
  for (let i = 1; i <= outOf; i++) stars += `<span class="${val >= i - 0.25 ? "on" : ""}">&#9733;</span>`;
  const label = (Math.round(val * 10) / 10) + " out of " + outOf;
  return `<span class="stars" role="img" aria-label="${label}">${stars}</span> <span class="fv-num">${Math.round(val * 10) / 10}</span>`;
}
export function scoreClass(n) { return n > 0 ? "up" : n < 0 ? "dn" : ""; }
export function plural(n, word) { return `${n} ${word}${n === 1 ? "" : "s"}`; }

/* ---------- cursors ---------- */
export function encCursor(o) {
  return btoa(JSON.stringify(o)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function decCursor(s) {
  try {
    return JSON.parse(atob(String(s || "").replace(/-/g, "+").replace(/_/g, "/") + "===".slice((String(s || "").length + 3) % 4)));
  } catch { return null; }
}

export const cleanUrl = (s) => String(s || "").replace(/[<>"'`]/g, "");
/* plain: user text headed for attributes/structured data. No angle brackets. */
export const plain = (s) => String(s == null ? "" : s).replace(/[<>]/g, " ").replace(/\s+/g, " ").trim();
