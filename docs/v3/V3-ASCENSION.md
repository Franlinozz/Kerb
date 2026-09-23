# KERB V3: ASCENSION
### Commit `d7202a7`, production as captured 23 Sep 2026 08:32 UTC, submission 25 Sep 23:59 UTC

Evidence levels used below: **E1** official source or our own repo and chain, **E2** multiple credible reports, **E3** reasoned inference, **E4** speculative. Product decisions rest on E1 and E2 only.

---

## 1. Executive verdict

**Implementation: about 95% complete. Opportunity: about 70%.**

V2 closed the build. Mainnet risk plane live, KTS 0.2 live and visibly moving terms (KOx Carry 55.60% to 51.57% across the 21 Sep New York close, E1 from `PROJECT_STATE.md`), a full credit lifecycle proven in a real browser (13 transactions, all success), 47 E2E tests on production, Lighthouse 90 to 100, nine contracts Sourcify exact match.

What is incomplete is the half of the thesis that makes Kerb a company rather than an app.

- **Kerb calls itself a risk layer, and has one consumer.** Kerb Terms are read by exactly one system: Kerb Credit on testnet, through relayed mirror terms. No agent, no external contract and no installable SDK consumes them. A risk layer with one captive consumer is a lending app with extra steps.
- **One of the two integration surfaces the judges name is unused.** The criterion reads "meaningful integration with X Layer **and/or OKX AI**". OKX.AI's A2MCP service type is, in OKX's own words, for services that "take some parameters, return a clear result", read-only, deterministic, optionally billed per call through x402 and settled in USDT0 on X Layer (E1, OKX docs). That is a description of Kerb Terms. ChatGPT rejected OKX AI as theatre. It is not theatre when there is no model in the path and the payment settles on X Layer.
- **The first thing a judge sees is stale.** On 23 Sep the Board showed "Updated 5h 50m ago" with Hong Kong morning regimes, Credit showed a demo Last Call time four hours in the past, and Proof said "generated 06:40" when viewed at 08:33 (E1, screenshots). This is structural, not a one-off. See `V3-LIVE-AUDIT.md` L-01.
- **The hero moment still needs you in the room.** The standing demo position is written and dormant. A remote judge who arrives with no position sees "No position needs a cure right now."
- **There is no video.** For the Best Remote Demo award, the video is the pitch.

Biggest hidden opportunity: **Report #2 is evidence OKX itself wants.** It measures what happened to executable depth in X Layer xStocks pools when OKX's own X Liquidity incentives ended on 24 Sep. Framed that way, it is ecosystem contribution, not a blog post.

Strongest current advantage: a measured exit (tick-walk C(1%), cross-checked against OKX DEX quotes), horizon-bound terms, deterministic recomputation from published inputs, and five days of continuous X Layer observations nobody else has.

Most dangerous blind spot: first-paint freshness. It silently contradicts the product's core promise ("live", "right now") on every page a judge opens cold.

### Scores (Crucible weights)

| Dimension | Weight | Now | After V3 |
|---|---:|---:|---:|
| Functional completeness | 18 | 16 | 17.5 |
| Hackathon alignment | 12 | 12 | 12 |
| Sponsor integration | 10 | 7.5 | 9.5 |
| Reliability | 10 | 7 | 9.5 |
| UX clarity | 10 | 8.5 | 9.5 |
| Visual polish | 8 | 7.5 | 7.5 |
| Technical quality | 10 | 9.5 | 9.5 |
| Security / trust | 6 | 5.5 | 5.5 |
| Demo readiness | 6 | 2 | 6 |
| Competitive strength | 5 | 3.5 | 4.5 |
| Documentation / submission | 5 | 4 | 5 |
| **Total** | **100** | **83** | **~96** |

**Win readiness now: 71.** Deductions: no video (the award is literally "Best Remote Demo"), dormant keeper, stale first paint, OKX AI unused, stale claims in the submission draft.

---

## 2. Opportunity reconstruction (from scratch)

OKX's Build a Market list: portfolio and market-data tools, asset-based payment or commerce, investor or issuer tooling, onchain marketplaces, launchpads. Requirements: working X Layer integration, tokenized-stock or RWA integration, contract addresses, working flow in the video. Judging: innovation, completeness, user value, technical execution, meaningful X Layer and/or OKX AI integration, growth potential, ecosystem contribution (E1, Builder Kit).

The chain of needs for tokenized stocks is: issuance, price, trading, liquidity, then **credit**. Credit needs a risk layer that understands two things a crypto-native lender never had to: the underlying market keeps its own hours, and the onchain pool is the only exit when it is closed. Everyone now building stock-backed credit needs that layer:

- Kamino runs an xStocks market on Solana and holds most tokenized-stock lending TVL (E2).
- Morpho has Ondo SPYon and QQQon as collateral since February 2026, and opened markets for Coinbase's tokenized stocks on Base on 7 Sep 2026, with about 54,652 USDC borrowed by 16 Sep (E2).
- Aave announced tokenized-stock lending for V4 on 26 June 2026; its RWA hub is planned, not live (E2).
- Arch Lending announced tokenized-stock credit this week (E2).
- Chainlink ships 24/5 US equity streams with market-status flags (E1). That answers "what is it worth and is its market open". It does not answer "could this pool absorb the liquidation", which is Kerb's question.

None of the credit venues above is on X Layer. **The opportunity is to be the risk layer they all need, native to X Layer, with Kerb Credit as the proof and three open consumption surfaces: agents, contracts and code.** That is the same product, finished.

---

## 3. Research findings

| Finding | Level | Consequence for Kerb |
|---|---|---|
| Judging names "X Layer and/or OKX AI"; Remote teams compete for Best Remote Demo | E1 | Use OKX AI where it is genuine; the video is the product surface |
| A2MCP: free or x402 pay-per-call endpoints; example network `eip155:196`, asset USDT0 `0x779d…3736`; registration via Onchain OS skills and Agentic Wallet email login; listing review within 24 h | E1 | Kerb Terms fit A2MCP exactly; register Wednesday |
| Payment SDK: `@okxweb3/x402-express`, price as USD string, one-line switch to testnet `eip155:1952`, facilitator key from the OKX Developer Portal | E1 | Small, isolated service; testnet first |
| Tokenized-stock credit is a category now (Kamino, Morpho with Ondo and Coinbase stocks, Aave planned, Arch) | E2 | Never pitch "we lend against stocks" as the innovation |
| Morpho market parameters, including liquidation LTV, are fixed at market creation | E1 (Morpho design) | Kerb's horizon-bound terms and measured debt caps are a clean contrast; phrase it about Morpho, not "all lenders" |
| Chainlink 24/5 streams carry market status, bid and ask, staleness; lunch breaks report Closed | E1 | Complement, not competitor; it is Kerb's rung-1 reference once credentials exist |
| Industry notes that liquidation risk rises in thin overnight and weekend sessions and that pool prices drift outside market hours (CoinGecko, Allium) | E2 | Independent validation of the problem statement |
| Tokenized stocks outstanding rose to about $3.15B from about $630M a year earlier (RWA.xyz via Cointelegraph) | E2 | Growth context for the video and README |
| Kerb's own record: 84,915 pool observations, 4,229 mainnet Terms posts (Home, 23 Sep); 7 of 10 pools lost in-range liquidity over the closed weekend (Report #1) | E1 | The evidence moat; lead with it |

Not used: ChatGPT cited "Vela", "Morbit" and "ARCWELL" as X Layer-class competitors. I could not verify any of them. They stay out of every public sentence.

---

## 4. Category grammar

Category: **collateral risk infrastructure for tokenized securities**, with a reference credit market.

| Capability | State |
|---|---|
| Underlying market calendars, lunch breaks, holidays, onchain clock | Implemented |
| Regime machine with strict resolution order | Implemented |
| Reference price with source exclusion | Implemented (rung 2, Chainlink rung 1 needs credentials) |
| Measured executable exit (tick-walk) with OKX DEX cross-check | Implemented; cross-check under-exposed in the UI |
| Conservative mark with regime haircut | Implemented |
| Horizon-bound LTVs (KTS 0.2) | Implemented and live |
| Debt ceiling from measured depth | Implemented |
| Onchain attestation with guardrails and bounded loosening | Implemented |
| Reproducibility from published inputs | Implemented (API-served; IPFS gap disclosed) |
| **Explanation of why a term changed** | **Partial**: one static sentence on Home |
| **Consumption by agents** | **Missing** |
| **Consumption by other contracts on X Layer** | **Missing** |
| **Installable SDK** | **Partial**: "curl a raw file" |
| **Paid access / business model evidence** | **Missing** |
| Open dataset | Partial (reports only) |
| Reference credit market: supply, borrow, repay, withdraw, modes, covenant, cure, default | Implemented (testnet) |
| **Standing demo position** | **Missing** (written, dormant) |
| **Covenant reminder (Last Call alert)** | **Missing** |
| Audit, governance, real capital, production oracle | Post-hackathon (stated) |

## 5. Primitive completeness

Present and strong: **Clock, Exit, Mark, Horizon, Term, Covenant, Proof.**
Broken: **Freshness guarantee** on first paint.
Partial: **Attribution**, **SDK distribution**, **Dataset**.
Absent and high value: **Consumption interfaces** (agent endpoint with payment, onchain read adapter), **Standing demo**, **Covenant alert**.

---

## 6. Blind-spot report

1. **Stale first paint** (S0 for a live product). ISR stale-while-revalidate on a low-traffic site hands each visitor the page rendered at the previous visit; the client refresh then waits 30 s because `initialDataUpdatedAt` is set to `Date.now()`. V2's E2E never caught it because the suite warms the cache first.
2. **One consumer.** The "infrastructure" claim is rhetorical until something other than Kerb Credit reads Kerb Terms.
3. **OKX AI left on the table** although the official A2MCP shape matches Kerb exactly.
4. **Report #2 framed as our research** rather than as evidence about OKX's own incentive programme.
5. **KTS 0.2's causality is under-told.** Terms step at every close; nothing on the site narrates the step or its cause.
6. **The covenant has no reminder.** A Session Max borrower accepted a deadline; nothing tells them it is coming.
7. **The keeper is dormant**, so the hero cannot be reproduced alone.
8. **False or stale claims:** Home says bundles are "pinned" (0 of 2,770 pinned in the last 24 h per Proof); the submission draft says the repo is private, calls USDG "the loan asset" (the credit plane lends mUSDG), says "pinned input bundle", and claims "lending protocols in production treat all of those moments as identical collateral"; `art.ts` and `PROJECT_STATE.md` still say The Seal is unapproved.
9. **Raw enum on the Board:** "LUNCH_BREAK in Updating". The calendar emits `LUNCH_BREAK`, `SESSION_BREAK`, `SESSION_END`, `POST_CLOSE`; the web map knows `LUNCH_START`.
10. **No video.**
11. **The SDK is not installable.**
12. **The form summary is long and overclaims**; the 1:1 display picture does not exist yet.

## 7. Network and environment

Correct as built: risk plane on X Layer mainnet 196, credit plane on testnet 1952 with mirror collateral, never user funds on mainnet. V3 adds two mainnet surfaces that hold no user funds: x402 settlement of one-cent agent payments in USDT0 on 196, and two read-only consumer contracts on 196. Mainnet credit stays out (unaudited, jurisdiction, no production collateral access).

---

## 8. Product and competitor matrix

| Dimension | Kerb | Kamino xStocks | Morpho (Ondo, Coinbase stocks) | Aave V4 equities | Chainlink 24/5 |
|---|---|---|---|---|---|
| Stock-collateral lending live | Testnet reference | Yes, Solana | Yes, Ethereum and Base | Planned | Not a lender |
| Session-aware data | Core | Via oracle | Via oracle | Planned feeds | Core (market status) |
| Measured onchain exit capacity | **Core** | Not published | Not published | Not published | No |
| LTV tied to survival horizon | **Core (KTS 0.2)** | Unknown | Fixed per market | Risk parameters | No |
| Pre-liquidation cure covenant | **Core** | No | No | No | No |
| Terms recomputable from published inputs | **Core** | No | Parameters onchain | Governance trail | Signed reports |
| Consumable by agents with payment | **V3** | No | No | No | No |
| X Layer native | **Yes** | No | No | No | Multi-chain |
| Scale, liquidity, audits | Weak | Strong | Strong | Very strong | Very strong |

Table stakes we lack and accept lacking: audit, real capital, production oracle credentials. Worth leapfrogging: measured exit, horizon terms, consumption by agents and contracts. Not worth copying: hub and spoke, multi-chain, fixed-rate, perps, governance token.

---

## 9. Use-case frontier (100-point expansion score)

| Candidate | Product 20 | Hackathon 15 | Diff 15 | Eco 10 | Sponsor 10 | Demo 10 | Reuse 8 | Commercial 7 | Risk 5 | **Score** | Decision |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Freshness guarantee | 20 | 15 | 5 | 5 | 5 | 10 | 8 | 3 | 5 | **76** | A0 (existential regardless of score) |
| Standing demo position | 16 | 15 | 8 | 5 | 5 | 10 | 8 | 2 | 4 | **73** | A0 |
| Kerb for Agents: A2MCP x402 on X Layer, plus MCP | 16 | 14 | 13 | 10 | 10 | 8 | 7 | 7 | 3 | **88** | A1 |
| Term attribution ("why") | 17 | 12 | 13 | 6 | 4 | 9 | 7 | 4 | 4 | **76** | A1 |
| Onchain consumers (`KerbQuote`, `KerbMarkFeed`) | 15 | 12 | 11 | 9 | 8 | 6 | 7 | 5 | 4 | **77** | A1 |
| Exit evidence panel with OKX DEX history | 14 | 11 | 10 | 7 | 9 | 8 | 7 | 3 | 5 | **74** | A2 |
| Report #2 as OKX ecosystem evidence, plus open dataset | 15 | 13 | 10 | 10 | 6 | 7 | 7 | 4 | 5 | **77** | A0 (report), A2 (dataset) |
| Last Call alerts | 13 | 7 | 6 | 3 | 2 | 5 | 6 | 3 | 4 | **49** | A2, cut first |
| `@kerb/sdk` on npm | 10 | 6 | 3 | 6 | 2 | 3 | 8 | 3 | 5 | **46** | A2 if npm account exists |
| Chainlink 24/5 rung | 14 | 8 | 4 | 6 | 3 | 3 | 4 | 4 | 1 | **47** | A3 unless credentials exist today |
| Cure-keeper agent on Agentic Wallet | 12 | 10 | 11 | 8 | 9 | 7 | 4 | 5 | 1 | **67** | A3 (post-hackathon, strong) |
| Morpho curator cap integration | 14 | 6 | 10 | 4 | 2 | 3 | 4 | 6 | 2 | **51** | A3 |
| Exchange OS risk policies | 14 | 8 | 10 | 8 | 7 | 2 | 2 | 6 | 1 | **58** | A3 |
| Mainnet user-fund credit | 12 | 8 | 3 | 6 | 6 | 5 | 6 | 5 | 0 | **51** | A4 now |
| AI chat underwriting | 4 | 5 | 2 | 3 | 5 | 5 | 2 | 2 | 1 | **29** | A4 |

## 10. Integration frontier

**OKX.AI A2MCP with x402 on X Layer** (core enabler, economic, distribution). Kerb's paid tools (`credit_check`, `exit_check`) answer "how much can I borrow against this, until when, and could it be sold" with provenance. One cent per call, settled in USDT0 on X Layer mainnet through the OKX Payment SDK. Public terms stay free, because they are public onchain; what is sold is the computed, decision-ready answer. Cost: one small Express service, one facilitator key, one registration. Risk: low; isolated from the posting path. Spec: `SPEC-AGENTS.md`.

**Remote MCP server** (distribution). Free, read-only tools for Claude, Cursor or any MCP client: terms, board, clock, position, verify. Spec: `SPEC-AGENTS.md`.

**X Layer mainnet read adapter** (force multiplier). `KerbQuote` returns max borrow, cure deadline and usability for any collateral amount from the live mainnet terms and clock; `KerbMarkFeed` exposes the Credit Mark behind a Chainlink AggregatorV3 interface so an existing lender can drop it into an oracle slot. View-only, no owner, no funds. Spec: `SPEC-ONCHAIN-CONSUMERS.md`.

**OKX DEX** (deepen, do not add). The cross-check exists and bounds capacity whenever it is lower. V3 shows it as a panel with its 72-hour record.

Rejected as cosmetic now: Agentic Wallet keeper (A3), Exchange OS (A3), Chainlink without credentials (A3).

## 11. 10x levers

1. First paint is never stale.
2. A curable position exists every demo cycle.
3. Agents pay for Kerb's answer on X Layer through OKX.AI.
4. Any X Layer contract can read Kerb in one call.
5. Every term change explains itself with its own numbers.
6. Report #2 answers a question OKX has: what its incentives did to executable depth.
7. The video.

## 12. 100x vision

**The answer to "what can this collateral safely support until the next deep market?", signed, recomputable and consumable by anything.** Lenders read it onchain for caps and LTVs. Curators set supply caps from measured depth instead of intuition. Venues (Exchange OS) set collateral policy per session. Agents buy it per call before taking a position. Issuers watch their token's exit capacity. Liquidity programmes (OKX's own) see which pools collapse without incentives. Every hour of observation sharpens stress and horizon calibration; the Report series is both evidence and distribution. Kerb Credit stays as the reference market that proves the terms under real borrowers. None of this is built now beyond the three consumers; it shapes their interfaces.

---

## 13. Selected transformation

**Before:** a session-aware credit market with an excellent risk engine inside it.
**After:** the market-time risk layer for tokenized stocks on X Layer, with four live consumers (Kerb Credit, agents on OKX.AI paying through x402, any X Layer contract, developers through SDK and MCP), every term self-explaining, first paint always fresh, and a hero moment any judge can trigger alone.

### Priorities

| Class | Items |
|---|---|
| **A0 existential** | Freshness (V3-01); truth sweep and enum fix (V3-00); keeper (V3-02); Report #2 (V3-09); certification (V3-11); video and form (V3-12) |
| **A1 win levers** | Kerb for Agents with one real settled mainnet payment (V3-03); term attribution (V3-04); `KerbQuote` on mainnet (V3-05); positioning around consumers (V3-07) |
| **A2 high value** | Exit evidence history (V3-06); `KerbMarkFeed` factory (V3-05); dataset download (V3-09); Last Call alerts (V3-08); npm SDK |
| **A3 post-hackathon** | Chainlink rung 1, IPFS mirror, audit, multisig, cure-keeper agent on Agentic Wallet, Morpho curator caps, Exchange OS, real collateral |
| **A4 rejected** | Mainnet user-fund credit, AI underwriting, chatbot, governance token, DAO, points, NFTs, multi-chain, perps, options, new collateral to raise the count, new top-level navigation, redesign |

### Remove or merge

- Remove "Kerb does not keep a standing demo position" once the keeper runs.
- Merge the Home "Verify everything" band into a new "One term, four consumers" section plus the verify strip.
- Retire "USDG as the loan asset" (say "denominated in USDG"), "pinned" (say "published, retrievable"), and every "lending protocols treat all moments as identical" sentence.

## 14. New golden path

Home (thesis, consumers) → Board (Hong Kong in Last Call, New York in pre-market, all fresh) → Asset (exit check: tick-walk against OKX quote; "why these terms": Carry stepped down at the last close because the horizon grew to the next open) → Credit (Session Max borrow; at the demo Last Call the standing position appears in Curable now; a stranger cures it) → Proof (the transaction, the recompute) → Developers, Agents tab (an agent pays one cent in USDT0 on X Layer for a credit check and gets the same numbers with provenance) → Solidity tab (`KerbQuote` on mainnet returns the same max borrow onchain).

## 15. New hero moment

Unchanged at the centre: **Session Max, Last Call, a stranger's partial cure while liquidity still exists, then the recompute.** V3 adds the closer the judges have not seen: **an agent paying Kerb on X Layer for that same answer.** One product, proven by a human borrower, a stranger, a contract and an agent.

---

## 16. ChatGPT's final-ascension pack: adopt, modify, reject

| Item | Verdict | Why |
|---|---|---|
| Reposition around Kerb Terms, Kerb Credit as reference consumer | **Adopt** | Correct and necessary |
| Keeper as A0 | **Adopt** | Same conclusion |
| Truth sweep list (P4, private repo, pinned, competitor claims) | **Adopt, extend** | It missed the Home "pinned" line, the "USDG as loan asset" line, and the raw enum |
| Freeze Thu 20:00 | **Modify** | Feature freeze Thu 22:00, code freeze Fri 04:00, given bot speed and the added scope; protected windows unchanged |
| FA-02 "make OKX cross-check visible" | **Modify** | Already on the Asset Liquidity tab as a sentence and chart marker; the real work is a panel plus its 72-hour record |
| FA-03 "why did this term change" | **Modify** | Home already has a static margin sentence; the real work is post-to-post attribution with numbers, shown as a timeline |
| OKX AI agent rejected as theatre | **Reject** | A2MCP is deterministic and read-only with x402 settlement on X Layer; it is the most direct sponsor depth still available |
| External lender example as optional | **Promote** | `KerbQuote` on mainnet turns "any lender can consume" from a claim into a transaction |
| Competitors Vela, Morbit, ARCWELL | **Reject** | Unverifiable; never in public copy |
| "Chainlink Data Streams supported on X Layer" | **Hold** | Streams are live on 40+ chains; Kerb lacks credentials either way; keep as rung 1 roadmap |
| Missing: stale first paint | **Add** | Not visible without the site; the most important live defect |
| Missing: form specifics, display picture, "new project" answer | **Add** | `V3-SUBMISSION.md` |
| Missing: video production detail and filming windows | **Add** | `V3-DEMO.md` |
| Missing: single-agent and dual-lane execution plan | **Add** | `V3-BUILD-PROMPTS.md` |

---

## 17. Hackathon delta

| Criterion | What V3 adds |
|---|---|
| Innovation | Measured exit plus horizon terms, now sold to agents and readable by contracts; nobody sells stock-credit risk to agents |
| Product completeness | Four consumers, standing demo, covenant alert, fresh first paint |
| User value | Borrowers see why their terms moved; lenders, curators and agents get a decision-ready answer |
| Technical execution | Two more mainnet contracts with fork tests; x402 service; attribution engine tested on stored bundles |
| X Layer and OKX AI | OKX DEX cross-check surfaced; x402 settlement on X Layer; A2MCP listing on OKX.AI; Builder Code on every Kerb transaction |
| Growth potential | Paid per-call revenue live; distribution through OKX.AI and MCP |
| Ecosystem contribution | Report #2 on OKX's own incentive programme; open dataset; any X Layer lender can consume Kerb |

## 18. Things not to build

AI chat, AI underwriting, governance token, DAO, points, NFT badges, social feed, portfolio optimiser, trading terminal, perps, options, multi-chain, new collateral classes to raise the count, mainnet user-fund credit, contract changes to KerbClock, KerbTerms or KerbCredit, new top-level navigation, a redesign, a charting library, WebGL.

## 19. Freeze

Feature freeze **Thu 24 Sep 22:00 UTC**. Code freeze **Fri 25 Sep 04:00 UTC** (tag `v3.0.0`); after it, only S0 fixes. No production deploys Thu 05:00 to 09:00 UTC or Fri 06:00 to 10:30 UTC.

## 20. Competitive end state

Kerb will not match Morpho, Kamino or Aave on capital, audits, liquidity or institutional reach, and should never imply it. It can credibly lead on one wedge: **a published, recomputable answer to whether a tokenized-stock position could actually be exited, and for how long a loan must survive before it can, consumed by lenders, contracts and agents on X Layer.** That wedge is complementary to Chainlink's session-aware prices, and it is exactly what fixed-parameter lending markets do not publish.

## 21. Final thesis

- **Original:** a session-aware lending market for tokenized stocks.
- **Missing:** the consumers. A risk layer is defined by who reads it.
- **Becomes:** the market-time risk layer for tokenized stocks on X Layer, read by a credit market, agents, contracts and code.
- **Why stronger:** stock-backed lending is commoditising; measured-exit, horizon-bound risk terms are not, and now they are demonstrably consumable and paid for on X Layer.
- **Build now:** freshness, keeper, truth, agents with one settled payment, attribution, `KerbQuote`, Report #2, video.
- **Wait:** Chainlink, audit, IPFS mirror, curator integrations, Exchange OS, real collateral.
- **Could still lose us the award:** a stale first page, a video that explains more than it proves, a Last Call a judge cannot trigger, or one false sentence in the submission.
