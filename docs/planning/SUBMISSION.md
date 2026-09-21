# SUBMISSION.md
## Everything that goes into the OKX Dev Day form, and the final-day runbook

Form: https://forms.gle/81S2gnFCzqSoeDEA7
Deadline: **25 Sep 2026, 23:59 UTC**. Internal target: **18:00 UTC**.

---

## 1. Form answers (paste-ready, verify every number on the day)

**Team name.** Xyndicate Labs

**Project name.** Kerb

**Primary track.** Build a Market

**Participation route.** **Remote.** Nothing in the submission should describe in-person attendance.

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

**Repository.** `https://github.com/Franlinozz/Kerb` — **currently private, must be made public before submitting.** README complete, `BUILD_PERIOD.md` shows day-by-day build-period work, full history scanned clean of secrets.

**Demo video.** 2 to 4 minutes, per `docs/v2/V2-DEMO.md`. Unlisted or public link that works logged out.

**Product link.** `https://www.usekerb.xyz` — the Board, the Market, the Methodology, Market-Time Report #1 and the Proof page all load with no wallet and no account. Public API at `https://api.usekerb.xyz`.

> **Open item:** the apex `usekerb.xyz` has no A record. `www` and `api` resolve. Either add an A record for `@` pointing at 62.171.182.75, or submit the `www` URL.

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
| Contract | Network | Address |
|---|---|---|
| KerbClock | X Layer mainnet 196 | 0xf765d374e0ce576860a463f0d796ad45c62161b8 (Sourcify exact match) |
| KerbTerms | X Layer mainnet 196 | 0x6d6eaf24c498df6cef0954f6d19ab4ea7b0102d5 (Sourcify exact match) |
| KerbClock | X Layer testnet 1952 | 0x6c1de992e3219980138d7e51b67ecc523618bc5c (Sourcify exact match) |
| KerbTerms | X Layer testnet 1952 | 0x5a4942f55e37994370745ef984a21321edb75f7e (Sourcify exact match) |
| KerbCredit | X Layer testnet 1952 | 0xa1314645cd6c07e651359aba540e2600090b98a8 |
| KerbClockDemo | X Layer testnet 1952 | 0xd2483b2d8bd759f87fadb21117498a5db36bcb0f |
| kKOx mirror | X Layer testnet 1952 | 0x11827f0f59d516e3778951fde36bd0d961af4a16 |
| kHKEXCx mirror | X Layer testnet 1952 | 0x80da4036ee45e6d66a27dba415a4ce23eb9360f2 |
| MockUSDG (testnet loan asset) | X Layer testnet 1952 | 0x91fcf99262214c32f6fe342d94c7b0dfb2dba679 |

Loan asset: USDG mainnet 0x4ae46a509F6b1D9056937BA4500cb143933D2dc8. On testnet the real Paxos USDG
(0xF0863D7A29a55d0c4263c11bFac754312ff078DF) has a permissioned mint and no faucet, so it cannot be obtained;
`MockUSDG` stands in and says so in its own name.

Builder Code: `kt0hl6xyhlx8xmt`, ERC-8021 suffix on every Kerb transaction, decodable from mainnet calldata.

## The Kerb Terms Standard
Link to docs/KTS-0.1.md. One paragraph on reproducibility, with the verify command.

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

## 2b. Status as of 21 Sep

| Item | State |
|---|---|
| Mainnet risk plane | LIVE, posting all ten assets every 5 minutes |
| Testnet credit plane | LIVE, full lifecycle executed on chain including a permissionless cure |
| Web | LIVE at www.usekerb.xyz: Board, Market, Methodology, Reports, Proof |
| API | LIVE at api.usekerb.xyz |
| Tests | 494 TypeScript, 106 Solidity, all green |
| Slither | 67 results, none High, every one dispositioned in SECURITY.md |
| IPFS pinning | live; `kerb verify <inputsHash>` reproduces the posted terms from the pinned bundle |
| Market-Time Report #1 | published at /reports/1 from 35,130 measured readings |
| Demo video | not recorded — final-stage item |
| Repo public | not yet — approved, to be flipped before submitting |
| Apex DNS | missing — operator action |

---

## 3. Proof checklist before submitting

- [ ] Every contract address on `/proof` opens on OKLink and shows verified source
- [ ] At least one mainnet `TermsPosted` transaction from the last hour
- [ ] Builder Code decoded from a real transaction and displayed
- [ ] A report's input bundle opens from the page, and `kerb verify` on it returns no diff
- [ ] Board loads logged out, on mobile, on a different network
- [x] `/reports/1` published with measured numbers (regenerate on the day so the window ends at submission)
- [ ] Test counts on `/proof` match a fresh run of `./scripts/test-report.sh`
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
