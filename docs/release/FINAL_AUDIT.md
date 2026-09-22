# Final audit

Against the final gates in `docs/v2/V2-AUDIT.md` section 10. Evidence only; each line says where to
check it. Updated at the cutover and again on submission day.

| Gate | Pass condition | Status | Evidence |
|---|---|---|---|
| A Eligibility | Form fields, public repo, video 2 to 4 min, addresses, product link | Repo public, addresses and link ready; video and form Fri 25 Sep | `SUBMISSION_CHECKLIST.md` |
| B Golden path | Fresh wallet: onboard, Session Max, Last Call, cure, repay, on the live site | Passed on staging, the build cut over, with fresh wallets; to be repeated on the apex after cutover | `data/credit-flow-2026-09-22*.json`; RELEASE_STATE.md |
| C X Layer | Mainnet posts in the last hour, Builder Code decoded on `/proof` | Passing continuously | `/proof` first and third tiles; `/health` |
| D Security | No secrets in history; no new privileged keys beyond the demo wallet | Full-history scan clean (17 live secret values, 0 found); the only new keys are throwaway testnet flow wallets, stored on the VPS, never committed | V2-11 notes in PROJECT_STATE.md |
| E UX | Each page passes the 10-second test | Home test passed (V2-06); a full real-user walkthrough of every page follows the cutover | `data/screens/v2/final-22sep` |
| F Responsive | 390, 768, 1440, both themes, no horizontal scroll | Passing; E2E at 390 on every route | `apps/web/e2e/shell.spec.ts`, `reference-pages.spec.ts` |
| G Repository | CI green, README accurate, root clean | CI green; README rewritten for judges 22 Sep | GitHub Actions; `README.md` |
| H Demo | Video uploaded, plays logged out | Operator, Fri 25 Sep | `DEMO_VERIFICATION.md` |
| I Claims | `CLAIM_EVIDENCE.md` complete | Complete for site, README and form text | `CLAIM_EVIDENCE.md` |
| J Submission | Submitted by 18:00 UTC with receipt | Fri 25 Sep | `SUBMISSION_CHECKLIST.md` |

## Quality measures on the release build

- Tests: 545 TypeScript, 106 Solidity, 47 E2E (functional, links, axe on 10 routes in both themes).
- Accessibility: zero serious or critical axe findings; every text and surface token pair at AA in both themes; focus ring on every control; the credit flow completed keyboard only.
- Lighthouse mobile on production, idle GitHub runner, median of three, 22 Sep 16:20 UTC: Home 99, Board 100, Asset 99, Credit 95, Research 95, Report 99, Methodology 95, Proof 94, Developers 99, Changelog 99; Accessibility 99 to 100; Best Practices 96 to 100.
- Dead buttons: 277 pressed on every route in both themes, none dead.
- Performance and correctness work found by these checks and fixed on 22 Sep: gas estimates from a lagging node (two out-of-gas sends), a MAX that rounded a balance up, a wallet on the wrong network shown as on X Layer testnet, duplicate wallets in the connect sheet, a hydration mismatch after reconnect, a Board layout shift of 0.13, and an unknown address answering 200.
