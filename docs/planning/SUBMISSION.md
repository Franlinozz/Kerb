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

> **Kerb is the market-time risk layer for tokenized stocks on X Layer.**
>
> **Product.** Tokenized stocks trade 24/7; their exit does not. Kerb walks the real Uniswap V3 pools on X Layer tick by tick, cross-checked against OKX DEX quotes, to measure how much could actually be sold, reads each stock's own market clock, and posts credit terms on X Layer mainnet every few minutes: Carry, sized to survive until the next deep market; Session Max, more now with a promise to cure at Last Call; a debt ceiling capped by measured depth. Every term recomputes from its published inputs.
>
> **Users.** Tokenized-stock holders who want credit without selling; lenders and curators who need exit-aware limits; agents that need a verifiable answer before taking risk.
>
> **Core integration.** KerbClock and KerbTerms on X Layer mainnet with ERC-8021 Builder Codes; Kerb Credit (borrow, Last Call, permissionless cure) on X Layer testnet; KerbQuote, a read adapter any X Layer contract can call; and paid credit checks for agents via x402 on X Layer, settled in USDT0 on mainnet.

About 150 words (docs/v3/V3-POSITIONING.md section 6). On the morning of 25 Sep, pick the bracket that is true and drop any sentence whose evidence is not yet in docs/release/CLAIM_EVIDENCE.md. As of 23 Sep 17:15 UTC, KerbQuote is on mainnet and the first x402 payment has settled on mainnet; OKX.AI is not claimed (not registered).

**Repository.** `https://github.com/Franlinozz/Kerb` (public). README complete, `BUILD_PERIOD.md` shows day-by-day build-period work, full history scanned clean of secrets.

**Demo video.** 2 to 4 minutes, per `docs/v2/V2-DEMO.md`. Unlisted or public link that works logged out.

**Product link.** `https://www.usekerb.xyz` (V2 since 22 Sep). Home, the Board, every asset page, Research, Methodology, Proof and Developers load with no wallet and no account; Credit works with any browser wallet on X Layer testnet. Public API at `https://api.usekerb.xyz`.

The apex `usekerb.xyz` and `www` both serve the site.

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

Mainnet debt capacity is denominated in USDG (0x4ae46a509F6b1D9056937BA4500cb143933D2dc8). On testnet the real Paxos USDG
(0xF0863D7A29a55d0c4263c11bFac754312ff078DF) has a permissioned mint and no faucet, so it cannot be obtained;
`MockUSDG` stands in and says so in its own name.

Builder Code: `kt0hl6xyhlx8xmt`, ERC-8021 suffix on every Kerb transaction, decodable from mainnet calldata.

## The Kerb Terms Standard
Link to docs/KTS-0.1.md and its 0.2 amendment docs/v2/KTS-0.2.md (live since 21 Sep). One paragraph on reproducibility, with the verify command.

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
| Web | LIVE at www.usekerb.xyz (V2, tag v2.0.0): Home, Board, Asset, Credit, Research, Methodology, Proof, Developers |
| API | LIVE at api.usekerb.xyz |
| Tests | 545 TypeScript, 106 Solidity, 47 E2E, all green in CI |
| Slither | 67 results, none High, every one dispositioned in SECURITY.md |
| Input bundles | published and served by the API (IPFS pinning paused at the free-plan quota since 21 Sep); `kerb verify <inputsHash>` reproduces the posted terms from the published bundle |
| Market-Time Reports | #1 at /research/1 from 35,130 measured readings; #2 generated Thu 24 Sep from the campaign-end captures |
| Demo video | not recorded, final-stage item |
| Repo public | yes |
| Apex DNS | usekerb.xyz resolves and serves the site |

---

## 3. Proof checklist before submitting

- [ ] Every contract address on `/proof` opens on OKLink and shows verified source
- [ ] At least one mainnet `TermsPosted` transaction from the last hour
- [ ] Builder Code decoded from a real transaction and displayed
- [ ] A report's input bundle opens from the page, and `kerb verify` on it returns no diff
- [ ] Board loads logged out, on mobile, on a different network
- [x] `/research/1` published with measured numbers; Report #2 generated from the 24 Sep captures
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
