# AGENTS.md
## The Kerb build constitution

Every coding agent re-reads this file at the start of every session and at the start of every phase. If anything in a phase prompt contradicts this file, this file wins. If reality contradicts this file, log it in `PROJECT_STATE.md` under Deviations and continue.

---

## 1. Mission

Kerb is the market-time risk layer for tokenized securities, built on X Layer for OKX Dev Day 2026 (Build a Market track, submission 25 Sep 23:59 UTC).

Kerb observes each tokenized asset's underlying market session, its executable liquidity in real X Layer pools, and the quality of its price sources; converts those into reproducible onchain credit terms (the Kerb Terms Standard, KTS-0.1); and lends against them in Kerb Credit.

The promise, and the sentence that decides arguments:

> **Never lend more than you can liquidate.**

---

## 2. Hard guardrails. Never breach these.

1. **No fake data, ever.** Real data is labelled Live. Test data is labelled Demo or Testnet. An empty state says it is empty. A failed source says it failed. No placeholder numbers in any shipped surface, including screenshots and the demo video.
2. **No model in the risk path.** No LLM output ever becomes a price, a depth number, a regime, a term, a threshold, or any input to them. The engine is pure functions over observed data. A model may only write prose in `/reports` drafts, and any such text is reviewed by a human before publishing.
3. **Every published number carries provenance.** One of: `Verified` (checked onchain), `Observed` (read from a named source with timestamp and content hash), `Attested` (signed by the Kerb attester inside contract guardrails), `Computed` (produced by KTS from pinned inputs). If a number cannot carry one of those labels, it does not ship.
4. **Reproducibility is a feature, not a nice-to-have.** Every Terms report pins its full input bundle, hashes it, and puts the hash onchain. `kerb verify <reportId>` must recompute the identical outputs from the bundle. A report that cannot be recomputed is a bug of the highest severity.
5. **The liquidation threshold never moves with the session.** Sessions move borrowing capacity and the cure covenant only. Changing a liquidation threshold requires a timelocked admin action and is never automated.
6. **Money arithmetic.** Offchain: decimal strings, never JavaScript floats, for anything that becomes a price, amount, ratio or term. Onchain: fixed point with explicit scaling constants, rounding always against the user, never in their favour.
7. **No autonomous execution with funds.** Liquidations and cures are permissionless functions triggered by a human or by an external party. No Kerb-operated bot spends money without written approval from the operator.
8. **Keys.** The admin and guardian key exists only on the operator's local machine. The attester key (signs reports) and poster key (pays gas) live on the VPS, hold no user funds, and cannot move funds, change guardrails, or unpause anything.
9. **Mainnet rules.** Mainnet deployment of `KerbClock` and `KerbTerms` is expected and holds no user funds. Mainnet deployment of `KerbCredit` requires explicit written operator approval plus green invariants and a clean Slither run. Never deploy a contract to mainnet on your own initiative.
10. **Jurisdiction.** The operator does not acquire, hold or route around restrictions on the production tokenized assets. Do not write code, scripts, or instructions that attempt to do so. The credit demo runs on testnet with mirror collateral.
11. **No new dependencies with ceremony.** Standard, boring, well-known libraries only. No BUSL-licensed code copied into this repo. No forked protocol source. Attribute every open-source library used in the README.
12. **Build-period integrity.** Every commit stays inside the official build period, with honest messages. `BUILD_PERIOD.md` records what was built when. Never backdate, never squash history to hide iteration.

---

## 3. Four hard gates. Stop and ask the operator.

Escalate only for these. Everything else you decide yourself and log in one line.

1. **Onchain changes**: any mainnet deployment, any contract upgrade path, any change to guardrail constants, any key rotation.
2. **New costs**: any paid API, any domain, any infrastructure that bills.
3. **Data deletion**: any deletion or mutation of raw observations, input bundles, or the append-only store. Never delete. Roll forward.
4. **Estimates presented as measurements**: if you are about to publish a number the system did not actually measure, stop and ask.

---

## 4. Autonomy charter

- Self-debug with three distinct hypotheses before reporting a blocker. State which you tested and what you observed.
- Make implementation compromises freely and log each one in a single line in `PROJECT_STATE.md` under Deviations.
- Batch reports: one checkpoint at the start of a session, one at the end of a phase. Do not narrate.
- Never ask "would you like me to continue". Continue.
- If a phase's acceptance criteria cannot be met, ship the degraded version from the ladder in Section 7 and say which rung you are on.

---

## 5. Repository layout

```
kerb/
  apps/
    web/            Next.js app (Board, Asset, Market, Methodology, Reports, Proof, Developers)
    api/            Fastify REST + SDK surface + report serving
    collector/      Observation loops (pools, prices, calendars, corporate actions)
    engine/         KTS-0.1 pure functions and the report builder
    attester/       Signs Terms reports, posts to chain, pins input bundles
    indexer/        Reads Kerb events into Postgres views
    desk/           OKX AI A2MCP service (P1)
  packages/
    adapters/       AssetAdapter interface + XStocksAdapter + venue adapters
    v3math/         Uniswap V3 tick-walk price impact simulation
    calendar/       Per-market trading calendars (US, HKEX, commodity)
    types/          Shared types, decimal helpers, provenance labels
    sdk/            TypeScript client for Terms
  contracts/
    src/            KerbClock.sol KerbTerms.sol KerbCredit.sol KerbMirror.sol interfaces/
    test/           Foundry unit, fuzz, invariant, fork tests
    script/         Deploy and verify scripts
  docs/             KTS-0.1.md ARCHITECTURE.md DEMO.md SUBMISSION.md
  data/             Local snapshots for tests (never the source of truth)
  AGENTS.md KERB-MASTER-PLAN.md BUILD_PLAN.md PROJECT_STATE.md BUILD_PERIOD.md README.md
```

Directory ownership: `contracts/`, `apps/engine`, `apps/collector`, `apps/attester`, `apps/indexer`, `packages/*` belong to the backend agent (Codex). `apps/web` belongs to the frontend agent (Claude Code). Both may read everything. Neither edits the other's directory without saying so in `PROJECT_STATE.md`.

---

## 6. Conventions

- Node 22, TypeScript strict, `exactOptionalPropertyTypes` on. No `any` in `packages/` or `apps/engine`.
- Decimal math via a single shared helper module. Importing a raw float math path into the engine is a review failure.
- Solidity: Foundry, OpenZeppelin for standard pieces, no upgradeability, no `delegatecall`, checks-effects-interactions, `ReentrancyGuard` on every external state-changing entry point that moves tokens.
- Tests: Vitest for TS, Foundry for Solidity. Every engine function has a table-driven test with fixtures captured from real observations. Every contract has at least one invariant test.
- Fixtures: capture real responses once, commit them under `data/fixtures/`, and run the engine tests offline against them. Fake provider mode is the default in dev; live mode is an explicit env flag.
- Commits: conventional commits, present tense, one logical change each. Reference the task ID from `BUILD_PLAN.md`, for example `feat(engine): KTS carry capacity (K-14)`.
- Environment: `.env.example` is always current. No secrets in the repo, in logs, or in error responses. The runner env is allowlisted, so a live key can never leak into a test process (this is the Plumb lesson and it is not optional).
- UI: both themes are first class. After building any page, take Playwright screenshots at 390 and 1440 in both themes, look at them, list defects, fix, re-shoot. A page is not done until you have personally viewed the screenshots.

---

## 7. Degradation ladders

Take the highest rung you can reach. Log which rung you are on, on `/proof` under Limitations.

**Reference price**
1. Chainlink Data Streams report verified onchain.
2. xStocks public price data, attested by Kerb.
3. Pool-implied price with a wide band and regime forced to `STALE` for borrow purposes.

**Executable depth**
1. Uniswap V3 tick-walk on the real X Layer pool, cross-checked against OKX DEX quotes.
2. Tick-walk only, with a note that the cross-check is unavailable.
3. OKX DEX quotes only, labelled as a third-party estimate.
4. No depth: debt ceiling goes to its floor and the Board says depth is unavailable.

**Loan asset on testnet**
1. Real Paxos testnet USDG on X Layer testnet.
2. `MockUSDG` deployed by Kerb, clearly labelled, with the real mainnet USDG address still wired into the mainnet config.

**Credit market deployment**
1. Testnet live plus mainnet guarded launch with operator approval.
2. Testnet only, mainnet risk plane live.
3. Local anvil fork demo plus mainnet risk plane live. This is the floor and it still submits.

**Corporate action data**
1. xStocks corporate action schedule endpoint.
2. Multiplier change detection by polling the token contract and flagging `ACTION` on change.

**Time**
If a phase is overrunning its timebox by more than 50 percent, stop, ship the current rung, and move to the next phase. Ship beats complete.

---

## 8. Definition of done

A task is done when all of these are true:

- Code implemented and typechecked with no suppressed errors.
- Tests written and passing, including at least one failure-path test.
- Error states handled and visible in the UI where relevant.
- Provenance labels attached to every number it produces.
- Responsive at 390 and 1440 if it has a UI, and screenshots reviewed.
- Documented: README or `docs/` updated if behaviour changed.
- Deployed to the environment the task targets, with addresses recorded in `PROJECT_STATE.md`.
- `/proof` updated if the task created a new verifiable artifact.
- One line added to `BUILD_PERIOD.md` describing the new functionality.

---

## 9. QA matrix. Nothing claims to be tested until these pass.

Engine and data: source down, source stale, sources disagreeing beyond threshold, pool with zero liquidity, pool with a single tick of liquidity, non-USD quote path, multiplier change mid-observation, calendar holiday, DST boundary, HKEX lunch break boundary, clock crossing UTC midnight, duplicate observation, out-of-order observation, indexer restart, reorg.

Contracts: borrow above Carry in Session Max mode, borrow above Session Max (must revert), cure before window opens (revert), cure after window with correct partial size, cure to exactly the Carry target, default liquidation at threshold, close factor respected, repay while paused, withdraw while paused, attester posting beyond guardrail (revert), attester loosening before cooldown (revert), stale report (revert borrow, allow repay), debt ceiling reached, supply cap reached, rounding never favours the user, reentrancy attempt.

UI: wallet disconnected, wrong chain, transaction rejected, transaction reverted, transaction pending, stale data banner, empty board, single asset board, mobile borrow flow, both themes, reduced motion.

---

## 10. Non-negotiable vocabulary

Use these exact words everywhere, in code, UI and docs: **Clock, Mark (Credit Mark), Depth, Terms, Carry, Session Max, Last Call, Cure, Default, Coverage Ratio, Regime, Board, Market-Time Report, Kerb Desk, KTS**.

Do not invent synonyms. Do not write "curb". Do not write "weekend mode": the product is about liquidity regimes, of which the weekend is one instance.

---

## 11. Checkpoint format

At the end of each phase, report exactly this and stop:

```
PHASE <n> CHECKPOINT
Built: <one line per deliverable>
Evidence: <tx hashes, addresses, test counts, screenshot paths>
Rung: <which degradation rung each subsystem is on>
Deviations: <one line each, or none>
Blocked: <one line each, with the three hypotheses tested, or none>
Next: <the next phase ID>
```

---

## 12. V2 addendum

Appended 21 Sep 2026 from `docs/v2/AGENTS-V2-ADDENDUM.md`. Where this section conflicts with sections 1 to 11, this section wins.

Operator instruction, 21 Sep: one agent (Claude Code) runs both lanes. Where the V2 documents say Codex or Claude Code, read it as the backend lane or the frontend lane, not as two people. The ownership rules still hold as lanes: CSS has one owner, and backend changes are made deliberately, never as a side effect of frontend work.

### 12.1 What V2 is

V1 built a strong engine and a weak window onto it. V2 rebuilds how Kerb is experienced and makes one thesis-critical engine change (KTS-0.2). It does not rebuild the engine, the contracts, the data plane or the evidence system.

Kerb competes on the **Remote route**. No judge will see a live pitch. Judges experience Kerb through exactly three artifacts: the **demo video**, the **live URL**, and the **public repo**. Every task in V2 is ranked by how much it improves those three.

Submission: 25 Sep 2026 23:59 UTC. Internal target 18:00 UTC. Feature freeze Thu 24 Sep 20:00 UTC.

### 12.2 Read before every V2 session

`AGENTS.md` (all), `V2-AUDIT.md`, `V2-DESIGN-SYSTEM.md`, `KTS-0.2.md`, and `PROJECT_STATE.md`. Frontend sessions also read `V2-IMAGE-PROMPTS.md` section 4.

### 12.3 Ownership

| Area | Owner | Rule |
|---|---|---|
| `apps/web/src/styles/**`, `apps/web/src/components/ui/**`, every page layout | Claude Code | Single owner of all CSS. Nobody else edits styles |
| `apps/engine`, `apps/api`, `apps/attester`, `apps/indexer`, `apps/collector`, `contracts`, `scripts` | Codex | Frontend may request endpoints; it does not implement them |
| `art/`, `scripts/art/` | Codex runs, operator selects | No auto-selection of final art |
| Public docs (README, SUBMISSION, docs/) | Codex drafts, operator approves wording | No em dashes |

When one agent needs something from the other's area, it writes a one-line request in `PROJECT_STATE.md` under "Requests" and continues with a typed stub that renders a labelled empty state.

### 12.4 The design law (replaces section 6's UI bullet and ARCHITECTURE.md section 9)

1. The Kerbstone system in `V2-DESIGN-SYSTEM.md` is the only visual source of truth. Tokens are CSS variables; no raw hex in components.
2. Fonts are actually loaded (`next/font`), and the build fails if a declared family is missing.
3. Tables only where comparison is the job. Decisions, positions, research and verification are composed layouts.
4. Every page has one clear primary action, one hero, and at most one art plate.
5. Every tracked uppercase label carries information. No decorative eyebrows.
6. No raw library, RPC or contract error text is ever rendered. Everything goes through the error map.
7. No em dash characters anywhere in UI copy, docs or README. No dash glyph as an empty value.
8. Numbers follow the format standard in `V2-DESIGN-SYSTEM.md` section 10.
9. Every number still carries a ProvMark. V2 changes how provenance looks, never whether it exists.
10. Both themes and the Market-time mode are first class. Screenshots in both themes at 390, 768 and 1440 before any page is called done.

### 12.5 Frozen, do not modify

Contracts and their deployments. The collector. The append-only store and its triggers. The tick-walk, mark, regime and depth code. Builder Code wiring. Git history (no rewrites; hashes are cited on `/proof`). The attester's signing path, except the version field KTS-0.2 requires.

**Hands off the collector and attester from Thu 24 Sep 05:00 to 09:00 UTC.** The X Liquidity campaign ends at 07:00 UTC and the HKEX Last Call window runs 07:00 to 08:00 UTC. That window is the most valuable evidence in the project.

### 12.6 Gates (additions to section 3)

5. **KTS-0.2 merge**: requires all acceptance items in `KTS-0.2.md` section 7 green and the operator's written go before the attester switches versions. Decision time Tue 22 Sep 18:00 UTC.
6. **Demo position keeper** (testnet, autonomous): requires operator approval and a dedicated testnet wallet that holds only faucet assets.
7. **Image batch**: new cost, operator approval.
8. **Pinning plan change**: new cost, operator approval.

### 12.7 Definition of done, V2 (adds to section 8)

- Playwright E2E test exists for the route or flow, and passes in CI.
- No console errors or hydration warnings on load, navigation or interaction.
- Lighthouse (mobile) on the route: Performance ≥ 85, Accessibility ≥ 95, Best Practices ≥ 95.
- Screenshots (both themes, 390, 768, 1440) viewed by the agent, defects listed and fixed, final set saved under `data/screens/v2/<route>/`.
- Every interactive control either works, is removed, or is disabled with a visible reason. Dead buttons are S1 defects.

### 12.8 V2 degradation ladders

**Art plates:** 1 generated and selected plates. 2 geometric SVG Kerbstone (see `V2-IMAGE-PROMPTS.md` section 5). Never a stock image, never an unmasked rectangle.

**KTS-0.2:** 1 merged and live. 2 not merged, UI and README state the 0.1 truth (see `KTS-0.2.md` section 8).

**Demo position:** 1 keeper maintains a curable position each demo cycle. 2 a single manually opened position before recording. 3 the judge's own Session Max position is the only curable one, and the Credit page says so.

**Curable feed:** 1 indexed endpoint. 2 client-side scan of recent `Borrow` events from the deploy block. 3 hidden, with the lookup form kept.

**Report #2:** 1 full before/after report published Thu 24 Sep by 20:00 UTC. 2 the capture published as an addendum to Report #1. 3 the capture files linked from `/proof` with a one-paragraph note.

### 12.9 V2 kill list

Anything not in `V2-BUILD-PROMPTS.md`. Specifically: new contracts or redeploys, Kerb Desk, Autopilot, Exchange OS, a token, points, a chatbot, AI copy generation in the product, WebGL or Three.js scenes, a charting library, a CSS framework migration, a component library install beyond `lucide-react`, route changes beyond the listed redirects, git history rewrites, and any "while I'm here" refactor of frozen code.
