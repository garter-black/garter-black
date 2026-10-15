#!/usr/bin/env python3
"""garter.black page builder (stdlib only).

Every src/**/*.html page (except src/partials) starts with a front-matter comment:

  <!--page {"title": "...", "desc": "...", "canonical": "/escorts"} -->

Optional blocks inside the page:
  <!--head--> extra <head> html <!--/head-->
  <!--scripts--> extra scripts placed after the shared scripts <!--/scripts-->
Everything else is the page body, wrapped in <main id="main">.

Front-matter keys (all optional except title/desc/canonical):
  og        image path for social cards        default /assets/band-figure.jpg
  robots    robots meta                         default "index, follow"
  loader    true = loader + curtains (home)     default false
  corridor  true = 3D gold corridor background  default true
  gate      true = 18+ gate                     default true
  chrome    true = nav + footer                 default true
  bodyClass extra body classes
  edgeOff   true = keep the edge's Hera widget and album player off this page (admin)
Output: dist/<same relative path>. Pages placed straight into dist/ by hand (raw aliases)
are never touched.
"""
import hashlib, json, os, re, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC, DIST, PART = os.path.join(ROOT, "src"), os.path.join(ROOT, "dist"), os.path.join(ROOT, "src", "partials")
CONST = {
    # reception / shop line (default for home and all shared chrome)
    "tel": "+61412216197",
    "phone": "0412 216 197",
    "email": "0@black.industries",
    "wa": "https://wa.me/61412216197",
    # recruitment line (Rose / join the house), kept distinct from the shop line
    "rec_tel": "+61451700056",
    "rec_phone": "0451 700 056",
    "rec_wa": "https://wa.me/61451700056",
    # Twilio landline (office line, distinct from the mobile and recruitment lines)
    "land_tel": "+61253000019",
    "land_phone": "02 5300 0019",
}
IMPORTMAP = '<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"}}</script>'


def part(name):
    with open(os.path.join(PART, name + ".html"), encoding="utf-8") as f:
        return f.read()


MUSIC_TAGS = None


def music_tags():
    """Shared music script tags (playlist then player, both defer). Cached read."""
    global MUSIC_TAGS
    if MUSIC_TAGS is None:
        try:
            MUSIC_TAGS = part("scripts").strip()
        except OSError:
            MUSIC_TAGS = ""
    return MUSIC_TAGS


def ver():
    h = hashlib.sha1()
    ad = os.path.join(DIST, "assets")
    for n in sorted(os.listdir(ad)):
        if n.endswith((".css", ".js")):
            h.update(open(os.path.join(ad, n), "rb").read())
    return h.hexdigest()[:10]


def sub(s, ctx):
    return re.sub(r"\{\{(\w+)\}\}", lambda m: str(ctx.get(m.group(1), m.group(0))), s)


def esc_attr(s):
    return (s or "").replace("&", "&amp;").replace('"', "&quot;").replace("<", "&lt;")


def build_page(path, v):
    raw = open(path, encoding="utf-8-sig").read()
    m = re.match(r"\s*<!--page\s+(\{.*?\})\s*-->", raw, re.S)
    if not m:
        raise SystemExit("missing <!--page {...} --> front matter: " + path)
    meta = json.loads(m.group(1))
    body = raw[m.end():]
    extrahead = extrascripts = ""
    hm = re.search(r"<!--head-->(.*?)<!--/head-->", body, re.S)
    if hm:
        extrahead, body = hm.group(1).strip(), body[:hm.start()] + body[hm.end():]
    sm = re.search(r"<!--scripts-->(.*?)<!--/scripts-->", body, re.S)
    if sm:
        extrascripts, body = sm.group(1).strip(), body[:sm.start()] + body[sm.end():]
    for k in ("title", "desc", "canonical"):
        if k not in meta:
            raise SystemExit(f"front matter needs '{k}': {path}")
    corridor = meta.get("corridor", True)
    edge_off = meta.get("edgeOff", False)
    if edge_off:
        extrahead += '\n<script type="text/plain" src="/_pbi/player.js"></script>'
    ctx = dict(CONST)
    ctx.update({
        "title": esc_attr(meta["title"]), "desc": esc_attr(meta["desc"]), "canonical": meta["canonical"],
        "og": meta.get("og", "/assets/black-room.jpg"), "robots": meta.get("robots", "index, follow"),
        "ver": v, "importmap": IMPORTMAP if corridor else "", "extrahead": extrahead,
    })
    out = [sub(part("head"), ctx)]
    cls = " ".join(x for x in [meta.get("bodyClass", "")] if x)
    attrs = (' class="%s"' % cls if cls else "") + (" data-nogate" if not meta.get("gate", True) else "")
    out.append("<body%s>" % attrs)
    if corridor:
        out.append('<canvas id="bg3d" aria-hidden="true"></canvas><div class="bg-veil" aria-hidden="true"></div>')
    if meta.get("gate", True):
        out.append(part("gate"))
    if meta.get("loader", False):
        out.append(part("loader"))
    out.append('<div class="grain" aria-hidden="true"></div>')
    if meta.get("chrome", True):
        out.append(sub(part("nav"), ctx))
    out.append('<main id="main">\n' + sub(body.strip(), ctx) + "\n</main>")
    if meta.get("chrome", True):
        out.append(sub(part("footer"), ctx))
    if edge_off:
        out.append("<elevenlabs-convai hidden></elevenlabs-convai>")
    out.append('<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js" defer></script>')
    out.append('<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js" defer></script>')
    out.append('<script src="/assets/garter.js?v=%s" defer></script>' % v)
    if corridor:
        out.append('<script type="module" src="/assets/corridor.js?v=%s"></script>' % v)
    if not edge_off:
        mt = music_tags()
        if mt:
            out.append(mt)
    if extrascripts:
        out.append(sub(extrascripts, ctx))
    out.append("</body>\n</html>\n")
    return "\n".join(out)


def main():
    v = ver()
    n = 0
    only = sys.argv[1:]
    for dp, dn, fn in os.walk(SRC):
        if os.path.abspath(dp).startswith(os.path.abspath(PART)):
            continue
        for f in fn:
            if not f.endswith(".html"):
                continue
            sp = os.path.join(dp, f)
            rel = os.path.relpath(sp, SRC)
            if only and not any(rel.startswith(o) for o in only):
                continue
            dst = os.path.join(DIST, rel)
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            with open(dst, "w", encoding="utf-8", newline="\n") as fh:
                fh.write(build_page(sp, v))
            n += 1
            print("built", rel)
    print(f"{n} pages, asset version {v}")


if __name__ == "__main__":
    main()
