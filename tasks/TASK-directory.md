# TASK · directory · every Sydney brothel, researched

Read `tasks/CONVENTIONS.md` first (rules 1 to 3 and 6 apply). Output `data/brothels.json` and `tasks/REPORT-directory.md`.

Goal: the data behind garter.black/forum/brothels, a directory of brothels and licensed sex services premises currently operating in Greater Sydney (Sydney CBD, inner west, east, north shore, south, south west, west, Parramatta, Hills, Sutherland, Liverpool, Penrith, Campbelltown, Blacktown). Massage parlours that openly offer adult services count, tagged `type: "parlour"`.

## Method
1. Discover venue names with web search (queries by suburb and region, "brothel <suburb>", "adult massage <suburb>", council development applications for sex services premises, news, business directories). Forum sites like aus99/syd99 may be used only to discover names; never copy their text, ratings or reviews.
2. Verify each venue from its own website or another independent source (business listing, council record, news). Record every URL used in `sources`.
3. Do NOT use Google Maps or Places data. Do not guess phone numbers, addresses or hours. Leave a field empty when no source states it.
4. Venues that look closed (dead site, news of closure) go in with `status: "closed"`.

## Record format (JSON array, UTF-8)
```json
{"name":"", "suburb":"", "address":"", "phone":"", "website":"", "hours":"", "type":"brothel|parlour",
 "notes":"one neutral, non-explicit line, max 140 chars", "status":"open|closed|unverified",
 "confidence":"high|medium|low", "sources":["https://..."], "verified_at":"2026-10-02"}
```
Notes stay neutral and factual (e.g. "Long running venue near the station, open late"). No sexual detail, no worker names, no prices unless the venue publishes them.
Always include: {"name":"The Black Garter","suburb":"Rockdale","address":"17 to 19 The Seven Ways, Rockdale NSW 2216","phone":"0451 700 056","website":"https://garter.black","type":"brothel","status":"open","confidence":"high","sources":["https://garter.black"]}. Never mention theblackgarter.com.au.

Target 60 to 150 venues; quality beats count. Deduplicate (same address or phone = same venue). Sort by suburb then name. Validate the JSON parses. Report: counts by status and confidence, regions covered, gaps, and the search queries used.
