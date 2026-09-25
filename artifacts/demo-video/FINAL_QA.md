# Final QA (v2)

Film: `Kerb_OKX_Dev_Day_Demo_MASTER.mp4` (submission master) and `Kerb_OKX_Dev_Day_Demo_WEB.mp4`. Checked 25 Sep 2026, 18:25 UTC. v2 replaces v1 (release `demo-film-v1`) after the operator's review.

## What changed from v1, and why

| v1 problem (operator review) | v2 answer |
|---|---|
| The opening cut three times in 14 s between pages | The first 14 s is one designed shot: a UTC day drawn on the Kerb fog plate. A token lane runs all day while New York and Hong Kong open and close; the closes cut through every lane. Then the Kerb lockup and the category line, and the product window rises. No page cuts before the Board |
| Constant zoom-ins on page screenshots | The page is never zoomed. Every recording plays at one fixed size inside a browser window. Emphasis comes from lift-out cards: the region of the live page rises in place, or moves to centre, over a dimmed page |
| The page looked cropped out and plain | The window sits on Kerb's own art (the p5 fog plate), with a URL bar showing the real route, a soft shadow and rounded corners. The close pushes through the window into the Kerbstone arch |
| Too many cuts overall | 29 takes in 3:27 (v1: 46 shots in 3:20). Changes of page inside the window are 0.45 s dissolves; wallet confirmations are hard cuts, as they should be |
| Loose sync | Every take, card, tag and graphic is placed on a spoken word, using the ASR word timings of the narration. Narration clips are cut at word boundaries and placed per sentence |

## Technical

| Check | Result |
|---|---|
| Runtime | 3:26.6 (206.62 s, 6,199 frames). Inside 2:00 to 4:00; 8.6 s over the 3:18 target |
| Video | 1920x1080, 30 fps CFR, H.264 High, yuv420p, BT.709, fast start |
| Audio | AAC 48 kHz stereo, 320 kb/s (web 160 kb/s) |
| Loudness | -14.0 LUFS integrated, LRA 3.4 LU, true peak -1.6 dBTP |
| Black | Only the 0.4 s fade in and the fade out |
| Pops | Frame-difference scan of all 6,199 frames: remaining steps are the Last Call flip (intended), the cut between the two wallet confirmations (intended) and a scroll inside the live recording at 1:38 |
| Sync | Last Call impact found in the mix 4 ms after the flip frame (95.587 s); Cure tone 4 ms after the "Done" frame (114.867 s) |
| Speech | ASR of the finished mix: 96.6% word match with the script, every difference a spelling (C1, x4 02, 10) |
| `qa-render.mjs` | No issues, both files |

## Gates

**A Comprehension, B Hero, C Truth, G, I, J:** as in v1, all pass. The hero keeps real time from the countdown through the flip, and the curable row is shown lifted with its two tags (above its Carry target, only the excess is due), the curer and borrower addresses, the bonus, the wallet confirmation, "Cured kKOx", the OKLink receipt and the row back at its Carry target with the kKOx liquidation line fixed.

**C Truth, detail.** The opening graphic is conceptual and says so by being a diagram: it shows a UTC day with New York's regular session (13:30 to 20:00 UTC) and Hong Kong's two sessions (01:30 to 04:00, 05:00 to 08:00 UTC). The KTS rail and the proof strip carry no numbers. Every figure on screen is captured UI; cards are crops of the live frame, never redrawn.

**D Visual.** Page scale is constant (1568 px wide, 0.92 of the recording). Cards scale a crop up to 2.45x (the countdown) with bicubic filtering. The white OKLink page appears only as a small window on the dimmed page.

**E Motion.** One family: window, cards, leader tags, seams. Cubic easing, 0.35 to 0.6 s. One high-energy moment (the Last Call seam with a brief warm lift of the backdrop).

**F Audio.** As v1. The narration is the same set of takes, now cut per sentence.

**H Three modes.** Muted: full-film contact sheets at 2.5 s reviewed; the story reads without sound. Audio only: the ASR transcript is a complete account. Normal: sync measured.

## Not done

Listening on headphones and laptop speakers: this environment has no playback. The operator should listen once before submitting.
