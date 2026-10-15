#!/usr/bin/env bash
# ============================================================
# garter.black forum · API test suite (curl against local dev)
# Usage: bash tasks/test-forum-api.sh [base-url]
# ============================================================
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT" || exit 1
BASE="${1:-http://127.0.0.1:8791}"
T="tasks/logs/test"
mkdir -p "$T"
B="$BASE"

FAILED=0
P() { printf "PASS  %s\n" "$1"; }
F() { printf "FAIL  %s :: %s\n" "$1" "$2"; FAILED=$((FAILED + 1)); }

CJ() { # method path data jar outfile -> prints http code
  local m=$1 p=$2 d=$3 j=$4 o=$5
  local args=(-s -m 30 -o "$o" -w '%{http_code}' -X "$m" "$B$p")
  if [ -n "$d" ]; then args+=(-H 'content-type: application/json' --data "$d"); fi
  if [ -n "$j" ]; then args+=(-b "$j" -c "$j"); fi
  curl "${args[@]}"
}
GET() { CJ GET "$1" "$2" "$3" "$4"; }
POST() { CJ POST "$1" "$2" "$3" "$4"; }
JGET() { node "$T/jget.js" "$1" < "$2"; }
EQ() { if [ "$2" = "$3" ]; then P "$1"; else F "$1" "want[$2] got[$3]"; fi; }
HAS() { if grep -q -- "$2" "$3"; then P "$1"; else F "$1" "missing [$2] in $3"; fi; }
NOHAS() { if grep -q -- "$2" "$3"; then F "$1" "found [$2] in $3"; else P "$1"; fi; }
CGE() { local c; c=$(grep -c -- "$2" "$3"); if [ "$c" -ge "$4" ]; then P "$1"; else F "$1" "count $c < $4 for [$2]"; fi; }
POS() { grep -bo -- "$1" "$2" | head -1 | cut -d: -f1; }
sqlq() { # run one d1 query, print raw
  npx wrangler d1 execute garter-black --local --command "$1" 2>/dev/null
}

S=$(printf '%04d' $((RANDOM % 10000)))
ALICE="alice_$S"; BOB="bob_$S"; CAROL="carol_$S"; DAVE="dave_$S"; EVE="eve_$S"; FRANK="frank_$S"
PW="garter-test-pass-1"
PW2="garter-test-pass-2"
T1="First evening at the Garter r$S"; T2="A link worth reading r$S"; T3="Report target post r$S"
T4="Midnight noodle recommendations r$S"; T5="Escaping test r$S"; RT="A fine night at the Garter r$S"
JA="$T/alice.jar"; JB="$T/bob.jar"; JC="$T/carol.jar"; JD="$T/dave.jar"; JE="$T/eve.jar"; JF="$T/frank.jar"
R="$T/r.json"

echo "== forum api tests · suffix $S · base $B =="
echo "(frank=$FRANK)"

# ---------- 0. reset throttle ----------
sqlq "DELETE FROM throttle" > /dev/null 2>&1

# ---------- 1. anon session ----------
code=$(GET /api/forum/me "" "" "$R")
EQ "me anon 200" "200" "$code"
EQ "me anon member null" "" "$(JGET member.u "$R")"

# ---------- 2. joins ----------
J() { printf '{"username":"%s","password":"%s","over18":true}' "$1" "$PW"; }
for pair in "alice:$ALICE:$JA" "bob:$BOB:$JB" "carol:$CAROL:$JC" "dave:$DAVE:$JD" "eve:$EVE:$JE"; do
  name="${pair%%:*}"; rest="${pair#*:}"; user="${rest%%:*}"; jar="${rest#*:}"
  code=$(POST /api/forum/join "$(J "$user")" "$jar" "$R")
  EQ "join $name" "200" "$code"
  EQ "join $name ok" "true" "$(JGET ok "$R")"
done
code=$(POST /api/forum/join "$(J "$FRANK")" "$JF" "$R")
EQ "join frank rate limited (5/hr/ip)" "429" "$code"

# ---------- 3. reset throttle, join validation ----------
sqlq "DELETE FROM throttle" > /dev/null 2>&1
code=$(POST /api/forum/join '{"username":"ab","password":"garter-test-pass-1","over18":true}' "" "$R")
EQ "join bad username 400" "400" "$code"
code=$(POST /api/forum/join '{"username":"admin","password":"garter-test-pass-1","over18":true}' "" "$R")
EQ "join reserved name 400" "400" "$code"
code=$(POST /api/forum/join "{\"username\":\"ok_$S\",\"password\":\"short\",\"over18\":true}" "" "$R")
EQ "join short password 400" "400" "$code"
code=$(POST /api/forum/join "{\"username\":\"ok_$S\",\"password\":\"long-enough-pass\"}" "" "$R")
EQ "join no 18 checkbox 400" "400" "$code"

# ---------- 4. login ----------
code=$(POST /api/forum/login "{\"username\":\"$ALICE\",\"password\":\"wrong-password\"}" "$JA" "$R")
EQ "login wrong password 401" "401" "$code"
code=$(POST /api/forum/login "{\"username\":\"$ALICE\",\"password\":\"$PW\"}" "$JA" "$R")
EQ "login alice 200" "200" "$code"
code=$(GET /api/forum/me "" "$JA" "$R")
EQ "me alice" "$ALICE" "$(JGET member.u "$R")"
code=$(POST /api/forum/logout '{}' "$JA" "$R")
EQ "logout 200" "200" "$code"
code=$(GET /api/forum/me "" "$JA" "$R")
EQ "me after logout null" "" "$(JGET member.u "$R")"
code=$(POST /api/forum/login "{\"username\":\"$ALICE\",\"password\":\"$PW\"}" "$JA" "$R")
EQ "login alice again" "200" "$code"

# ---------- 5. import (auth + Black Garter) ----------
TOKEN=$(grep '^AI_TOKEN=' .dev.vars | cut -d= -f2-)
code=$(POST /api/forum/admin/import '[]' "" "$R")
EQ "import without token 401" "401" "$code"
node -e 'console.log(JSON.stringify([{name:"The Black Garter",suburb:"Rockdale",address:"17 to 19 The Seven Ways, Rockdale NSW 2216",phone:"0451 700 056",website:"https://garter.black",hours:"",notes:"",sources:["garter.black"],confidence:"high"}]))' > "$T/import.json"
code=$(curl -s -m 30 -o "$R" -w '%{http_code}' -X POST -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' --data @"$T/import.json" "$B/api/forum/admin/import")
EQ "import with ai bearer 200" "200" "$code"
EQ "import imported 1" "1" "$(JGET imported "$R")"
code=$(GET "/api/forum/brothels?list=1&q=black" "" "" "$R")
EQ "brothel lookup slug" "the-black-garter" "$(JGET list.0.slug "$R")"

# ---------- 6. posts ----------
mkpost() { # kind title body extra -> json
  printf '{"board":"%s","kind":"%s","title":"%s","body":"%s"%s}' "$1" "$2" "$3" "$4" "$5"
}
code=$(POST /api/forum/posts "$(mkpost general text "$T1" "Went in for a look. Quiet, clean, friendly." ',"flair":"Discussion"')" "$JA" "$R")
EQ "alice creates text post" "200" "$code"
EQ "text post live" "live" "$(JGET status "$R")"
P1ID=$(JGET id "$R")

code=$(POST /api/forum/posts "$(mkpost general link "$T2" "Notes on the scene." ',"url":"https://example.com/sydney"')" "$JA" "$R")
EQ "alice creates link post" "200" "$code"
EQ "link post from new account held" "pending" "$(JGET status "$R")"
P2ID=$(JGET id "$R")

code=$(POST /api/forum/posts "$(mkpost general text "$T3" "This one gets reported three times." "")" "$JA" "$R")
P3ID=$(JGET id "$R"); EQ "post for reports created" "200" "$code"

code=$(POST /api/forum/posts "$(mkpost general text "$T4" "Where to eat after. The noodle house on the corner." "")" "$JA" "$R")
P4ID=$(JGET id "$R"); EQ "searchable post created" "200" "$code"

code=$(POST /api/forum/posts "$(mkpost general text "$T5" "<script>alert(1)</script> and <img src=x onerror=alert(2)> done" "")" "$JA" "$R")
P5ID=$(JGET id "$R"); EQ "xss test post created" "200" "$code"

# ---------- 7. comments ----------
cmt() { printf '{"post":%s,"body":"%s"%s}' "$1" "$2" "${3:-}"; }
code=$(POST /api/forum/comments "$(cmt $P1ID "first reply needle")" "$JB" "$R")
EQ "bob comment d1" "200" "$code"; C1=$(JGET id "$R")
code=$(POST /api/forum/comments "$(cmt $P1ID "carol depth two" ",\"parent\":$C1")" "$JC" "$R")
EQ "carol reply d2" "200" "$code"; C2=$(JGET id "$R")
code=$(POST /api/forum/comments "$(cmt $P1ID "dave depth three" ",\"parent\":$C2")" "$JD" "$R")
EQ "dave reply d3" "200" "$code"; C3=$(JGET id "$R")
code=$(POST /api/forum/comments "$(cmt $P1ID "@$ALICE look here depth four" ",\"parent\":$C3")" "$JE" "$R")
EQ "eve reply d4 mention" "200" "$code"; C4=$(JGET id "$R")
code=$(POST /api/forum/comments "$(cmt $P1ID "call me on 0400 999 888 sometime")" "$JE" "$R")
EQ "phone comment held" "pending" "$(JGET status "$R")"
code=$(POST /api/forum/comments "$(cmt $P1ID "any schoolgirl specials?")" "$JE" "$R")
EQ "minors comment held" "pending" "$(JGET status "$R")"

code=$(GET "/forum/p/$P1ID" "" "" "$R")
EQ "post page 200" "200" "$code"  # code from GET
HAS "thread has d1" "first reply needle" "$R"
HAS "thread has d2" "carol depth two" "$R"
HAS "thread has d3" "dave depth three" "$R"
HAS "thread has d4" "look here depth four" "$R"
CGE "three nested kids containers" "fc-kids" "$R" 3
NOHAS "held phone comment hidden from anon" "999 888" "$R"

# ---------- 8. notifications ----------
code=$(GET "/forum/notifications" "" "$JA" "$R")
EQ "alice notif page 200" "200" "$code"
HAS "alice notif reply snippet" "first reply needle" "$R"
HAS "alice notif mention" "look here depth four" "$R"
code=$(POST /api/forum/notifications/read '{}' "$JA" "$R")
EQ "notif read marks" "200" "$code"
code=$(GET "/forum/notifications" "" "$JB" "$R")
NOHAS "bob has no self notif" "first reply needle" "$R"
HAS "bob notif for carol reply" "carol depth two" "$R"

# ---------- 9. votes + hot order ----------
vote() { printf '{"t":"%s","id":%s,"val":%s}' "$1" "$2" "$3"; }
code=$(POST /api/forum/vote "$(vote post $P4ID 1)" "$JB" "$R")
EQ "bob upvote" "200" "$code"
EQ "score 1" "1" "$(JGET score "$R")"; EQ "my 1" "1" "$(JGET my "$R")"
code=$(POST /api/forum/vote "$(vote post $P4ID 1)" "$JC" "$R")
EQ "carol upvote" "200" "$code"; EQ "score 2" "2" "$(JGET score "$R")"
code=$(GET "/api/forum/posts?sort=hot&board=general" "" "" "$R")
P4POS=$(POS "$T4" "$R"); P1POS=$(POS "$T1" "$R")
if [ -n "$P4POS" ] && [ -n "$P1POS" ] && [ "$P4POS" -lt "$P1POS" ]; then P "hot order: voted post first"; else F "hot order: voted post first" "P4=$P4POS P1=$P1POS"; fi
code=$(POST /api/forum/vote "$(vote post $P4ID -1)" "$JB" "$R")
EQ "bob switches to down" "-1" "$(JGET my "$R")"; EQ "score 0 after switch" "0" "$(JGET score "$R")"
code=$(POST /api/forum/vote "$(vote post $P4ID -1)" "$JC" "$R")
EQ "carol down" "-1" "$(JGET my "$R")"; EQ "score -2" "-2" "$(JGET score "$R")"
code=$(GET "/api/forum/posts?sort=hot&board=general" "" "" "$R")
P4POS=$(POS "$T4" "$R"); P1POS=$(POS "$T1" "$R")
if [ -n "$P4POS" ] && [ -n "$P1POS" ] && [ "$P1POS" -lt "$P4POS" ]; then P "hot order flips on downvotes"; else F "hot order flips on downvotes" "P4=$P4POS P1=$P1POS"; fi
code=$(POST /api/forum/vote "$(vote comment $C1 1)" "$JD" "$R")
EQ "dave upvotes bob comment" "200" "$code"
BOBK=$(sqlq "SELECT username, karma FROM f_members WHERE username='$BOB'" | grep -Ec '"karma":[[:space:]]*1')
EQ "bob karma +1" "1" "$BOBK"
code=$(GET "/forum/u/$BOB" "" "" "$R")
EQ "profile page 200" "200" "$code"
HAS "profile karma line" "karma" "$R"

# ---------- 10. report auto hide + staff queue ----------
for who in "$JB:bob" "$JC:carol" "$JD:dave"; do
  jar="${who%%:*}"; name="${who#*:}"
  code=$(POST "/api/forum/posts/$P3ID/report" '{"reason":"test report"}' "$jar" "$R")
  EQ "report by $name" "200" "$code"
done
code=$(GET "/api/forum/posts?sort=new&board=general" "" "" "$R")
NOHAS "reported post hidden from feed" "$T3" "$R"
code=$(GET "/forum/p/$P3ID" "" "" "$R")
EQ "reported post 404 for anon" "404" "$code"
code=$(GET "/forum/p/$P3ID" "" "$JA" "$R")
HAS "author sees held notice" "review" "$R"
AQ=$(sqlq "SELECT status FROM f_posts WHERE id=$P3ID" | grep -c 'pending')
EQ "P3 sql status pending" "1" "$AQ"
# staff queue with bearer
code=$(curl -s -m 30 -o "$R" -w '%{http_code}' -H "Authorization: Bearer $TOKEN" "$B/forum/mod")
EQ "staff mod queue 200" "200" "$code"
HAS "queue lists pending post" "$T3" "$R"
code=$(GET "/forum/mod" "" "$JA" "$R")
EQ "member non-mod 403" "403" "$code"

# ---------- 11. makemod carol (sql) + mod actions ----------
CAROLID=$(sqlq "SELECT id, username FROM f_members WHERE username='$CAROL'" | grep -oE '"id":[[:space:]]*[0-9]+' | grep -oE '[0-9]+' | head -1)
DAVEID=$(sqlq "SELECT id, username FROM f_members WHERE username='$DAVE'" | grep -oE '"id":[[:space:]]*[0-9]+' | grep -oE '[0-9]+' | head -1)
echo "carol id=$CAROLID dave id=$DAVEID"
sqlq "UPDATE f_members SET role='mod' WHERE id=$CAROLID" > /dev/null 2>&1
code=$(GET "/forum/mod" "" "$JC" "$R")
EQ "carol mod queue 200" "200" "$code"
HAS "carol queue shows pending post" "$T3" "$R"
mod() { printf '{"act":"%s","kind":"%s","id":"%s"%s}' "$1" "$2" "$3" "${4:-}"; }
code=$(POST /api/forum/mod/action "$(mod approve post $P2ID)" "$JC" "$R")
EQ "approve link post 200" "200" "$code"
code=$(GET "/api/forum/posts?sort=new&board=general" "" "" "$R")
HAS "approved post in feed" "$T2" "$R"
code=$(POST /api/forum/mod/action "$(mod pin post $P1ID)" "$JC" "$R")
EQ "pin post 200" "200" "$code"
code=$(GET "/forum" "" "" "$R")
PINP=$(POS "$T1" "$R"); P4POS=$(POS "$T4" "$R")
if [ -n "$PINP" ] && [ -n "$P4POS" ] && [ "$PINP" -lt "$P4POS" ]; then P "pinned post first on front page"; else F "pinned post first on front page" "pin=$PINP p4=$P4POS"; fi
code=$(POST /api/forum/mod/action "$(mod lock post $P1ID)" "$JC" "$R")
EQ "lock post 200" "200" "$code"
code=$(POST /api/forum/comments "$(cmt $P1ID "should fail locked")" "$JB" "$R")
EQ "comment on locked 403" "403" "$code"
code=$(POST /api/forum/mod/action "$(mod unlock post $P1ID)" "$JC" "$R")
EQ "unlock post 200" "200" "$code"
code=$(POST /api/forum/mod/action "$(mod remove post $P4ID ',"reason":"test remove"')" "$JC" "$R")
EQ "remove post 200" "200" "$code"
code=$(GET "/api/forum/posts?sort=new&board=general" "" "" "$R")
NOHAS "removed post gone" "$T4" "$R"
code=$(POST /api/forum/mod/action "$(mod restore post $P4ID)" "$JC" "$R")
EQ "restore post 200" "200" "$code"
code=$(GET "/api/forum/posts?sort=new&board=general" "" "" "$R")
HAS "restored post back" "$T4" "$R"
code=$(POST /api/forum/mod/action "$(mod dismiss report "post:$P3ID")" "$JC" "$R")
EQ "dismiss reports 200" "200" "$code"
code=$(POST /api/forum/mod/action "$(mod approve post $P3ID)" "$JC" "$R")
EQ "approve reported post 200" "200" "$code"
# ban without reason
code=$(POST /api/forum/mod/action "$(mod ban member $DAVEID)" "$JC" "$R")
EQ "ban needs reason 400" "400" "$code"
code=$(POST /api/forum/mod/action "$(mod ban member $DAVEID ',"reason":"test ban"')" "$JC" "$R")
EQ "ban dave 200" "200" "$code"
code=$(POST /api/forum/comments "$(cmt $P1ID "banned cannot post")" "$JD" "$R")
EQ "banned comment 403" "403" "$code"
code=$(POST /api/forum/vote "$(vote post $P1ID 1)" "$JD" "$R")
EQ "banned vote 403" "403" "$code"
code=$(POST /api/forum/messages "{\"to\":\"$ALICE\",\"body\":\"banned dm\"}" "$JD" "$R")
EQ "banned message 403" "403" "$code"
code=$(GET "/api/forum/posts?sort=new&board=general" "" "$JD" "$R")
EQ "banned can read" "200" "$code"
code=$(POST /api/forum/mod/action "$(mod unban member $DAVEID)" "$JC" "$R")
EQ "unban dave 200" "200" "$code"
code=$(POST /api/forum/comments "$(cmt $P1ID "dave is back")" "$JD" "$R")
EQ "unbanned comment ok" "200" "$code"

# ---------- 12. review + venue + directory + suggest ----------
code=$(POST /api/forum/posts "$(mkpost reviews review "$RT" "Booked ahead. Service was sharp." ',"brothel":"the-black-garter","overall":5,"rooms":4,"service":5,"value":4,"worker_name":"Nova","visit_month":"2026-09"')" "$JD" "$R")
EQ "dave review post" "200" "$code"; RV=$(JGET id "$R")
EQ "review live" "live" "$(JGET status "$R")"
code=$(GET "/forum/brothels/the-black-garter" "" "" "$R")
EQ "venue page 200" "200" "$code"
HAS "venue has suburb" "Rockdale" "$R"
HAS "venue phone" "0451" "$R"
HAS "venue review listed" "$RT" "$R"
HAS "venue ratings bars" "fr-track" "$R"
HAS "venue stars" "stars" "$R"
code=$(GET "/forum/brothels?q=black" "" "" "$R")
HAS "directory search finds it" "The Black Garter" "$R"
code=$(GET "/forum/brothels?suburb=Rockdale" "" "" "$R")
HAS "suburb filter finds it" "The Black Garter" "$R"
code=$(GET "/forum/brothels?sort=rating" "" "" "$R")
EQ "directory sort rating 200" "200" "$code"
code=$(GET "/api/forum/brothels?list=1&q=black" "" "" "$R")
EQ "brothel list slug" "the-black-garter" "$(JGET list.0.slug "$R")"
code=$(POST "/api/forum/brothels/1/suggest" '{"body":"Add the late night hours"}' "$JA" "$R")
EQ "suggest edit 200" "200" "$code"
SUGID=$(sqlq "SELECT id FROM f_suggestions ORDER BY id DESC LIMIT 1" | grep -oE '"id":[[:space:]]*[0-9]+' | grep -oE '[0-9]+' | head -1)
code=$(POST /api/forum/mod/action "$(mod accept suggestion $SUGID)" "$JC" "$R")
EQ "accept suggestion 200" "200" "$code"

# ---------- 13. messages + block ----------
code=$(POST /api/forum/messages "{\"to\":\"$BOB\",\"body\":\"hello bob dm needle\"}" "$JA" "$R")
EQ "alice dm bob" "200" "$code"
code=$(GET "/forum/messages?with=$ALICE" "" "$JB" "$R")
EQ "bob messages page 200" "200" "$code"
HAS "bob sees dm" "hello bob dm needle" "$R"
code=$(GET "/api/forum/messages?with=$ALICE" "" "$JB" "$R")
HAS "dm api html" "hello bob dm needle" "$R"
code=$(POST /api/forum/messages/block "{\"user\":\"$ALICE\",\"on\":true}" "$JB" "$R")
EQ "bob blocks alice" "200" "$code"
code=$(POST /api/forum/messages "{\"to\":\"$BOB\",\"body\":\"blocked attempt\"}" "$JA" "$R")
EQ "blocked dm 403" "403" "$code"
code=$(POST /api/forum/messages/block "{\"user\":\"$ALICE\",\"on\":false}" "$JB" "$R")
EQ "bob unblocks" "200" "$code"
code=$(POST /api/forum/messages "{\"to\":\"$BOB\",\"body\":\"second dm ok\"}" "$JA" "$R")
EQ "dm after unblock" "200" "$code"

# ---------- 14. subscribe ----------
code=$(POST "/api/forum/posts/$P1ID/subscribe" '{}' "$JB" "$R")
EQ "bob subscribes" "200" "$code"
code=$(POST /api/forum/comments "$(cmt $P1ID "subscriber ping text")" "$JC" "$R")
EQ "carol comment for sub" "200" "$code"
code=$(GET "/forum/notifications" "" "$JB" "$R")
HAS "bob sub notification" "subscriber ping text" "$R"

# ---------- 15. edit/delete markers ----------
code=$(POST "/api/forum/posts/$P1ID/edit" '{"body":"Went in for a look. Quiet, clean, friendly. Edited now."}' "$JA" "$R")
EQ "edit post 200" "200" "$code"
code=$(GET "/forum/p/$P1ID" "" "" "$R")
HAS "edited body shown" "Edited now" "$R"
HAS "edited marker" "edited" "$R"
code=$(POST "/api/forum/comments/$C1/edit" '{"body":"first reply needle edited"}' "$JB" "$R")
EQ "edit comment 200" "200" "$code"
code=$(POST "/api/forum/comments/$C1/delete" '{}' "$JB" "$R")
EQ "delete comment 200" "200" "$code"
code=$(GET "/forum/p/$P1ID" "" "" "$R")
HAS "comment shows deleted" "[deleted]" "$R"

# ---------- 16. search / windows / rss / rules ----------
code=$(GET "/forum/search?q=noodle" "" "" "$R")
EQ "search page 200" "200" "$code"
HAS "search finds post" "$T4" "$R"
code=$(GET "/forum/search?q=black+garter" "" "" "$R")
HAS "search finds venue" "Black Garter" "$R"
for t in today week month year all; do
  GET "/forum/all?sort=top&t=$t" "" "" "$R"
  EQ "all window $t" "200" "$code"
done
code=$(GET "/forum/all" "" "" "$R")
HAS "all default has week tabs" "Week" "$R"
code=$(curl -s -m 30 -o "$R" -w '%{http_code}' "$B/forum/all.rss")
EQ "rss 200" "200" "$code"
HAS "rss is xml" "<?xml" "$R"
HAS "rss has post" "$T1" "$R"
code=$(GET "/forum/rules" "" "" "$R")
EQ "rules 200" "200" "$code"
HAS "rules mentions 18" "18" "$R"
code=$(GET "/forum/login" "" "" "$R")
EQ "login page 200" "200" "$code"
NOHAS "google hidden without client id" "data-gsi" "$R"
HAS "join form present" "over18" "$R"

# ---------- 17. xss ----------
code=$(GET "/forum/p/$P5ID" "" "" "$R")
EQ "xss post page 200" "200" "$code"
NOHAS "no raw script tag" "<script>alert(1)" "$R"
NOHAS "no raw img onerror tag" "<img src=x" "$R"
HAS "script escaped" "&lt;script&gt;" "$R"
code=$(GET "/api/forum/posts?sort=new&board=general" "" "" "$R")
NOHAS "feed escaped too" "<script>alert(1)" "$R"

# ---------- 18. settings ----------
code=$(POST /api/forum/settings/password "{\"old\":\"$PW\",\"password\":\"$PW2\"}" "$JA" "$R")
EQ "change password" "200" "$code"
code=$(POST /api/forum/login "{\"username\":\"$ALICE\",\"password\":\"$PW2\"}" "$JA" "$R")
EQ "login with new password" "200" "$code"
code=$(POST /api/forum/settings/email "{\"email\":\"$ALICE@example.com\"}" "$JA" "$R")
EQ "set email" "200" "$code"

# ---------- 19. 404s / deletes ----------
code=$(GET "/forum/p/999999-nope" "" "" "$R")
EQ "missing post 404" "404" "$code"
code=$(GET "/forum/p/$P1ID" "" "" "$R")
EQ "permalink without slug 200" "200" "$code"
code=$(GET "/forum/b/nope" "" "" "$R")
EQ "missing board 404" "404" "$code"
code=$(GET "/api/forum/nope" "" "" "$R")
EQ "api 404" "404" "$code"
code=$(POST "/api/forum/posts/$P5ID/delete" '{}' "$JA" "$R")
EQ "delete own post" "200" "$code"
code=$(GET "/forum/p/$P5ID" "" "" "$R")
EQ "deleted post 404" "404" "$code"

# ---------- 20. delete account ----------
code=$(POST /api/forum/settings/delete "{\"confirm\":true,\"password\":\"$PW2\"}" "$JA" "$R")
EQ "delete account" "200" "$code"
code=$(GET /api/forum/me "" "$JA" "$R")
EQ "me after delete null" "" "$(JGET member.u "$R")"
code=$(POST /api/forum/login "{\"username\":\"$ALICE\",\"password\":\"$PW2\"}" "$JA" "$R")
EQ "deleted account cannot login" "401" "$code"

echo
echo "==================== SUMMARY ===================="
echo "suffix: $S  (alice=$ALICE bob=$BOB carol=$CAROL dave=$DAVE eve=$EVE)"
if [ "$FAILED" -eq 0 ]; then echo "ALL PASS"; else echo "FAILURES: $FAILED"; fi
exit "$FAILED"
