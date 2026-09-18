# SUBMISSION.md
## Everything that goes into the OKX Dev Day form, and the final-day runbook

Form: https://forms.gle/81S2gnFCzqSoeDEA7
Deadline: **25 Sep 2026, 23:59 UTC**. Internal target: **18:00 UTC**.

---

## 1. Form answers (paste-ready, verify every number on the day)

**Team name.** Xyndicate Labs

**Project name.** Kerb

**Primary track.** Build a Market

**Participation route.** Decide by 24 Sep. See `KERB-MASTER-PLAN.md` section 11. Whichever you pick, do not describe the other one anywhere in the submission.

**Project summary (product, intended user, core integration).**

> Kerb is a session-aware credit market for tokenized securities on X Layer.
>
> Tokenized equities trade around the clock. Their liquidation conditions do not stay constant around the clock: the underlying market opens and closes on its own calendar, reference coverage runs on a 24/5 clock, and executable onchain depth moves hour by hour. Lending protocols in production treat all of those moments as identical collateral, and size credit against a price rather than against an exit.
>
> Kerb measures the difference and lends on it. A deterministic engine reads each asset's underlying market session, walks the real Uniswap V3 pools on X Layer tick by tick to compute executable depth and price impact, builds a conservative Credit Mark, and publishes credit terms onchain under the Kerb Terms Standard: a Carry capacity that survives the next weaker regime unattended, a higher Session Max capacity for the current regime, and a debt ceiling capped by what the market could actually absorb. Never lend more than you can liquidate.
>
> Borrowers pick one of two modes. Carry positions are never disturbed. Session Max positions precommit to Last Call: before the next material liquidity transition, the position returns to its Carry target by repayment, added collateral, or a partial cure executed while liquidity is still deep. The liquidation threshold itself is fixed and timelocked, so sessions move borrowing capacity, never the line under a live borrower.
>
> Intended users: holders of tokenized equities on X Layer who want credit without selling; USDG lenders who want collateral with a published exit path; and, through the same onchain Terms, other lenders, curators and venue operators who would otherwise rebuild equity market risk logic themselves.
>
> Core integration: X Layer mainnet contracts (KerbClock, KerbTerms) publishing signed, reproducible terms for ten live tokenized equity pools, USDG as the loan asset, ERC-8021 Builder Code attribution on every Kerb transaction, and the Kerb Credit market with the full borrow, Last Call, cure and liquidation lifecycle. Every published number carries provenance and can be recomputed from its pinned input bundle.

**Repository.** `https://github.com/talk2francis/kerb` (public, README complete, `BUILD_PERIOD.md` showing build-period work)

**Demo video.** 2 to 4 minutes, per `DEMO.md`. Unlisted or public link that works logged out.

**Product link.** The deployed app. The Board must be reachable with no wallet and no account.

**Declaration.** Read it, then tick it.

---

## 2. README skeleton (D7)

```
# Kerb
### Credit on the market's clock

[one-line thesis]
[Board screenshot, real data, timestamp visible]

## What it does
Five lines. Session -> depth -> mark -> terms -> credit. Carry vs Session Max. Last Call and cure.

## Why it exists
Three lines. Tokenized equities trade 24/7. Liquidation conditions do not. Never lend more than you can liquidate.

## Deployments
| Contract | Network | Address | Explorer |
KerbClock / KerbTerms on X Layer mainnet (196)
KerbClock / KerbTerms / KerbCredit / KerbMirror on X Layer testnet (1952)
Loan asset: USDG mainnet 0x4ae46a509F6b1D9056937BA4500cb143933D2dc8, testnet 0xF0863D7A29a55d0c4263c11bFac754312ff078DF

## The Kerb Terms Standard
Link to KTS-0.1.md. One paragraph on reproducibility, with the verify command.

## Run it locally
Prereqs, env, pnpm install, pnpm dev, forge test.

## Tests
Counts and what they cover, including the clock equivalence fuzz and the credit invariants.

## Built during the official build period
Link to BUILD_PERIOD.md and the commit history.

## Limitations
Credit plane is testnet with mirror collateral because the production tokenized asset is not available in the builder's jurisdiction.
Unaudited. Guarded parameters. Single attester with onchain guardrails. Degradation rungs currently in force.

## Attribution
Open-source libraries used, and the data sources with their licences.
```

---

## 3. Proof checklist before submitting

- [ ] Every contract address on `/proof` opens on OKLink and shows verified source
- [ ] At least one mainnet `TermsPosted` transaction from the last hour
- [ ] Builder Code decoded from a real transaction and displayed
- [ ] A report's input bundle opens from the page, and `kerb verify` on it returns no diff
- [ ] Board loads logged out, on mobile, on a different network
- [ ] `/reports/1` published with measured campaign-end numbers
- [ ] Test counts on `/proof` match a fresh CI run
- [ ] Limitations section names: testnet credit, mirror collateral, jurisdiction, unaudited, current degradation rungs
- [ ] No `.env`, key, or secret anywhere in git history (run a scan over the full history, not just HEAD)
- [ ] Video plays logged out and is between 2:00 and 4:00
- [ ] Repo is public and the README renders correctly on GitHub

---

## 4. Final-day runbook (25 Sep)

| Time (UTC) | Action |
|---|---|
| 08:00 | Health check: collector gap, attester last post, API latency, both explorers |
| 09:00 | Cold verification of every link from a logged-out browser |
| 10:00 | Secret scan over full history, tag `submission-2026-09-25`, push |
| 11:00 | Final README and `/proof` pass, screenshots refreshed |
| 12:00 | Watch the Friday Last Call window on a live asset if the calendar puts one inside today; if it lands, capture it and link it, do not rebuild anything for it |
| 14:00 | Fill the form in a document first, re-read it once, check every link inside it |
| 16:00 | Submit |
| 17:00 | Confirm the receipt email, save it, post the project link in the builder Telegram |
| 18:00 | Buffer. If anything failed, this is the hour to fix and resubmit if the form allows |
| After | Leave the collector and attester running. The record continuing past submission is itself evidence |

---

## 5. If asked for a one-paragraph description elsewhere

> Kerb is a session-aware credit market for tokenized securities on X Layer. It converts each asset's underlying market session, conservative valuation and measured onchain exit liquidity into reproducible credit terms published onchain, then lends against them, capping total debt by what the market could actually liquidate. Borrowers choose conservative Carry credit or higher Session Max credit that precommits to a partial cure before liquidity weakens. Kerb Credit is the first consumer of Kerb Terms, which is built to become the market-time risk layer other lenders and venue operators read instead of rebuilding.

---

## 6. After the hackathon, whatever the result

1. Keep the collector running. The dataset is the company.
2. Publish a Market-Time Report every week, measured only.
3. Open-source KTS properly with a spec repo and a versioned changelog.
4. Approach one lender or curator and one Exchange OS venue operator with the Terms feed, not with a pitch deck.
5. Only then decide whether Kerb Credit should carry real money, and only behind an audit.
