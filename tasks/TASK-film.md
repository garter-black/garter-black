# TASK · film · HyperFrames hero films for garter.black

Read `tasks/CONVENTIONS.md` first (rules 1 to 4 and 6 apply). HyperFrames (HeyGen, HTML + GSAP to deterministic MP4) is installed on this PC (`%USERPROFILE%\.hyperframes`); if the CLI is not on PATH use `npx hyperframes`. Work in `tasks/film/`. Outputs go to `dist/assets/film/`.

## Source stills (graded venue photos, no people except one figure)
`dist/assets/`: corridor.jpg, room-gold.jpg, black-room.jpg, room-lines.jpg, room-suite.jpg, room-3.jpg, room-7.jpg, stage.jpg, facade.jpg. Look at each one before you use it. NEVER use band-figure.jpg (it carries printed text and an old phone number). black-room.jpg is the hero still: the film should open and close on it.

## Film 1 · `hero-film.mp4` (1080 x 1350, 4:5, 12 s, 30 fps, seamless loop, no audio, no text)
Sits in the hero image panel of every house page. A slow, expensive, nocturnal reel of the house:
- 5 shots: corridor, room-gold, black-room, room-lines, back to corridor (the loop closes on the exact first frame).
- Each shot: very slow push in (scale 1.04 to 1.12) with a gentle lateral drift; 1.2 s cross dissolves through near black.
- Grade: rich black, warm dark metallic gold highlights, no white anywhere (CSS filter around `contrast(1.08) saturate(.8) sepia(.28) brightness(.88)` then tune by eye), soft vignette.
- Light: thin warm gold COB LED lines (1 to 2 px) that sweep across the frame now and then with a travelling hotspot and soft bloom (gradients and drop-shadow), like the strip lighting in the building. One tiny deep red glint (#a8202f) per loop, never more.
- Fine animated film grain (SVG turbulence), subtle.
Film 2 · `band-film.mp4` (1920 x 800, 10 s, seamless loop): the corridor still with a slow forward drift, two gold COB lines receding in perspective, drifting dust motes, the same grade. Used as a full bleed band.

## Encode
H.264, yuv420p, CRF around 26, `-movflags +faststart`, no audio. Each file 3 MB or less (raise CRF if needed). Posters `hero-film.jpg`, `band-film.jpg` (first frame, JPEG quality 82). Also a contact sheet `tasks/film/contact-hero.jpg` and `contact-band.jpg` (frames at 0%, 25%, 50%, 75%, 99% side by side) for review.

## Check before you finish
Open the contact sheets and look at them: no white blow outs, no text, gold and black only with the one red glint, the loop closes cleanly (first and last frame match). Write `tasks/REPORT-film.md` (HyperFrames version and commands, composition files, durations, sizes, anything you could not do) and store the cortex summary.
