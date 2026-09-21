# V2-DEMO.md
## The submission video (Remote route) and the final-day runbook

You are on the Remote route. The video is the pitch. It must show a working product, real transactions and the thesis, in 2 to 4 minutes. Target **3:10**. Hard ceiling 3:45.

---

## 1. When to film (real events you can catch)

| Shot | Best window (UTC) | Why |
|---|---|---|
| Board with Hong Kong names in Last Call | Weekdays 07:00 to 08:00 (before the HKEX close) or 03:30 to 04:00 (before lunch) | Live Last Call on real mainnet terms, no simulation |
| Campaign end B-roll | Thu 24 Sep 06:50 to 07:15 | The X Liquidity incentives end at 07:00; record the Board and one asset page across it, even if you do not use it |
| Credit hero (Session Max, Last Call, cure) | Any hour, timed to the demo clock | `KerbClockDemo` runs one trading week per hour; check the demo rail countdown and start the take about 4 minutes before its Last Call |
| Proof and terminal verify | Any time | Use a report posted in the last hour |

Lagos is UTC+1, so the Hong Kong Last Call is 08:00 to 09:00 your time.

---

## 2. Setup

- Browser: clean profile, 1440 × 900 viewport, zoom 100%, bookmarks bar hidden, no extensions except the wallet, OS notifications off.
- Theme: Night for the product takes; one Day glimpse on Research is allowed.
- Wallet: a fresh X Layer testnet wallet with test OKB, faucet collateral and mUSDG already minted for the take (a second profile holds a pre-opened Session Max position as backup).
- Recorder: Screen Studio or OBS, 60 fps, cursor highlight on, click sounds off.
- Terminal: large font, dark, with `pnpm --filter @kerb/engine kerb verify <hash>` ready.
- Audio: your voice, close mic, quiet room; or captions-only with a low ambient bed. Burn captions in either way.

---

## 3. Script

Spoken lines are written the way they should sound. Keep them short. Nothing on screen may contradict the words.

**0:00 to 0:10. Home hero, Night.** Slow push on the headline, clocks ticking.
> "Tokenized stocks trade on X Layer around the clock. The markets behind them don't."

**0:10 to 0:28. Home lanes rail, then the Board.** Cursor rests on the Hong Kong lane in Last Call, then the Board's Last Call rows.
> "Every stock keeps its own hours. Right now Hong Kong is minutes from its close, and New York hasn't opened. Kerb reads each asset's clock and the liquidity that's actually in its pool."

**0:28 to 0:52. Asset page, HKEXCx.** Liquidity tab: the impact curve. Then the LTV ladder and the terms history chart with regime bands.
> "Kerb walks the real Uniswap pool on X Layer tick by tick to measure what you could sell at one percent impact. That becomes credit terms, posted on chain every few minutes. Carry is sized to survive until the next deep market. Session Max gives you more now, if you agree to cure before the market weakens."

If KTS-0.2 is live, add while the chart is on screen:
> "Watch the lines. Before a long close, Carry tightens and Session Max doesn't."

**0:52 to 1:52. Credit, the hero.** On-screen caption for the first 4 seconds: "Credit plane on X Layer testnet with mirror collateral. Risk terms from mainnet."
> "Here's the market. I'll borrow at Session Max."

Select Session Max, show the extra borrowing power and the cure deadline, sign, confirmed toast with the OKLink link.
> "The demo clock runs a trading week every hour, so you can watch a Last Call happen."

Demo rail approaches the brass window. The position panel takes over: LAST CALL, the cure amount, the deadline.
> "Last Call. The position has to come back to its Carry target. I can repay, add collateral, or anyone can cure it for a small bonus. Only the difference, not the whole loan."

Press Cure. TxStepper runs. Panel resolves to READY TO CARRY with the timeline.
> "Cured, while liquidity is still there. And the liquidation line never moved."

**1:52 to 2:18. Research.** Report #1 headline numbers, then Report #2's before and after.
> "We measured this for real. Over one closed weekend, seven of ten pools lost in-range liquidity, one by forty-nine percent. When the incentive campaign ended on Thursday, [say what Report #2 actually shows]."

**2:18 to 2:42. Proof.** Status tiles, one Terms transaction on OKLink with the Builder Code decoded, then the terminal verify output.
> "Everything here is checkable. Kerb's clock and terms contracts are on X Layer mainnet, every post carries our Builder Code, and any number recomputes from its published inputs."

**2:42 to 2:56. Developers.** The SDK tab with the live response.
> "Any lender, venue or agent on X Layer can read these terms in one call."

**2:56 to 3:10. Back to the Home hero.**
> "Most protocols ask what an asset is worth. Kerb asks whether you could liquidate it when you need to. Credit on the market's clock."

End card: wordmark, usekerb.xyz, github.com/Franlinozz/Kerb.

---

## 4. Rules for the edit

- Real footage only. Speed up waiting (block confirmation, demo clock) with a visible "2× speed" tag, never cut a failure out and splice a success in.
- Zoom into the number being spoken about. No zoom longer than 3 seconds.
- One caption line at a time, 2 lines maximum.
- No music under speech, or a very quiet ambient bed.
- Export 1080p H.264, under 200 MB. Upload unlisted to YouTube and keep a Google Drive copy. Test playback logged out.

## 5. Fallbacks

| Risk | Fallback |
|---|---|
| No Hong Kong Last Call in your recording slot | Use the Thursday B-roll, or show the Board with the next Last Call countdown and say when it opens |
| Demo Last Call missed | Wait for the next cycle (under an hour), or use the backup profile's pre-opened position |
| RPC slow | Keep recording; speed-tag the wait |
| KTS-0.2 not live | Drop the "watch the lines" sentence; nothing else changes |
| Report #2 shows no depth change | Say so plainly; "the incentives ended and depth held" is still a measured result |

---

## 6. Final-day runbook (Fri 25 Sep, UTC)

| Time | Action |
|---|---|
| 06:30 | Health: collector gap, last posts on both chains, API latency, site on apex |
| 07:00 to 08:00 | Film the Board and asset takes during the Hong Kong Last Call |
| 08:00 to 10:00 | Film Credit, Research, Proof, Developers; retakes |
| 10:00 to 13:00 | Edit, captions, export, upload, logged-out playback test |
| 13:00 | README final pass with the video link; CI green |
| 14:00 | Cold check of every link from another network |
| 15:00 | Fill the form in a document first; check every link inside it |
| 16:00 | Submit. Save the receipt to `docs/release/` |
| 16:30 | Post the link in the builder Telegram |
| 18:00 | Buffer ends. If anything failed, fix and resubmit if the form allows |
| After | Leave the collector, attester and keeper running |

## 7. Form text (update numbers on the day)

**Project summary.**

> Kerb is a session-aware credit market for tokenized stocks on X Layer.
>
> Tokenized equities trade around the clock, but the conditions you would have to liquidate them in change hour by hour: each underlying market opens, breaks and closes on its own calendar, and executable depth in X Layer pools moves with it. Kerb measures that directly. It walks the real Uniswap V3 pools tick by tick to compute what could be sold at 1% impact, builds a conservative Credit Mark, and posts reproducible credit terms on X Layer mainnet under the open Kerb Terms Standard, capping total debt by what the market could actually absorb.
>
> Borrowers choose Carry, sized to survive the next weaker market unattended, or Session Max, which gives more credit now and precommits to Last Call: a partial cure back to the Carry target before liquidity weakens. The liquidation threshold is fixed and never moves with the session.
>
> Core integration: KerbClock and KerbTerms on X Layer mainnet posting signed terms for ten live xStocks pools with ERC-8021 Builder Code attribution, debt capacity denominated in USDG, and the full borrow, Last Call and cure lifecycle in Kerb Credit on X Layer testnet with mirror collateral. Every number links to the inputs that produced it and recomputes from them.

**Repository:** https://github.com/Franlinozz/Kerb
**Product:** https://usekerb.xyz
**Video:** your unlisted link
**Track:** Build a Market. **Route:** Remote Build.
