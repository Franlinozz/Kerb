# Demo verification

Each step of the video script in `docs/v2/V2-DEMO.md`, what the screen must show, whether it has
been exercised on the release build, and the fallback. "Tested" means run on staging (the build
cut over to www.usekerb.xyz) by the E2E suite or the real browser flow on 22 Sep 2026.

| Time | Step | Expected on screen | Tested | Fallback |
|---|---|---|---|---|
| 0:00 | Home hero, Night | Headline, the arch, ticking clocks, live callouts with real C(1%) | Yes: E2E home, screenshots `final-22sep/home` | Day theme is also approved art |
| 0:10 | Lanes rail, then the Board | Both markets on one clock; Board rows with regime pills, countdowns | Yes: rail transition E2E, board filter, sort, row click | If Hong Kong is not in Last Call, show the countdown to it and say when |
| 0:28 | Asset page, HKEXCx | Impact curve with hover points, LTV ladder with margin line, terms history with regime bands | Yes: asset tabs E2E | Any asset works; KOx shows the clearest 0.2 step at a close |
| 0:52 | Credit, Session Max borrow | Caption; Session Max card with the extra amount and cure deadline; TxStepper approve then borrow; toast with OKLink | Yes: four real browser runs (one keyboard only, one in Day); gas padding fixed after two out-of-gas sends | Pre-mint in the take profile; a backup profile with a position already open |
| 1:20 | Demo rail reaches Last Call | Brass window; the position panel turns to LAST CALL with amount and deadline | Yes: on every run the panel took over when the window opened | Next cycle is under an hour away |
| 1:35 | Cure from Curable now | Row with Cure; stepper; panel shows the cure happened (a few cents of interest may remain curable, and the panel says so) | Yes: cures `0xa38cab22...`, and three more runs | Cure from the second profile; or repay from the borrower |
| 1:52 | Research | Report #1 numbers; Report #2 before and after | #1 yes; #2 generates Thu 24 Sep from the captures | If depth held, say so; that is the measured result |
| 2:18 | Proof and terminal verify | Status tiles; Builder Code per row; Recompute tile; terminal `kerb verify` output | Yes: E2E proof, live recompute tile | Use any post from the last hour |
| 2:42 | Developers | SDK tab with a live response | Yes: E2E each tab shows a live response | REST tab |
| 2:56 | Home, end card | Wordmark, usekerb.xyz, the repo | Yes | |

Browser profile for the take: 1440 x 900, zoom 100%, Night, no extensions but the wallet, a fresh
X Layer testnet wallet with test OKB; kKOx and mUSDG minted beforehand in the Credit setup steps.
Start the Credit take about four minutes before the demo Last Call shown on the rail.
