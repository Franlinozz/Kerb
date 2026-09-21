# AGENTS.md: V2 ADDENDUM
## Append this to AGENTS.md as section 12. Where it conflicts with sections 1 to 11, this section wins.

---

## 12.1 What V2 is

V1 built a strong engine and a weak window onto it. V2 rebuilds how Kerb is experienced and makes one thesis-critical engine change (KTS-0.2). It does not rebuild the engine, the contracts, the data plane or the evidence system.

Kerb competes on the **Remote route**. No judge will see a live pitch. Judges experience Kerb through exactly three artifacts: the **demo video**, the **live URL**, and the **public repo**. Every task in V2 is ranked by how much it improves those three.

Submission: 25 Sep 2026 23:59 UTC. Internal target 18:00 UTC. Feature freeze Thu 24 Sep 20:00 UTC.

## 12.2 Read before every V2 session

`AGENTS.md` (all), `V2-AUDIT.md`, `V2-DESIGN-SYSTEM.md`, `KTS-0.2.md`, and `PROJECT_STATE.md`. Frontend sessions also read `V2-IMAGE-PROMPTS.md` section 4.

## 12.3 Ownership

| Area | Owner | Rule |
|---|---|---|
| `apps/web/src/styles/**`, `apps/web/src/components/ui/**`, every page layout | Claude Code | Single owner of all CSS. Nobody else edits styles |
| `apps/engine`, `apps/api`, `apps/attester`, `apps/indexer`, `apps/collector`, `contracts`, `scripts` | Codex | Frontend may request endpoints; it does not implement them |
| `art/`, `scripts/art/` | Codex runs, operator selects | No auto-selection of final art |
| Public docs (README, SUBMISSION, docs/) | Codex drafts, operator approves wording | No em dashes |

When one agent needs something from the other's area, it writes a one-line request in `PROJECT_STATE.md` under "Requests" and continues with a typed stub that renders a labelled empty state.

## 12.4 The design law (replaces section 6's UI bullet and ARCHITECTURE.md section 9)

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

## 12.5 Frozen, do not modify

Contracts and their deployments. The collector. The append-only store and its triggers. The tick-walk, mark, regime and depth code. Builder Code wiring. Git history (no rewrites; hashes are cited on `/proof`). The attester's signing path, except the version field KTS-0.2 requires.

**Hands off the collector and attester from Thu 24 Sep 05:00 to 09:00 UTC.** The X Liquidity campaign ends at 07:00 UTC and the HKEX Last Call window runs 07:00 to 08:00 UTC. That window is the most valuable evidence in the project.

## 12.6 Gates (additions to section 3)

5. **KTS-0.2 merge**: requires all acceptance items in `KTS-0.2.md` section 7 green and the operator's written go before the attester switches versions. Decision time Tue 22 Sep 18:00 UTC.
6. **Demo position keeper** (testnet, autonomous): requires operator approval and a dedicated testnet wallet that holds only faucet assets.
7. **Image batch**: new cost, operator approval.
8. **Pinning plan change**: new cost, operator approval.

## 12.7 Definition of done, V2 (adds to section 8)

- Playwright E2E test exists for the route or flow, and passes in CI.
- No console errors or hydration warnings on load, navigation or interaction.
- Lighthouse (mobile) on the route: Performance ≥ 85, Accessibility ≥ 95, Best Practices ≥ 95.
- Screenshots (both themes, 390, 768, 1440) viewed by the agent, defects listed and fixed, final set saved under `data/screens/v2/<route>/`.
- Every interactive control either works, is removed, or is disabled with a visible reason. Dead buttons are S1 defects.

## 12.8 V2 degradation ladders

**Art plates:** 1 generated and selected plates. 2 geometric SVG Kerbstone (see `V2-IMAGE-PROMPTS.md` section 5). Never a stock image, never an unmasked rectangle.

**KTS-0.2:** 1 merged and live. 2 not merged, UI and README state the 0.1 truth (see `KTS-0.2.md` section 8).

**Demo position:** 1 keeper maintains a curable position each demo cycle. 2 a single manually opened position before recording. 3 the judge's own Session Max position is the only curable one, and the Credit page says so.

**Curable feed:** 1 indexed endpoint. 2 client-side scan of recent `Borrow` events from the deploy block. 3 hidden, with the lookup form kept.

**Report #2:** 1 full before/after report published Thu 24 Sep by 20:00 UTC. 2 the capture published as an addendum to Report #1. 3 the capture files linked from `/proof` with a one-paragraph note.

## 12.9 V2 kill list

Anything not in `V2-BUILD-PROMPTS.md`. Specifically: new contracts or redeploys, Kerb Desk, Autopilot, Exchange OS, a token, points, a chatbot, AI copy generation in the product, WebGL or Three.js scenes, a charting library, a CSS framework migration, a component library install beyond `lucide-react`, route changes beyond the listed redirects, git history rewrites, and any "while I'm here" refactor of frozen code.
