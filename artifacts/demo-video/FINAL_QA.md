# Final QA

Film: `Kerb_OKX_Dev_Day_Demo_MASTER.mp4` (submission master) and `Kerb_OKX_Dev_Day_Demo_WEB.mp4` (web copy). Checked 25 Sep 2026, 15:50 UTC.

## Technical

| Check | Result |
|---|---|
| Runtime | 3:20.5 (200.53 s, 6,016 frames). Inside 3:05 to 3:30 |
| Video | 1920x1080, 30 fps CFR, H.264 High, yuv420p, BT.709 tagged, fast start |
| Audio | AAC 48 kHz stereo, 320 kb/s (web 160 kb/s) |
| Loudness | -14.0 LUFS integrated, LRA 3.0 LU, true peak -1.6 dBTP |
| Black frames | Only the 0.13 s fade in and the 1.6 s end card, both intended |
| Chunk seams | Frame differences across the four render seams match their neighbours; no jump or repeat |
| Sync | Last Call impact onset measured at 94.017 s, the exact frame the countdown flips; Cure tone on the "Done" frame (112.82 s) |
| `qa-render.mjs` | No issues, both files |
| Sizes | Master 117.5 MB, web 49.0 MB |

## Gates

**A Comprehension.** Each question has a spoken answer and a matching picture: the problem (0:00 to 0:14), C(1%) (0:31 to 0:50, the depth curve and the exit check), Carry against Session Max (0:50 to 1:08 with the two-horizon rail), Last Call (1:26 onward), what a Cure does (1:36 to 1:58), the fixed line (0:55 rail, 1:04 "never the line", 1:57 "the liquidation line never moved"), mainnet against testnet (Board chapter, Borrow chapter, Last Call tag, close), more than Kerb Credit (2:19 to 2:37), verification (2:02 to 2:19). Pass.

**B Hero.** In order, on real footage from 06: an open Session Max position (the operator's, 1:23), the countdown to "in 0s" and the flip (1:34), "Last Call is open ... no position needs a cure", the curable row with LTV above target and the required repay (1:40), a different wallet (0xc995...a4dc) against the borrower (0xaccd...c0f4) pressing Cure, the OKX Wallet confirmation on X Layer Testnet, "Cured kKOx", the OKLink receipt, and the same row back at 46.3% / 46.3%. The curable position is the demo keeper's standing Session Max position, and the narration never says it is the one borrowed at 1:14. Pass.

**C Truth.** Every figure on screen is captured UI. Overlays are labels, brackets and the conceptual rail, which carries no numbers or times. The Report #2 narration follows the final report shown in the footage (held at the 07:00 cliff; a day later 6 of 10 fell 10% or more, 4 rose). No warning, testnet badge or limitation is covered. Pass.

**D Visual.** Base framing crops only the Chrome bar (the dotted recording border and "Ask Gemini" never appear). No stretch; scaling is uniform, at most 2.1x (the countdown close-up), Lanczos. No notifications. The white OKLink page holds 1.7 s, the only light frame, kept because it is the on-chain receipt. Pass.

**E Motion.** One motif family (seam, rule, bracket) in brand colours. Hard cuts inside chapters, a seam only at chapter boundaries, one dip into Last Call, one fade into the close. No glow, particles, glitch or whooshes. Pass.

**F Audio.** Every narration line was checked by local speech recognition on the finished mix: 94% word match against the script, and every difference is spelling only (xlayer, C1, 10). Acronyms: Kerb as "curb", KTS spoken as the Kerb Terms Standard, "x four oh two", "C one percent". Music sits about 21 dB under speech. Three accents only. Not done: listening on headphones and laptop speakers. This environment has no playback, so the operator should listen once before submitting.

**G Runtime.** 3:20.5. Pass.

**H Three modes.** Muted: reviewed as 2 s contact sheets of the silent rough cut and full-resolution stills of the master; the story reads without sound. Audio only: the ASR transcript of the mix is a coherent account on its own and names no number that is not also on screen. Normal: sync measured on the two state changes.

**I First 30 s.** The problem, the category ("the market-time risk layer for tokenized stocks on X Layer"), the live Home and Board, and the market state. No logo intro. Pass.

**J Final 20 s.** The mainnet and testnet split with "unaudited", no new feature, the thesis, a clean close on the live Home, "Never lend more than you can liquidate." spoken once. Pass.

## Deviations from the pack

- Voice: Adam, not Antoni. Antoni, Sam and Noah are not in the connected ElevenLabs account; Adam is the pack's first fallback.
- Script: tightened for timing and for accuracy. Research lines follow the final Report #2. Segments 06 and 10 were split so the hero beats and the final line land on exact frames.
- Music: the opening of the track is used, except for 3.4 s of near silence between its second and third pieces, which is removed with a 0.3 s crossfade so the bed does not drop out under Proof.
- Runtime 3:20.5 against a 3:18 target, inside the preferred window.
- 06b and 11 unused. One replacement capture: the live Home for the close.
