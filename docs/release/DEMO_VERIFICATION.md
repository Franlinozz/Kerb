# Demo verification (V3-DEMO.md, filmed Fri 25 Sep 2026)

No production deploys 06:00 to 10:30 UTC. Checked against production at 25 Sep 02:30 to 02:55 UTC.

## Demo Last Call times (KerbClockDemo, one market week per hour)

Read from `/v1/credit/1952/demo-clock`: `weekLengthSec 3600`, `cureStartSec 2400`, `sessionEndSec 3000`, cycles start at hh:13:58 UTC.

| Cycle starts (SESSION) | Keeper opens by | Last Call opens | Last Call closes (anyone may cure after the owner) | CLOSED until |
|---|---|---|---|---|
| 06:13:58 | 06:48:58 | **06:53:58** | 07:03:58 | 07:13:58 |
| 07:13:58 | 07:48:58 | **07:53:58** | 08:03:58 | 08:13:58 |
| 08:13:58 | 08:48:58 | **08:53:58** | 09:03:58 | 09:13:58 |
| 09:13:58 | 09:48:58 | **09:53:58** | 10:03:58 | 10:13:58 |

Best take: the Hong Kong cold open at 07:30 to 08:00 on mainnet, then the Credit hero on the 07:53:58 demo Last Call. Open Profile A's Session Max position between 07:14 and 07:48.

## Shots

| Shot | Expected on screen | Tested | Fallback |
|---|---|---|---|
| Cold open, Board | HKEXCx and other Hong Kong rows in brass Last Call before the 08:00 UTC close, countdown ticking | Board live; HKEXCx regime history shows Pre-transition at 07:33 on 24 Sep (same window) | Hong Kong lunch Last Call 03:30 to 04:00 UTC; or 24 Sep B-roll |
| Home hero | "Credit on the market's clock", both clocks, pool callouts | Screenshot `docs/media/screens/home.webp` | None needed |
| Asset HKEXCx | Exit check (tick-walk, OKX DEX quote, difference, capacity used), "Why these terms", Terms history step | Screenshots `asset-why.webp`, `asset-exit.webp` | KOx, same panels |
| Credit hero | Profile A position at Session Max; Last Call panel; the keeper's kKOx position in Curable now; Profile B cures it; Profile A back at Carry | Keeper opened kKOx at 02:49 UTC, curable 02:53:58; golden path passed on production 23 Sep (`data/credit-flow-2026-09-23.json`) | Profile B cures Profile A's own position |
| Proof | Cure tx on OKLink with the Builder Code decoded; `kerb verify` printing MATCHES | `data/release/crucible-2026-09-25/kerb-verify-stranger.txt` | `/proof` live recompute panel |
| Agents | 402, payment in USDT0 on X Layer, answer; settlement on OKLink | 402 header captured (`checks.txt`); first mainnet settlement `0xb0befc3e…e982e` | Show the recorded settlement; say "registered on OKX.AI, listing under review" |
| Contracts | `cast call` KerbQuote on mainnet returns max borrow | `kerbquote-kox-25.txt`: 992393683 for 25 KOx at Carry | Drop the beat |
| Research | Report #2 headline: held at the cliff, 5 of 10 fell 10% or more by 08:30 UTC, HKEXCx −82.80%, HK close caveat | `/research/2` live; final regeneration Fri 07:15 UTC | Say the partial finding with its window |

## Terminal 2, pre-typed

```bash
# Recompute the latest KOx post with no database: bundle from the API (checked by hash), posted values from KerbTerms
H=$(curl -s https://api.usekerb.xyz/v1/terms/196/KOx | jq -r .inputsHash)
env -u DATABASE_URL pnpm --silent --filter @kerb/engine kerb verify $H

# Any contract can read the terms: KerbQuote.maxBorrow for 25 KOx at Carry, on X Layer mainnet
cast call --rpc-url https://rpc.xlayer.tech 0x223d5e2a97d751403300b55aa92c88a42920e52a \
  "maxBorrow(bytes32,uint256,uint8)(uint256)" \
  $(cast keccak $(cast abi-encode "f(uint256,address)" 196 0xdCC1a2699441079dA889B1F49e12B69cC791129b)) 25000000000000000000 0
```

## Terminal 1, the paid call

`apps/agents/scripts/pay-once.ts` pays from the Kerb-owned payer (`0xeB3e…2e8E`, key in `/root/.kerb/payer.env`) and prints the settlement tx. With an Onchain OS agent, use the OKX.AI service once the listing is approved.
