# Kerb API

Base URL `https://api.usekerb.xyz`. Read-only, JSON, CORS open for GET. Every number carries a provenance label: Verified, Observed, Attested or Computed. A chain or source that does not answer returns a labelled error (502 with `label: "Unavailable"`), never a stack trace.

Examples below were captured from production on 21 Sep 2026 19:51 UTC by `scripts/api-doc.py`. Arrays are cut to their first two items and long strings shortened; nothing is invented.

| Method | Path | What |
|---|---|---|
| GET | `/health` | Observation freshness and post counts per chain. |
| GET | `/v1/board?chain=196` | One row per asset: posted terms with provenance, the fixed LT, market, next transition, Last Call window, KTS version and margins, a 24 h C(1%) spark; plus a summary. Cache 15 s. |
| GET | `/v1/terms/:chain/:asset` | Latest posted terms for one asset (symbol, token address or assetId), with the bundle link. |
| GET | `/v1/clock/:chain/:asset?from&to` | The asset's market clock and session segments over a window (max 31 days). |
| GET | `/v1/report/:chain/:asset` | The full KTS report recomputed now from observations: depth curve, mark, stress, capacity, margins. Cache 60 s. |
| GET | `/v1/proof` | Deployments and verification, recent posts, data coverage, pinning, limitations. |
| GET | `/v1/params` | The live KTS parameter file. |
| GET | `/v1/tape?limit=20` | Newest Terms posts across both chains (limit 1 to 100). Cache 15 s. |
| GET | `/v1/stats` | Headline counts: observation rows, posts by chain, assets, markets, latest Market-Time Report. Cache 60 s. |
| GET | `/v1/credit/:chain` | Credit market state: pool, collaterals with their fixed LT and relayed terms, disclaimer. |
| GET | `/v1/credit/:chain/demo-clock` | The testnet demo clock as a schedule: phase, state, next Last Call. Cache 5 s. |
| GET | `/v1/credit/:chain/positions?state=curable\|all` | Every open position found from KerbCredit events, curable first, then by deadline. Cache 30 s. |
| GET | `/v1/credit/:chain/position/:user/:assetId` | One position: debt, LTV, health against the fixed LT, covenant status. |
| GET | `/v1/market-time` | Published Market-Time Reports. |
| GET | `/v1/market-time/:id` | One Market-Time Report. |
| GET | `/v1/reports` | Stored KTS report ids. |
| GET | `/v1/reports/:id` | One stored KTS report. |
| GET | `/v1/bundle/:hash` | The exact input bundle posted under an inputsHash (or a report id). keccak256 of the bytes equals the hash. |

## `GET /health`

Observation freshness and post counts per chain.

`/health`

```json
{
 "status": "ok",
 "now": "2026-09-21T19:51:49.972Z",
 "observations": {
  "poolRows": 52215,
  "lastObservedAt": "2026-09-21T19:51:44.842Z",
  "ageSec": 5
 },
 "posts": [
  {
   "chainId": 196,
   "count": 1720,
   "lastAt": "2026-09-21T19:49:13.762Z"
  },
  {
   "chainId": 1952,
   "count": 1871,
   "lastAt": "2026-09-21T19:49:34.086Z"
  }
 ]
}
```

## `GET /v1/board?chain=196`

One row per asset: posted terms with provenance, the fixed LT, market, next transition, Last Call window, KTS version and margins, a 24 h C(1%) spark; plus a summary. Cache 15 s.

`/v1/board?chain=196`

```json
{
 "chainId": 196,
 "loanAsset": "USDG",
 "generatedAt": "2026-09-21T19:51:49.045Z",
 "contracts": {
  "KerbClock": "0xf765d374e0ce576860a463f0d796ad45c62161b8",
  "KerbTerms": "0x6d6eaf24c498df6cef0954f6d19ab4ea7b0102d5",
  "explorer": "https://www.oklink.com/xlayer/address/0x6d6eaf24c498df6cef0954f6d19ab4ea7b0102d5"
 },
 "rows": [
  {
   "symbol": "BRK.Bx",
   "underlying": {
    "symbol": "BRK.B",
    "market": "XNYS",
    "currency": "USD"
   },
   "pool": {
    "address": "0x34Fa7515d3364648F558aa876F73feC12e2bA507",
    "quote": "USDG",
    "fee": 500,
    "explorer": "https://www.oklink.com/xlayer/address/0x34Fa7515d3364648F558aa876F73feC12e2bA507"
   },
   "status": "live",
   "regime": {
    "value": "PRE_TRANSITION",
    "label": "Attested",
    "source": "KerbTerms 196",
    "observedAt": "2026-09-21T19:47:44.000Z",
    "tx": "https://www.oklink.com/xlayer/tx/0x1339858c89f27e94e3d3be9b52d4eca4bfbc40e38e94a7fc87b965959f8ca8e2"
   },
   "creditMark": {
    "value": "499.082526932377911245",
    "label": "Attested",
    "source": "KerbTerms 196",
    "observedAt": "2026-09-21T19:47:44.000Z",
    "inputsHash": "0x51b6504510c38af001bbfc02e5926dad7ce4e07a983fe1a201d23032fadca54e",
    "tx": "https://www.oklink.com/xlayer/tx/0x1339858c89f27e94e3d3be9b52d4eca4bfbc40e38e94a7fc87b965959f8ca8e2"
   },
   "executableDepth1": {
    "value": "12824.104492",
    "label": "Attested",
    "source": "KerbTerms 196",
    "observedAt": "2026-09-21T19:47:44.000Z",
    "inputsHash": "0x51b6504510c38af001bbfc02e5926dad7ce4e07a983fe1a201d23032fadca54e",
    "tx": "https://www.oklink.com/xlayer/tx/0x1339858c89f27e94e3d3be9b52d4eca4bfbc40e38e94a7fc87b965959f8ca8e2"
   },
   "carryLTV": {
    "value": "0.561",
    "label": "Attested",
    "source": "KerbTerms 196",
    "observedAt": "2026-09-21T19:47:44.000Z",
    "inputsHash": "0x51b6504510c38af001bbfc02e5926dad7ce4e07a983fe1a201d23032fadca54e",
    "tx": "https://www.oklink.com/xlayer/tx/0x1339858c89f27e94e3d3be9b52d4eca4bfbc40e38e94a7fc87b965959f8ca8e2"
   },
   "sessionMaxLTV": {
    "value": "0.612",
    "label": "Attested",
    "source": "KerbTerms 196",
    "observedAt": "2026-09-21T19:47:44.000Z",
    "inputsHash": "0x51b6504510c38af001bbfc02e5926dad7ce4e07a983fe1a201d23032fadca54e",
    "tx": "https://www.oklink.com/xlayer/tx/0x1339858c89f27e94e3d3be9b52d4eca4bfbc40e38e94a7fc87b965959f8ca8e2"
   },
   "debtCeiling": {
    "value": "9618.078369",
    "label": "Attested",
    "source": "KerbTerms 196",
    "observedAt": "2026-09-21T19:47:44.000Z",
    "inputsHash": "0x51b6504510c38af001bbfc02e5926dad7ce4e07a983fe1a201d23032fadca54e",
    "tx": "https://www.oklink.com/xlayer/tx/0x1339858c89f27e94e3d3be9b52d4eca4bfbc40e38e94a7fc87b965959f8ca8e2"
   },
   "coverageRatio": {
    "value": "1.333333",
    "label": "Computed",
    "source": "C(1%) / debtCeiling",
    "observedAt": "2026-09-21T19:47:44.000Z"
   },
   "reportAgeSec": 245,
   "poolObservedAt": "2026-09-21T19:51:44.013Z",
   "poolObservationAgeSec": 5,
   "kts": "0.2",
   "margins": {
    "label": "Computed",
    "inputsHash": "0x51b6504510c38af001bbfc02e5926dad7ce4e07a983fe1a201d23032fadca54e",
    "stressMultiplier": "2.5",
    "carry": {
     "margin": "0.08438730780197121",
     "gap": "0.039247105934017156",
     "exitCost": "0.0079234626",
     "floor": "0.05",
     "horizonHours": "17.7042",
     "horizonEndsAt": "2026-09-22T13:30:00.000Z"
    },
    "session": {
     "margin": "0.03",
     "gap": "0",
     "exitCost": "0.0079234626",
     "floor": "0.03",
     "horizonHours": "0",
     "horizonEndsAt": "2026-09-21T19:47:44.859Z"
    },
    "carryMarginUsed": "0.08438730780197121",
    "sessionMarginUsed": "0.03",
    "horizonEndsAt": "2026-09-22T13:30:00.000Z"
   },
   "lt": {
    "value": "0.65",
    "label": "Verified",
    "source": "KerbTerms 196 guardrails",
    "observedAt": "2026-09-21T19:51:49.045Z"
   },
   "market": {
    "code": "XNYS",
    "city": "New York",
    "tz": "America/New_York",
    "lat": 40.7069,
    "lon": -74.0113
   },
   "next": {
    "type": "SESSION_CLOSE",
    "at": "2026-09-21T20:00:00.000Z",
    "weakening": "2026-09-21T20:00:00.000Z",
    "label": "Computed"
   },
   "cure": {
    "opensAt": "2026-09-21T19:00:00.000Z",
    "closesAt": "2026-09-21T20:00:00.000Z",
    "open": true,
    "label": "Computed"
   },
   "spark": [
    {
     "at": "2026-09-20T20:23:20.000Z",
     "c1": "17458.24707",
     "regime": "REFERENCE_CLOSED"
    },
    {
     "at": "2026-09-20T20:53:20.000Z",
     "c1": "17458.24707",
     "regime": "REFERENCE_CLOSED"
    },
    "... 46 more"
   ]
  },
  {
   "symbol": "HKEXCx",
   "underlying": {
    "symbol": "388",
    "market": "XHKG",
    "currency": "HKD"
   },
   "pool": {
    "address": "0x293A6167Bed3A474b99f450dE817BC4474087Ed4",
    "quote": "USDG",
    "fee": 500,
    "explorer": "https://www.oklink.com/xlayer/address/0x293A6167Bed3A474b99f450dE817BC4474087Ed4"
   },
   "status": "live",
   "regime": {
    "value": "REFERENCE_CLOSED",
    "label": "Attested",
    "source": "KerbTerms 196",
    "observedAt": "2026-09-21T19:47:44.000Z",
    "tx": "https://www.oklink.com/xlayer/tx/0x2b8f9bab1233c6d34b35ae22a02bb16c62c286f9253a49074074c25e21ec309f"
   },
   "creditMark": {
    "value": "48.387930497969688097",
    "label": "Attested",
    "source": "KerbTerms 196",
    "observedAt": "2026-09-21T19:47:44.000Z",
    "inputsHash": "0xe8731ea91839f6c34eb48953c3f0d1dee0ef27e21173b79c55002c0c073d5a6c",
    "tx": "https://www.oklink.com/xlayer/tx/0x2b8f9bab1233c6d34b35ae22a02bb16c62c286f9253a49074074c25e21ec309f"
   },
   "executableDepth1": {
    "value": "16918.817382",
    "label": "Attested",
    "source": "KerbTerms 196",
    "observedAt": "2026-09-21T19:47:44.000Z",
    "inputsHash": "0xe8731ea91839f6c34eb48953c3f0d1dee0ef27e21173b79c55002c0c073d5a6c",
    "tx": "https://www.oklink.com/xlayer/tx/0x2b8f9bab1233c6d34b35ae22a02bb16c62c286f9253a49074074c25e21ec309f"
   },
   "carryLTV": {
    "value": "0.5",
    "label": "Attested",
    "source": "KerbTerms 196",
    "observedAt": "2026-09-21T19:47:44.000Z",
    "inputsHash": "0xe8731ea91839f6c34eb48953c3f0d1dee0ef27e21173b79c55002c0c073d5a6c",
    "tx": "https://www.oklink.com/xlayer/tx/0x2b8f9bab1233c6d34b35ae22a02bb16c62c286f9253a49074074c25e21ec309f"
   },
   "sessionMaxLTV": {
    "value": "0.524196297644338378",
    "label": "Attested",
    "source": "KerbTerms 196",
    "observedAt": "2026-09-21T19:47:44.000Z",
    "inputsHash": "0xe8731ea91839f6c34eb48953c3f0d1dee0ef27e21173b79c55002c0c073d5a6c",
    "tx": "https://www.oklink.com/xlayer/tx/0x2b8f9bab1233c6d34b35ae22a02bb16c62c286f9253a49074074c25e21ec309f"
   },
   "debtCeiling": {
    "value": "11792.896746",
    "label": "Attested",
    "source": "KerbTerms 196",
    "observedAt": "2026-09-21T19:47:44.000Z",
    "inputsHash": "0xe8731ea91839f6c34eb48953c3f0d1dee0ef27e21173b79c55002c0c073d5a6c",
    "tx": "https://www.oklink.com/xlayer/tx/0x2b8f9bab1233c6d34b35ae22a02bb16c62c286f9253a49074074c25e21ec309f"
   },
   "coverageRatio": {
    "value": "1.434662",
    "label": "Computed",
    "source": "C(1%) / debtCeiling",
    "observedAt": "2026-09-21T19:47:44.000Z"
   },
   "reportAgeSec": 245,
   "poolObservedAt": "2026-09-21T19:51:44.385Z",
   "poolObservationAgeSec": 5,
   "kts": "0.2",
   "margins": {
    "label": "Computed",
    "inputsHash": "0xe8731ea91839f6c34eb48953c3f0d1dee0ef27e21173b79c55002c0c073d5a6c",
    "stressMultiplier": "2.5",
    "carry": {
     "margin": "0.081485231706626651",
     "gap": "0.037017841051054627",
     "exitCost": "0.005994216",
     "floor": "0.05",
     "horizonHours": "9.2042",
     "horizonEndsAt": "2026-09-22T05:00:00.000Z"
    },
    "session": {
     "margin": "0.075060488762171851",
     "gap": "0.033867398433671277",
     "exitCost": "0.005994216",
     "floor": "0.03",
     "horizonHours": "7.7042",
     "horizonEndsAt": "2026-09-22T03:30:00.000Z"
    },
    "carryMarginUsed": "0.081485231706626651",
    "sessionMarginUsed": "0.075060488762171851",
    "horizonEndsAt": "2026-09-22T05:00:00.000Z"
   },
   "lt": {
    "value": "0.6",
    "label": "Verified",
    "source": "KerbTerms 196 guardrails",
    "observedAt": "2026-09-21T19:51:49.045Z"
   },
   "market": {
    "code": "XHKG",
    "city": "Hong Kong",
    "tz": "Asia/Hong_Kong",
    "lat": 22.284,
    "lon": 114.158
   },
   "next": {
    "type": "PRE_OPEN",
    "at": "2026-09-22T01:00:00.000Z",
    "weakening": "2026-09-22T04:00:00.000Z",
    "label": "Computed"
   },
   "cure": {
    "opensAt": "2026-09-22T03:30:00.000Z",
    "closesAt": "2026-09-22T04:00:00.000Z",
    "open": false,
    "label": "Computed"
   },
   "spark": [
    {
     "at": "2026-09-20T20:24:19.000Z",
     "c1": "14137.58789",
     "regime": "REFERENCE_CLOSED"
    },
    {
     "at": "2026-09-20T20:54:20.000Z",
     "c1": "14137.58789",
     "regime": "REFERENCE_CLOSED"
    },
    "... 46 more"
   ]
  },
  "... 8 more"
 ],
 "sources": [
  {
   "name": "okx-dex:v6-quote",
   "lastObservedAt": "2026-09-21T19:50:21.304Z",
   "ageSec": 88,
   "healthy": true
  },
  {
   "name": "xlayer:uniswap-v3",
   "lastObservedAt": "2026-09-21T19:51:44.842Z",
   "ageSec": 4,
   "healthy": true
  },
  "... 12 more"
 ],
 "summary": {
  "inLastCall": 6,
  "c1Total": "96875.707024",
  "ceilingTotal": "58782.942582",
  "sourcesHealthy": 14,
  "sourcesTotal": 14,
  "lastPostAgeSec": 184,
  "label": "Computed"
 }
}
```

## `GET /v1/terms/:chain/:asset`

Latest posted terms for one asset (symbol, token address or assetId), with the bundle link.

`/v1/terms/196/KOx`

```json
{
 "chainId": 196,
 "assetId": "0x2052b48fd37e4b80adfb4e2e758dd0ca050b129a4cf7b648e9fbde5aa3c32b27",
 "symbol": "KOx",
 "observedAt": "2026-09-21T19:48:45.000Z",
 "ageSec": 185,
 "usable": true,
 "regime": {
  "value": "PRE_TRANSITION",
  "index": 3,
  "label": "Attested"
 },
 "creditMark": {
  "raw": "86928950141840949368",
  "decimals": 18,
  "label": "Attested"
 },
 "carryLTV": {
  "raw": "556041938054855748",
  "decimals": 18,
  "label": "Attested"
 },
 "sessionMaxLTV": {
  "raw": "612000000000000000",
  "decimals": 18,
  "label": "Attested"
 },
 "debtCeiling": {
  "raw": "8245483886",
  "decimals": 6,
  "label": "Attested"
 },
 "executableDepth1": {
  "raw": "10993978515",
  "decimals": 6,
  "label": "Attested"
 },
 "loanAsset": {
  "symbol": "USDG",
  "decimals": 6
 },
 "inputsHash": "0xf9114889fd377f96ee059bc5e70763b2b00af0add164eeb0821b632ea5bdaabf",
 "bundle": {
  "cid": "bafkreidm3oobp4wuznyxlmgzmzzrloz2dppyfkgfoplqkk47lubfnogoey",
  "pinStatus": "unpinned",
  "pinned": false,
  "ipfsUrl": null,
  "url": "/v1/bundle/0xf9114889fd377f96ee059bc5e70763b2b00af0add164eeb0821b632ea5bdaabf",
  "servedByApi": true,
  "verifyCommand": "pnpm --filter @kerb/engine kerb verify 0xf9114889fd377f96ee059bc5e70763b2b00af0add164eeb0821b632ea5bdaabf"
 },
 "tx": "0xf20fa95f7b488e3241c526a180feef9c08ec75302ab6d88b9f849cdaee94127b",
 "contracts": {
  "clock": "0xf765d374e0ce576860a463f0d796ad45c62161b8",
  "terms": "0x6d6eaf24c498df6cef0954f6d19ab4ea7b0102d5"
 },
 "history": [
  {
   "observedAt": "2026-09-21T19:48:45.000Z",
   "regime": "PRE_TRANSITION",
   "carryLTV": "556041938054855748",
   "sessionMaxLTV": "612000000000000000",
   "debtCeiling": "8245483886",
   "executableDepth1": "10993978515",
   "creditMark": "86928950141840949368",
   "tx": "0xf20fa95f7b488e3241c526a180feef9c08ec75302ab6d88b9f849cdaee94127b"
  },
  {
   "observedAt": "2026-09-21T19:38:44.000Z",
   "regime": "PRE_TRANSITION",
   "carryLTV": "556041938054855748",
   "sessionMaxLTV": "612000000000000000",
   "debtCeiling": "8245483886",
   "executableDepth1": "10993978515",
   "creditMark": "86990515766840949368",
   "tx": "0x6212668a35862bb6753ffb84ec9843665df3b3bff9fed5999bb65a5fca139577"
  },
  "... 48 more"
 ]
}
```

## `GET /v1/clock/:chain/:asset?from&to`

The asset's market clock and session segments over a window (max 31 days).

`/v1/clock/196/KOx`

```json
{
 "chainId": 196,
 "symbol": "KOx",
 "market": "XNYS",
 "timezone": "America/New_York",
 "at": "2026-09-21T19:51:50.057Z",
 "label": "Computed",
 "clock": {
  "calendarVersion": "kerb-calendar@0.1.0 (2025-12-01..2027-12-31)",
  "market": "XNYS",
  "at": "2026-09-21T19:51:50.057Z",
  "session": {
   "kind": "REGULAR",
   "reason": "SESSION",
   "startedAt": "2026-09-21T13:30:00.000Z",
   "endsAt": "2026-09-21T20:00:00.000Z",
   "names": []
  },
  "inMainSession": true,
  "referenceClosed": false,
  "nextTransition": {
   "type": "SESSION_CLOSE",
   "at": "2026-09-21T20:00:00.000Z",
   "atMs": 1790020800000,
   "from": "REGULAR",
   "to": "POST",
   "weakening": true
  },
  "nextWeakening": {
   "type": "SESSION_CLOSE",
   "at": "2026-09-21T20:00:00.000Z",
   "atMs": 1790020800000,
   "from": "REGULAR",
   "to": "POST",
   "weakening": true
  },
  "nextReferenceClosed": {
   "type": "POST_CLOSE",
   "at": "2026-09-22T00:00:00.000Z",
   "atMs": 1790035200000,
   "from": "POST",
   "to": "CLOSED",
   "weakening": true
  },
  "nextMainOpen": {
   "type": "SESSION_OPEN",
   "at": "2026-09-22T13:30:00.000Z",
   "atMs": 1790083800000,
   "from": "PRE",
   "to": "REGULAR",
   "weakening": false
  },
  "lastMainOpen": "2026-09-21T13:30:00.000Z",
  "cureWindow": {
   "lengthSec": 3600,
   "opensAt": "2026-09-21T19:00:00.000Z",
   "closesAt": "2026-09-21T20:00:00.000Z",
   "open": true
  },
  "horizonHours": "17.636"
 },
 "window": {
  "from": "2026-09-18T19:51:50.057Z",
  "to": "2026-09-25T19:51:50.057Z"
 },
 "segments": [
  {
   "kind": "REGULAR",
   "reason": "SESSION",
   "startsAt": "2026-09-18T13:30:00.000Z",
   "endsAt": "2026-09-18T20:00:00.000Z",
   "names": []
  },
  {
   "kind": "POST",
   "reason": "SESSION",
   "startsAt": "2026-09-18T20:00:00.000Z",
   "endsAt": "2026-09-19T00:00:00.000Z",
   "names": []
  },
  "... 19 more"
 ]
}
```

## `GET /v1/report/:chain/:asset`

The full KTS report recomputed now from observations: depth curve, mark, stress, capacity, margins. Cache 60 s.

`/v1/report/196/KOx`

```json
{
 "kts": "0.2",
 "engineVersion": "kerb-engine@0.1.0",
 "paramsVersion": "2026-09-22.1",
 "chainId": 196,
 "asset": "0xdCC1a2699441079dA889B1F49e12B69cC791129b",
 "assetSymbol": "KOx",
 "underlying": {
  "symbol": "KO",
  "market": "XNYS",
  "multiplier": "1.0225601246249238"
 },
 "observedAt": "2026-09-21T19:50:45.313Z",
 "regime": "PRE_TRANSITION",
 "regimeInputs": {
  "calendarSession": "REGULAR",
  "calendarVersion": "kerb-calendar@0.1.0 (2025-12-01..2027-12-31)",
  "nextTransition": {
   "type": "SESSION_CLOSE",
   "at": "2026-09-21T20:00:00.000Z"
  },
  "nextWeakening": {
   "type": "SESSION_CLOSE",
   "at": "2026-09-21T20:00:00.000Z"
  },
  "nextReferenceClosed": {
   "type": "POST_CLOSE",
   "at": "2026-09-22T00:00:00.000Z"
  },
  "cureWindowOpensAt": "2026-09-21T19:00:00.000Z",
  "cureWindowOpen": true,
  "sourceMaxAgeSec": 17,
  "dispersion": "0.002708248647436157",
  "rule": 4,
  "reason": "inside the Last Call window before the next weakening",
  "asymmetry": {
   "carryLTV": "held",
   "sessionMaxLTV": "held",
   "debtCeiling": "held"
  }
 },
 "mark": {
  "reference": {
   "value": "87.60725",
   "label": "Observed",
   "sources": [
    "xstocks:price-data",
    "yahoo:chart:KO"
   ],
   "usedSources": [
    "xstocks:price-data",
    "yahoo:chart:KO"
   ],
   "excluded": []
  },
  "pool": {
   "value": "87.844512216318101264",
   "label": "Observed",
   "sources": [
    "0x273DA512f76129ED59a2D93D68dFe198423a3114"
   ],
   "basis": "twap",
   "twapWindowSec": 900
  },
  "creditMark": "86.831564516840949368",
  "band": [
   "85.963248871672539874",
   "87.60725"
  ],
  "haircut": "0.008854124323718078",
  "dispersion": "0.002708248647436157",
  "dispersionBreach": false,
  "quoteAssumption": "USDG is treated as 1 USD; the USDG peg is observed separately and reported"
 },
 "depth": {
  "venues": [
   {
    "path": [
     "wKOx",
     "USDG"
    ],
    "pools": [
     "0x273DA512f76129ED59a2D93D68dFe198423a3114"
    ],
    "midPrice": "89.819123280490058787684415431318",
    "curve": [
     "... 9 fields omitted",
     "... 9 fields omitted",
     "... 6 more"
    ],
    "C_0_5": {
     "impact": "0.005",
     "notional": "5184.346191",
     "censored": false
    },
    "C_1": {
     "impact": "0.01",
     "notional": "10993.978515",
     "censored": false
    },
    "C_3": {
     "impact": "0.03",
     "notional": "33373.707031",
     "censored": false
    }
   }
  ],
  "excluded": [],
  "fragmentationFactor": "1",
  "C_0_5": "5184.346191",
  "C_1": "10993.978515",
  "C_3": "33373.707031",
  "C_1_simulated": "10993.978515",
  "quoteCurve": [
   {
    "notional": "1000",
    "impact": "0.001373312416082143"
   },
   {
    "notional": "5000",
    "impact": "0.004851399989288456"
   },
   "... 2 more"
  ],
  "censored": false,
  "crosscheck": {
   "source": "okx-dex:v6-quote",
   "simulated": "10993.978515",
   "quoted": "10962.911652",
   "delta": "0.00283381495593211",
   "flag": false,
   "used": "10993.978515"
  }
 },
 "capacity": {
  "LT": "0.65",
  "carryLTV": "0.55651877291855745",
  "sessionMaxLTV": "0.62",
  "stressLTVWeak": "0.861521113746140302",
  "stressLTVCure": "0.861521113746140302",
  "debtCeiling": "8245.483886",
  "maxPositionDebt": "2748.494629",
  "coverageRatioAtCeiling": "1.333333",
  "clamped": [],
  "margins": {
   "kts": "0.2",
   "stressMultiplier": "2.5",
   "gapMethod": "hours/24 = d; d <= 1: g(1 session) * sqrt(d); d > 1: variance-interpolated between g(floor d) and g(ceil d) sessions, nearest larger bucket when a session co...",
   "carry": {
    "gap": "0.036476431494728016",
    "volScaler": "0.924811432759057336",
    "exitCost": "0.0091466749",
    "raw": "0.09348122708144255",
    "floor": "0.05",
    "used": "0.09348122708144255",
    "horizonHours": "17.6541",
    "horizonEndsAt": "2026-09-22T13:30:00.000Z"
   },
   "session": {
    "gap": "0",
    "volScaler": "0.924811432759057336",
    "exitCost": "0.0091466749",
    "raw": "0.0091466749",
    "floor": "0.03",
    "used": "0.03",
    "horizonHours": "0",
    "horizonEndsAt": "2026-09-21T19:50:45.313Z"
   }
  }
 },
 "stress": {
  "horizonHoursWeak": "17.6541",
  "horizonHoursCure": "0",
  "sessionsWeak": 1,
  "sessionsCure": 1,
  "quantile": "0.99",
  "gapQuantileWeak": "0.036476431494728016",
  "gapQuantileCure": "0",
  "volScaler": "0.924811432759057336",
  "impactAtReferenceSize": "0.0091466749",
  "liquidationBonus": "0.07",
  "buffer": "0.02",
  "historySufficient": true,
  "seriesDigest": "0xdab7c28662e154d9dedc50ee0d258268e3e2c4e27377349f44d9e2a2ad892d6d"
 },
 "inputsHash": "0x6a3c69bb0ded662dc3416609fd6f2f0dcf94a3eb0834c400f412344c25ad9fc1",
 "inputsCidV1Raw": "bafkreie2iso22rge6kdg7qdftepufuio7c2mbmmqlsnozru7ce5wm2jxmq",
 "provenance": {
  "label": "Computed",
  "note": "Produced by KTS-0.1 from the pinned input bundle; recompute with `kerb verify`"
 },
 "bundleBytes": 10789,
 "label": "Computed"
}
```

## `GET /v1/proof`

Deployments and verification, recent posts, data coverage, pinning, limitations.

`/v1/proof`

```json
{
 "generatedAt": "2026-09-21T19:51:50.168Z",
 "build": {
  "repo": "https://github.com/Franlinozz/Kerb",
  "firstCommitAt": "2026-09-18T23:38:38+01:00",
  "latestCommitAt": "2026-09-21T21:42:26+02:00",
  "commits": 81,
  "commitsPerDay": [
   {
    "date": "2026-09-18",
    "count": 9
   },
   {
    "date": "2026-09-19",
    "count": 13
   },
   "... 2 more"
  ],
  "buildPeriodMarkdown": "# BUILD_PERIOD.md\n## What was built when\n\nOfficial build period: 18 Sep 2026 to 25 Sep 2026 23:59 UTC (OKX Dev Day 2026, Build a Market).\nPlanning documents ...",
  "tests": {
   "startedAt": "2026-09-21T06:59:30Z",
   "finishedAt": "2026-09-21T07:01:09Z",
   "commit": "c503f7a864aa4d915f1b28a9ee7717656455f100",
   "typescript": {
    "passed": 494,
    "suitesWithFailures": 0,
    "command": "pnpm -r test"
   },
   "solidity": {
    "passed": 106,
    "failed": 0,
    "command": "forge test"
   }
  }
 },
 "onchain": {
  "deployments": [
   {
    "key": "1952:KerbClock",
    "chainId": 1952,
    "contract": "KerbClock",
    "address": "0x6c1de992e3219980138d7e51b67ecc523618bc5c",
    "block": "41420913",
    "deployedAt": "2026-09-20T04:49:09.381Z",
    "verification": "Sourcify exact match",
    "verificationUrl": "https://repo.sourcify.dev/contracts/full_match/1952/0x6c1de992e3219980138d7e51b67ecc523618bc5c/",
    "explorer": "https://www.oklink.com/x-layer-testnet/address/0x6c1de992e3219980138d7e51b67ecc523618bc5c"
   },
   {
    "key": "1952:KerbTerms",
    "chainId": 1952,
    "contract": "KerbTerms",
    "address": "0x5a4942f55e37994370745ef984a21321edb75f7e",
    "block": "41420914",
    "deployedAt": "2026-09-20T04:49:11.128Z",
    "verification": "Sourcify exact match",
    "verificationUrl": "https://repo.sourcify.dev/contracts/full_match/1952/0x5a4942f55e37994370745ef984a21321edb75f7e/",
    "explorer": "https://www.oklink.com/x-layer-testnet/address/0x5a4942f55e37994370745ef984a21321edb75f7e"
   },
   "... 7 more"
  ],
  "latestPosts": [
   {
    "chainId": 1952,
    "symbol": "SLVx",
    "observedAt": "2026-09-21T19:48:45.000Z",
    "tx": "0xf8f3848d469855fa32751162fc867dcc0f784b7ef5792fde0375435e369b9668",
    "explorer": "https://www.oklink.com/x-layer-testnet/tx/0xf8f3848d469855fa32751162fc867dcc0f784b7ef5792fde0375435e369b9668",
    "gasUsed": "69581",
    "builderCode": [
     "kt0hl6xyhlx8xmt"
    ]
   },
   {
    "chainId": 1952,
    "symbol": "SHEINx",
    "observedAt": "2026-09-21T19:48:45.000Z",
    "tx": "0x20678c7eec7a4eee87ed87ec7cef4dde42941d00901f42437268ccb26ec77587",
    "explorer": "https://www.oklink.com/x-layer-testnet/tx/0x20678c7eec7a4eee87ed87ec7cef4dde42941d00901f42437268ccb26ec77587",
    "gasUsed": "66733",
    "builderCode": null
   },
   "... 8 more"
  ],
  "postCounts": [
   {
    "chainId": 196,
    "count": 1720
   },
   {
    "chainId": 1952,
    "count": 1871
   }
  ]
 },
 "data": {
  "sources": [
   {
    "source": "xlayer:uniswap-v3",
    "lastObservedAt": "2026-09-21T19:51:44.842Z",
    "ageSec": 5,
    "rows": 52215
   },
   {
    "source": "xstocks:price-data",
    "lastObservedAt": "2026-09-21T19:51:38.226Z",
    "ageSec": 12,
    "rows": 23484
   },
   "... 14 more"
  ],
  "totals": [
   {
    "table": "obs_multiplier",
    "rows": 7026
   },
   {
    "table": "terms_posts",
    "rows": 3591
   },
   "... 4 more"
  ],
  "latestBundle": {
   "symbol": "SLVx",
   "inputsHash": "0xff190415663a5b47387edaa542035feb9df84d0b57d6263b693bf02abfe85afe",
   "cid": "bafkreigpdsgj3dyb57j4bdhiac53nqqk4dn7auzvnxbmk5trx2mgofd7uy",
   "pinStatus": "unpinned",
   "gateway": null,
   "apiUrl": "/v1/bundle/0xff190415663a5b47387edaa542035feb9df84d0b57d6263b693bf02abfe85afe"
  },
  "pinning": {
   "recentPosts": 2386,
   "pinned": 498,
   "unpinned": 1888,
   "storedByApi": 1279,
   "retrievable": 1777,
   "note": "Every bundle posted after K-43 resolves from its inputsHash through the Kerb API. Earlier posts have a documented IPFS gap caused by the pinning quota. In th..."
  }
 },
 "risk": {
  "report": {
   "symbol": "SLVx",
   "observedAt": "2026-09-21T19:48:45.000Z",
   "inputsHash": "0xff190415663a5b47387edaa542035feb9df84d0b57d6263b693bf02abfe85afe",
   "cid": "bafkreigpdsgj3dyb57j4bdhiac53nqqk4dn7auzvnxbmk5trx2mgofd7uy",
   "recomputeCommand": "pnpm --filter @kerb/engine kerb verify 0xff190415663a5b47387edaa542035feb9df84d0b57d6263b693bf02abfe85afe"
  }
 },
 "limitations": [
  {
   "subsystem": "Reference price",
   "rung": "2 + independent check",
   "note": "xStocks issuer price data, plus Yahoo as an independent Observed reference. Chainlink Data Streams (rung 1) needs credentials Kerb does not have."
  },
  {
   "subsystem": "Executable depth",
   "rung": "1",
   "note": "Exact Uniswap V3 tick-walk on the real X Layer pools, cross-checked against OKX DEX v6 aggregator quotes at the same notionals. The conservative value is tak..."
  },
  "... 4 more"
 ]
}
```

## `GET /v1/params`

The live KTS parameter file.

`/v1/params`

```json
{
 "kts": "0.2",
 "paramsVersion": "2026-09-22.1",
 "depth": {
  "ladder": [
   "1000",
   "2500",
   "... 6 more"
  ],
  "impactTargets": [
   "0.005",
   "0.01",
   "... 1 more"
  ],
  "fragmentationFactorMulti": "0.8",
  "stalenessMaxSec": 300,
  "crosscheckMax": "0.25",
  "minVenueC1": "100"
 },
 "mark": {
  "stalenessMaxSec": 300,
  "dispersionMax": "0.02",
  "hDispersion": "0.5",
  "bandRegime": "0.01",
  "twapWindowSec": 900,
  "regimeHaircut": {
   "DEEP": "0",
   "NORMAL": "0.0025",
   "THIN": "0.0075",
   "PRE_TRANSITION": "0.0075",
   "REFERENCE_CLOSED": "0.015",
   "ACTION": "0.025",
   "RECOVERY": "0.0075",
   "STALE": "0.025",
   "HALTED": "0.025",
   "DEFAULT": "0.0075"
  }
 },
 "regime": {
  "stalenessMaxSec": 300,
  "dispersionMax": "0.02",
  "actionCooldownSec": 3600,
  "recoveryCooldownSec": 1800,
  "thinThreshold": "5000",
  "deepThreshold": "20000",
  "spreadMax": "0.01"
 },
 "asymmetry": {
  "recoveryCooldownSec": 1800,
  "nConfirm": 3,
  "maxLoosenStep": "0.02"
 },
 "capacityDefaults": {
  "k": "0.75",
  "buffer": "0.02",
  "liquidationBonus": "0.07",
  "carryMargin": "0.10",
  "sessionMargin": "0.05",
  "positionCapAbs": "25000",
  "positionCapShare": "0.25",
  "referenceLiquidationSize": "10000",
  "stressMultiplier": "2.5",
  "minCarryMargin": "0.05",
  "minSessionMargin": "0.03"
 },
 "stress": {
  "quantile": "0.99",
  "lookbackYears": 5,
  "minBarsForOwnQuantile": 60,
  "minBarsForSufficientHistory": 1260,
  "volWindowDays": 20,
  "volMin": "0.75",
  "volMax": "2"
 },
 "guardrails": {
  "default": {
   "ltvMin": "0.05",
   "ltvMax": "0.50",
   "ceilingMin": "0",
   "ceilingMax": "250000",
   "LT": "0.50"
  },
  "assets": {
   "KOx": {
    "ltvMin": "0.05",
    "ltvMax": "0.65",
    "ceilingMin": "0",
    "ceilingMax": "250000",
    "LT": "0.65"
   },
   "BRK.Bx": {
    "ltvMin": "0.05",
    "ltvMax": "0.65",
    "ceilingMin": "0",
    "ceilingMax": "250000",
    "LT": "0.65"
   },
   "ICEx": {
    "ltvMin": "0.05",
    "ltvMax": "0.60",
    "ceilingMin": "0",
    "ceilingMax": "250000",
    "LT": "0.60"
   },
   "COINx": {
    "ltvMin": "0.05",
    "ltvMax": "0.50",
    "ceilingMin": "0",
    "ceilingMax": "250000",
    "LT": "0.50"
   },
   "BMNRx": {
    "ltvMin": "0.05",
    "ltvMax": "0.40",
    "ceilingMin": "0",
    "ceilingMax": "250000",
    "LT": "0.40"
   },
   "SLVx": {
    "ltvMin": "0.05",
    "ltvMax": "0.65",
    "ceilingMin": "0",
    "ceilingMax": "250000",
    "LT": "0.65"
   },
   "HKEXCx": {
    "ltvMin": "0.05",
    "ltvMax": "0.60",
    "ceilingMin": "0",
    "ceilingMax": "250000",
    "LT": "0.60"
   },
   "KUAIx": {
    "ltvMin": "0.05",
    "ltvMax": "0.55",
    "ceilingMin": "0",
    "ceilingMax": "250000",
    "LT": "0.55"
   },
   "MIXUx": {
    "ltvMin": "0.05",
    "ltvMax": "0.50",
    "ceilingMin": "0",
    "ceilingMax": "250000",
    "LT": "0.50"
   },
   "SHEINx": {
    "ltvMin": "0.05",
    "ltvMax": "0.45",
    "ceilingMin": "0",
    "ceilingMax": "250000",
    "LT": "0.45"
   }
  }
 },
 "note": "Risk configuration, versioned with every bundle so old reports stay reproducible under the parameters they used. LT is fixed per asset at listing; sessions n..."
}
```

## `GET /v1/tape?limit=20`

Newest Terms posts across both chains (limit 1 to 100). Cache 15 s.

`/v1/tape?limit=3`

```json
{
 "label": "Attested",
 "posts": [
  {
   "symbol": "SLVx",
   "chainId": 1952,
   "regime": "PRE_TRANSITION",
   "c1": "4940.839843",
   "carryLTV": "0.383045186618832157",
   "sessionMaxLTV": "0.6",
   "tx": "0xf8f3848d469855fa32751162fc867dcc0f784b7ef5792fde0375435e369b9668",
   "explorer": "https://www.oklink.com/x-layer-testnet/tx/0xf8f3848d469855fa32751162fc867dcc0f784b7ef5792fde0375435e369b9668",
   "observedAt": "2026-09-21T19:48:45.000Z"
  },
  {
   "symbol": "SHEINx",
   "chainId": 1952,
   "regime": "REFERENCE_CLOSED",
   "c1": "13162.654296",
   "carryLTV": "0.05",
   "sessionMaxLTV": "0.067537918472606862",
   "tx": "0x20678c7eec7a4eee87ed87ec7cef4dde42941d00901f42437268ccb26ec77587",
   "explorer": "https://www.oklink.com/x-layer-testnet/tx/0x20678c7eec7a4eee87ed87ec7cef4dde42941d00901f42437268ccb26ec77587",
   "observedAt": "2026-09-21T19:48:45.000Z"
  },
  "... 1 more"
 ]
}
```

## `GET /v1/stats`

Headline counts: observation rows, posts by chain, assets, markets, latest Market-Time Report. Cache 60 s.

`/v1/stats`

```json
{
 "label": "Observed",
 "obsPoolRows": 52200,
 "obsTotalRows": 170051,
 "postsByChain": [
  {
   "chainId": 196,
   "count": 1720
  },
  {
   "chainId": 1952,
   "count": 1871
  }
 ],
 "assets": 10,
 "markets": 4,
 "marketMeta": [
  {
   "code": "XNYS",
   "city": "New York",
   "label": "NYSE",
   "tz": "America/New_York",
   "lat": 40.7069,
   "lon": -74.0113
  },
  {
   "code": "XNAS",
   "city": "New York",
   "label": "Nasdaq",
   "tz": "America/New_York",
   "lat": 40.7566,
   "lon": -73.9863
  },
  "... 2 more"
 ],
 "latestReport": {
  "id": "1",
  "title": "What happened to executable liquidity while the underlying markets were shut",
  "headline": "In-range liquidity did not hold still while the underlying markets were closed: 7 of 10 asset pools ended the window with less in-range liquidity than they s...",
  "figure": "MIXUx -49.12%"
 }
}
```

## `GET /v1/credit/:chain`

Credit market state: pool, collaterals with their fixed LT and relayed terms, disclaimer.

`/v1/credit/1952`

```json
{
 "chainId": 1952,
 "contracts": {
  "KerbCredit": "0xa1314645cd6c07e651359aba540e2600090b98a8",
  "KerbTerms": "0x5a4942f55e37994370745ef984a21321edb75f7e",
  "clock": "0xd2483B2D8Bd759F87faDb21117498A5Db36bcb0f",
  "clockIsDemo": true,
  "loanAsset": "0x91Fcf99262214C32F6fe342D94c7B0dfB2DbA679"
 },
 "loanAsset": {
  "symbol": "mUSDG",
  "decimals": 6,
  "isMock": true,
  "standsInFor": "0xF0863D7A29a55d0c4263c11bFac754312ff078DF"
 },
 "pool": {
  "totalSupplied": "80000007165",
  "totalDebt": "2716438178",
  "reserves": "793",
  "utilisation": "33955474183862843",
  "borrowRate": "11697773709193142",
  "available": "77283568987"
 },
 "collaterals": [
  {
   "key": "1952:KerbMirror:KOx",
   "mirrors": "KOx",
   "token": "0x11827f0f59d516e3778951fde36bd0d961af4a16",
   "assetId": "0x254b3d276908ccbf128e0dd59ab700de06581c83597bcef47a12d9cad8abb383",
   "tokenDecimals": 18,
   "liquidationThreshold": "680000000000000000",
   "closeFactor": "500000000000000000",
   "cureBonus": "15000000000000000",
   "defaultBonus": "70000000000000000",
   "terms": {
    "carryLTV": "556240253001191548",
    "sessionMaxLTV": "620000000000000000",
    "creditMark": "86917756391840949368",
    "regime": 3,
    "usable": true,
    "debtCeiling": "8245483886",
    "maxPositionDebt": "2748494629",
    "observedAt": "2026-09-21T19:43:44.000Z"
   },
   "relayedFrom": {
    "symbol": "KOx",
    "chainId": 196,
    "token": "0xdCC1a2699441079dA889B1F49e12B69cC791129b"
   }
  },
  {
   "key": "1952:KerbMirror:HKEXCx",
   "mirrors": "HKEXCx",
   "token": "0x80da4036ee45e6d66a27dba415a4ce23eb9360f2",
   "assetId": "0x848d3f1b4ab86b2a27774b635a76429ae579620fc7dcaa2956e1ceb298b394bb",
   "tokenDecimals": 18,
   "liquidationThreshold": "630000000000000000",
   "closeFactor": "500000000000000000",
   "cureBonus": "15000000000000000",
   "defaultBonus": "70000000000000000",
   "terms": {
    "carryLTV": "518241731993413300",
    "sessionMaxLTV": "524641180942696023",
    "creditMark": "48389488340786200800",
    "regime": 4,
    "usable": true,
    "debtCeiling": "12689113036",
    "maxPositionDebt": "4229704346",
    "observedAt": "2026-09-21T19:43:44.000Z"
   },
   "relayedFrom": {
    "symbol": "HKEXCx",
    "chainId": 196,
    "token": "0x64c1C1A6453Abb3ebBFC69e3E8f8e75953ABd46a"
   }
  }
 ],
 "disclaimer": "The credit plane runs on X Layer testnet with mirror collateral. Mirror tokens have no claim on any security. The risk data underneath them is the real mainn..."
}
```

## `GET /v1/credit/:chain/demo-clock`

The testnet demo clock as a schedule: phase, state, next Last Call. Cache 5 s.

`/v1/credit/1952/demo-clock`

```json
{
 "address": "0xd2483b2d8bd759f87fadb21117498a5db36bcb0f",
 "weekLengthSec": 3600,
 "sessionEndSec": 3000,
 "cureStartSec": 2400,
 "epoch": 1789942438,
 "now": "2026-09-21T19:51:54.000Z",
 "phaseSec": 2276,
 "state": "SESSION",
 "nextCureOpensAt": "2026-09-21T19:53:58.000Z",
 "nextCureClosesAt": "2026-09-21T20:03:58.000Z",
 "nextSessionAt": "2026-09-21T20:13:58.000Z",
 "cycleStartedAt": "2026-09-21T19:13:58.000Z",
 "label": "Verified",
 "note": "Demo clock, testnet only: one compressed market week per cycle. Not a real market calendar."
}
```

## `GET /v1/credit/:chain/positions?state=curable|all`

Every open position found from KerbCredit events, curable first, then by deadline. Cache 30 s.

`/v1/credit/1952/positions`

```json
{
 "chainId": 1952,
 "label": "Verified",
 "scannedToBlock": 41561458,
 "eventsSeen": 7,
 "positions": [
  {
   "user": "0x0d63f9eeb86813230b72017444cea16cd4a453f2",
   "assetId": "0x254b3d276908ccbf128e0dd59ab700de06581c83597bcef47a12d9cad8abb383",
   "symbol": "kKOx",
   "mode": "Session Max",
   "debt": "2716438177",
   "positionLTV": "550065820482780587",
   "carryTarget": "550000000000000000",
   "healthFactor": "1236215693930736565",
   "cure": {
    "eligible": false,
    "deadline": "2026-09-21T20:03:58.000Z",
    "requiredRepay": "735819"
   },
   "label": "Verified"
  }
 ]
}
```

## `GET /v1/credit/:chain/position/:user/:assetId`

One position: debt, LTV, health against the fixed LT, covenant status.

`/v1/credit/1952/position/0x0d63f9eeb86813230b72017444cea16cd4a453f2/0x254b3d276908ccbf128e0dd59ab700de06581c83597bcef47a12d9cad8abb383`

```json
{
 "user": "0x0d63f9eeb86813230b72017444cea16cd4a453f2",
 "assetId": "0x254b3d276908ccbf128e0dd59ab700de06581c83597bcef47a12d9cad8abb383",
 "collateralShares": "56816785372023262856",
 "debt": "2716438177",
 "positionLTV": "550065820482780587",
 "healthFactor": "1236215693930736565",
 "carryTarget": "550000000000000000",
 "mode": 1,
 "modeName": "Session Max",
 "cure": {
  "eligible": false,
  "deadline": "2026-09-21T20:03:58.000Z",
  "requiredRepay": "735819"
 }
}
```

## `GET /v1/market-time`

Published Market-Time Reports.

`/v1/market-time`

```json
{
 "reports": [
  {
   "id": 1,
   "title": "What happened to executable liquidity while the underlying markets were shut",
   "generatedAt": "2026-09-21T00:53:14.636Z",
   "window": "2026-09-19T06:37:30.540Z",
   "windowTo": "2026-09-21T00:52:26.368Z",
   "hours": "42.25",
   "observations": 35130
  }
 ]
}
```

## `GET /v1/market-time/:id`

One Market-Time Report.

`/v1/market-time/1`

```json
{
 "id": 1,
 "title": "What happened to executable liquidity while the underlying markets were shut",
 "generatedAt": "2026-09-21T00:53:14.636Z",
 "window": {
  "from": "2026-09-19T06:37:30.540Z",
  "to": "2026-09-21T00:52:26.368Z",
  "hours": "42.25",
  "observations": 35130,
  "pools": 15,
  "largestGap": "03:16:22",
  "underlyingOpenDuringWindow": false
 },
 "method": "Every 60 seconds the collector reads slot0, liquidity, tickSpacing, fee and the initialised ticks spanning at least +/-60% around spot from each pool on X La...",
 "pools": [
  {
   "pool": "0x273DA512f76129ED59a2D93D68dFe198423a3114",
   "symbol": "KOx",
   "role": "asset",
   "observations": 2342,
   "firstAt": "2026-09-19T06:37:30.863Z",
   "lastAt": "2026-09-21T00:52:26.362Z",
   "liquidityAtStart": "184959125440040068",
   "liquidityAtEnd": "163126416052238249",
   "liquidityMin": "163053586282599012",
   "liquidityMax": "184959125440040068",
   "changePct": "-11.80",
   "swingPct": "13.43"
  },
  {
   "pool": "0x293A6167Bed3A474b99f450dE817BC4474087Ed4",
   "symbol": "HKEXCx",
   "role": "asset",
   "observations": 2342,
   "firstAt": "2026-09-19T06:37:30.581Z",
   "lastAt": "2026-09-21T00:52:26.157Z",
   "liquidityAtStart": "206189211533389420",
   "liquidityAtEnd": "212674316394872700",
   "liquidityMin": "93122847002811493",
   "liquidityMax": "251163145491688688",
   "changePct": "3.14",
   "swingPct": "169.71"
  },
  "... 13 more"
 ],
 "sources": [
  {
   "source": "xstocks:price-data",
   "observations": 6889,
   "firstAt": "2026-09-19T06:37:28.813Z",
   "lastAt": "2026-09-21T00:52:57.927Z"
  },
  {
   "source": "yahoo:chart:0388.HK",
   "observations": 4659,
   "firstAt": "2026-09-19T06:44:09.794Z",
   "lastAt": "2026-09-21T00:52:48.664Z"
  },
  "... 10 more"
 ],
 "findings": [
  {
   "claim": "In-range liquidity did not hold still while the underlying markets were closed: 7 of 10 asset pools ended the window with less in-range liquidity than they s...",
   "evidence": "Largest fall MIXUx -49.12%, largest rise SLVx 4.94%, over 35,130 readings."
  },
  {
   "claim": "A capacity number fixed at Friday's close would have been wrong by the size of those moves for the whole weekend.",
   "evidence": "This is the arithmetic consequence of the row above, not a separate measurement: debtCeiling is a fraction of C(1%), and C(1%) is computed from exactly this ..."
  }
 ],
 "limitations": [
  "The window observed so far is entirely outside the underlying markets' regular sessions. It therefore measures how liquidity behaves while they are shut, and...",
  "In-range liquidity L is not executable depth in dollars. Kerb computes C(i) by walking ticks, which uses more of the stored state than L alone; L is used her...",
  "... 1 more"
 ],
 "reproduce": "pnpm --filter @kerb/engine market-time-report regenerates this file from the observation store. Every row is a SELECT over append-only tables whose UPDATE, D..."
}
```

## `GET /v1/reports`

Stored KTS report ids.

`/v1/reports`

```json
{
 "reports": [
  "BMNRx-2026-09-20T01-07-30-929Z",
  "BRK.Bx-2026-09-20T00-49-31-530Z",
  "... 16 more"
 ]
}
```

## `GET /v1/reports/:id`

One stored KTS report.

`/v1/reports/SLVx-2026-09-20T01-13-32-104Z`

```json
{
 "asset": "0x4833e7f4f0460f4B72A3a5879A6C9841bCC5B58B",
 "assetSymbol": "SLVx",
 "capacity": {
  "LT": "0.65",
  "carryLTV": "0.55",
  "clamped": [],
  "coverageRatioAtCeiling": "1.333333",
  "debtCeiling": "2701.750815",
  "maxPositionDebt": "900.583605",
  "sessionMaxLTV": "0.6",
  "stressLTVCure": "0.772256489471720993",
  "stressLTVWeak": "0.772256489471720993"
 },
 "chainId": 196,
 "depth": {
  "C_0_5": "1226.696044",
  "C_1": "3602.33442",
  "C_3": "13538.387695",
  "censored": false,
  "crosscheck": {
   "reason": "no aggregator quotes in the bundle (credentials not configured)",
   "rung": 2,
   "source": "okx-dex",
   "status": "unavailable"
  },
  "excluded": [],
  "fragmentationFactor": "1",
  "venues": [
   {
    "C_0_5": {
     "censored": false,
     "impact": "0.005",
     "notional": "1226.696044"
    },
    "C_1": {
     "censored": false,
     "impact": "0.01",
     "notional": "3602.33442"
    },
    "C_3": {
     "censored": false,
     "impact": "0.03",
     "notional": "13538.387695"
    },
    "curve": [
     "... 9 fields omitted",
     "... 9 fields omitted",
     "... 6 more"
    ],
    "midPrice": "60.254788305757577395212632476822",
    "path": [
     "wSLVx",
     "USDC",
     "... 1 more"
    ],
    "pools": [
     "0xd510189E8b3684A101e0552835f3B6C2dE4af4a6",
     "0xbB9a35F790EA6eA9763b99e885f33BCF95860d40"
    ]
   }
  ]
 },
 "engineVersion": "kerb-engine@0.1.0",
 "inputsCidV1Raw": "bafkreiadukerxkcqchmvsxwjnatapodjxeg4yp7x3ggjhmdbj4jls7dd4e",
 "inputsHash": "0xa8a26398e27d6a72b4b9d07e11dd1986ce852d356203c040ad7d5a87c721ffbb",
 "kts": "0.1",
 "mark": {
  "band": [
   "58.316723038649999189",
   "59.955"
  ],
  "creditMark": "58.905780847121211302",
  "dispersion": "0.005000221929073095",
  "dispersionBreach": false,
  "haircut": "0.017500110964536547",
  "pool": {
   "basis": "spot",
   "label": "Observed",
   "sources": [
    "0xd510189E8b3684A101e0552835f3B6C2dE4af4a6 -> 0xbB9a35F790EA6eA9763b99e885f33BCF95860d40"
   ],
   "twapWindowSec": null,
   "value": "60.254788305757577395"
  },
  "quoteAssumption": "USDG is treated as 1 USD; the USDG peg is observed separately and reported",
  "reference": {
   "excluded": [],
   "label": "Observed",
   "sources": [
    "xstocks:price-data",
    "yahoo:chart:SLV"
   ],
   "usedSources": [
    "xstocks:price-data",
    "yahoo:chart:SLV"
   ],
   "value": "59.955"
  }
 },
 "observedAt": "2026-09-20T01:13:32.104Z",
 "paramsVersion": "2026-09-20.1",
 "pin": {
  "cid": "bafkreiadukerxkcqchmvsxwjnatapodjxeg4yp7x3ggjhmdbj4jls7dd4e",
  "reason": "PINATA_JWT not configured; CID computed locally",
  "service": "none",
  "status": "unpinned"
 },
 "provenance": {
  "label": "Computed",
  "note": "Produced by KTS-0.1 from the pinned input bundle; recompute with `kerb verify`"
 },
 "regime": "REFERENCE_CLOSED",
 "regimeInputs": {
  "asymmetry": {
   "carryLTV": "held",
   "debtCeiling": "held",
   "sessionMaxLTV": "held"
  },
  "calendarSession": "CLOSED",
  "calendarVersion": "kerb-calendar@0.1.0 (2025-12-01..2027-12-31)",
  "cureWindowOpen": false,
  "cureWindowOpensAt": "2026-09-21T19:00:00.000Z",
  "dispersion": "0.005000221929073095",
  "nextReferenceClosed": {
   "at": "2026-09-22T00:00:00.000Z",
   "type": "POST_CLOSE"
  },
  "nextTransition": {
   "at": "2026-09-21T08:00:00.000Z",
   "type": "PRE_OPEN"
  },
  "nextWeakening": {
   "at": "2026-09-21T20:00:00.000Z",
   "type": "SESSION_CLOSE"
  },
  "reason": "underlying market is not in any session",
  "rule": 6,
  "sourceMaxAgeSec": 22
 },
 "stress": {
  "buffer": "0.02",
  "gapQuantileCure": "0.07051656368544541",
  "gapQuantileWeak": "0.07051656368544541",
  "historySufficient": true,
  "horizonHoursCure": "41.7744",
  "horizonHoursWeak": "60.2744",
  "impactAtReferenceSize": "0.0229751969",
  "liquidationBonus": "0.07",
  "quantile": "0.99",
  "seriesDigest": "0xd3ac47b0fe94270d8bb363ec5721509f63201e467a444a530de89a6b0c779c1a",
  "sessionsCure": 1,
  "sessionsWeak": 1,
  "volScaler": "1.627536959121097107"
 },
 "underlying": {
  "market": "ARCX",
  "multiplier": "1",
  "symbol": "SLV"
 }
}
```

## `GET /v1/bundle/:hash`

The exact input bundle posted under an inputsHash (or a report id). keccak256 of the bytes equals the hash.

`/v1/bundle/0xf9114889fd377f96ee059bc5e70763b2b00af0add164eeb0821b632ea5bdaabf`

```json
{
 "asset": {
  "chainId": 196,
  "corporateActionMethod": "multiplier",
  "decimals": 18,
  "halted": {
   "adapter": false,
   "underlying": false
  },
  "multiplier": {
   "issuer": "1.0225601246249238",
   "onchain": "1.0225601246249238",
   "pending": null
  },
  "poolToken": "wrapper",
  "symbol": "KOx",
  "token": "0xdCC1a2699441079dA889B1F49e12B69cC791129b",
  "underlying": {
   "currency": "USD",
   "isin": "US1912161007",
   "listingCountry": "US",
   "market": "XNYS",
   "symbol": "KO"
  },
  "wrapper": {
   "address": "0xE4784B45415AAc58b289f9373314261c788C91e8",
   "assetsPerShare": "1.0225601246249238",
   "decimals": 18,
   "symbol": "wKOx",
   "version": "v2"
  }
 },
 "bundleVersion": 1,
 "calendarVersion": "kerb-calendar@0.1.0",
 "config": {
  "asymmetry": {
   "maxLoosenStep": "0.02",
   "nConfirm": 3,
   "recoveryCooldownSec": 1800
  },
  "capacity": {
   "buffer": "0.02",
   "carryMargin": "0.10",
   "k": "0.75",
   "liquidationBonus": "0.07",
   "minCarryMargin": "0.05",
   "minSessionMargin": "0.03",
   "positionCapAbs": "25000",
   "positionCapShare": "0.25",
   "referenceLiquidationSize": "10000",
   "sessionMargin": "0.05",
   "stressMultiplier": "2.5"
  },
  "depth": {
   "crosscheckMax": "0.25",
   "fragmentationFactorMulti": "0.8",
   "impactTargets": [
    "0.005",
    "0.01",
    "... 1 more"
   ],
   "ladder": [
    "1000",
    "2500",
    "... 6 more"
   ],
   "minVenueC1": "100",
   "stalenessMaxSec": 300
  },
  "guardrails": {
   "LT": "0.65",
   "ceilingMax": "250000",
   "ceilingMin": "0",
   "ltvMax": "0.65",
   "ltvMin": "0.05"
  },
  "mark": {
   "bandRegime": "0.01",
   "dispersionMax": "0.02",
   "hDispersion": "0.5",
   "regimeHaircut": {
    "ACTION": "0.025",
    "DEEP": "0",
    "DEFAULT": "0.0075",
    "HALTED": "0.025",
    "NORMAL": "0.0025",
    "PRE_TRANSITION": "0.0075",
    "RECOVERY": "0.0075",
    "REFERENCE_CLOSED": "0.015",
    "STALE": "0.025",
    "THIN": "0.0075"
   },
   "stalenessMaxSec": 300,
   "twapWindowSec": 900
  },
  "regime": {
   "actionCooldownSec": 3600,
   "deepThreshold": "20000",
   "dispersionMax": "0.02",
   "recoveryCooldownSec": 1800,
   "spreadMax": "0.01",
   "stalenessMaxSec": 300,
   "thinThreshold": "5000"
  },
  "stress": {
   "lookbackYears": 5,
   "minBarsForOwnQuantile": 60,
   "minBarsForSufficientHistory": 1260,
   "quantile": "0.99",
   "volMax": "2",
   "volMin": "0.75",
   "volWindowDays": 20
  },
  "stressQuantile": "0.99"
 },
 "engineVersion": "kerb-engine@0.1.0",
 "fx": [
  {
   "contentHash": "0x406e8b929684f057e05f2a2bf5acdbb707a015d0ecfb4c72d85ae1a0c918a20e",
   "currency": "HKD",
   "observedAtMs": 1790020108416,
   "perUsd": "7.845",
   "source": "yahoo:chart:HKD=X"
  }
 ],
 "kts": "0.2",
 "market": {
  "code": "XNYS",
  "cureWindowSec": 3600
 },
 "observedAtMs": 1790020125211,
 "paramsVersion": "2026-09-22.1",
 "previous": null,
 "quotes": [
  {
   "amountIn": "11.15412153680211836",
   "contentHash": "0x07d90803b6cf854c17afe0be7bd49a1ebbd5616b12a6d3a7c92eec230ce133af",
   "notional": "1000",
   "observedAtMs": 1790019899353,
   "quoteOut": "1000.478108",
   "router": "Uniswap V3:100%",
   "source": "okx-dex:v6-quote"
  },
  {
   "amountIn": "55.770607684010591799",
   "contentHash": "0xe75d595153b34bb314ec588699893317365ac987030513252503a2c188944604",
   "notional": "5000",
   "observedAtMs": 1790019900739,
   "quoteOut": "4984.978744",
   "router": "Uniswap V3:100%",
   "source": "okx-dex:v6-quote"
  },
  "... 2 more"
 ],
 "references": [
  {
   "contentHash": "0x5f901f0bda13f21eeb8077d277ffe58ae9cdeb938f6b5607e320bf4c9b19db81",
   "currency": "USD",
   "observedAtMs": 1790020118203,
   "source": "xstocks:price-data",
   "value": "87.675"
  },
  {
   "contentHash": "0xa4f0d11bb702a38bb48ddbc824fd236983341faf822d262a4ebad5151e53f7a7",
   "currency": "USD",
   "observedAtMs": 1790020108411,
   "source": "yahoo:chart:KO",
   "value": "87.67"
  }
 ],
 "routes": [
  {
   "from": "xETH",
   "pool": "0x6E18CEbFb9C5BBcf127b97a6daB026E941FfF6D5",
   "to": "USDG"
  },
  {
   "from": "USDC",
   "pool": "0xbB9a35F790EA6eA9763b99e885f33BCF95860d40",
   "to": "USDG"
  }
 ],
 "stress": {
  "bars": 2514,
  "firstDate": "2016-09-19",
  "gapQuantileBySessions": {
   "1": {
    "sampleSize": 2513,
    "source": "own",
    "value": "0.042529979583532014"
   },
   "2": {
    "sampleSize": 2512,
    "source": "own",
    "value": "0.057885081427152819"
   },
   "3": {
    "sampleSize": 2511,
    "source": "own",
    "value": "0.07762152055902075"
   },
   "4": {
    "sampleSize": 2510,
    "source": "own",
    "value": "0.084391314157973062"
   },
   "5": {
    "sampleSize": 2509,
    "source": "own",
    "value": "0.084857076102829819"
   },
   "6": {
    "sampleSize": 2508,
    "source": "own",
    "value": "0.088404815580852814"
   },
   "7": {
    "sampleSize": 2507,
    "source": "own",
    "value": "0.092334370071432859"
   },
   "8": {
    "sampleSize": 2506,
    "source": "own",
    "value": "0.097198328212260443"
   },
   "9": {
    "sampleSize": 2505,
    "source": "own",
    "value": "0.102485942843006645"
   },
   "10": {
    "sampleSize": 2504,
    "source": "own",
    "value": "0.104339151125443887"
   },
   "12": {
    "sampleSize": 2502,
    "source": "own",
    "value": "0.111727251727835329"
   },
   "15": {
    "sampleSize": 2499,
    "source": "own",
    "value": "0.121976208784417037"
   },
   "20": {
    "sampleSize": 2494,
    "source": "own",
    "value": "0.138836429655008128"
   }
  },
  "historySufficient": true,
  "lastDate": "2026-09-18",
  "seriesDigest": "0xdab7c28662e154d9dedc50ee0d258268e3e2c4e27377349f44d9e2a2ad892d6d",
  "source": "yahoo:chart (not redistributed; see data/SOURCES.md)",
  "volScaler": {
   "clamped": false,
   "medianVol": "0.009003597849357881",
   "recentVol": "0.008326630227051029",
   "sampleSize": 2494,
   "source": "own",
   "value": "0.924811432759057336"
  }
 },
 "venues": [
  {
   "contentHash": "0xbfe261a779ef731515469789aff6ff252dbd17289ff848b3967198edbd8ce373",
   "decimals0": 6,
   "decimals1": 18,
   "legIndex": 0,
   "observedAtMs": 1790020124665,
   "path": [
    "wKOx",
    "USDG"
   ],
   "pathId": "0x273DA512f76129ED59a2D93D68dFe198423a3114",
   "pool": "0x273DA512f76129ED59a2D93D68dFe198423a3114",
   "quote": "USDG",
   "sellToken": "0xE4784B45415AAc58b289f9373314261c788C91e8",
   "snapshot": {
    "bitmapWords": {
     "lower": 86,
     "upper": 93
    },
    "blockHash": "0x7b2bd473208b7e70755b587ab663c22e189d0063f5cbe3d0ca24d30f6cef4c42",
    "blockNumber": "71251087",
    "blockTimestamp": "1790020123",
    "chainId": 196,
    "coveredTicks": {
     "lower": 220160,
     "upper": 240639
    },
    "fee": 500,
    "kind": "uniswap-v3-pool-snapshot",
    "liquidity": "120895141814987806",
    "observationCardinality": 32,
    "pool": "0x273DA512f76129ED59a2D93D68dFe198423a3114",
    "sqrtPriceX96": "8359786341509665916740755297653251",
    "tick": 231343,
    "tickSpacing": 10,
    "ticks": [
     "... 3 fields omitted",
     "... 3 fields omitted",
     "... 52 more"
    ],
    "token0": "0x4ae46a509F6b1D9056937BA4500cb143933D2dc8",
    "token1": "0xE4784B45415AAc58b289f9373314261c788C91e8",
    "twap": {
     "tickCumulatives": "... 2 items omitted",
     "windowSec": 900
    },
    "version": 1
   }
  }
 ]
}
```
