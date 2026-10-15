/* ============================================================
   garter.black · Hera reception · /api/hera/*
   systems lane (garter-continuation-20261002, completed 3 Oct 2026).

   House-only reception bridge for the NEW Black Garter Hera copy:
     agent_1601m3yqm0vgey8shyjhefzxm3hp  ("Hera - Black Garter Reception (lively copy)")

   Scope: house paths only (/, /brothel, /ladies, /backentrance, /hotelbyhour and
   the ladies profiles). Corporate pages keep their existing voice; this module is
   reached only through the house mount and it never touches any other agent.

   HONEST STATE (current):
     - ElevenLabs credits remaining: ZERO. No call is placed, nothing is generated,
       no top-up is attempted here. So voiceEnabled is FALSE and this module says so.
     - The face (Spatius public avatar "Leyla" 8b86dda1-98ed-4acd-8a4e-b1a00ba69268)
       is configured but only ever started by the page on an explicit user click,
       behind the 18+ gate. If the Spatius balance is unknown the page shows an honest
       fallback rather than a false "live" state.

   Endpoints:
     GET  /api/hera/config   -> honest capability + agent id + avatar id. No secret.
     POST /api/hera/session  -> mints a short-lived Spatius Direct Mode session token
                                ONLY when the private operator env HERA_VOICE_ENABLED
                                === "true" (backend credential only). While voice is
                                off it returns an honest voice_unavailable and never
                                mints, so nothing can be charged.

   Hard rules honoured here:
   - No secret, prompt text, private handover note, or voice-actor name is ever
     returned to the browser.
   - Read-only against upstream: no agent create/PATCH/DELETE, no generation.
   - Disabled means disabled: no fake "live" state, no fabricated conversation.
   - Current instructions supersede the earlier older-persona note in this file's
     history; the operator has since supplied the NEW copy's agent id.
   ============================================================ */
import { json } from "./lib.js";

/* ---- New Black Garter Hera copy (authoritative: hera-history-copy/CREATE-VERIFICATION.json) ---- */
const HERA = {
  brand: "Hera",
  agent_id: "agent_1601m3yqm0vgey8shyjhefzxm3hp",
  main_branch_id: "agtbrch_7301m3yqm2g8fgwsgyk8p4emrg8m",
  // Client hints only; the agent holds the authoritative config server-side.
  model_id: "eleven_v3_conversational",
  output_format: "pcm_24000",
  asr: "scribe_realtime",
  avatar_id: "8b86dda1-98ed-4acd-8a4e-b1a00ba69268", // Spatius public avatar "Leyla"
  avatar_label: "reception",
};

/* Voice is OFF while ElevenLabs credits are zero. This is the single source of
   truth the page reads. It can only be turned on with a private backend credential
   (never a client flag), matching the task's "gated private operator env" rule. */
function voiceEnabled(env) {
  return !!(env && String(env.HERA_VOICE_ENABLED) === "true");
}

/* House paths the reception widget may run on. Anything else is refused here AND by
   the page guard, so corporate pages can never receive this bridge. */
const HOUSE_EXACT = new Set(["/", "/brothel", "/ladies", "/backentrance", "/hotelbyhour"]);
function isHousePath(pathname) {
  const p = (pathname || "/").replace(/\/+$/, "") || "/";
  if (HOUSE_EXACT.has(p)) return true;
  if (p.startsWith("/ladies/") && p !== "/ladies") return true; // ladies profiles
  return false;
}

/* The router passes the API URL (/api/hera/...), so the PAGE path that actually
   loaded the widget must come from the same-origin Referer. This is what keeps the
   bridge house-only without trusting client state: a corporate page's Referer never
   matches a house path, so it can never receive an agent id or a minted session.
   Fallback: a same-origin request with no Referer is treated as non-house. */
function pagePath(url, request) {
  const ref = request && request.headers.get("Referer");
  if (!ref) return "";
  try {
    const r = new URL(ref);
    if (r.origin !== url.origin) return "";        // cross-origin referer is not us
    return r.pathname || "/";
  } catch { return ""; }
}
function isHouseRequest(url, request) {
  return isHousePath(pagePath(url, request));
}

/* The existing broker (same one the setter/gallery lanes use); it holds the Spatius
   API key as a Worker secret. Overridable for local review only. */
const BROKER_DEFAULT = "https://umbra-spatius.zwt26420.workers.dev";
const SESSION_TTL_SECONDS = 3600;

function brokerBase(env) {
  return (env && env.HERA_BROKER_URL) || BROKER_DEFAULT;
}

function cors(origin) {
  return {
    "Access-Control-Allow-Origin": origin || "null",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
    "Cache-Control": "no-store",
  };
}

function sameOrigin(url, request) {
  const o = (request.headers.get("Origin") || "") || "";
  return o === url.origin;
}

function configResponse(env, url, request) {
  const h = { ...cors(request.headers.get("Origin")), "Content-Type": "application/json" };
  const house = isHouseRequest(url, request);
  const voice = voiceEnabled(env);
  const body = {
    ok: true,
    brand: HERA.brand,
    house: house,
    /* Voice off while credits are zero. The page shows an honest
       "reception unavailable - call or WhatsApp" instead of a live call. */
    voiceEnabled: voice,
    agent_id: house ? HERA.agent_id : null,
    model_id: voice ? HERA.model_id : null,
    avatar: { id: HERA.avatar_id, label: HERA.avatar_label },
    features: {
      /* the face may be offered as a still "view" only; it is never auto-started */
      face: true,
      face_autostart: false,
      voice: voice,
      mic_on_user_click: true,
      music_pause_on_voice: true,
    },
    contact: {
      phone_display: "0412 216 197",
      tel: "+61412216197",
      whatsapp: "https://wa.me/61412216197",
    },
    note: "Public reception. No secret is served here.",
  };
  return new Response(JSON.stringify(body), { status: 200, headers: h });
}

async function sessionResponse(env, url, request) {
  const h = { ...cors(request.headers.get("Origin")), "Content-Type": "application/json" };

  /* House-only: never mint a session for a corporate path. */
  if (!isHouseRequest(url, request)) {
    return new Response(JSON.stringify({ ok: false, error: "not_house_path" }), { status: 404, headers: h });
  }
  if (!sameOrigin(url, request)) {
    return new Response(JSON.stringify({ ok: false, error: "cross_origin_refused" }), { status: 403, headers: h });
  }

  /* Gate: voice stays off until the operator enables it with a backend credential.
     While off we do NOT call the broker and DO NOT mint, so nothing is charged. */
  if (!voiceEnabled(env)) {
    return new Response(
      JSON.stringify({
        ok: false,
        voiceEnabled: false,
        error: "voice_unavailable",
        message: "Reception is not taking calls right now.",
        contact: { tel: "+61412216197", whatsapp: "https://wa.me/61412216197" },
      }),
      { status: 503, headers: h }
    );
  }

  const base = brokerBase(env);
  let r;
  try {
    r = await fetch(base.replace(/\/+$/, "") + "/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: "broker_unreachable" }), { status: 502, headers: h });
  }
  let d = {};
  try { d = await r.json(); } catch { d = {}; }
  if (!r.ok || !d || !d.sessionToken) {
    /* Never surface the broker's upstream detail verbatim; keep it honest but plain. */
    return new Response(
      JSON.stringify({ ok: false, error: "face_unavailable" }),
      { status: 502, headers: h }
    );
  }
  return new Response(
    JSON.stringify({
      ok: true,
      sessionToken: d.sessionToken,
      appId: d.appId || null,
      region: d.region || "us-west",
      expireAt: d.expireAt || Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
      avatar: { id: HERA.avatar_id, label: HERA.avatar_label },
      note: "Single-use Spatius Direct Mode session token. Mint again per connection.",
    }),
    { status: 200, headers: h }
  );
}

export async function api(request, env, ctx, url) {
  const path = url.pathname.replace(/\/+$/, "") || "/api/hera";
  const method = request.method.toUpperCase();
  if (method === "OPTIONS") return new Response(null, { status: 204, headers: cors(request.headers.get("Origin")) });
  if (path === "/api/hera/config" && (method === "GET" || method === "HEAD")) return configResponse(env, url, request);
  if (path === "/api/hera/session" && method === "POST") return sessionResponse(env, url, request);
  return json({ error: "Not found" }, 404);
}

export default { api, _house: isHousePath, _agent: HERA.agent_id, _avatar: HERA.avatar_id };
