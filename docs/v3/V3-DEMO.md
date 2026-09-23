# V3-DEMO.md
## The video is the pitch. Remote, Best Remote Demo, 2 to 4 minutes. Target 3:15.

Principle: **prove more than you explain.** Every claim in the voiceover is on screen at the same moment, live, on a real transaction or a real number. No slides, no generated footage, no staged states.

---

## 1. Filming windows (UTC, Friday 25 Sep)

| Shot | Window | Why |
|---|---|---|
| Cold open: Board with Hong Kong in Last Call | **07:30 to 08:00** (arrive 07:15) | HKEX closes 08:00 UTC; the 30-minute Last Call is live on mainnet terms. Lagos: 08:30 to 09:00 |
| Asset HKEXCx exit check and why | 07:30 to 08:15 | Same moment; after 08:00 the "why" shows the close step |
| Credit hero | Any demo Last Call; times computed in `DEMO_VERIFICATION.md` | The demo clock runs a trading week every hour |
| Agent payment | Any time after "go x402 mainnet" | Real settlement on X Layer |
| KerbQuote cast call | Any time | Mainnet read |
| Proof and verify | Any time | Use a post from the last hour |
| Report #2 | After 07:05 regeneration | Final window |

Backup cold open: Thursday 24 Sep, same window, recorded as B-roll. Second backup: the Hong Kong lunch Last Call, 03:30 to 04:00 UTC.

No production deploys 06:00 to 10:30 UTC.

## 2. Setup

- Screen 1440 × 900 (or 1920 × 1080 at 125%), browser at 100%, clean profile, no bookmarks bar, notifications off.
- Profile A: your borrower wallet on X Layer testnet with test OKB, collateral and mUSDG; a Session Max position opened in the current demo cycle before the take.
- Profile B: a second wallet (the stranger) for the cure.
- Terminal 1: an agent session with Onchain OS logged in, ready to pay for a credit check.
- Terminal 2: `kerb verify <hash>` and the `cast call` to KerbQuote, pre-typed.
- Night theme for everything except one Day glimpse on Research.
- Recorder at 60 fps, cursor highlight on, click sounds off. Record each shot separately; assemble in the edit.

## 3. Script

Lines are written to be spoken. Short. Caption every line.

**0:00 to 0:10, cold open. Board, Hong Kong rows in brass Last Call, countdown ticking.**
> "Hong Kong closes in twelve minutes. These tokens keep trading all weekend. The exit behind them won't."

**0:10 to 0:20, Home hero.**
> "Kerb is the market-time risk layer for tokenized stocks on X Layer. It measures how much you could actually sell, and for how long a loan has to survive, and posts both as credit terms onchain."

**0:20 to 0:50, Asset HKEXCx.** Exit check panel, then "Why these terms", then the Terms history step at the last close with its sentence.
> "Kerb walks the real Uniswap pool on X Layer, tick by tick, and checks it against the OKX DEX quote. The smaller number wins. Carry is sized to survive until the next deep session. Watch the step at every close: the horizon gets longer, so Carry tightens, and Kerb says exactly why."

**0:50 to 1:50, Credit, the hero.** Caption for 4 s: *Credit plane on X Layer testnet, mirror collateral. Risk terms from mainnet.*
> "This position borrowed at Session Max: more credit now, with a promise to cure before the market weakens."

Demo rail reaches the brass window. Your panel takes over: LAST CALL, cure amount, deadline. The standing demo position appears in Curable now.
> "Last Call. The position has to come back to its Carry target. I can repay, or anyone can cure it for a small bonus."

Switch to Profile B. Press Cure. The stepper runs. Speed-tag the confirmation wait if needed. Back to Profile A: READY TO CARRY, with the timeline.
> "A stranger cured only the difference, while liquidity was still there. The liquidation line never moved."

**1:50 to 2:15, Proof.** The cure on OKLink with the Builder Code decoded; then Terminal 2, `kerb verify` printing Matches.
> "Every term is posted on X Layer mainnet with our Builder Code, and anyone can recompute it from its published inputs."

**2:15 to 2:40, Agents.** Terminal 1: the agent calls Kerb Credit Check, gets the 402, pays one cent in USDT0, receives the answer; cut to the settlement on OKLink.
> "Agents can buy the same answer. One cent, paid on X Layer, through OKX.AI. No model in the loop: the numbers come straight from the posted terms, with the hash to check them."

**2:40 to 2:52, Contracts.** Terminal 2: `cast call` to KerbQuote on mainnet returns max borrow.
> "And any contract on X Layer can read it in one call."

**2:52 to 3:05, Research.** Report #2 headline and its bars.
> "When OKX's liquidity incentives ended on Thursday, we measured what happened to every pool. [One sentence: the actual finding.]"

**3:05 to 3:15, Home hero, slow push.**
> "Most lenders ask what collateral is worth. Kerb asks whether you could sell it, and how long you'd have to wait. Credit on the market's clock."

End card (3 s): wordmark, usekerb.xyz, github.com/Franlinozz/Kerb, "Built for OKX Dev Day 2026".

## 4. If something is not ready

| Missing | Replace with |
|---|---|
| OKX.AI listing not approved | Say "registered on OKX.AI" instead of "through OKX.AI"; the x402 payment on X Layer still stands |
| No mainnet agent payment | Testnet settlement with the caption "X Layer testnet"; cut "one cent, paid on X Layer" to "paid over x402" |
| KerbQuote not on mainnet | Drop the contracts beat (12 s) |
| Report #2 shows no change | Say "depth held"; it is a finding |
| Keeper position missing in the take | Your own position is the curable one; Profile B cures it |
| No live Hong Kong Last Call | Thursday B-roll, or the lunch window |

Never splice a success in place of a failure. Speed-tag every wait you shorten ("2×").

## 5. Edit and delivery

- Captions burned in, one line at a time, two lines maximum.
- Zoom into the number being spoken; no zoom longer than 3 s.
- No music under speech, or a very quiet bed.
- Export 1080p H.264, under 200 MB.
- Upload to YouTube as **Public** or **Unlisted** (the form needs a public link), and post natively on X as well. Test playback logged out, in a private window, on a phone.
- Thumbnail: the Home OG image.
- Put the link at the top of the README the moment it exists.
