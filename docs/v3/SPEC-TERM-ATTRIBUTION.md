# SPEC: TERM ATTRIBUTION
## "Why did this term change?", computed from the bundles, never written by hand

---

## 1. Purpose

KTS 0.2 made Kerb's terms move with market time: on 21 Sep, KOx Carry stepped from 55.60% to 51.57% across the New York close. Nothing on the site says so at the moment it happens. A judge sees numbers; nobody tells them *why these numbers, now*. Attribution turns every term change into a sentence with its own numbers, derived deterministically from the two input bundles on either side of the change. It is the most direct way to make the thesis visible without asking anyone to read Methodology.

## 2. Inputs

For an asset, two consecutive posted terms `P` (previous) and `N` (next), each with:
- the posted values (onchain `Terms`),
- the engine report recomputed from its bundle (`capacity` including `margins` for KTS 0.2, `clamped`, `stress` horizons and gaps, `depth` C values, `regime` and the rule that fired),
- the onchain guardrails for the asset.

## 3. What counts as a change

Carry or Session Max moved by at least 0.05 points; debt ceiling moved by at least 1%; regime changed; `usable` flipped; KTS version changed. Everything else is "no material change" and is not listed.

## 4. Decomposition

### 4.1 Carry and Session Max (KTS 0.2)

Per mode: `used = max(floor, raw)`, `raw = k * v * g + s`, `target = LT - used`, then the posted value may differ from `target` through the loosening cap, a guardrail clamp, or an attester clamp (the attester may only clamp tighter).

1. If `P.kts != N.kts`: cause `KTS_VERSION`, stop decomposing.
2. Floor transitions: `FLOOR_ENTER` or `FLOOR_EXIT` with both raw values.
3. Both raw: exact additive split of `Δraw`:
   - `HORIZON` (the gap over the horizon): `k * v_P * (g_N - g_P)`, stating both horizons in hours and their end times, and both gaps.
   - `VOLATILITY`: `k * (v_N - v_P) * g_N`.
   - `EXIT_COST`: `s_N - s_P`, stating the reference size and both impacts.
   The three parts sum to `Δraw` exactly (test it).
4. Posted against target:
   - `LOOSEN_CAP` when the posted value is below target because loosening is capped: state the cap, the target, and the earliest next step time.
   - `GUARDRAIL` when clamped to `ltvMin` or `ltvMax`.
   - `ATTESTER_CLAMP` when the posted value is tighter than the engine value (from `clamped`).

### 4.2 Debt ceiling

`target = k_ceiling * C(1%)` then clamps. Causes: `DEPTH` (C(1%) from, to, the pool, the regime), `LOOSEN_CAP`, `GUARDRAIL`, `ATTESTER_CLAMP`.

### 4.3 Regime and usability

`REGIME`: from, to, and the rule sentence the Methodology page already renders (for example "rule 6: the underlying market is in no session"). `USABLE`: flipped, with the reason (stale source by N seconds, halted).

### 4.4 Ranking and honesty

- Contributions are signed magnitudes in points (or USDG for the ceiling). Sort by absolute size.
- Show every cause with at least 20% of the total move. If the top two are within 30% of each other, the headline says "two causes" and names both.
- Residual above 0.05 points is shown as "rounding and other inputs", never hidden.
- When the decomposition cannot be computed (missing bundle, recompute mismatch), the event says "cause unavailable: {reason}". Never guess.

## 5. "Now" explanations

For the current terms of an asset, three sentences built from the latest report:

- Carry: *"Carry is {LT - carry} points below the fixed {LT}% line: {k} × the {g}% stressed gap over the {H} until the next deep session ({time} UTC), plus {s}% exit cost at ${ref}."* If floored: *"... held at its {floor}-point floor; the horizon is short."*
- Session Max: *"Session Max only has to reach the cure deadline, {H} away ({time} UTC): margin {used} points."*
- Debt ceiling: *"Debt ceiling ${x} is {k_ceiling} × C(1%) ${c1}{, capped while loosening | , clamped tighter onchain}."*

## 6. Templates for change events

| Kind | Sentence |
|---|---|
| HORIZON | "Carry {down/up} {a}% to {b}% ({Δ} pts): the loan must now survive {H_N} to {when_N} instead of {H_P}; the stressed gap over that horizon is {g_N}% (was {g_P}%)." |
| EXIT_COST | "Exit cost at ${ref} {rose/fell} from {s_P}% to {s_N}% as pool depth moved." |
| VOLATILITY | "Recent volatility scaler moved from {v_P} to {v_N}." |
| FLOOR_ENTER | "Margin reached its {floor}-point floor." |
| LOOSEN_CAP | "Would be {target}%, but terms loosen at most {cap} points per step; next step no earlier than {time} UTC." |
| DEPTH | "Debt ceiling ${a} to ${b}: C(1%) moved from ${c_P} to ${c_N} in pool {short address}." |
| REGIME | "Regime {from} to {to}: {rule sentence}." |
| USABLE | "New borrowing paused: {reason}. Repay and cure keep working." |
| ATTESTER_CLAMP | "Posted {x}, tighter than the engine's {y}: the attester may clamp tighter, never looser." |
| KTS_VERSION | "Formula changed from KTS {a} to KTS {b}." |

No em dashes. Times in UTC plus exchange local where it helps. Numbers formatted per the Kerbstone standard.

## 7. Where it runs

- **Engine:** new pure module `apps/engine/src/attribution.ts`: `attribute(prev, next, params) -> Change[]` and `explainNow(report, params) -> Sentences`. Not in the posting path. No I/O.
- **Job:** a small incremental job (inside the API process on a 60 s timer, or PM2 `kerb-attribution`) computes events for new posts and appends them to a new append-only table `term_changes` (`asset, chain_id, at, field, from, to, causes jsonb, prev_tx, next_tx, prev_inputs_hash, next_inputs_hash`). Backfill the last 72 hours once, after Thu 09:00 UTC.
- **API:** `GET /v1/terms/:chain/:asset/why` (now sentences, cached by latest inputsHash) and `GET /v1/terms/:chain/:asset/changes?hours=72` (events, newest first). Document both in `docs/API.md` with captured real responses.

## 8. UI placement

- **Asset page:** a "Why these terms" block directly under the KPI band (three sentences, each with a ProvMark to its bundle). Below the Terms history chart, a "What changed" timeline for 72 hours with chips (Carry, Session Max, Ceiling, Regime); each row: time, field from to, headline cause, tx link. Chart markers at each event with the same sentence on hover.
- **Credit:** one computed line under each mode card.
- **Home:** the Carry and Session Max section uses the Carry "now" sentence in place of the current static margin line.
- **Board:** hover card on the Terms cell only. Nothing added to the row.
- **Agents:** the `why` array in `credit-check`.

## 9. Tests

- Synthetic unit tests per cause, including the exact additive split.
- Golden tests on stored bundles: KOx across 21 Sep 20:00 UTC (expect HORIZON dominant), a Hong Kong lunch transition, a depth fall that moves the ceiling, a Monday or morning loosening capped by `maxLoosenStep`, and the 0.1 to 0.2 switch on 21 Sep 19:38 UTC (expect KTS_VERSION).
- Parity: every event's causes sum to the observed move within 0.01 points.
- UI: no template placeholder ever renders (`{` in DOM fails the test); every sentence has a ProvMark.
