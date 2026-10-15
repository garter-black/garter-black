# REPORT · directory · Sydney brothels dataset

Task: tasks/TASK-directory.md (worker: Umbra build worker, 2026-10-02). Output: `data/brothels.json` + this report. Nothing deployed.

## What was built

- `data/brothels.json`: UTF-8 JSON array, **149 venues** of Greater Sydney, sorted by suburb then name.
- Record fields: name, suburb, address, phone, website, hours, type (brothel|parlour), notes (neutral, max 140 chars), status, confidence, sources, verified_at 2026-10-02.
- The Black Garter record included exactly as specified in the brief.
- Deduplicated on name/address/phone; merged duplicate identities (see Decisions).

## Counts

- Total: 149
- status: open 137 · closed 7 · unverified 5
- confidence: high 106 · medium 40 · low 3
- type: brothel 111 · parlour 38
- suburbs covered: 84
- closed: Blacktown 8, At 7 Clyde, Alice's Massage, Lucky 10, 244 Paddington, 1 Nirvana, Luxury 359
- unverified: 295 Ashfield, Honey Cherry, Chatswood 350, Crystal Rose, 36 Kings Cross

## Regions covered

- **City and inner** (56): Alexandria, Annandale, Ashfield, Burwood, Camperdown, Chippendale, Croydon, Darlinghurst, Five Dock, Glebe, Haymarket, Leichhardt, Marrickville, Newtown, Paddington, Petersham, Potts Point, Pyrmont, Redfern, Rushcutters Bay, Strathfield South, Surry Hills, Sydney, Waterloo, Woolloomooloo
- **East** (6): Bondi Junction, Kingsford, Mascot, Miranda, Rosebery, St Peters
- **South** (12): Blakehurst, Caringbah, Carlton, Kogarah, Mortdale, Narwee, Peakhurst, Riverwood, Rockdale, Taren Point
- **South west** (17): Banksia, Bankstown, Campbelltown, Campsie, Canterbury, Greenacre, Ingleburn, Liverpool, Moorebank, Narellan, Villawood
- **West and Parramatta** (25): Arndell Park, Auburn, Clyde, Granville, Guildford, Harris Park, Lidcombe, Parramatta, Pendle Hill, Rydalmere, Smithfield, South Granville, Wetherill Park
- **North shore** (15): Artarmon, Chatswood, Crows Nest, Hornsby, North Sydney, North Willoughby, Pymble, Roseville, Willoughby
- **Northern beaches** (5): Balgowlah, Brookvale, Cromer
- **North west** (13): Blacktown, Jamisontown, Kings Park, Kingswood, Penrith, Seven Hills, St Marys

## Gaps

- The Hills Shire proper (Castle Hill, Baulkham Hills, Kellyville, Bella Vista): no verifiable venues found, nearby Seven Hills and Kings Park only.
- Camden LGA (Camden town, Elderslie): no venues found; Narellan rooms are the nearest south west coverage.
- Sutherland Shire: only Caringbah (Secrets of Sydney) and Miranda (555); no Cronulla or Engadine venues found.
- Northern beaches: Brookvale, Balgowlah, Cromer only; no Manly or Dee Why venues with verifiable adult services.
- Campbelltown proper: one venue (Cuties rooms); Ingleburn nearby.
- Inner south (Mascot, Botany, Eastgardens): light coverage; Mascot has two entries.
- Fields left empty where no source states them: phone on 9 records, address on 3, website on 15, hours on 47.

## Method

1. **Discovery**: ~8 search rounds by suburb and region (brothel <suburb>, adult massage <suburb>, closures, news, directories). Forums (aus99 and similar) used only to discover venue names; no forum text, ratings or reviews copied. No Google Maps or Places data used.
2. **Verification**: venue-owned websites fetched directly (web_extract, curl where the extractor was blocked), plus independent business listings (nearbymassage, oceaniabiz, 69honey, a-world, bookwell, brothelnearme, Yellow Pages, nusalist, hot.com) and news where relevant. Wayback Machine snapshots used for venues whose domains no longer resolve.
3. Every URL used is recorded in each record's `sources`. Phones, addresses and hours are only included when a source states them.

## Status policy and edge decisions

- **open** = venue site live today or strong current evidence.
- **closed** = domain no longer resolves or site repurposed, with no recent evidence (Blacktown 8, Lucky 10, 1 Nirvana, 244 Paddington, Luxury 359, Alice's Massage, At 7 Clyde). Notes record the last archive date.
- **unverified** = site offline but recent activity seen (36 Kings Cross, 295 Ashfield, Chatswood 350, Crystal Rose, Honey Cherry).
- **Merged duplicates**: 181 Guildford West + related domain → one '181 Smithfield' record (1/181 McCredie Rd); '7 Villawood' → 'Cuties Escorts (Villawood)' (same address and phone); 'Taylors Gentlemen's Retreat' → 'Xotic 58' (same address and phone); sydneybabymassage.com + sydbabymassage.com → '18 SBM Massage'; sydneygirlmassage.com + sydneymassage110.com.au → 'Sydney Girl Massage'.
- **Kept separate (related but distinct listings)**: 375 Rockdale and Love Hotel Rockdale (same phone, adjacent units 17 and 17A Bermill St); At Michelle's and RPM Sydney (same building, 135 Bayswater Rd); Sydney Empress 69 and Townhall 69 (same building, 69 Liverpool St).
- **Excluded**: strip clubs (Harem, Dollhouse Potts Point, Geanni, Sydney Elements); adult shops (Adult Lifestyle Centre Kogarah, AW Newtown); home-based operators (Lola, Ruby and Friends, Chanel); massage venues without adult services stated (Iris Newtown, Top Ryde, Sylvania, Kogarah Massage, Leumeah, Amora Merrylands, 304 Ashfield, Dee Why, Venus Mosman, Sutherland Massage Centre); out of area (Belmore Beauties listed a Wollongong address).
- **Considered but not included for lack of verifiable fields**: Bondi Ladies (site offline), Vixens 271 (site offline), Blacktown 40 (map/place listings only), 485 Leichhardt (no current source), generic Minto listing, Michelle's Rushcutters Bay (building sold years ago, operation unconfirmed).

## Testing

- JSON round-trip parse via Python (json.load) passed; 149 records, 64,632 bytes.
- Schema assertions: all keys present; status in {open,closed,unverified}; type in {brothel,parlour}; confidence in {high,medium,low}; notes max length 65 chars; sources non-empty; verified_at set.
- Checks: no duplicate name+suburb; shared-phone and shared-address review (only the intentional pairs above); dash scan of notes; forbidden-string scan (previous managers' domain absent).
- Sort verified: first record 'Dream Girl Massage 130' (Alexandria), last 'Sydney Girl Massage' (Woolloomooloo).

## Search queries used

Saved discovery rounds (queries by suburb, region and venue name), 236 entries:

```
- brothel inner west Sydney
- brothel eastern suburbs Sydney
- brothel north shore Sydney
- brothel southern Sydney
- brothel south west Sydney
- brothel western Sydney
- brothel lower north shore Sydney
- brothel Hills district Sydney
- brothel Sutherland shire
- Sydney CBD brothel
- brothel Darlinghurst Sydney
- brothel Surry Hills
- brothel Woolloomooloo
- brothel Potts Point
- brothel Paddington Sydney
- brothel Kings Cross
- brothel Newtown Sydney
- brothel Enmore Sydney
- brothel Marrickville
- brothel Leichhardt
- brothel Ashfield Sydney
- brothel Burwood Sydney
- brothel Strathfield
- brothel Chatswood
- brothel St Leonards Sydney
- brothel Crows Nest Sydney
- brothel North Sydney
- brothel Manly Sydney
- brothel Brookvale
- brothel Dee Why
- brothel Bondi Junction
- brothel Randwick Sydney
- brothel Mascot Sydney
- brothel Botany Sydney
- brothel Kogarah
- brothel Hurstville
- brothel Caringbah
- brothel Miranda Sydney
- brothel Cronulla
- brothel Sutherland Sydney
- brothel Bankstown Sydney
- brothel Fairfield Sydney
- brothel Auburn Sydney
- brothel Lidcombe
- brothel Granville Sydney
- brothel Guildford Sydney
- brothel Merrylands
- brothel Seven Hills Sydney
- brothel Westmead Sydney
- brothel Wentworthville
- brothel Toongabbie Sydney
- brothel Pendle Hill
- brothel Harris Park Sydney
- brothel Rydalmere
- brothel Dundas Sydney
- brothel Carlingford
- brothel Epping Sydney
- brothel Hornsby Sydney
- brothel Castle Hill Sydney
- brothel Baulkham Hills
- brothel Kellyville Sydney
- brothel Rooty Hill
- brothel Mount Druitt
- brothel St Marys Sydney
- brothel Kingswood Sydney
- brothel Emu Plains
- brothel St Clair Sydney
- brothel Quakers Hill
- brothel Riverstone Sydney
- brothel Prospect Sydney
- brothel Smithfield Sydney
- brothel Wetherill Park
- brothel Greystanes
- brothel Fairfield Heights
- brothel Cabramatta
- brothel Canley Heights
- brothel Villawood
- brothel Chester Hill
- brothel Regents Park Sydney
- brothel Berala
- brothel Punchbowl Sydney
- brothel Lakemba
- brothel Campsie Sydney
- brothel Belmore Sydney
- brothel Greenacre Sydney
- brothel Revesby
- brothel Padstow Sydney
- brothel Peakhurst
- brothel Condell Park
- brothel Georges Hall
- brothel Roselands
- brothel Wiley Park
- brothel Neutral Bay Sydney
- brothel Cremorne Sydney
- adult massage Sydney CBD erotic
- adult massage Darlinghurst
- adult massage Surry Hills
- adult massage Newtown Sydney
- adult massage Parramatta
- adult massage Blacktown
- adult massage Penrith
- adult massage Liverpool NSW
- adult massage Chatswood
- adult massage North Sydney
- adult massage Bondi
- adult massage Rockdale
- adult massage Hurstville
- adult massage Bankstown
- adult massage Auburn
- adult massage Granville
- adult massage Merrylands
- adult massage Fairfield
- adult massage Cabramatta
- adult massage Castle Hill
- adult massage Hornsby
- adult massage Manly
- adult massage Brookvale
- adult massage Dee Why
- adult massage Sutherland
- adult massage Miranda
- adult massage Campbelltown
- adult massage Mount Druitt
- adult massage St Marys
- adult massage Epping Sydney
- adult massage Ryde Sydney
- adult massage Burwood Sydney
- adult massage Strathfield
- adult massage Ashfield
- adult massage Enmore
- adult massage Marrickville
- adult massage Leichhardt
- erotic massage Sydney CBD parlour
- Nuru massage Sydney
- Bada Bing Sydney brothel
- Langtrees Sydney brothel
- adult massage Campsie
- adult massage Kogarah
- adult massage Ramsgate
- brothel Penrith high street
- brothel Bondi
- brothel Double Bay
- brothel Edgecliff Sydney
- brothel Rose Bay Sydney
- brothel Coogee Sydney
- brothel Maroubra
- brothel Kingsford Sydney
- brothel Kensington Sydney
- brothel Alexandria Sydney
- brothel Waterloo Sydney
- brothel Rosebery Sydney
- brothel Annandale Sydney
- brothel Glebe Sydney
- brothel Ultimo Sydney
- brothel Pyrmont Sydney
- brothel Balmain Sydney
- brothel Drummoyne
- brothel Rozelle Sydney
- brothel Concord Sydney
- brothel Homebush Sydney
- brothel Croydon Sydney
- brothel Gladesville Sydney
- brothel Lane Cove Sydney
- brothel Mosman Sydney
- brothel Balgowlah
- brothel Mona Vale
- brothel Narrabeen
- brothel Warriewood
- brothel Newport Sydney
- brothel Engadine
- brothel Menai Sydney
- brothel Sylvania Sydney
- brothel Jannali
- brothel Gymea
- brothel Wolli Creek
- brothel Tempe Sydney
- Desires of Penrith brothel
- Sweet Desires Penrith brothel
- Crystal Rose Penrith brothel
- brothel closed Sydney news
- brothel raid Sydney news
- Kings Cross brothel closed
- brothel for sale Sydney news
- Sydney brothels list
- brothel Stanmore Sydney
- brothel Erskineville
- "Upmarket Bathhouse" Crows Nest massage
- "Eden Club" Crows Nest brothel
- "Bondi Ladies" brothel Bondi Junction
- "Blacktown 40" brothel adult
- Jamisontown brothel
- 485 Parramatta Road Leichhardt brothel
- "Taylors Gentlemen's Retreat" Lidcombe
- Mascot Studio massage Rosebery 413 Gardeners
- Pink Pussycat Darlinghurst brothel closed
- Rushcutters Bay brothel sold Australia's best
- brothel Ingleburn
- brothel Minto NSW
- brothel Camden NSW
- brothel Narellan
- Crystal Rose Penrith 361 Edwards
- adult massage Ingleburn
- adult massage Penrith NSW
- Chics of Blacktown East Massage Centre venues
- Syd Massages Auburn Hurstville
- brothel Girraween Sydney
- brothel Kings Park NSW
- adult massage Parramatta erotic
- brothel Smithfield 72
- brothel Pendle Hill 112
- "Blacktown 8" brothel Carnegie Place
- "Ace Club 359" OR "Riley 359" Sydney brothel
- "7 Villawood" brothel Birmingham Ave
- "Sutherland Massage Centre" Gray St Sutherland
- "Lucky 10" Guildford Guernsey St brothel
- "181 Guildford West" OR "181 Smithfield" brothel
- "Sutherland St" Clyde brothel "Unit 7"
- "1 Nirvana" Pendle Hill brothel
- "Alice's Massage" Darlinghurst Oxford Street
- "36 Kings Cross" Darlinghurst Rd brothel
- "295 Ashfield" massage Liverpool Rd
- "244 Paddington" OR "244 Oxford St" Paddington brothel
- "Wives Only" brothel Sydney address
- "327A Riverwood" brothel Forest Road
- "26 George" Granville brothel address
- "Cleopatra's Gentleman's Club" Sydney address brothel
- "Vixens 271" Marrickville brothel
- "Secrets of Sydney" Caringbah 18 Box Rd phone
- "Kyoto 206" Sydney brothel address
- "Chatswood 350" brothel address phone
- "Roseville Rose" brothel 104 Pacific Highway phone
- "Midnight Delight" Parramatta brothel address
- "Campsie 303" OR "Honey at 303" brothel
- "Michelle's" Rushcutters Bay brothel closed sold
- "Blacktown 40" brothel adult services
- "Upmarket Bathhouse" Crows Nest brothel massage
- "Sutherland Massage Centre" Sutherland phone
```

Targeted follow-up queries, 48 entries:

```
- "Blacktown 8" brothel Carnegie Place
- "Ace Club 359" OR "Riley 359" Sydney brothel
- "7 Villawood" brothel Birmingham Ave
- "Sutherland Massage Centre" Gray St
- "Lucky 10" Guildford Guernsey
- "181 Guildford" OR "181 Smithfield" McCredie
- "At 7" OR "Unit 7" Sutherland St Clyde brothel
- "1 Nirvana" Pendle Hill brothel
- "Alice's Massage" Darlinghurst Oxford St
- "36 Kings Cross" Darlinghurst Rd
- "295 Ashfield" massage Liverpool Rd
- "244 Paddington" OR "244 Oxford" brothel
- "Wives Only" brothel address Sydney
- "327A Riverwood" address Forest Rd
- "26 George" Granville brothel address
- "Cleopatra's Gentleman's Club" address
- "Vixens 271" Marrickville
- "Secrets of Sydney" Caringbah phone Box Rd
- "Campsie 303" OR "Honey at 303" brothel
- "Kyoto 206" Sydney brothel address
- "Chatswood 350" brothel address phone
- "Roseville Rose" brothel 104 Pacific Highway phone
- "Midnight Delight" Parramatta brothel address
- "Michelle's" Rushcutters Bay brothel closed sold
- "Blacktown 40" brothel adult services
- "Upmarket Bathhouse" Crows Nest brothel massage
- "12 Cottam" Bankstown brothel
- "19 Lipstick" Rydalmere brothel address
- "Bodyrotic" Sydney erotic massage address
- "Kings Court" massage Glebe Sydney address
- "Peachy Asian Massage" Sydney address
- "Hana's Beauties" Seven Hills address
- Liaisons brothel Sydney address Edgecliff
- "Abby's" boutique brothel Sydney address
- "CBD Youku" massage address
- "Ultimate Relaxation" Ingleburn address
- "Honey Cherry" Jamisontown address
- "Nightshade Establishment" Gladesville address brothel
- "Pendle Hill" brothel "Nirvana"
- "Bellevue 5 Star Retreat" Carlton brothel
- "Club 350" OR "Chatswood 350" Willoughby brothel
- "Eden Club" Crows Nest brothel
- "Bondi Ladies" brothel Bondi Junction
- "Taylors Gentlemen's Retreat" Lidcombe
- brothel Minto NSW
- brothel Camden NSW
- oceaniabiz "Crystal Rose" Penrith 361
- a-world "Roseville Rose" 104 Pacific Highway
```

## Left / next

- Claude reviews and deploys; the forum worker imports `data/brothels.json`.
- Re-check unverified and closed records periodically; several dead-domain venues may operate without a current website.
- Consider adding The Hills and Camden coverage in a future pass with council DA searches.
