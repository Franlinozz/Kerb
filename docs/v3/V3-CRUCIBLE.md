# V3-CRUCIBLE.md
## Final certification. Nothing is ticked without the evidence named in its row.

Run in V3-11 (Fri 00:00 to 04:00 UTC) against production, then again in a 10-minute cold check before submitting. Record evidence paths in `docs/release/FINAL_AUDIT.md`.

---

## A. Eligibility
| Check | Evidence |
|---|---|
| Repo public, opens logged out | Private-window screenshot |
| Product reachable logged out, apex and www | curl status for both |
| Video 2:00 to 4:00, plays logged out on desktop and phone | Duration, two screenshots |
| Remote route and Build a Market stated consistently everywhere | grep of README, form text |
| Contract addresses and technical links in the form resolve | Link check output |

## B. Freshness (the V3 S0)
| Check | Evidence |
|---|---|
| After 10 minutes of no traffic, first paint on `/`, `/board`, `/credit`, `/proof`, `/methodology`, one asset: asOf under 60 s or Refreshing state | `freshness.idle.spec.ts` on production, with warmer stopped then started |
| With the warmer running: first-paint age median under 30 s across 10 loads per route | Age table |
| No "Updating" visible over 5 s during a 10-minute watch of Board and Credit | Recording |
| No uppercase underscore token in any DOM | E2E regex |

## C. Golden path (fresh wallet, real browser)
Connect → switch to X Layer testnet → test OKB → mint collateral and mUSDG → deposit → Session Max → borrow → demo Last Call → the standing demo position is in Curable now → stranger cures from a second wallet → own position cured or repaid → withdraw. Every receipt success. Evidence: `data/credit-flow-<date>.json` and tx list on `/proof`.

## D. Keeper
| Check | Evidence |
|---|---|
| Three consecutive cycles: position opens in SESSION, curable in LAST_CALL, cleaned in CLOSED | `data/keeper.log` excerpt with tx hashes |
| One stranger cure, keeper re-arms next cycle | tx hashes |
| Refuses any chain but 1952 | test output |

## E. X Layer
| Check | Evidence |
|---|---|
| Mainnet Terms post within the last 15 minutes | `/health` |
| Builder Code decodes on the latest mainnet post and on the cure tx | `/proof` row, OKLink |
| All contracts Sourcify exact match, including consumers | Sourcify links |
| `KerbQuote.quoteToken` on mainnet equals the API's credit-check numbers for the same inputs (within rounding down) | cast output beside API output |

## F. OKX DEX
| Check | Evidence |
|---|---|
| Cross-check source healthy, or degraded with a visible reason | `/v1/exit` response |
| Exit check panel shows both figures, the bound, the age | Screenshot |
| Conservative selection: capacity used equals the smaller figure in 10 of 10 sampled checks | Script output |

## G. OKX.AI and agents
| Check | Evidence |
|---|---|
| `curl -i -X POST /agents/credit-check` returns 402 with `PAYMENT-REQUIRED` | Header capture |
| Listing status stated exactly as the latest OKX email says | Email screenshot, `/v1/agents/stats` |
| At least one settled payment on X Layer mainnet (or testnet at rung 3), tx on `/proof` | OKLink |
| No settlement on a forced 503 | Test output |
| MCP `tools/list` and one call per tool succeed from a real MCP client | Transcript |
| Rate limits answer 429 with a plain reason | curl |

## H. Attribution
| Check | Evidence |
|---|---|
| "Why these terms" on three assets matches the report numbers | Screenshots beside `/why` output |
| Change events sum to the observed moves within 0.01 points | Test output |
| No template placeholder in any DOM | E2E |

## I. Proof and research
| Check | Evidence |
|---|---|
| Latest bundle fetches; `kerb verify` reproduces a post from the last hour | Terminal output |
| No "pinned" claim anywhere without a resolving CID | claims-check |
| Report #1 unchanged except the dated appendix | git diff |
| Report #2 published with exact window, gaps visible, no interpolation; final version after Fri 07:05 | URL, screenshot |
| Dataset downloads, row counts match | curl |

## J. Frontend
At 390, 768, 1440 in Night, Day and Market time: no horizontal overflow, no nav collision, readable charts, no clipped art, no raw RPC or contract error, visible focus, full keyboard path through Credit, Day header visible on every route. Evidence: `data/screens/v3/` and E2E.

## K. Quality
Lint, typecheck, TypeScript tests, Forge tests, E2E in CI, `e2e:live`, axe (zero serious or critical), Lighthouse mobile per route (table), dead-button sweep (zero dead), full-history secret scan (facilitator and OKX keys absent), em dash check, claims-check. Evidence: CI URL and outputs.

## L. Repository
Root clean; README top per `V3-POSITIONING.md` section 5 with the video link; addresses current; `BUILD_PERIOD.md` current; `AGENTS.md` sections 12 and 13 present; `PROJECT_STATE.md` final; `docs/release/*` updated; every public claim has a `CLAIM_EVIDENCE.md` row.

## M. Demo
Real footage only; every spoken claim visible on screen at the same moment; the hero moment (Session Max, Last Call, stranger's cure) is unmistakable; X Layer and OKX surfaces visible (OKLink, Builder Code, OKX DEX figure, x402 settlement); Proof shown; under 4:00; waits speed-tagged; captions on.

## N. Submission
Exact legal name; team size 1; Build a Market; Remote; attend 0; display picture uploaded; summary pasted from the verified source with the true OKX.AI bracket; repo, video and product links; "Yes, new project"; receipt saved.

---

## Verdict format (write into FINAL_AUDIT.md)

```
CRUCIBLE RELEASE VERDICT, Kerb v3.0.0 (<commit>)
Golden path:            VERIFIED / PARTIAL / FAILED
Freshness:              VERIFIED / PARTIAL / FAILED
Keeper:                 rung <n>
Agents:                 rung <n>, listing <status>, first mainnet settlement <tx or none>
Onchain consumers:      rung <n>
Report #2:              rung <n>
Critical blockers:      <count>
Completion score:       <n>/100
Win readiness:          <n>/100
Recommendation:         SHIP / CONDITIONAL SHIP / DO NOT SHIP
Remaining risks:        <list>
```
