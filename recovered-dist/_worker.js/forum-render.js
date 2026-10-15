/* ============================================================
   garter.black · forum SSR renderers
   Every page renders to HTML here; forum.js fetches the built
   shell, injects this into #forum-root and sets meta.
   House style: black, dark metallic gold, Cormorant + Inter.
   ============================================================ */
import { esc, slugify } from "./lib.js";
import {
  md, txt, ago, fmtDay, fmtMonth, rankOf, serverStars, plural, plain,
} from "./forum-shared.js";

const E = esc;

/* ---------- small helpers ---------- */

export function postHref(p) { return `/forum/p/${p.id}-${slugify(p.title, 60)}`; }
export function boardHref(b) { return `/forum/b/${E(typeof b === "string" ? b : b.slug)}`; }
export function userHref(u) { return `/forum/u/${encodeURIComponent(String(u || ""))}`; }

export function authorLink(p) {
  if (!p || !p.username || p.author_status === "deleted") return `<span class="fu fu-del">[deleted]</span>`;
  return `<a class="fu" href="${userHref(p.username)}">u/${E(p.username)}</a>`;
}

export function statusBadge(status) {
  if (status === "open") return `<span class="fbadge open">Open</span>`;
  if (status === "closed") return `<span class="fbadge closed">Closed</span>`;
  return `<span class="fbadge unv">Unverified</span>`;
}

export function voteRail(t, id, score, my) {
  const up = `<svg viewBox="0 0 16 10" aria-hidden="true"><path d="M1 9 L8 2 L15 9" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const dn = `<svg viewBox="0 0 16 10" aria-hidden="true"><path d="M1 1 L8 8 L15 1" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const s = +score || 0;
  return `<div class="frail" data-rail="${t}-${id}">
    <button class="fv fv-up${my === 1 ? " on" : ""}" type="button" data-vote data-t="${t}" data-id="${id}" data-val="1" aria-pressed="${my === 1 ? "true" : "false"}" aria-label="Upvote">${up}</button>
    <span class="fscore ${s > 0 ? "up" : s < 0 ? "dn" : ""}" data-score="${t}-${id}">${s}</span>
    <button class="fv fv-dn${my === -1 ? " on" : ""}" type="button" data-vote data-t="${t}" data-id="${id}" data-val="-1" aria-pressed="${my === -1 ? "true" : "false"}" aria-label="Downvote">${dn}</button>
  </div>`;
}

export function subBar(label, v) {
  const val = Math.max(0, Math.min(5, +v || 0));
  return `<div class="rbar"><span>${E(label)}</span><div class="fr-track"><i style="width:${(val / 5) * 100}%"></i></div><b>${val}</b></div>`;
}

function revMeta(p) {
  const bits = [];
  if (p.brothel_name) bits.push(`<a href="/forum/brothels/${E(p.brothel_slug)}">${E(p.brothel_name)}</a>`);
  bits.push(serverStars(p.r_overall));
  if (p.worker_name) bits.push(`<span class="fwtag">working as <b>${E(p.worker_name)}</b></span>`);
  if (p.visit_month) bits.push(`<span class="fwt">visited ${E(fmtMonth(p.visit_month))}</span>`);
  return `<div class="frev">${bits.join('<i class="fvsep">·</i>')}</div>`;
}

/* ---------- feed row ---------- */

export function feedRow(p, viewer) {
  const href = postHref(p);
  const n = p.ncomments != null ? +p.ncomments : (+p.comments || 0);
  const excerpt = p.kind === "link" ? "" : txt(p.body, 220);
  return `<article class="fpost${p.pin ? " pinned" : ""}${p.status !== "live" ? " held" : ""}" data-post="${p.id}">
  ${voteRail("post", p.id, (+p.ups || 0) - (+p.downs || 0), +p.my_vote || 0)}
  <div class="fmain2">
    <h3 class="ftitle"><a href="${href}">${E(p.title)}</a>${p.flair ? ` <span class="fflair">${E(p.flair)}</span>` : ""}${p.pin ? ' <span class="fpin">Pinned</span>' : ""}${p.locked ? ' <span class="flock">Locked</span>' : ""}${p.status === "pending" ? ' <span class="fhold">Held for review</span>' : ""}</h3>
    <div class="fmeta"><a class="fb" href="${boardHref(p.board_slug)}">b/${E(p.board_slug)}</a><i>·</i>${authorLink(p)}<i>·</i><time datetime="${E(p.created_at)}">${ago(p.created_at)}</time><i>·</i><a href="${href}">${plural(n, "comment")}</a>${p.edited_at ? '<i>·</i><span class="fed">edited</span>' : ""}</div>
    ${p.kind === "review" ? revMeta(p) : ""}
    ${p.kind === "link" && p.url ? `<div class="flink"><a href="${E(p.url)}" rel="nofollow ugc noopener" target="_blank">${E(txt(p.url, 90))}</a></div>` : ""}
    ${excerpt ? `<p class="fx">${E(excerpt)}</p>` : ""}
  </div>
</article>`;
}

export function feedRows(posts, viewer) {
  if (!posts || !posts.length) return "";
  return posts.map((p) => feedRow(p, viewer)).join("");
}

function emptyState(text, sub) {
  return `<div class="fempty"><div class="fe-k">Nothing here yet.</div><p>${E(text)}</p>${sub ? `<p class="ffine">${sub}</p>` : ""}</div>`;
}

/* ---------- tab strips ---------- */

function tabLink(href, label, active) {
  return `<a class="tab" href="${href}"${active ? ' aria-current="true"' : ""}>${E(label)}</a>`;
}

function feedTabs(base, { sort, t, window: withWindow }) {
  const s = sort || "hot";
  const q = (extra) => base + (extra ? `?${extra}` : "");
  const sortQs = (v) => `sort=${v}${withWindow && t ? `&t=${t}` : ""}`;
  let html = `<div class="fnav"><div class="tabs" aria-label="Sort">${["hot", "new", "top", "rising"].map((v) => tabLink(q(sortQs(v)), v === "hot" ? "Hot" : v === "new" ? "New" : v === "top" ? "Top" : "Rising", s === v)).join("")}</div>`;
  if (withWindow) {
    const w = t || "week";
    const win = [["today", "Today"], ["week", "Week"], ["month", "Month"], ["year", "Year"], ["all", "All time"]];
    html += `<div class="tabs tabs-win" aria-label="Time">${win.map(([v, l]) => tabLink(q(`sort=${s}&t=${v}`), l, w === v)).join("")}</div>`;
  }
  html += "</div>";
  return html;
}

function commentTabs(postId, cs) {
  const cur = cs || "best";
  const list = [["best", "Best"], ["top", "Top"], ["new", "New"], ["old", "Old"]];
  return `<div class="tabs" aria-label="Sort comments">${list.map(([v, l]) => tabLink(`/forum/p/${postId}?cs=${v}`, l, cur === v)).join("")}</div>`;
}

/* ---------- chrome pieces ---------- */

export function sidebar(ctx) {
  const m = ctx.member;
  const user = m ? (m.username || "") : "";
  return `<aside class="fside">
  <div class="panel fs-about">
    <h4 class="fh">The forum</h4>
    <p class="p-sub">Field reports, questions and who is working tonight. Strictly 18+. Working names only, never real ones.</p>
    <a class="deep" href="/forum/rules">The rules</a>
  </div>
  <div class="panel fs-member">
    ${m ? `<div class="fs-uwho"><a class="fu" href="${userHref(user)}">u/${E(user)}</a><span class="frank">${rankOf(m.karma)}</span></div>
      <div class="fs-k">${+m.karma || 0} karma</div>
      <div class="fs-links"><a href="${userHref(user)}">Profile</a><a href="/forum/messages">Messages</a><a href="/forum/notifications">Notifications</a><a href="/forum/settings">Settings</a><button type="button" class="fqa" data-logout>Sign out</button></div>`
    : `<div class="fs-uwho"><span class="fsn">Sign in or join</span></div>
      <p class="p-sub">Post reviews, vote and message other members.</p>
      <div class="fs-cta"><button type="button" class="btn solid sm" data-login-open>Sign in</button><a class="btn ghost sm" href="/forum/login?join=1">Join</a></div>`}
  </div>
  <div class="panel fs-boards">
    <h4 class="fh">Boards</h4>
    <ul class="fboards">${(ctx.boards || []).map((b) => `<li><a href="${boardHref(b)}">b/${E(b.slug)}</a><span>${E(b.name)}</span></li>`).join("")}</ul>
  </div>
  <div class="panel fs-brothels">
    <h4 class="fh">Sydney brothels</h4>
    <form class="fs-search" action="/forum/brothels" method="get"><input type="search" name="q" placeholder="Search venues" aria-label="Search Sydney brothels"><button class="btn ghost sm" type="submit">Go</button></form>
    ${(ctx.topBrothels || []).length
      ? `<ul class="ftop">${ctx.topBrothels.map((b) => `<li><a href="/forum/brothels/${E(b.slug)}">${E(b.name)}</a><span>${E(b.suburb || "")}</span><b>${plural(+b.n || 0, "review")}</b></li>`).join("")}</ul><p class="ffine">Top venues this month, by reviews.</p>`
      : `<p class="ffine">No reviews this month yet. Yours could be the first.</p>`}
    <a class="deep" href="/forum/brothels">The full directory</a>
  </div>
  <div class="panel fs-rules"><h4 class="fh">House rules</h4><p class="ffine">Adults only. Working names only. No doxxing, no threats. Reviews must be your own.</p></div>
</aside>`;
}

export function fmbar(ctx) {
  const { boards, sort, t, board } = ctx;
  const base = board ? `/forum/b/${E(board.slug)}` : ctx.barBase || "/forum";
  const sortHref = (v) => `${base}?sort=${v}${t && ctx.windowSort ? `&t=${t}` : ""}`;
  const m = ctx.member;
  return `<div class="fmbar">
    <form class="fmbar-s" action="/forum/search" method="get"><input type="search" name="q" placeholder="Search" aria-label="Search the forum"><button type="submit" aria-label="Search">&#8981;</button></form>
    <select class="fmbar-b" aria-label="Board" data-goto>
      <option value="" data-href="/forum"${!board ? " selected" : ""}>All boards</option>
      ${(boards || []).map((b) => `<option value="${E(b.slug)}" data-href="${boardHref(b)}"${board && board.slug === b.slug ? " selected" : ""}>b/${E(b.slug)}</option>`).join("")}
    </select>
    <select aria-label="Sort" data-goto>
      ${["hot", "new", "top", "rising"].map((v) => `<option value="${v}" data-href="${sortHref(v)}"${(sort || "hot") === v ? " selected" : ""}>${v === "hot" ? "Hot" : v === "new" ? "New" : v === "top" ? "Top" : "Rising"}</option>`).join("")}
    </select>
    ${m ? `<a class="fmbar-u" href="${userHref(m.username)}">u/${E(m.username)}</a>` : `<button class="fmbar-i" type="button" data-login-open>Sign in</button>`}
  </div>`;
}

/* ---------- feed pages ---------- */

function feedPage(ctx, opts) {
  const { rows, moreUrl, board, heading, kick, blurb, window: withWindow } = opts;
  const hasRows = rows && rows.trim();
  return `<div class="fw">
  ${fmbar(ctx)}
  <div class="flay">
    <div class="fmain-col">
      <header class="fhead">
        <div class="kick">${E(kick)}</div>
        <h1>${heading}</h1>
        ${blurb ? `<p class="lede">${blurb}</p>` : ""}
      </header>
      ${feedTabs(ctx.barBase || (board ? `/forum/b/${board.slug}` : "/forum"), { sort: ctx.sort, t: ctx.t, window: withWindow })}
      <div class="ffeed" data-feed>${hasRows ? rows : ""}</div>
      ${hasRows ? "" : emptyState(ctx.emptyText || "No posts yet. Start the first thread.", ctx.emptySub)}
      ${moreUrl ? `<div class="fmore"><button class="btn ghost" type="button" data-more data-url="${E(moreUrl)}">Load more</button></div>` : ""}
    </div>
    ${sidebar(ctx)}
  </div>
</div>`;
}

export function frontPage(ctx) {
  const jsonld = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "The Black Garter Forum",
    url: "https://garter.black/forum",
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: "https://garter.black/forum/search?q={search_term_string}" },
      "query-input": "required name=search_term_string",
    },
  };
  return {
    title: "Forum · The Black Garter",
    desc: "Sydney's adult scene, discussed properly. Field reports, questions and who is working tonight. Adults only.",
    canonical: "/forum",
    jsonld,
    html: feedPage(ctx, {
      rows: feedRows(ctx.posts, ctx.member),
      moreUrl: ctx.moreUrl,
      kick: "THE FLOOR",
      heading: 'Talk, <em>properly.</em>',
      blurb: "Field reports, questions and who is working tonight. Sydney's adult scene, minus the noise.",
      emptyText: "No posts yet. Start the first thread.",
    }),
  };
}

export function allPage(ctx) {
  ctx.windowSort = true;
  const win = ctx.t === "all" ? "of all time" : ctx.t === "year" ? "this year" : ctx.t === "month" ? "this month" : ctx.t === "today" ? "today" : "this week";
  return {
    title: "All posts · Forum · The Black Garter",
    desc: "Everything on the forum, ranked. Field reports, questions and who is working tonight.",
    canonical: "/forum/all",
    html: feedPage(ctx, {
      rows: feedRows(ctx.posts, ctx.member),
      moreUrl: ctx.moreUrl,
      kick: "EVERYTHING",
      heading: 'All posts, <em>ranked.</em>',
      blurb: `Top posts ${win}. Switch the window to change the cut.`,
      window: true,
      emptyText: "Nothing in this window yet.",
    }),
  };
}

export function boardPage(ctx) {
  const b = ctx.board;
  return {
    title: `b/${b.slug} · Forum · The Black Garter`,
    desc: plain((b.desc || b.name) + ". The Black Garter forum, adults only."),
    canonical: `/forum/b/${b.slug}`,
    html: feedPage(ctx, {
      rows: feedRows(ctx.posts, ctx.member),
      moreUrl: ctx.moreUrl,
      board: b,
      kick: "BOARD",
      heading: `${E(b.name)}`,
      blurb: E(b.desc || ""),
      emptyText: "No posts on this board yet. Open it.",
    }),
  };
}

/* ---------- comments ---------- */

export function commentNode(c, viewer, opts) {
  opts = opts || {};
  const mine = viewer && +viewer.id === +c.author_id;
  const del = c.status === "deleted";
  const held = c.status === "pending";
  const kids = (c.kids || []).map((k) => commentNode(k, viewer, opts)).join("");
  const raw = del ? "" : `<template class="fraw">${E(c.body)}</template>`;
  return `<div class="fc${held ? " held" : ""}${del ? " deleted" : ""}" id="c${c.id}" data-c="${c.id}">
  ${voteRail("comment", c.id, (+c.ups || 0) - (+c.downs || 0), +c.my_vote || 0)}
  <div class="fc-main">
    <div class="fc-head"><span class="fc-who">${authorLink(c)}</span><span class="frank">${rankOf(c.author_karma)}</span><i>·</i><time datetime="${E(c.created_at)}">${ago(c.created_at)}</time>${c.edited_at ? '<i>·</i><span class="fed">edited</span>' : ""}${held ? ' <span class="fhold">Held for review</span>' : ""}</div>
    <div class="fc-body" data-body>${del ? "<p>[deleted]</p>" : md(c.body)}</div>
    <div class="fc-acts">
      ${kids ? `<button type="button" class="fqa" data-collapse aria-expanded="true" aria-label="Collapse thread">[&ndash;]</button>` : ""}
      ${!opts.locked && !del ? `<button type="button" class="fqa" data-reply data-id="${c.id}" data-user="${E(c.username || "")}">Reply</button>` : ""}
      ${!del ? `<button type="button" class="fqa" data-quote data-id="${c.id}">Quote</button>` : ""}
      ${mine && !del ? `<button type="button" class="fqa" data-edit-comment data-id="${c.id}">Edit</button><button type="button" class="fqa fqa-danger" data-del-comment data-id="${c.id}">Delete</button>` : ""}
      ${opts.mod && !del ? `<button type="button" class="fqa" data-mod data-act="remove" data-kind="comment" data-id="${c.id}">Remove</button>${held ? `<button type="button" class="fqa" data-mod data-act="approve" data-kind="comment" data-id="${c.id}">Approve</button>` : ""}` : ""}
      ${viewer && !del ? `<button type="button" class="fqa" data-report data-t="comment" data-id="${c.id}">Report</button>` : ""}
      <a class="fqa" href="#c${c.id}" aria-label="Permalink">Permalink</a>
    </div>
    ${kids ? `<div class="fc-kids">${kids}</div>` : ""}
    ${raw}
  </div>
</div>`;
}

export function commentTree(roots, viewer, opts) {
  if (!roots || !roots.length) return "";
  return roots.map((c) => commentNode(c, viewer, opts)).join("");
}

export function replyFormHtml(postId, member, parentId) {
  if (!member) return "";
  return `<form class="fcf" data-cform data-post="${postId}" data-parent="${parentId || ""}">
  <div class="freplyto" hidden>Replying to <b data-reply-name></b> <button type="button" class="fqa" data-reply-cancel>Cancel</button></div>
  <textarea class="farea" name="body" rows="4" maxlength="4000" placeholder="Add to the thread" aria-label="Comment" required></textarea>
  <div class="frow"><button class="btn solid sm" type="submit">Comment</button><span class="ffine" data-cstate></span></div>
</form>`;
}

/* ---------- post page ---------- */

export function postPage(ctx) {
  const p = ctx.post;
  const mine = ctx.member && +ctx.member.id === +p.author_id;
  const held = p.status === "pending";
  const removed = p.status === "removed";
  const ncomments = +ctx.ncomments || 0;
  let controls = "";
  if (ctx.member) {
    controls += `<button type="button" class="fqa" data-reply data-id="post">Reply</button>`;
    controls += `<button type="button" class="fqa" data-report data-t="post" data-id="${p.id}">Report</button>`;
    controls += `<button type="button" class="fqa${ctx.subscribed ? " on" : ""}" data-subscribe data-id="${p.id}" aria-pressed="${ctx.subscribed ? "true" : "false"}">${ctx.subscribed ? "Subscribed" : "Subscribe"}</button>`;
  }
  if (mine) {
    controls += `<button type="button" class="fqa" data-edit-post data-id="${p.id}">Edit</button>`;
    controls += `<button type="button" class="fqa fqa-danger" data-del-post data-id="${p.id}">Delete</button>`;
  }
  if (ctx.mod) {
    if (held) controls += `<button type="button" class="fqa" data-mod data-act="approve" data-kind="post" data-id="${p.id}">Approve</button>`;
    if (removed) controls += `<button type="button" class="fqa" data-mod data-act="restore" data-kind="post" data-id="${p.id}">Restore</button>`;
    else controls += `<button type="button" class="fqa fqa-danger" data-mod data-act="remove" data-kind="post" data-id="${p.id}">Remove</button>`;
    controls += `<button type="button" class="fqa" data-mod data-act="${p.pin ? "unpin" : "pin"}" data-kind="post" data-id="${p.id}">${p.pin ? "Unpin" : "Pin"}</button>`;
    controls += `<button type="button" class="fqa" data-mod data-act="${p.locked ? "unlock" : "lock"}" data-kind="post" data-id="${p.id}">${p.locked ? "Unlock" : "Lock"}</button>`;
  }
  const tree = commentTree(ctx.roots, ctx.member, { locked: !!p.locked, mod: ctx.mod });
  const jsonld = {
    "@context": "https://schema.org",
    "@type": "DiscussionForumPosting",
    headline: p.title,
    datePublished: p.created_at,
    dateModified: p.edited_at || p.created_at,
    author: { "@type": "Person", name: "u/" + (p.username || "deleted") },
    interactionStatistic: {
      "@type": "InteractionCounter",
      interactionType: "https://schema.org/LikeAction",
      userInteractionCount: (+p.ups || 0) - (+p.downs || 0),
    },
    commentCount: ncomments,
    url: "https://garter.black" + postHref(p),
  };
  const html = `<div class="fw">
  <div class="flay">
    <div class="fmain-col">
      <nav class="fcrumbs" aria-label="Breadcrumb"><a href="/forum">Forum</a><i>·</i><a href="${boardHref(p.board_slug)}">b/${E(p.board_slug)}</a><i>·</i><span>${E(txt(p.title, 40))}</span></nav>
      <article class="fpost single${held ? " held" : ""}${removed ? " removed" : ""}" data-post="${p.id}">
        ${voteRail("post", p.id, (+p.ups || 0) - (+p.downs || 0), +p.my_vote || 0)}
        <div class="fmain2">
          <h1 class="ftitle-s">${E(p.title)}</h1>
          <div class="fmeta">${authorLink(p)}<i>·</i><time datetime="${E(p.created_at)}">${ago(p.created_at)}</time>${p.edited_at ? '<i>·</i><span class="fed">edited ' + E(ago(p.edited_at)) + "</span>" : ""}${p.pin ? '<i>·</i><span class="fpin">Pinned</span>' : ""}${p.locked ? '<i>·</i><span class="flock">Locked</span>' : ""}${held ? '<i>·</i><span class="fhold">Held for review</span>' : ""}${removed ? '<i>·</i><span class="fhold">Removed</span>' : ""}${p.flair ? `<i>·</i><span class="fflair">${E(p.flair)}</span>` : ""}</div>
          <div class="fbody" data-body>${md(p.body)}</div>
          ${mine && !removed ? `<template class="fraw">${E(p.body)}</template>` : ""}
          ${p.kind === "review" ? `<div class="freview">${revMeta(p)}<div class="frbars">${subBar("Rooms", p.r_rooms)}${subBar("Service", p.r_service)}${subBar("Value", p.r_value)}</div></div>` : ""}
          ${p.kind === "link" && p.url ? `<div class="flink big"><a href="${E(p.url)}" rel="nofollow ugc noopener" target="_blank">${E(p.url)}</a></div>` : ""}
          ${ctx.brothel ? `<a class="fvenue-card" href="/forum/brothels/${E(ctx.brothel.slug)}"><span class="fvc-n">${E(ctx.brothel.name)}</span><span class="fvc-s">${E(ctx.brothel.suburb || "")}</span><span class="fvc-g">View venue</span></a>` : ""}
          <div class="facts">${controls}</div>
        </div>
      </article>
      <section class="fcomments">
        <div class="fchead"><h2 class="fh2">${plural(ncomments, "comment")}</h2>${commentTabs(p.id, ctx.csort)}</div>
        <div class="freply" id="reply-form">${ctx.member ? replyFormHtml(p.id, ctx.member) : `<p class="ffine">Sign in to join the thread. <button type="button" class="fqa" data-login-open>Sign in</button></p>`}</div>
        <div class="ftree" data-tree>${tree || emptyState("No comments yet. Say the first word.")}</div>
        ${ctx.moreComments ? `<div class="fmore"><button class="btn ghost" type="button" data-more-comments data-post="${p.id}" data-cs="${E(ctx.csort)}" data-after="${E(ctx.lastRoot)}">Load more comments</button></div>` : ""}
      </section>
    </div>
    ${sidebar(ctx)}
  </div>
</div>`;
  return {
    title: `${txt(p.title, 70)} · Forum · The Black Garter`,
    desc: plain(txt(p.body, 150)) || "The Black Garter forum, adults only.",
    canonical: postHref(p),
    jsonld,
    robots: removed ? "noindex" : undefined,
    html,
  };
}

/* ---------- submit ---------- */

export function submitPage(ctx) {
  const b = ctx.preset.brothel;
  const boards = ctx.boards || [];
  const html = `<div class="fw">
  <div class="flay">
    <div class="fmain-col">
      <header class="fhead"><div class="kick">NEW POST</div><h1>Say it <em>usefully.</em></h1><p class="lede">Reviews must be your own genuine experience. <a href="/forum/rules">The rules</a> apply to everything you post.</p></header>
      <form class="fform panel" data-submit>
        <div class="fld"><span>Board</span><select name="board" required aria-label="Board">${boards.map((x) => `<option value="${E(x.slug)}"${ctx.preset.board === x.slug ? " selected" : ""}>b/${E(x.slug)} · ${E(x.name)}</option>`).join("")}</select></div>
        <div class="fld"><span>Type</span><div class="seg" data-seg="kind" role="group" aria-label="Post type">
          ${["text", "link", "review"].map((k) => `<button type="button" data-k="${k}" aria-pressed="${(ctx.preset.kind || "text") === k}">${k === "text" ? "Text" : k === "link" ? "Link" : "Review"}</button>`).join("")}
        </div><input type="hidden" name="kind" value="${E(ctx.preset.kind || "text")}"></div>
        <div class="fld"><span>Title</span><input name="title" maxlength="140" minlength="3" required placeholder="One clear line" aria-label="Title"></div>
        <div class="fld"><span>Flair</span><div class="seg" data-seg="flair" role="group" aria-label="Flair">
          ${["Review", "Question", "News", "Discussion", "Warning", "Meta"].map((f) => `<button type="button" data-k="${E(f)}" aria-pressed="false">${E(f)}</button>`).join("")}
        </div><input type="hidden" name="flair" value=""></div>
        <div class="fld fsec" data-sec="link" hidden><span>Link URL</span><input name="url" maxlength="300" placeholder="https://" aria-label="Link URL" inputmode="url"></div>
        <div class="fld fsec" data-sec="review" hidden>
          <span>Venue</span>
          <input name="brothel_name" data-brothels autocomplete="off" list="fbrothels" placeholder="Start typing a venue" aria-label="Venue"${b ? ` value="${E(b.name)}"` : ""}>
          <input type="hidden" name="brothel" value="${b ? E(b.slug) : ""}">
          <datalist id="fbrothels"></datalist>
          <span class="ffine" data-bstate>${b ? "Venue set." : ""}</span>
        </div>
        <div class="fld fsec" data-sec="review" hidden><span>Overall rating</span><select name="overall" aria-label="Overall rating"><option value="">Select 1 to 5</option>${[1, 2, 3, 4, 5].map((v) => `<option value="${v}">${v}</option>`).join("")}</select></div>
        <div class="fld fsec" data-sec="review" hidden><span>Rooms, service, value</span>
          <div class="frow3">
            <select name="rooms" aria-label="Rooms rating"><option value="">Rooms</option>${[1, 2, 3, 4, 5].map((v) => `<option value="${v}">${v}</option>`).join("")}</select>
            <select name="service" aria-label="Service rating"><option value="">Service</option>${[1, 2, 3, 4, 5].map((v) => `<option value="${v}">${v}</option>`).join("")}</select>
            <select name="value" aria-label="Value rating"><option value="">Value</option>${[1, 2, 3, 4, 5].map((v) => `<option value="${v}">${v}</option>`).join("")}</select>
          </div>
        </div>
        <div class="fld fsec" data-sec="review" hidden><span>Working name (optional, never a real name)</span><input name="worker_name" maxlength="40" autocomplete="off" aria-label="Working name"></div>
        <div class="fld fsec" data-sec="review" hidden><span>Visit month (optional)</span><input name="visit_month" type="month" aria-label="Visit month" min="2015-01"></div>
        <div class="fld"><span>Body</span><textarea name="body" rows="10" maxlength="8000" placeholder="Markdown: **bold**, *italic*, > quote" aria-label="Body"></textarea></div>
        <div class="frow"><button class="btn solid" type="submit">Post</button><span class="ffine" data-state></span></div>
      </form>
    </div>
    ${sidebar(ctx)}
  </div>
</div>`;
  return {
    title: "New post · Forum · The Black Garter",
    desc: "Write a field report, a question or a link for the forum.",
    canonical: "/forum/submit",
    robots: "noindex",
    html,
  };
}

/* ---------- directory & venue ---------- */

export function venueCard(v) {
  const n = +v.n || 0;
  const rating = +v.ravg || 0;
  return `<a class="fvenue" href="/forum/brothels/${E(v.slug)}">
    <div class="fv-main"><h3>${E(v.name)}</h3><div class="fmeta"><span>${E(v.suburb || "")}</span>${v.hours ? `<i>·</i><span>${E(txt(v.hours, 40))}</span>` : ""}</div>${v.status !== "open" ? statusBadge(v.status) : ""}</div>
    <div class="fv-right">${n ? `${serverStars(rating)}<span>${plural(n, "review")}</span>` : `<span class="ffine">No reviews yet</span>`}${v.last_at ? `<span class="ffine">last ${E(ago(v.last_at))}</span>` : ""}</div>
  </a>`;
}

export function directoryPage(ctx) {
  const rows = (ctx.rows || []).map(venueCard).join("");
  const empty = `<div class="fempty"><div class="fe-k">Nothing matches.</div><p>Clear the filters or search another suburb.</p></div>`;
  const html = `<div class="fw">
  <div class="flay">
    <div class="fmain-col">
      <header class="fhead"><div class="kick">DIRECTORY</div><h1>Sydney brothels, <em>every one we know.</em></h1><p class="lede">Ratings come from member reviews. Status unverified where we have not confirmed the details yet.</p></header>
      <form class="fdfilters" action="/forum/brothels" method="get">
        <input type="search" name="q" value="${E(ctx.q || "")}" placeholder="Search name, suburb or address" aria-label="Search venues">
        <select name="suburb" aria-label="Suburb"><option value="">All suburbs</option>${(ctx.suburbs || []).map((s) => `<option value="${E(s)}"${ctx.suburb === s ? " selected" : ""}>${E(s)}</option>`).join("")}</select>
        <select name="sort" aria-label="Sort"><option value="rating"${ctx.sort === "rating" ? " selected" : ""}>Rating</option><option value="reviews"${ctx.sort === "reviews" ? " selected" : ""}>Reviews</option><option value="name"${ctx.sort === "name" ? " selected" : ""}>Name</option><option value="newest"${ctx.sort === "newest" ? " selected" : ""}>Newest</option></select>
        <button class="btn solid sm" type="submit">Filter</button>
      </form>
      <div class="fvenues" data-venues>${rows || empty}</div>
    </div>
    ${sidebar(ctx)}
  </div>
</div>`;
  return {
    title: "Sydney brothels · Forum · The Black Garter",
    desc: "A directory of Sydney brothels with member reviews, ratings and contact details.",
    canonical: "/forum/brothels",
    html,
  };
}

export function venuePage(ctx) {
  const v = ctx.b;
  const st = ctx.stats || {};
  const reviews = (ctx.reviews || []).map((p) => feedRow(p, ctx.member)).join("");
  const threads = (ctx.threads || []).map((p) => feedRow(p, ctx.member)).join("");
  const jsonld = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: v.name,
    address: v.address || undefined,
    telephone: v.phone || undefined,
    url: v.website || undefined,
    areaServed: v.suburb || undefined,
  };
  const html = `<div class="fw">
  <div class="flay">
    <div class="fmain-col">
      <nav class="fcrumbs" aria-label="Breadcrumb"><a href="/forum">Forum</a><i>·</i><a href="/forum/brothels">Sydney brothels</a><i>·</i><span>${E(v.name)}</span></nav>
      <article class="panel fv-head">
        <h1>${E(v.name)} ${statusBadge(v.status)}</h1>
        <div class="fmeta"><span>${E(v.suburb || "")}</span>${v.address ? `<i>·</i><span>${E(v.address)}</span>` : ""}</div>
        ${v.hours ? `<div class="fv-hours">${E(v.hours)}</div>` : ""}
        ${v.notes ? `<p class="lede">${E(v.notes)}</p>` : ""}
        <div class="fv-contacts">
          ${v.phone ? `<a class="btn ghost sm" href="tel:${E(String(v.phone).replace(/[^\d+]/g, ""))}">${E(v.phone)}</a>` : ""}
          ${v.website ? `<a class="btn ghost sm" href="${E(v.website)}" rel="nofollow noopener" target="_blank">Website</a>` : ""}
        </div>
        <div class="fv-stats">
          <div class="fv-big">${st.count ? serverStars(st.avg) : `<span class="ffine">No reviews yet</span>`}<span>${plural(+st.count || 0, "review")}</span></div>
          ${st.count ? `<div class="frbars">${subBar("Rooms", st.rooms)}${subBar("Service", st.service)}${subBar("Value", st.value)}</div>` : ""}
        </div>
        <div class="fv-acts">
          <a class="btn solid sm" href="/forum/submit?brothel=${E(v.slug)}&kind=review">Write a review</a>
          ${ctx.member ? `<button class="btn ghost sm" type="button" data-suggest data-id="${v.id}" data-name="${E(v.name)}">Suggest an edit</button>` : ""}
        </div>
      </article>
      <section class="fcomments">
        <div class="fchead"><h2 class="fh2">Reviews</h2></div>
        ${reviews || emptyState("No reviews yet. Be the first to write one.", "")}
      </section>
      <section class="fcomments">
        <div class="fchead"><h2 class="fh2">Threads mentioning ${E(v.name)}</h2></div>
        ${threads || `<p class="ffine">No threads yet.</p>`}
      </section>
    </div>
    ${sidebar(ctx)}
  </div>
</div>`;
  const desc = `${v.name}${v.suburb ? " in " + v.suburb : ""}: reviews, ratings and details on The Black Garter forum.`;
  return {
    title: `${v.name} · Sydney brothels · The Black Garter`,
    desc: plain(txt(desc, 160)),
    canonical: `/forum/brothels/${E(v.slug)}`,
    jsonld,
    html,
  };
}

/* ---------- member, messages, notifications ---------- */

export function memberPage(ctx) {
  const m = ctx.profile;
  const tab = ctx.tab === "comments" ? "comments" : "posts";
  const posts = (ctx.posts || []).map((p) => feedRow(p, ctx.member)).join("");
  const comments = (ctx.comments || []).map((c) => `<div class="fcmini panel">
    <div class="fmeta">on <a href="${postHref({ id: c.post_id, title: c.post_title })}">${E(txt(c.post_title, 70))}</a><i>·</i><time datetime="${E(c.created_at)}">${ago(c.created_at)}</time></div>
    <div class="fc-body">${md(c.body)}</div>
  </div>`).join("");
  const html = `<div class="fw">
  <div class="flay">
    <div class="fmain-col">
      <article class="panel fs-profile">
        <h1>u/${E(m.username)}</h1>
        <div class="fmeta"><span class="frank">${rankOf(m.karma)}</span><i>·</i><span>${+m.karma || 0} karma</span><i>·</i><span>cake day ${E(fmtDay(m.created_at))}</span></div>
      </article>
      <div class="fnav"><div class="tabs" aria-label="Profile">${tabLink(userHref(m.username), "Posts", tab === "posts")}${tabLink(userHref(m.username) + "?tab=comments", "Comments", tab === "comments")}</div></div>
      ${tab === "posts" ? `<div class="ffeed">${posts || emptyState("No posts yet.")}</div>` : `<div class="ffeed">${comments || emptyState("No comments yet.")}</div>`}
    </div>
    ${sidebar(ctx)}
  </div>
</div>`;
  return {
    title: `u/${m.username} · Forum · The Black Garter`,
    desc: `Profile for u/${m.username} on The Black Garter forum.`,
    canonical: userHref(m.username),
    robots: "noindex",
    html,
  };
}

export function messagesPage(ctx) {
  const partners = (ctx.partners || []).map((p) => {
    const active = ctx.with && +ctx.with.id === +p.id;
    return `<li${active ? ' class="on"' : ""}><a href="/forum/messages?with=${encodeURIComponent(p.username)}"><span class="fm-w">u/${E(p.username)}${+p.unread ? ` <b class="fm-u">${+p.unread}</b>` : ""}</span><time datetime="${E(p.last)}">${ago(p.last)}</time></a></li>`;
  }).join("");
  const msgs = (ctx.conv || []).map((m) => `<div class="fmsg-i${ctx.member && +m.from_id === +ctx.member.id ? " me" : ""}">
    <div class="fmeta">${ctx.member && +m.from_id === +ctx.member.id ? "you" : "u/" + E(m.username || "?")}<i>·</i><time datetime="${E(m.created_at)}">${ago(m.created_at)}</time></div>
    <div class="fbody">${md(m.body)}</div>
  </div>`).join("");
  let conv = `<p class="ffine">Pick a conversation, or message a member from their profile.</p>`;
  if (ctx.with) {
    const blockedNote = ctx.blockedBoth
      ? `<p class="fhold">Messaging is blocked between you and u/${E(ctx.with.username)}.</p>`
      : "";
    conv = `<div class="fm-conv-head"><h2 class="fh2">u/${E(ctx.with.username)}</h2>${ctx.member ? `<button class="fqa" type="button" data-block data-user="${E(ctx.with.username)}">${ctx.blocked ? "Unblock" : "Block"}</button>` : ""}</div>
    ${blockedNote}
    <div class="fmsgs" data-msgs>${msgs || `<p class="ffine">No messages yet. Say hello.</p>`}</div>
    ${ctx.member && !ctx.blockedBoth ? `<form class="fcf" data-msgform data-to="${E(ctx.with.username)}"><textarea class="farea" name="body" rows="3" maxlength="4000" placeholder="Message u/${E(ctx.with.username)}" aria-label="Message" required></textarea><div class="frow"><button class="btn solid sm" type="submit">Send</button><span class="ffine" data-mstate></span></div></form>` : ""}`;
  }
  const html = `<div class="fw">
  <div class="fmsg">
    <aside class="panel fmsg-list">
      <h4 class="fh">Messages</h4>
      ${partners ? `<ul class="fplist">${partners}</ul>` : `<p class="ffine">No conversations yet.</p>`}
    </aside>
    <section class="panel fmsg-conv">${conv}</section>
  </div>
</div>`;
  return {
    title: "Messages · Forum · The Black Garter",
    desc: "Private messages on The Black Garter forum.",
    canonical: "/forum/messages",
    robots: "noindex",
    html,
  };
}

export function notificationsPage(ctx) {
  const items = (ctx.items || []).map((n) => {
    const who = n.actor ? `<b>u/${E(n.actor)}</b>` : "Someone";
    const what = n.kind === "message" ? "sent you a message" : n.kind === "mention" ? "mentioned you" : n.kind === "sub" ? "posted in a thread you follow" : "replied";
    const href = n.kind === "message" && n.actor ? `/forum/messages?with=${encodeURIComponent(n.actor)}` : n.post_id ? `/forum/p/${n.post_id}${n.comment_id ? `#c${n.comment_id}` : ""}` : "/forum";
    return `<a class="fnotif${n.read_at ? "" : " unread"}" href="${href}"><span>${who} ${what}${n.snippet ? `: <i>${E(txt(n.snippet, 80))}</i>` : ""}</span><time datetime="${E(n.at)}">${ago(n.at)}</time></a>`;
  }).join("");
  const html = `<div class="fw">
  <div class="flay">
    <div class="fmain-col">
      <header class="fhead"><div class="kick">INBOX</div><h1>Notifications</h1><div class="frow"><button class="btn ghost sm" type="button" data-notif-read>Mark all read</button></div></header>
      <div class="fnotifs">${items || emptyState("Nothing yet. Replies to your posts land here.")}</div>
    </div>
    ${sidebar(ctx)}
  </div>
</div>`;
  return {
    title: "Notifications · Forum · The Black Garter",
    desc: "Your notifications on The Black Garter forum.",
    canonical: "/forum/notifications",
    robots: "noindex",
    html,
  };
}

/* ---------- search ---------- */

export function searchPage(ctx) {
  const q = ctx.q || "";
  const posts = (ctx.posts || []).map((p) => feedRow(p, ctx.member)).join("");
  const venues = (ctx.venues || []).map(venueCard).join("");
  const html = `<div class="fw">
  <div class="flay">
    <div class="fmain-col">
      <header class="fhead"><div class="kick">SEARCH</div><h1>${q ? `Results for <em>${E(q)}</em>` : "Search"}</h1>
        <form class="fdfilters" action="/forum/search" method="get"><input type="search" name="q" value="${E(q)}" placeholder="Posts and venues" aria-label="Search"><button class="btn solid sm" type="submit">Search</button></form>
      </header>
      ${q ? `
      <section class="fcomments"><div class="fchead"><h2 class="fh2">Posts</h2></div>
      <div class="ffeed">${posts || emptyState("No posts match.", "")}</div></section>
      <section class="fcomments"><div class="fchead"><h2 class="fh2">Venues</h2></div>
      <div class="fvenues">${venues || `<p class="ffine">No venues match.</p>`}</div></section>` : `<p class="ffine">Search posts and the brothel directory.</p>`}
    </div>
    ${sidebar(ctx)}
  </div>
</div>`;
  return {
    title: q ? `${txt(q, 40)} · Search · The Black Garter` : "Search · Forum · The Black Garter",
    desc: "Search posts and Sydney brothels on The Black Garter forum.",
    canonical: "/forum/search",
    robots: "noindex",
    html,
  };
}

/* ---------- rules ---------- */

export function rulesPage(ctx) {
  const rules = [
    ["Adults only", "18 and over, no exceptions. Anything that suggests otherwise is removed and reported."],
    ["Working names only", "Never real names, phone numbers, addresses or photos of workers or clients. Not in posts, not in messages, not anywhere."],
    ["No doxxing, threats or harassment", "No pile ons, no stalking, no outing. One warning at most, then a ban."],
    ["Nothing involving anyone under 18", "Or anyone who did not consent. This is the line. Cross it and you are gone for good."],
    ["No drug dealing", "Not here, not in messages, not implied."],
    ["No advertising your own services", "The forum is for field reports and talk, not for selling. Providers who want a listing should speak to the house."],
    ["Reviews must be your own", "Genuine first hand experience only. Shills and vendettas get removed."],
  ];
  const html = `<div class="fw">
  <div class="flay">
    <div class="fmain-col">
      <header class="fhead"><div class="kick">THE RULES</div><h1>Keep it <em>clean.</em></h1><p class="lede">Agreeing to these is part of joining. They apply to posts, comments and private messages.</p></header>
      <div class="fthules">
        ${rules.map((r, i) => `<div class="fthu"><span class="fthu-n">${String(i + 1).padStart(2, "0")}</span><div><h3>${E(r[0])}</h3><p>${E(r[1])}</p></div></div>`).join("")}
      </div>
      <p class="ffine">Reports go to the mod queue. Three reports hide a post or comment pending review. Bans are shared with the house.</p>
    </div>
    ${sidebar(ctx)}
  </div>
</div>`;
  return {
    title: "Rules · Forum · The Black Garter",
    desc: "The house rules for The Black Garter forum.",
    canonical: "/forum/rules",
    html,
  };
}

/* ---------- login & settings ---------- */

export function loginPage(ctx) {
  const html = `<div class="fw">
  <div class="flay flay-narrow">
    <div class="fmain-col">
      <header class="fhead"><div class="kick">MEMBERS</div><h1>Come <em>in.</em></h1></header>
      <div class="fgrid2">
        <form class="panel fform" data-join>
          <h3>Join</h3><p class="p-sub">A username, a password, and you are on the floor.</p>
          <div class="fld"><span>Username</span><input name="username" minlength="3" maxlength="20" pattern="[A-Za-z0-9_]{3,20}" autocomplete="username" required aria-label="Username"><span class="ffine">3 to 20 letters, numbers or underscore.</span></div>
          <div class="fld"><span>Password</span><input name="password" type="password" minlength="10" autocomplete="new-password" required aria-label="Password"><span class="ffine">10 characters or more.</span></div>
          <div class="fld"><span>Email (optional)</span><input name="email" type="email" autocomplete="email" aria-label="Email"></div>
          <label class="chk"><input type="checkbox" name="over18" required><span>I am 18 or over and agree to <a href="/forum/rules" target="_blank">the rules</a>.</span></label>
          <div class="frow"><button class="btn solid" type="submit">Create account</button><span class="ffine" data-state></span></div>
          ${ctx.google ? `<div class="fg-google"><span class="ffine">Or</span><div data-gsi></div></div>` : ""}
        </form>
        <form class="panel fform" data-login>
          <h3>Sign in</h3><p class="p-sub">Welcome back.</p>
          <div class="fld"><span>Username</span><input name="username" autocomplete="username" required aria-label="Username"></div>
          <div class="fld"><span>Password</span><input name="password" type="password" autocomplete="current-password" required aria-label="Password"></div>
          <div class="frow"><button class="btn solid" type="submit">Sign in</button><span class="ffine" data-state></span></div>
          ${ctx.google ? `<div class="fg-google"><span class="ffine">Or</span><div data-gsi></div></div>` : ""}
        </form>
      </div>
      <p class="ffine">Google sign in appears here once the house configures it. <a href="/forum/rules">The rules</a> apply from the first post.</p>
    </div>
    ${sidebar(ctx)}
  </div>
</div>`;
  return {
    title: "Sign in · Forum · The Black Garter",
    desc: "Sign in or join The Black Garter forum.",
    canonical: "/forum/login",
    robots: "noindex",
    html,
  };
}

export function settingsPage(ctx) {
  const m = ctx.member;
  const html = `<div class="fw">
  <div class="flay flay-narrow">
    <div class="fmain-col">
      <header class="fhead"><div class="kick">ACCOUNT</div><h1>Settings</h1></header>
      <form class="panel fform" data-password>
        <h3>Change password</h3>
        ${m.pass_hash ? `<div class="fld"><span>Current password</span><input name="old" type="password" autocomplete="current-password" required aria-label="Current password"></div>` : `<p class="ffine">You signed in with Google. Set a password to sign in without it.</p>`}
        <div class="fld"><span>New password</span><input name="password" type="password" minlength="10" autocomplete="new-password" required aria-label="New password"></div>
        <div class="frow"><button class="btn solid sm" type="submit">Save password</button><span class="ffine" data-state></span></div>
      </form>
      <form class="panel fform" data-email>
        <h3>Email</h3><p class="p-sub">Optional. Used for sign in and account recovery only.</p>
        <div class="fld"><span>Email</span><input name="email" type="email" value="${E(m.email || "")}" autocomplete="email" aria-label="Email"></div>
        <div class="frow"><button class="btn solid sm" type="submit">Save email</button><span class="ffine" data-state></span></div>
      </form>
      <form class="panel fform fdanger" data-delete>
        <h3>Delete account</h3><p class="p-sub">Your posts stay on the floor, attributed to nobody. This cannot be undone.</p>
        <label class="chk"><input type="checkbox" name="confirm" required><span>I understand, delete my account.</span></label>
        ${m.pass_hash ? `<div class="fld"><span>Password</span><input name="password" type="password" autocomplete="current-password" required aria-label="Password"></div>` : ""}
        <div class="frow"><button class="btn ghost sm fqa-danger" type="submit">Delete account</button><span class="ffine" data-state></span></div>
      </form>
    </div>
    ${sidebar(ctx)}
  </div>
</div>`;
  return {
    title: "Settings · Forum · The Black Garter",
    desc: "Account settings.",
    canonical: "/forum/settings",
    robots: "noindex",
    html,
  };
}

/* ---------- moderation ---------- */

export function modPage(ctx) {
  const reports = (ctx.reports || []).map((r) => `<div class="fmod-i">
    <div class="fmeta"><span>${E(r.t)}</span><i>·</i><span>reported by u/${E(r.username || "?")}</span><i>·</i><time>${ago(r.created_at)}</time></div>
    <div class="fc-body">${E(txt(r.preview, 160))}</div>
    <div class="fmeta"><span>reason: ${E(r.reason || "none given")}</span>${r.n > 1 ? `<i>·</i><span>${r.n} reports</span>` : ""}</div>
    <div class="facts">
      <button class="fqa" type="button" data-mod data-act="remove" data-kind="${E(r.t)}" data-id="${r.tid}">Remove content</button>
      <button class="fqa" type="button" data-mod data-act="dismiss" data-kind="report" data-id="${r.t}:${r.tid}">Dismiss reports</button>
      <a class="fqa" href="${r.t === "post" ? `/forum/p/${r.tid}` : "#"}" ${r.t === "post" ? "" : "hidden"}>Open</a>
    </div>
  </div>`).join("");
  const pend = (arr, kind) => (arr || []).map((p) => `<div class="fmod-i">
    <div class="fmeta"><span>${E(kind)}</span><i>·</i><span>u/${E(p.username || "?")}</span><i>·</i><time>${ago(p.created_at)}</time></div>
    <div class="fc-body">${E(txt(p.body || p.title || "", 200))}</div>
    <div class="facts">
      <button class="fqa" type="button" data-mod data-act="approve" data-kind="${E(kind)}" data-id="${p.id}">Approve</button>
      <button class="fqa fqa-danger" type="button" data-mod data-act="remove" data-kind="${E(kind)}" data-id="${p.id}">Remove</button>
      ${kind === "post" ? `<a class="fqa" href="/forum/p/${p.id}">Open</a>` : ""}
    </div>
  </div>`).join("");
  const sugg = (ctx.suggestions || []).map((s) => `<div class="fmod-i">
    <div class="fmeta"><span>suggestion</span><i>·</i><span>${E(s.brothel_name || "")}</span><i>·</i><span>u/${E(s.username || "?")}</span><i>·</i><time>${ago(s.created_at)}</time></div>
    <div class="fc-body">${E(txt(s.body, 300))}</div>
    <div class="facts"><button class="fqa" type="button" data-mod data-act="accept" data-kind="suggestion" data-id="${s.id}">Accept</button><button class="fqa" type="button" data-mod data-act="decline" data-kind="suggestion" data-id="${s.id}">Decline</button></div>
  </div>`).join("");
  const members = (ctx.members || []).map((m) => `<div class="fmod-i fmod-m">
    <div class="fmeta"><a href="${userHref(m.username)}">u/${E(m.username)}</a><i>·</i><span>${E(m.role)}</span><i>·</i><span>${+m.karma || 0} karma</span><i>·</i><span>joined ${E(fmtDay(m.created_at))}</span>${m.status === "banned" ? '<i>·</i><span class="fhold">banned</span>' : ""}</div>
    <div class="facts">
      ${m.status === "banned"
        ? `<button class="fqa" type="button" data-mod data-act="unban" data-kind="member" data-id="${m.id}">Unban</button>`
        : `<button class="fqa fqa-danger" type="button" data-mod data-act="ban" data-kind="member" data-id="${m.id}">Ban</button>`}
      ${m.role === "member" ? `<button class="fqa" type="button" data-mod data-act="makemod" data-kind="member" data-id="${m.id}">Make mod</button>` : ""}
      ${m.role === "mod" ? `<button class="fqa" type="button" data-mod data-act="demote" data-kind="member" data-id="${m.id}">Demote</button>` : ""}
    </div>
  </div>`).join("");
  const html = `<div class="fw">
  <div class="flay flay-narrow">
    <div class="fmain-col">
      <header class="fhead"><div class="kick">MODERATION</div><h1>The queue.</h1><p class="lede">Everything held, reported or waiting. Actions are logged.</p></header>
      <section class="fcomments"><div class="fchead"><h2 class="fh2">Reports (${(ctx.reports || []).length})</h2></div><div class="fmods">${reports || '<p class="ffine">Queue clear.</p>'}</div></section>
      <section class="fcomments"><div class="fchead"><h2 class="fh2">Held posts (${(ctx.pendingPosts || []).length})</h2></div><div class="fmods">${pend(ctx.pendingPosts, "post") || '<p class="ffine">Nothing held.</p>'}</div></section>
      <section class="fcomments"><div class="fchead"><h2 class="fh2">Held comments (${(ctx.pendingComments || []).length})</h2></div><div class="fmods">${pend(ctx.pendingComments, "comment") || '<p class="ffine">Nothing held.</p>'}</div></section>
      <section class="fcomments"><div class="fchead"><h2 class="fh2">Edit suggestions (${(ctx.suggestions || []).length})</h2></div><div class="fmods">${sugg || '<p class="ffine">Nothing waiting.</p>'}</div></section>
      <section class="fcomments"><div class="fchead"><h2 class="fh2">Members</h2></div><div class="fmods">${members || '<p class="ffine">Nobody here yet.</p>'}</div></section>
    </div>
    ${sidebar(ctx)}
  </div>
</div>`;
  return {
    title: "Moderation · Forum · The Black Garter",
    desc: "Moderation queue.",
    canonical: "/forum/mod",
    robots: "noindex",
    html,
  };
}

/* ---------- misc ---------- */

export function notFound(ctx) {
  return {
    title: "Not found · Forum · The Black Garter",
    desc: "That page is not here.",
    canonical: "/forum",
    robots: "noindex",
    status: 404,
    html: `<div class="fw"><div class="fempty big"><div class="fe-k">That door does not open.</div><p>The page you asked for is gone, or never was.</p><p><a class="deep" href="/forum">Back to the forum</a></p></div></div>`,
  };
}

export function rssFeed(posts, origin) {
  const xml = (s) => String(s ?? "").replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]));
  const items = (posts || []).map((p) => `    <item>
      <title>${xml(p.title)}</title>
      <link>${origin}${postHref(p)}</link>
      <guid isPermaLink="true">${origin}${postHref(p)}</guid>
      <pubDate>${new Date(p.created_at).toUTCString()}</pubDate>
      <description>${xml(txt(p.body, 300))}</description>
    </item>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
    <title>The Black Garter · Forum</title>
    <link>${origin}/forum/all</link>
    <description>Everything on The Black Garter forum, ranked. Adults only.</description>
    <language>en-au</language>
    <atom:link xmlns:atom="http://www.w3.org/2005/Atom" href="${origin}/forum/all.rss" rel="self" type="application/rss+xml"/>
${items}
</channel></rss>
`;
}
