# AGENTS.md: V3 ADDENDUM
## Append as section 13. Where it conflicts with sections 1 to 12, this section wins.

---

## 13.1 What V3 is

Kerb is **the market-time risk layer for tokenized stocks on X Layer**. It measures how much of a position could actually be sold in X Layer pools and how long a loan must survive before the next deep market, and publishes both as credit terms anyone can recompute.

Kerb Terms have four consumers after V3, in this order of importance for the story:
1. **Kerb Credit**, the reference credit market (testnet, mirror collateral).
2. **Agents**, through paid x402 endpoints listed on OKX.AI (A2MCP) and a free MCP server.
3. **Contracts** on X Layer mainnet, through `KerbQuote` and `KerbMarkFeed`.
4. **Developers**, through REST and the SDK.

Never describe Kerb as "a lending protocol for tokenized stocks". Never describe Kerb Credit as the product. It is the proof.

## 13.2 Read before every V3 session

`AGENTS.md` sections 1 to 13, `docs/v3/V3-ASCENSION.md` sections 1 and 13, `docs/v3/V3-LIVE-AUDIT.md`, the spec for your phase, `docs/v3/V3-POSITIONING.md` section 3 (claims), and `PROJECT_STATE.md`.

## 13.3 Lanes

| Lane | Owns | Never touches |
|---|---|---|
| **A** backend, contracts, infra | `apps/api`, `apps/engine` (new pure modules only), `apps/agents` (new), `contracts/src/consumers/` (new), `scripts`, PM2, Caddy, keeper | Any CSS, any page layout |
| **B** frontend | `apps/web` | Engine, API handlers, contracts, PM2 |

One agent may run both lanes; it still follows the ownership rules phase by phase. Requests between lanes go in `PROJECT_STATE.md` under Requests.

## 13.4 Frozen

- `KerbClock`, `KerbTerms`, `KerbCredit`, `KerbMirror`, `MockUSDG`, `KerbClockDemo`: no redeploy, no admin call, no guardrail change.
- Collector, attester posting path, engine functions that produce posted numbers (depth, mark, regime, stress, capacity), KTS 0.2 parameters.
- The append-only store triggers. New tables may be added, append-only, with the same triggers.
- Git history. The Kerbstone design system (new UI uses its tokens and components).

## 13.5 Protected windows

- **Thu 24 Sep 05:00 to 09:00 UTC:** no production deploy of any process (collector, attester, API, web, agents, keeper, warmer). Captures read the API at 127.0.0.1:8720. Work continues on staging only.
- **Fri 25 Sep 06:00 to 10:30 UTC:** filming. No deploys.

## 13.6 Gates (additions)

9. **Keeper start:** operator writes "go keeper" and the wallet holds faucet OKB only.
10. **x402 on mainnet:** runs on `eip155:1952` first; switching `KERB_X402_NETWORK` to `eip155:196` needs the operator's "go x402 mainnet".
11. **ASP registration and listing on OKX.AI:** the agent drives the Onchain OS prompts; the operator approves each step in their own Agentic Wallet session.
12. **Mainnet deploy of `KerbQuote` and `KerbMarkFeed`:** needs fork tests green and the operator's "go consumers mainnet".

## 13.7 Claim discipline (hard rules)

- A claim appears in public copy only after its evidence is in `docs/release/CLAIM_EVIDENCE.md`.
- "Listed on OKX.AI" only after the listing email confirms it; before that, "registered on OKX.AI, listing under review".
- "Agents pay for Kerb" only after at least one settled x402 payment on X Layer mainnet, with its tx hash on `/proof`. If the payer was the operator's own wallet, say so.
- Never "pinned" for a bundle unless that bundle's CID resolves on a public gateway. Default word: "published".
- Never claim other lenders ignore market sessions. Use `V3-POSITIONING.md` section 4.
- Never name a competitor that is not in `V3-ASCENSION.md` section 3 with E2 evidence.

## 13.8 Definition of done (additions)

- Freshness: every live value renders either under 60 s old or in the Refreshing state; covered by `freshness.idle.spec.ts`.
- No uppercase underscore token reaches the DOM on any route.
- New endpoints: input validation, rate limit, labelled errors, no stack traces, a test per failure mode.
- New contracts: fork tests against the live mainnet deployments, Sourcify exact match, addresses in `config/deployments.json` and on `/proof`.
- Every number a new surface shows carries its provenance (tx or inputsHash, and asOf).

## 13.9 Degradation ladders

**Kerb for Agents:** 1 listed on OKX.AI, x402 on mainnet, one settled payment on `/proof`. 2 registered, listing under review, x402 on mainnet with a settled payment. 3 x402 on testnet 1952 with a settled test payment, registration pending. 4 free endpoints and MCP only, with the reason stated.

**Onchain consumers:** 1 `KerbQuote` and ten `KerbMarkFeed`s on mainnet, verified. 2 `KerbQuote` only. 3 deployed on testnet with mainnet fork tests, mainnet deploy pending approval.

**Keeper:** unchanged from 12.8.

**Report #2:** unchanged from 12.8.

**Attribution:** 1 full post-to-post attribution with a 72 h timeline. 2 the current "why" sentences only, computed from the latest bundle. Never hand-written reasons.

## 13.10 Kill list (V3)

Everything in 12.9, plus: AI chat, AI underwriting, any LLM in any path that produces a number, Exchange OS work, cure-keeper agent, Morpho integration, Chainlink work without credentials in hand, a new pinning provider, new top-level navigation, new art plates, token or points of any kind, mainnet credit.
