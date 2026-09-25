# Kerb gap audit, 23 Sep 2026 (evening)

Every item in `docs/v2/V2-BUILD-PROMPTS.md`, `docs/v2/V2-AUDIT.md` (hardening queue H-01 to H-18 and gates A to J) and `docs/v3/*` checked against what exists in the repo and on www.usekerb.xyz. Method: the plans read in full, the code read, and a real Chromium walkthrough of every route on production at 1440 (Night) and 390 (Day), screenshots in `data/screens/v3/audit/`.

Status words: **Done** (built, live, evidenced), **Partial** (live but an acceptance line is unmet), **Open** (not built), **Operator** (needs the operator), **Declined** (decided against, with the reason).

## 1. Things that stopped halfway or were decided quietly

These are the items most likely to surprise the operator late. Each is stated plainly.

| Item | What happened | State now | What it needs |
|---|---|---|---|
| IPFS pinning (Pinata) | The free Pinata plan hit its 500-pin limit on 21 Sep 01:56 UTC; every pin since is refused (403). Option C (keep bundles served by the Kerb API) was recorded as the operator's choice on 21 Sep | Every bundle since K-43 is retrievable from the API and verifiable by hash; 0 are on IPFS since 21 Sep. The site says "published", never "pinned" | **Operator:** keep C (free, honest), or upgrade Pinata (about USD 20 a month) and pins resume with the same JWT |
| OKX.AI marketplace listing | Registered late, on the operator's go | **25 Sep 01:02 UTC:** agent #13887 registered, two A2MCP services, listing under review | OKX review (up to 48 h); flip to listed only on the approval email |
| Contract verification on OKLink | OKLink source verification needs an OKLink API key; Sourcify was used instead | All 34 Kerb deployments are Sourcify exact match; OKLink pages show bytecode without source | **Operator (optional):** an OKLink API key (free account) lets the contracts show verified source on OKLink, which is the explorer judges click |
| Chainlink reference price | Rung 1 needs Data Streams credentials | Rung 2: issuer price data plus Yahoo as an independent check, stated on `/proof` | Nothing before the deadline |
| xStocks corporate-action schedule | The full schedule endpoint needs an issuer API key | Rung 1 partial plus onchain polling of `multiplier()` every ten minutes | Nothing before the deadline |
| SDK on npm | Needed an npm account | **Done 24 Sep:** `kerb-sdk@0.1.0` on npm (`npm i kerb-sdk`), shown first on Developers | Nothing |
| Telegram Last Call alerts | Needed a bot token | **Done 24 Sep:** @KerbAlertsBot live (`/watch`, `/status`, `/stop`), linked from Credit, Docs and FAQ | Nothing |
| Demo video | Operator's step | Not recorded | **Operator:** Fri 25 Sep 07:30 to 08:00 UTC per `docs/v3/V3-DEMO.md` |
| Mainnet credit | Kill-listed: unaudited, guardrail 9, jurisdiction guardrail 10 | Credit runs on testnet with mirror collateral; the risk plane, KerbQuote, feeds and x402 are on mainnet | Declined by design (see section 4) |

## 2. V2 plan, item by item

| Phase / item | Status | Evidence or gap |
|---|---|---|
| V2-K staging, cutover commands | Done | `scripts/deploy-web.sh`, v2.usekerb.xyz |
| V2-00 repo hygiene, em dash CI, Sourcify for testnet, mirror LT, pinning | Done | CI `check:copy`; `/proof`; ARCHITECTURE note; pinning in section 1 |
| V2-01 KTS-0.2 | Done | live since 21 Sep 19:38 UTC |
| V2-02 API additions | Done | `docs/API.md` |
| V2-03 art and brand | Done | six plates, icons, OG images for seven routes |
| V2-04 shell, fonts, three themes, wallet layer, error map, toasts | Done | Market-time theme present in the theme menu |
| V2-05 time components | Done | rail, clocks, Tape, E2E across a mocked transition |
| V2-06 Home | Done | |
| V2-07 Board and Asset | Done | |
| V2-08 Credit hero workflow, keeper, real browser runs | Done | keeper live since 23 Sep; `data/credit-flow-2026-09-23.json` on production |
| V2-09 Research, Report #2 | Partial | page ready; Report #2 data after Thu 09:00 UTC |
| V2-10 Methodology, Proof, Developers, Changelog | Done | |
| V2-11 hardening, cutover | Done for V2 | re-run in V3-10 |
| V2-12 certification, video, submission | Open | V3-11, V3-12 |
| H-09 demo video | Open | operator |
| Gate H demo, gate J submission | Open | Fri |

## 3. V3 plan, item by item

| Phase / item | Status | Evidence or gap |
|---|---|---|
| V3-00 truth sweep, claims-check | Done | CI `check:claims` |
| V3-01 freshness | Done | first paint 2 to 37 s; `freshness.idle.spec.ts` |
| L-02 raw enums | Done | E2E regex |
| L-03 standing demo position | Done | keeper, stranger cure |
| L-04 false claims | Done | |
| L-05 true live line | Done | |
| L-06 Day header visible | Partial | not yet asserted by E2E (V3-10) |
| L-07 SDK installable | Done | `npm i kerb-sdk` |
| L-08 relay age on Credit cards | **Open** | cards say "relayed from mainnet" without the age; fixing |
| L-09 counts agree | Done | |
| L-10 Research #2 flips | Partial | code path ready; proven when Report #2 publishes |
| L-11 "(mirror listing)" | Done | |
| V3-02 keeper | Done | six-plus cycles, recovery path exercised |
| V3-03 x402, MCP | Done at rung 2 without OKX.AI | first mainnet settlement `0xb0befc3e…982e` |
| V3-04 attribution | Done | |
| V3-05 KerbQuote, feeds | Done, mainnet | `0x223d5e2a…e52a` |
| V3-06 exit evidence | Done | |
| V3-07 consumers surfaces | Done, but under-signposted | a visitor does not see "what is new" without knowing where to look; addressed in section 5 |
| V3-08 Last Call alerts | Done | browser notifications plus @KerbAlertsBot on Telegram |
| V3-09 Report #2, dataset | Partial | dataset live; report after Thu 09:00 UTC |
| V3-10 hardening | Partial | secret scan and append-only checks done; axe, Lighthouse, dead buttons, full screenshot set Thu |
| V3-11 certification, display picture | Open | Fri 00:00 to 04:00 UTC |
| V3-12 film and submit | Open | operator, Fri |

## 4. Real tokens and the lifecycle, stated honestly

- **Kerb never buys or holds the production xStocks.** Guardrail 10 in `AGENTS.md`: the operator does not acquire, hold or route around restrictions on the production tokenized assets, and the V1 plan records that they are not available in the operator's jurisdiction. So the credit lifecycle (deposit, borrow, Last Call, cure, repay, withdraw) runs on X Layer testnet with mirror tokens whose terms are relayed from the real mainnet terms. That lifecycle is verified end to end in a real browser, on production, on 22 and 23 Sep.
- **What does run on the real tokens, on mainnet:** the measurement of all ten real xStocks pools every minute, the posted terms, KerbQuote (priced for any holder of the real tokens) and the Credit Mark feeds. Section 5 adds a mainnet holdings view to the account page, so any real holder's xStocks can be quoted without Kerb ever touching them.
- **Mainnet credit** (lending real money against real xStocks) is deliberately out of scope: unaudited contracts, one attester, and the jurisdiction rule. The site and README say so.

## 5. What this audit changes (tonight)

| Finding | Fix |
|---|---|
| Home scrolls sideways (the new consumers animation) at 1440 and 390 | contain the animation |
| Home "Verify everything" lists all twelve mainnet contracts, the ten feeds included | core contracts and KerbQuote only; the feeds live on Developers and Proof |
| Account and Docs are hard to find (footer, wallet menu) | Docs in the top navigation; Your account beside Connect when a wallet is connected, and on Credit |
| No FAQ, no onboarding, no terms, privacy or risk pages, no whitepaper | `/faq`, a first-visit guided tour, `/legal/terms`, `/legal/privacy`, `/legal/risk`, `/whitepaper` (and a PDF) |
| V3 work is invisible unless you know where it is | "What's new in V3" strip on Home linking each consumer and evidence surface |
| No way to see real xStocks on the account page | a mainnet holdings section priced through KerbQuote for any address |
| Relay age missing on Credit cards (L-08) | "relayed {age} ago" per card |

## 6. Declined, with reasons

| Idea | Why not |
|---|---|
| AI copilot or chat | Kill list (AGENTS.md 13.10) and guardrail 2: no model near the numbers. A chat that paraphrases risk terms can be wrong in a way a judge can screenshot. The deterministic tour, FAQ and "why" sentences do the job without that risk |
| Buying real xStocks to test | Guardrail 10 (jurisdiction). The real-token path is covered read-only through KerbQuote on mainnet |
