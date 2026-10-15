/* ============================================================
   garter.black · Pages advanced-mode worker (router)
   /api/forum/*  -> forum.js     (forum, directory, members)
   /api/*        -> roster.js    (roster, ladies, enquiries, tips, staff)
   /media/*      -> R2 photos
   /ladies/<slug>, /forum/*      -> server-routed shells with real meta
   everything else               -> static assets
   ============================================================ */
import { HttpError, json, fail, serveMedia, withSec, staffSession } from "./lib.js";
import { CORE_SCHEMA } from "./schema.js";
import * as roster from "./roster.js";
import * as forum from "./forum.js";

/* Old paths that moved, and the sub pages that were renamed. */
const MOVED = {
  "/hotel": "/hotelbyhour",
  "/streamers": "/streamersbyhour",
  "/stream": "/streamersbyhour",
  "/onlyfans": "/streamersmanagement",
  "/management": "/streamersmanagement",
  "/music": "/records",
  "/album": "/records",
  "/fireflies": "/escorts",
  "/recruitment": "/rose",
  "/directory": "/forum/brothels",
  "/admin": "/roster",
};

/* ---------- full contract asset denial (early, before ASSETS.fetch) ----------
   The full contract and guide PDFs are private trade secrets. The originals are
   quarantined outside dist/ and must never be served from the public asset store.
   Any request for those old full-document names, or for a .pdf under the rose sample
   directories, is refused here with a 404 that is not cached and not indexed.
   Once pages creates a deliberately selected 2 to 3 page excerpt it will live at
   exactly /rose/samples/black-garter-house-preview-sample.pdf and is the only PDF
   this guard lets through; its page count is verified by pages before it ships. */
const PDF_DENY_EXACT = new Set([
  "/rose/samples/black-garter-creator-partnership-guide.pdf",
  "/rose/samples/black-garter-house-standards.pdf",
  "/rose/samples/black-garter-new-starter-guide.pdf",
  "/rose/samples/black-garter-service-guides.pdf",
  "/rose/samples/black-garter-worker-agreement-and-forms.pdf",
  "/rose/recruitment/samples/black-garter-creator-partnership-guide.pdf",
  "/rose/recruitment/samples/black-garter-house-standards.pdf",
  "/rose/recruitment/samples/black-garter-new-starter-guide.pdf",
  "/rose/recruitment/samples/black-garter-service-guides.pdf",
  "/rose/recruitment/samples/black-garter-worker-agreement-and-forms.pdf",
]);
const PDF_ALLOW_EXACT = new Set([
  "/rose/samples/black-garter-house-preview-sample.pdf",
]);
function denyPdf404() {
  return new Response("Not found", {
    status: 404,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow",
      "x-content-type-options": "nosniff",
    },
  });
}
function isDeniedContractAsset(pathname) {
  const lower = pathname.toLowerCase();
  if (!lower.endsWith(".pdf")) return false;
  if (PDF_ALLOW_EXACT.has(lower)) return false;
  if (PDF_DENY_EXACT.has(lower)) return true;
  /* any other pdf sitting in the rose sample directories stays private */
  if (lower.startsWith("/rose/samples/")) return true;
  if (lower.startsWith("/rose/recruitment/samples/")) return true;
  /* belt and braces: the known full-document basenames anywhere on the site */
  const base = lower.slice(lower.lastIndexOf("/") + 1);
  return base.startsWith("black-garter-") && !base.includes("-sample.pdf");
}

/* ---------- same-origin guard for authenticated state-changing API calls ----------
   Browser cookie mutations (staff roster, ladies, settings, team, forum member actions) must
   come from our own origin: Origin or Referer has to match the request's own origin, so preview
   and local dev work without hardcoding production. A request with no browser origin is allowed
   through here ONLY when it carries a genuinely valid AI Bearer [REDACTED], verified by
   staffSession().ai. External signed callers (the Stripe webhook) and the public,
   unauthenticated flows are exempt and keep working cross-origin. */
const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);
/* Public endpoints that are legitimately called without a staff session; they keep their own
   honeypot, consent and throttle checks. The Stripe webhook is machine-to-machine and is
   verified by its signature, not by origin. */
const ORIGIN_EXEMPT = new Set([
  "/api/stripe/webhook",
  "/api/enquiry",
  "/api/review",
  "/api/tip/intent",
  "/api/tip/confirm",
  "/api/staff/login",
  "/api/staff/google",
  "/api/staff/logout",
]);

function originOf(request, referer) {
  try { return new URL(referer).origin; } catch { return ""; }
}

async function assertSameOrigin(request, env, url) {
  const m = request.method.toUpperCase();
  if (!MUTATING.has(m)) return;
  const path = url.pathname.replace(/\/+$/, "") || "/";
  if (!path.startsWith("/api/")) return;
  if (ORIGIN_EXEMPT.has(path)) return;
  const expected = url.origin;
  const origin = (request.headers.get("origin") || "").replace(/\/+$/, "");
  const referer = request.headers.get("referer") || "";
  const refOrigin = referer ? originOf(request, referer) : "";
  if (origin) {
    if (origin === expected) return;
    /* cross-site browser origin: refused, even with a valid cookie */
    fail(403, "Cross origin request refused");
  }
  if (refOrigin) {
    if (refOrigin === expected) return;
    fail(403, "Cross origin request refused");
  }
  /* no browser origin at all: only a real AI Bearer [REDACTED] pass */
  const s = await staffSession(request, env);
  if (s && s.ai) return;
  fail(403, "Missing origin on a state changing request");
}

/* Idempotent schema, applied once per isolate before any DB work. */
let READY = null;
function ready(env) {
  if (!READY) READY = (async () => {
    const stmts = [...CORE_SCHEMA, ...(forum.SCHEMA || [])];
    await env.DB.batch(stmts.map((s) => env.DB.prepare(s)));
  })().catch((e) => { READY = null; throw e; });
  return READY;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const p = url.pathname;
    try {
      if (isDeniedContractAsset(p)) return denyPdf404();
      if (p.startsWith("/api/")) await assertSameOrigin(request, env, url);
      if (p.startsWith("/api/forum/") || p === "/api/forum") { await ready(env); return await forum.api(request, env, ctx, url); }
      if (p.startsWith("/api/hera/") || p === "/api/hera") {
        /* systems lane owns hera.js. Mount only when the module actually exists and exposes
           an api handler. Never import a missing module, and never expose internal
           HecateLive, Cortex or agent internals here. */
        try {
          const hera = await import("./hera.js");
          if (hera && typeof hera.api === "function") return await hera.api(request, env, ctx, url);
        } catch (e) { /* module absent or failed to load: fall through to normal handling */ }
        return json({ error: "Not found" }, 404);
      }
      if (p.startsWith("/api/")) { await ready(env); return await roster.api(request, env, ctx, url); }
      if (p.startsWith("/media/")) return await serveMedia(request, env, decodeURIComponent(p.slice(7)));

      const bare = p.replace(/\/+$/, "") || "/";
      if (MOVED[bare.toLowerCase()]) return Response.redirect(url.origin + MOVED[bare.toLowerCase()] + url.search, 301);

      if (p === "/forum" || p.startsWith("/forum/")) {
        await ready(env);
        const r = await forum.page(request, env, ctx, url);
        if (r) return r;
      }
      if (p.startsWith("/ladies/") && bare !== "/ladies") {
        await ready(env);
        const r = await roster.page(request, env, ctx, url);
        if (r) return r;
      }
      const res = await env.ASSETS.fetch(request);
      return withSec(res);
    } catch (e) {
      if (e instanceof HttpError) {
        if (p.startsWith("/api/")) return json({ error: e.message }, e.status);
        return new Response(e.message, { status: e.status });
      }
      console.error("worker error", p, e && e.stack || e);
      if (p.startsWith("/api/")) return json({ error: "Something went wrong at the desk. Try again." }, 500);
      return new Response("Something went wrong. Please refresh.", { status: 500 });
    }
  },
};
