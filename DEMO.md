# DEMO.md
## The 2 to 4 minute submission video, and the live finale version

Required by the Builder Kit: a 2 to 4 minute video demonstrating the working product and integration. Target **3 minutes 15 seconds**. Record on D7 (24 Sep). Never exceed 3:45.

---

## 1. Rules

- Open on live data, never on a logo or a title card.
- Every screen shown is the real product. No slides except one architecture frame at 2:10, and even that is a screenshot of `/proof`, not a diagram made in Figma.
- Speak in short sentences. One idea per sentence.
- Say the words "Never lend more than you can liquidate" exactly once.
- Never claim a number the screen does not show.
- State the limitations out loud once, in one sentence, near the end. Judges forgive limitations they are told; they punish limitations they discover.
- 1440 wide, dark theme, cursor visible, no music under the voice.

---

## 2. Shot list and script

**0:00 to 0:20 - The Board, live**

Screen: `/board`, full list, Session Strip at the top.

> "This is every tokenized equity with a live pool on X Layer, right now. Coca-Cola is in its regular New York session. HKEX is closed for the day in Hong Kong. And the token for each of them is still trading, twenty four hours a day."

**0:20 to 0:40 - The problem, in one number**

Screen: hover the depth column, then the coverage ratio.

> "Tokenized markets run around the clock. Liquidity does not. This pool can absorb about X thousand dollars at one percent price impact right now. Two hours from now that number is different. Every lending protocol in production treats those two moments as identical collateral."

**0:40 to 1:05 - An asset, and where the numbers come from**

Screen: `/asset/HKEXCx`. Impact curve, mark provenance, next transition.

> "Kerb walks the actual Uniswap V3 pool tick by tick to get that curve. It takes the conservative of the reference price and the pool price for its Credit Mark. Then it converts those into credit terms: how much this collateral can safely support, and how long that number survives."

**1:05 to 1:35 - The product choice**

Screen: `/market`, borrow panel, the two modes side by side.

> "So Kerb asks a borrower one question. How long do you want this loan to survive without touching it. Carry is sized to ride through the next weak session on its own. Session Max gives you more credit now, and you precommit to Last Call."

Click Session Max. Show the cure deadline and the exact cure amount. Sign. Transaction confirms.

**1:35 to 2:10 - Last Call and the cure (the hero moment)**

Screen: testnet with the compressed demo calendar, badged. Countdown running.

> "Here is the transition, accelerated on a demo calendar so you can watch it. Last Call opens. The position is above its Carry target, so it needs a partial cure: two hundred and fourteen dollars, not a liquidation of the whole position, and it happens while liquidity is still deep."

Execute the cure. Position drops to the Carry target. Regime changes to REFERENCE_CLOSED.

> "The loan crosses into the weak session inside terms it can survive. And the liquidation threshold never moved. Sessions move borrowing capacity, never the line under a live borrower."

**2:10 to 2:40 - Proof**

Screen: `/proof`.

> "Every number here is checkable. The Clock and Terms contracts are on X Layer mainnet. Every Terms transaction carries our Builder Code. Each report pins the exact inputs that produced it, and this command recomputes it from those inputs and diffs the result."

Show the `kerb verify` output.

**2:40 to 3:00 - The real event**

Screen: `/reports/1`.

> "On the twenty fourth, the X Layer liquidity campaign on these exact pools ended. Kerb had been measuring them for six days. Here is what happened to executable depth, and here is what our terms did in response. Measured, not predicted."

**3:00 to 3:15 - Limitations and close**

> "To be clear: the credit market runs on X Layer testnet with mirror collateral, because the production asset is not available in my jurisdiction, and nothing here is audited. The risk plane is mainnet and real."

> "Most protocols ask what an asset is worth. Kerb asks whether you could liquidate it when you need to. Credit on the market's clock."

---

## 3. Fallback recordings (capture all of these on D7 before the final take)

| Risk | Fallback |
|---|---|
| RPC slow during the take | Pre-recorded clip of each transaction confirming, cut in |
| Cure window timing missed | Demo-calendar run recorded twice, at different hours |
| A source goes down mid-take | The stale-source state is itself a good shot; use it and say one sentence about it |
| Live board empty | Screenshot sequence from a healthy moment with the timestamp visible |
| Video over four minutes | Cut the asset page segment to 15 seconds; never cut the cure |

---

## 4. The live finale version (3 to 5 minutes, if in-person)

Same spine, two changes:

1. Open with whatever regime is actually live on stage, and say it out loud. If the US is in its overnight session during the pitch, that is the opening line and it lands harder than anything scripted.
2. End on the company, not the demo: Kerb Credit is the first consumer of Kerb Terms, the terms are readable by any contract on X Layer, and every Exchange OS venue listing a tokenized equity needs exactly this. Then the closing line.

Prepare for these questions:
- "Why not just use a lower LTV all the time?" Because that is a permanent tax on every borrower to insure against a condition that exists a third of the time, and it still does not cap debt by exit capacity.
- "What if the pool is manipulated?" Credit Mark takes the conservative of reference and pool, dispersion beyond tolerance forces STALE, and STALE stops new borrowing rather than triggering liquidations.
- "What happens when markets go 24/7?" THIN is a regime. Calendar is one input of three. The product improves, it does not expire.
- "Who runs the attester?" Today, one key that holds no funds, bounded by onchain guardrails, tighten-fast and loosen-slow. Next: multiple attesters and Chainlink verification inside the open sessions.
- "How is this a business?" Reserve factor on the credit market, then Terms history and integrations, then risk operations for venues. Never a cut of liquidation penalties.
