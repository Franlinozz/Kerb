# V3 LIVE AUDIT
### Production as captured 23 Sep 2026 08:32 to 08:35 UTC (13 screenshots), traced to source at `d7202a7`

Severity: S0 blocks the promise of the product, S1 damages judging, S2 visible defect, S3 polish.
Every item has a root cause, a fix and an acceptance test. "Verify" means the screenshot is suggestive but not conclusive; the agent confirms before fixing.

---

## L-01 (S0) First paint is hours old on live pages

**Evidence**
- `/board`: "Updated 5h 50m ago · refreshes every 30 seconds". Rows show Hong Kong names as Normal and New York names as Closed: the state at about 02:43 UTC, the Hong Kong morning session. At capture time (08:33 UTC) the live Tape on Home shows MIXUx and SHEINx Closed and New York names Normal (pre-market).
- `/board` Next column: "Pre-market in Updating", "LUNCH_BREAK in Updating": transitions already in the past.
- `/credit` Curable section: "The next demo Last Call opens in Updating, at 04:53 UTC" while the demo rail above it says "Next Last Call in 20m 11s, 08:53 UTC".
- `/proof`: "Generated 2026-09-23 06:40 UTC" viewed at 08:33.
- `/methodology`: "BRK.Bx is Closed by rule 6" at 08:33, when New York was in pre-market.
- Home Board preview: MIXUx Normal while the Tape on the same page says Closed.

**Root cause (two parts)**
1. Every live route uses ISR (`revalidate` 5 to 60 s). ISR is stale-while-revalidate: the first request after expiry gets the old page and triggers a background render for the *next* visitor. On a low-traffic site, each judge receives the page rendered at the previous visit, which can be hours old.
2. `apps/web/src/components/kerb/useLive.ts` passes `initialDataUpdatedAt: Date.now()`, so React Query treats hours-old server data as fresh and waits a full `refetchInterval` (30 s on the Board) before correcting it. Countdowns computed from those stale targets render "Updating".

V2's E2E suite did not catch this because it loads pages repeatedly in a warm cache.

**Fix**
1. `useLive` takes an `asOf` extractor per payload (`generatedAt`, `at`, `observedAt`, `now`) and sets `initialDataUpdatedAt` from it, with `staleTime: 5_000`. A stale initial payload refetches immediately on mount.
2. Freshness guard: if the initial payload is older than 90 s, every live value renders in a "Refreshing" state (values dimmed, a small "Refreshing live data" line in place of "Updated ...") until the refetch returns. A stale regime is never shown as current. If the refetch fails, show "Last known, {age} old" with a retry, never a silent stale number.
3. Warmer: a PM2 process `kerb-web-warmer` requests `/`, `/board`, `/credit`, `/proof`, `/methodology`, `/research`, and the ten `/asset/*` pages every 10 s (Credit every 5 s) from localhost through Caddy, with a 5 s timeout and no concurrency above 2. This keeps ISR regenerating so first paint is normally under 25 s old. It also keeps the API's 15 s caches warm.
4. Server render stamps `data-asof` on the page root; the E2E reads it.

**Acceptance**
- New E2E `freshness.idle.spec.ts`: stop the warmer, wait 10 minutes (CI uses a fixture clock), load each live route cold, assert that the first painted `asOf` is either under 60 s old or rendered in the Refreshing state, and that within 5 s of load the live values are under 60 s old.
- Production check after deploy: with the warmer on, `asOf` age on first paint under 30 s on every live route, measured 10 times over an hour.
- No "Updating" text visible for more than 5 s on any page in a 10-minute watch.

## L-02 (S1) Raw enum in the Board's Next column

**Evidence:** "LUNCH_BREAK in Updating" on HKEXCx, KUAIx, SHEINx, MIXUx rows.
**Root cause:** `packages/calendar/src/timeline.ts` emits `PRE_OPEN | SESSION_OPEN | LUNCH_BREAK | LUNCH_END | SESSION_CLOSE | EARLY_CLOSE | POST_CLOSE | SESSION_BREAK | SESSION_END`. `apps/web/src/lib/time.ts` maps `LUNCH_START` (not emitted) and lacks `LUNCH_BREAK`, `POST_CLOSE`, `SESSION_BREAK`, `SESSION_END`.
**Fix:** export the transition union from `@kerb/calendar` (or `@kerb/types`), and type both word maps as `Record<TransitionType, string>` so a missing key fails `tsc`. Words: `LUNCH_BREAK` "Lunch break", `LUNCH_END` "Resumes", `POST_CLOSE` "After hours end", `SESSION_BREAK` "Session break", `SESSION_END` "Session ends", `EARLY_CLOSE` "Early close". Grep the API and docs for the same mismatch.
**Acceptance:** typecheck fails if a key is removed; a unit test renders every union member; no uppercase underscore token ever reaches the DOM (E2E regex check on every route).

## L-03 (S1) No standing demo position

**Evidence:** Credit: "No position needs a cure right now ... Kerb does not keep a standing demo position."
**Root cause:** `apps/attester/scripts/demo-keeper.ts` written, PM2 entry exists, wallet `0xacCd2b8B681eF9C5BeB1A2d08872652170EfC0f4` unfunded, not started.
**Fix:** V3-02.
**Acceptance:** during three consecutive demo Last Call windows the keeper position appears in Curable now; one is cured from a second wallet in a real browser; the keeper re-arms next cycle; the copy changes to describe the standing position.

## L-04 (S1) False and stale claims

| Where | Says | Truth | Replace with |
|---|---|---|---|
| Home, "How a term is made" lede | "each pinned in a bundle anyone can recompute" | Proof: last 24 h, 0 from IPFS, 2,770 from the API | "each published in an input bundle anyone can fetch and recompute" |
| `docs/planning/SUBMISSION.md` | "Currently private, must be made public" | Repo is public | Remove |
| `docs/planning/SUBMISSION.md` | "Lending protocols in production treat all of those moments as identical collateral" | Overbroad; several stock lenders use session-aware oracles | See `V3-POSITIONING.md` section 4 |
| `docs/planning/SUBMISSION.md` | "USDG as the loan asset" | Mainnet terms are denominated in USDG; the testnet credit plane lends mUSDG | "debt capacity denominated in USDG" |
| `docs/planning/SUBMISSION.md` | "recomputed from its pinned input bundle" | Same as above | "from its published input bundle" |
| `apps/web/src/lib/art.ts` line 3 | "P4 (The Seal) has no approved master" | Approved 22 Sep, placed on Proof | Remove the sentence |
| `PROJECT_STATE.md` V2 table rows V2-03, V2-10, decisions | "The Seal has no approved image, Proof keeps the geometric Kerbstone" | Placed 22 Sep | Update with commit `787f66e` |
| Anywhere | "KTS 0.1" as current | 0.2 live since 21 Sep | Keep 0.1 only when describing old bundles |

**Acceptance:** `scripts/claims-check.sh` (new) greps for a denylist (`pinned`, `currently private`, `identical collateral`, `loan asset is USDG`, `no approved master`, `geometric Kerbstone` in current-state docs) across README, docs (excluding `docs/v2/` history), and `apps/web/src`; CI fails on a hit. Every remaining public claim appears in `docs/release/CLAIM_EVIDENCE.md` with its evidence.

## L-05 (S2) "Refreshes every 30 seconds" is shown even when refresh fails

**Fix:** part of L-01 item 2: the live line states the real state ("Updated 12 s ago", "Refreshing", "Last known 4 m ago, retrying").

## L-06 (S2, verify) Day theme header on `/proof`

**Evidence:** the Day capture of `/proof` shows no header at scroll 0. Probably a full-page capture artefact of the sticky header, but the Night capture shows it.
**Fix:** verify with Playwright at scrollY 0 and 400 in Day on every route; if the header is invisible, fix the token.
**Acceptance:** screenshot assertion that the wordmark and nav are visible in Day on every route.

## L-07 (S2) The SDK is not installable

**Evidence:** Developers: "It is not on npm yet, so take it from the repository", then `curl -o kerb.ts ...raw.githubusercontent...`.
**Fix:** if the operator has an npm account, publish `@kerb/sdk` 0.2.0 (remove `private: true`, add `exports`, `files`, README, provenance) and change the Developers tab to `npm i @kerb/sdk`. Otherwise keep the curl path and add `npx degit Franlinozz/Kerb/packages/sdk` as a second option. Either way the tab states which is true.

## L-08 (S2, verify) Mirror terms freshness on Credit

**Evidence:** kHKEXCx card shows Normal at 16:33 HKT (after the Hong Kong close). Likely L-01 (ISR), but the relay cadence of mainnet terms to the testnet mirrors must be confirmed.
**Fix:** measure the lag between a mainnet post and the matching testnet mirror post over 24 h; if the median exceeds 10 min, document it on the card ("relayed {age} ago") and in the Credit drawer.
**Acceptance:** each collateral card shows "relayed {age} ago" from the testnet post, and the median lag is stated in `RELEASE_STATE.md`.

## L-09 (S2) Home counts disagree across pages

**Evidence:** Home "Terms posted on X Layer mainnet 4,229"; Proof tile "Live · 4,126 posts" at nearly the same time.
**Root cause:** different cache ages (L-01) and different sources (`/v1/stats` 60 s cache, `/v1/proof` 30 s page).
**Fix:** after L-01, both read `/v1/stats` for the headline count, and each shows its own `asOf` in the ProvMark card.

## L-10 (S3) Research: Report #2 row after publication

**Fix:** when `/v1/market-time/2` exists, the Scheduled row flips to a normal row automatically and the featured card switches to #2. Covered by E2E with a fixture.

## L-11 (S3) Credit collateral cards show mirror LT without the word "mirror"

**Evidence:** kKOx "Liquidation 68.0%" beside Home's BRK.Bx "65.0% fixed".
**Fix:** label as "Liquidation 68.0% (mirror listing)" with the existing explanation in the hover card.

---

## Things verified as correct (do not touch)

Hero art and composition; the Tape; two-lane rail with day-centred labels and the NOW flag; KTS 0.2 margin sentence on Home; Carry and Session Max cards with live dollar amounts; LTV ladder label layout; Board KPI band, filters, sparklines and compact ladders; Credit three-zone workspace, Get set up checklist, demo rail, mode cards, previews; Research featured card and scheduled row; Methodology contents rail and live regime highlight; Developers tabs, live response, endpoint table, contract table (all Sourcify exact match); Proof status matrix, live recompute with field-by-field result, limitations; footer clocks and wordmark.
