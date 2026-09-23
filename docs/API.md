# Kerb API

Base URL `https://api.usekerb.xyz`. Read-only, JSON, CORS open for GET. Every number carries a provenance label: Verified, Observed, Attested or Computed. A chain or source that does not answer returns a labelled error (502 with `label: "Unavailable"`), never a stack trace.

Examples below were captured from production on 23 Sep 2026 12:36 UTC by `scripts/api-doc.py`. Arrays are cut to their first two items and long strings shortened; nothing is invented.

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
| GET | `/v1/terms/:chain/:asset/why` | Why the current terms are what they are (V3-04): three sentences with their numbers, computed from the latest post's own input bundle. Chain 196. Cached by inputsHash. |
| GET | `/v1/terms/:chain/:asset/changes?hours=72` | Every material term change in the window (1 to 168 hours), newest first, each with its computed causes and the post that made it (V3-04). Cache 30 s. |
| GET | `/v1/exit/:chain/:asset?hours=72` | The exit check (V3-06): the latest post's tick-walk C(1%) against the OKX DEX quote at the same notionals, which bound the capacity, the quote's age, and a summary of the window with a strip of checks. Cache 30 s. |
| GET | `/v1/credit/:chain/keeper` | The demo keeper's status line (V3-02): its address, the demo state, its position, the last action with its transaction, and what it does next. Read-only. Testnet 1952. |
| GET | `/v1/agents/stats` | Kerb for Agents (V3-03): settled x402 calls by network with the latest settlement, the OKX.AI listing status, and the endpoints. Cache 15 s. |
| GET | `/agents/terms/:asset` | Kerb for Agents, free: the latest posted terms for one asset with the why sentences. Served by kerb-agents. |

## `GET /health`

Observation freshness and post counts per chain.

`/health`

```json
{
 "status": "ok",
 "now": "2026-09-23T12:36:52.030Z",
 "observations": {
  "poolRows": 88875,
  "lastObservedAt": "2026-09-23T12:35:59.827Z",
  "ageSec": 52
 },
 "posts": [
  {
   "chainId": 196,
   "count": 4529,
   "lastAt": "2026-09-23T12:33:51.378Z"
  },
  {
   "chainId": 1952,
   "count": 4714,
   "lastAt": "2026-09-23T12:34:24.742Z"
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
 "generatedAt": "2026-09-23T12:36:52.044Z",
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
    "value": "NORMAL",
    "label": "Attested",
    "source": "KerbTerms 196",
    "observedAt": "2026-09-23T12:32:59.000Z",
    "tx": "https://www.oklink.com/xlayer/tx/0xe3bce94c4ce9703164c1d7b4e73c3bc1d8edc4dc857b3b573d162a11d852e95a"
   },
   "creditMark": {
    "value": "503.149273586653644832",
    "label": "Attested",
    "source": "KerbTerms 196",
    "observedAt": "2026-09-23T12:32:59.000Z",
    "inputsHash": "0x7f2dbac24e198e1d1ec2a4672900d8dffda19a4930e9b72158a44d8bf4b4889e",
    "tx": "https://www.oklink.com/xlayer/tx/0xe3bce94c4ce9703164c1d7b4e73c3bc1d8edc4dc857b3b573d162a11d852e95a"
   },
   "executableDepth1": {
    "value": "17539.791015",
    "label": "Attested",
    "source": "KerbTerms 196",
    "observedAt": "2026-09-23T12:32:59.000Z",
    "inputsHash": "0x7f2dbac24e198e1d1ec2a4672900d8dffda19a4930e9b72158a44d8bf4b4889e",
    "tx": "https://www.oklink.com/xlayer/tx/0xe3bce94c4ce9703164c1d7b4e73c3bc1d8edc4dc857b3b573d162a11d852e95a"
   },
   "carryLTV": {
    "value": "0.554033884783457259",
    "label": "Attested",
    "source": "KerbTerms 196",
    "observedAt": "2026-09-23T12:32:59.000Z",
    "inputsHash": "0x7f2dbac24e198e1d1ec2a4672900d8dffda19a4930e9b72158a44d8bf4b4889e",
    "tx": "https://www.oklink.com/xlayer/tx/0xe3bce94c4ce9703164c1d7b4e73c3bc1d8edc4dc857b3b573d162a11d852e95a"
   },
   "sessionMaxLTV": {
    "value": "0.59672435843782424",
    "label": "Attested",
    "source": "KerbTerms 196",
    "observedAt": "2026-09-23T12:32:59.000Z",
    "inputsHash": "0x7f2dbac24e198e1d1ec2a4672900d8dffda19a4930e9b72158a44d8bf4b4889e",
    "tx": "https://www.oklink.com/xlayer/tx/0xe3bce94c4ce9703164c1d7b4e73c3bc1d8edc4dc857b3b573d162a11d852e95a"
   },
   "debtCeiling": {
    "value": "576.173741",
    "label": "Attested",
    "source": "KerbTerms 196",
    "observedAt": "2026-09-23T12:32:59.000Z",
    "inputsHash": "0x7f2dbac24e198e1d1ec2a4672900d8dffda19a4930e9b72158a44d8bf4b4889e",
    "tx": "https://www.oklink.com/xlayer/tx/0xe3bce94c4ce9703164c1d7b4e73c3bc1d8edc4dc857b3b573d162a11d852e95a"
   },
   "coverageRatio": {
    "value": "30.441844",
    "label": "Computed",
    "source": "C(1%) / debtCeiling",
    "observedAt": "2026-09-23T12:32:59.000Z"
   },
   "reportAgeSec": 233,
   "poolObservedAt": "2026-09-23T12:35:58.033Z",
   "poolObservationAgeSec": 54,
   "kts": "0.2",
   "margins": {
    "label": "Computed",
    "inputsHash": "0x7f2dbac24e198e1d1ec2a4672900d8dffda19a4930e9b72158a44d8bf4b4889e",
    "stressMultiplier": "2.5",
    "carry": {
     "margin": "0.095709196168247804",
     "gap": "0.046073826447146112",
     "exitCost": "0.005945076",
     "floor": "0.05",
     "horizonHours": "24.9502",
     "horizonEndsAt": "2026-09-24T13:30:00.000Z"
    },
    "session": {
     "margin": "0.052098568564989447",
     "gap": "0.023689509821778058",
     "exitCost": "0.005945076",
     "floor": "0.03",
     "horizonHours": "6.4502",
     "horizonEndsAt": "2026-09-23T19:00:00.000Z"
    },
    "carryMarginUsed": "0.095709196168247804",
    "sessionMarginUsed": "0.052098568564989447",
    "horizonEndsAt": "2026-09-24T13:30:00.000Z"
   },
   "lt": {
    "value": "0.65",
    "label": "Verified",
    "source": "KerbTerms 196 guardrails",
    "observedAt": "2026-09-23T12:36:52.044Z"
   },
   "market": {
    "code": "XNYS",
    "city": "New York",
    "tz": "America/New_York",
    "lat": 40.7069,
    "lon": -74.0113
   },
   "next": {
    "type": "SESSION_OPEN",
    "at": "2026-09-23T13:30:00.000Z",
    "weakening": "2026-09-23T20:00:00.000Z",
    "label": "Computed"
   },
   "cure": {
    "opensAt": "2026-09-23T19:00:00.000Z",
    "closesAt": "2026-09-23T20:00:00.000Z",
    "open": false,
    "label": "Computed"
   },
   "spark": [
    {
     "at": "2026-09-22T13:22:51.000Z",
     "c1": "18611.711914",
     "regime": "NORMAL"
    },
    {
     "at": "2026-09-22T13:52:52.000Z",
     "c1": "15832.871093",
     "regime": "RECOVERY"
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
    "observedAt": "2026-09-23T12:28:00.000Z",
    "tx": "https://www.oklink.com/xlayer/tx/0x43b6c1976ee313cfffe6acdbdcb6ae9ebff0338d8c87f10639724c5e340b6803"
   },
   "creditMark": {
    "value": "49.278229050458649233",
    "label": "Attested",
    "source": "KerbTerms 196",
    "observedAt": "2026-09-23T12:28:00.000Z",
    "inputsHash": "0x47ea441f3fc683f169f17c6833307f8d6c86268490ad1043693b4e7137cbd4e7",
    "tx": "https://www.oklink.com/xlayer/tx/0x43b6c1976ee313cfffe6acdbdcb6ae9ebff0338d8c87f10639724c5e340b6803"
   },
   "executableDepth1": {
    "value": "17061.879882",
    "label": "Attested",
    "source": "KerbTerms 196",
    "observedAt": "2026-09-23T12:28:00.000Z",
    "inputsHash": "0x47ea441f3fc683f169f17c6833307f8d6c86268490ad1043693b4e7137cbd4e7",
    "tx": "https://www.oklink.com/xlayer/tx/0x43b6c1976ee313cfffe6acdbdcb6ae9ebff0338d8c87f10639724c5e340b6803"
   },
   "carryLTV": {
    "value": "0.491718424024139429",
    "label": "Attested",
    "source": "KerbTerms 196",
    "observedAt": "2026-09-23T12:28:00.000Z",
    "inputsHash": "0x47ea441f3fc683f169f17c6833307f8d6c86268490ad1043693b4e7137cbd4e7",
    "tx": "https://www.oklink.com/xlayer/tx/0x43b6c1976ee313cfffe6acdbdcb6ae9ebff0338d8c87f10639724c5e340b6803"
   },
   "sessionMaxLTV": {
    "value": "0.496368318579332179",
    "label": "Attested",
    "source": "KerbTerms 196",
    "observedAt": "2026-09-23T12:28:00.000Z",
    "inputsHash": "0x47ea441f3fc683f169f17c6833307f8d6c86268490ad1043693b4e7137cbd4e7",
    "tx": "https://www.oklink.com/xlayer/tx/0x43b6c1976ee313cfffe6acdbdcb6ae9ebff0338d8c87f10639724c5e340b6803"
   },
   "debtCeiling": {
    "value": "2424.143139",
    "label": "Attested",
    "source": "KerbTerms 196",
    "observedAt": "2026-09-23T12:28:00.000Z",
    "inputsHash": "0x47ea441f3fc683f169f17c6833307f8d6c86268490ad1043693b4e7137cbd4e7",
    "tx": "https://www.oklink.com/xlayer/tx/0x43b6c1976ee313cfffe6acdbdcb6ae9ebff0338d8c87f10639724c5e340b6803"
   },
   "coverageRatio": {
    "value": "7.038314",
    "label": "Computed",
    "source": "C(1%) / debtCeiling",
    "observedAt": "2026-09-23T12:28:00.000Z"
   },
   "reportAgeSec": 532,
   "poolObservedAt": "2026-09-23T12:35:57.784Z",
   "poolObservationAgeSec": 54,
   "kts": "0.2",
   "margins": {
    "label": "Computed",
    "inputsHash": "0x47ea441f3fc683f169f17c6833307f8d6c86268490ad1043693b4e7137cbd4e7",
    "stressMultiplier": "2.5",
    "carry": {
     "margin": "0.107266531624196397",
     "gap": "0.049613268133637371",
     "exitCost": "0.0060894803",
     "floor": "0.05",
     "horizonHours": "16.5333",
     "horizonEndsAt": "2026-09-24T05:00:00.000Z"
    },
    "session": {
     "margin": "0.102567728084148949",
     "gap": "0.04730915868501671",
     "exitCost": "0.0060894803",
     "floor": "0.03",
     "horizonHours": "15.0333",
     "horizonEndsAt": "2026-09-24T03:30:00.000Z"
    },
    "carryMarginUsed": "0.107266531624196397",
    "sessionMarginUsed": "0.102567728084148949",
    "horizonEndsAt": "2026-09-24T05:00:00.000Z"
   },
   "lt": {
    "value": "0.6",
    "label": "Verified",
    "source": "KerbTerms 196 guardrails",
    "observedAt": "2026-09-23T12:36:52.044Z"
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
    "at": "2026-09-24T01:00:00.000Z",
    "weakening": "2026-09-24T04:00:00.000Z",
    "label": "Computed"
   },
   "cure": {
    "opensAt": "2026-09-24T03:30:00.000Z",
    "closesAt": "2026-09-24T04:00:00.000Z",
    "open": false,
    "label": "Computed"
   },
   "spark": [
    {
     "at": "2026-09-22T12:57:52.000Z",
     "c1": "16538.448242",
     "regime": "REFERENCE_CLOSED"
    },
    {
     "at": "2026-09-22T13:22:51.000Z",
     "c1": "16538.448242",
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
   "lastObservedAt": "2026-09-23T12:35:24.114Z",
   "ageSec": 88,
   "healthy": true
  },
  {
   "name": "xlayer:uniswap-v3",
   "lastObservedAt": "2026-09-23T12:35:59.827Z",
   "ageSec": 52,
   "healthy": true
  },
  "... 12 more"
 ],
 "summary": {
  "inLastCall": 0,
  "c1Total": "110440.6623",
  "ceilingTotal": "36120.031565",
  "sourcesHealthy": 14,
  "sourcesTotal": 14,
  "lastPostAgeSec": 233,
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
 "observedAt": "2026-09-23T12:28:00.000Z",
 "ageSec": 534,
 "usable": true,
 "regime": {
  "value": "NORMAL",
  "index": 1,
  "label": "Attested"
 },
 "creditMark": {
  "raw": "88446147542817312785",
  "decimals": 18,
  "label": "Attested"
 },
 "carryLTV": {
  "raw": "541413023829781982",
  "decimals": 18,
  "label": "Attested"
 },
 "sessionMaxLTV": {
  "raw": "589898630852145874",
  "decimals": 18,
  "label": "Attested"
 },
 "debtCeiling": {
  "raw": "9256902832",
  "decimals": 6,
  "label": "Attested"
 },
 "executableDepth1": {
  "raw": "12342537109",
  "decimals": 6,
  "label": "Attested"
 },
 "loanAsset": {
  "symbol": "USDG",
  "decimals": 6
 },
 "inputsHash": "0x48fc1601ae67a75efe130a25d93f505aee6c5eadabffac9d95bc0e9ef4f7f770",
 "bundle": {
  "cid": "bafkreifjox4uo45sfle3nhoq5cx3r2vdprn7yrarrvvmt4hb2oz7lfyabu",
  "pinStatus": "unpinned",
  "pinned": false,
  "ipfsUrl": null,
  "url": "/v1/bundle/0x48fc1601ae67a75efe130a25d93f505aee6c5eadabffac9d95bc0e9ef4f7f770",
  "servedByApi": true,
  "verifyCommand": "pnpm --filter @kerb/engine kerb verify 0x48fc1601ae67a75efe130a25d93f505aee6c5eadabffac9d95bc0e9ef4f7f770"
 },
 "tx": "0xf13f8939190aa0ffad69aadbf09b28bbd95d7a08ccd0cd4610b96043ce881bb1",
 "contracts": {
  "clock": "0xf765d374e0ce576860a463f0d796ad45c62161b8",
  "terms": "0x6d6eaf24c498df6cef0954f6d19ab4ea7b0102d5"
 },
 "history": [
  {
   "observedAt": "2026-09-23T12:28:00.000Z",
   "regime": "NORMAL",
   "carryLTV": "541413023829781982",
   "sessionMaxLTV": "589898630852145874",
   "debtCeiling": "9256902832",
   "executableDepth1": "12342537109",
   "creditMark": "88446147542817312785",
   "tx": "0xf13f8939190aa0ffad69aadbf09b28bbd95d7a08ccd0cd4610b96043ce881bb1"
  },
  {
   "observedAt": "2026-09-23T12:18:59.000Z",
   "regime": "NORMAL",
   "carryLTV": "541413023829781982",
   "sessionMaxLTV": "589898630852145874",
   "debtCeiling": "9256902832",
   "executableDepth1": "12342537109",
   "creditMark": "88446147542817312785",
   "tx": "0x8bf4dce2211f30f3bbe2130958fda81a42f3ad43fc3cebdae1393e246e4bd5fe"
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
 "at": "2026-09-23T12:36:53.686Z",
 "label": "Computed",
 "clock": {
  "calendarVersion": "kerb-calendar@0.1.0 (2025-12-01..2027-12-31)",
  "market": "XNYS",
  "at": "2026-09-23T12:36:53.686Z",
  "session": {
   "kind": "PRE",
   "reason": "SESSION",
   "startedAt": "2026-09-23T08:00:00.000Z",
   "endsAt": "2026-09-23T13:30:00.000Z",
   "names": []
  },
  "inMainSession": false,
  "referenceClosed": false,
  "nextTransition": {
   "type": "SESSION_OPEN",
   "at": "2026-09-23T13:30:00.000Z",
   "atMs": 1790170200000,
   "from": "PRE",
   "to": "REGULAR",
   "weakening": false
  },
  "nextWeakening": {
   "type": "SESSION_CLOSE",
   "at": "2026-09-23T20:00:00.000Z",
   "atMs": 1790193600000,
   "from": "REGULAR",
   "to": "POST",
   "weakening": true
  },
  "nextReferenceClosed": {
   "type": "POST_CLOSE",
   "at": "2026-09-24T00:00:00.000Z",
   "atMs": 1790208000000,
   "from": "POST",
   "to": "CLOSED",
   "weakening": true
  },
  "nextMainOpen": {
   "type": "SESSION_OPEN",
   "at": "2026-09-24T13:30:00.000Z",
   "atMs": 1790256600000,
   "from": "PRE",
   "to": "REGULAR",
   "weakening": false
  },
  "lastMainOpen": "2026-09-22T13:30:00.000Z",
  "cureWindow": {
   "lengthSec": 3600,
   "opensAt": "2026-09-23T19:00:00.000Z",
   "closesAt": "2026-09-23T20:00:00.000Z",
   "open": false
  },
  "horizonHours": "24.885"
 },
 "window": {
  "from": "2026-09-20T12:36:53.686Z",
  "to": "2026-09-27T12:36:53.686Z"
 },
 "segments": [
  {
   "kind": "CLOSED",
   "reason": "WEEKEND",
   "startsAt": "2026-09-19T00:00:00.000Z",
   "endsAt": "2026-09-21T08:00:00.000Z",
   "names": []
  },
  {
   "kind": "PRE",
   "reason": "SESSION",
   "startsAt": "2026-09-21T08:00:00.000Z",
   "endsAt": "2026-09-21T13:30:00.000Z",
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
 "observedAt": "2026-09-23T12:35:59.827Z",
 "regime": "NORMAL",
 "regimeInputs": {
  "calendarSession": "PRE",
  "calendarVersion": "kerb-calendar@0.1.0 (2025-12-01..2027-12-31)",
  "nextTransition": {
   "type": "SESSION_OPEN",
   "at": "2026-09-23T13:30:00.000Z"
  },
  "nextWeakening": {
   "type": "SESSION_CLOSE",
   "at": "2026-09-23T20:00:00.000Z"
  },
  "nextReferenceClosed": {
   "type": "POST_CLOSE",
   "at": "2026-09-24T00:00:00.000Z"
  },
  "cureWindowOpensAt": "2026-09-23T19:00:00.000Z",
  "cureWindowOpen": false,
  "sourceMaxAgeSec": 21,
  "dispersion": "0.000780050329645438",
  "rule": 9,
  "reason": "underlying open with adequate depth",
  "asymmetry": {
   "carryLTV": "held",
   "sessionMaxLTV": "held",
   "debtCeiling": "held"
  }
 },
 "mark": {
  "reference": {
   "value": "88.7025",
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
   "value": "88.771692414365374431",
   "label": "Observed",
   "sources": [
    "0x273DA512f76129ED59a2D93D68dFe198423a3114"
   ],
   "basis": "twap",
   "twapWindowSec": 900
  },
  "creditMark": "88.446147542817312785",
  "band": [
   "87.561686067389139657",
   "88.7025"
  ],
  "haircut": "0.002890025164822719",
  "dispersion": "0.000780050329645438",
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
    "midPrice": "90.766210086393654031172272497742",
    "curve": [
     "... 9 fields omitted",
     "... 9 fields omitted",
     "... 6 more"
    ],
    "C_0_5": {
     "impact": "0.005",
     "notional": "5817.096191",
     "censored": false
    },
    "C_1": {
     "impact": "0.01",
     "notional": "12342.537109",
     "censored": false
    },
    "C_3": {
     "impact": "0.03",
     "notional": "38622.21289",
     "censored": false
    }
   }
  ],
  "excluded": [],
  "fragmentationFactor": "1",
  "C_0_5": "5817.096191",
  "C_1": "12342.537109",
  "C_3": "38622.21289",
  "C_1_simulated": "12342.537109",
  "quoteCurve": [
   {
    "notional": "1000",
    "impact": "0.001277822984939876"
   },
   {
    "notional": "5000",
    "impact": "0.004377043721966901"
   },
   "... 2 more"
  ],
  "censored": false,
  "crosscheck": {
   "source": "okx-dex:v6-quote",
   "simulated": "12342.537109",
   "quoted": "12340.847629",
   "delta": "0.000136901455296301",
   "flag": false,
   "used": "12342.537109"
  }
 },
 "capacity": {
  "LT": "0.65",
  "carryLTV": "0.541899348042133588",
  "sessionMaxLTV": "0.591011478885663704",
  "stressLTVWeak": "0.862456934046140302",
  "stressLTVCure": "0.862456934046140302",
  "debtCeiling": "9256.902832",
  "maxPositionDebt": "3085.634277",
  "coverageRatioAtCeiling": "1.333333",
  "clamped": [],
  "margins": {
   "kts": "0.2",
   "stressMultiplier": "2.5",
   "gapMethod": "hours/24 = d; d <= 1: g(1 session) * sqrt(d); d > 1: variance-interpolated between g(floor d) and g(ceil d) sessions, nearest larger bucket when a session co...",
   "carry": {
    "gap": "0.043204395542497956",
    "volScaler": "0.924811432759057336",
    "exitCost": "0.0082108546",
    "raw": "0.108100651957866412",
    "floor": "0.05",
    "used": "0.108100651957866412",
    "horizonHours": "24.9",
    "horizonEndsAt": "2026-09-24T13:30:00.000Z"
   },
   "session": {
    "gap": "0.021962387018874792",
    "volScaler": "0.924811432759057336",
    "exitCost": "0.0082108546",
    "raw": "0.058988521114336296",
    "floor": "0.03",
    "used": "0.058988521114336296",
    "horizonHours": "6.4",
    "horizonEndsAt": "2026-09-23T19:00:00.000Z"
   }
  }
 },
 "stress": {
  "horizonHoursWeak": "24.9",
  "horizonHoursCure": "6.4",
  "sessionsWeak": 1,
  "sessionsCure": 1,
  "quantile": "0.99",
  "gapQuantileWeak": "0.043204395542497956",
  "gapQuantileCure": "0.021962387018874792",
  "volScaler": "0.924811432759057336",
  "impactAtReferenceSize": "0.0082108546",
  "liquidationBonus": "0.07",
  "buffer": "0.02",
  "historySufficient": true,
  "seriesDigest": "0xdab7c28662e154d9dedc50ee0d258268e3e2c4e27377349f44d9e2a2ad892d6d"
 },
 "inputsHash": "0x1629489f744f1190b2ed57b98ae01c6c551a881a3bfe203448d134fef0f2c08b",
 "inputsCidV1Raw": "bafkreicfxejcy7t4oftbsnope5zbqh6d6t65zi6ecdybzbfn5shkcoegyu",
 "provenance": {
  "label": "Computed",
  "note": "Produced by KTS-0.1 from the pinned input bundle; recompute with `kerb verify`"
 },
 "bundleBytes": 10707,
 "label": "Computed"
}
```

## `GET /v1/proof`

Deployments and verification, recent posts, data coverage, pinning, limitations.

`/v1/proof`

```json
{
 "generatedAt": "2026-09-23T12:36:53.824Z",
 "build": {
  "repo": "https://github.com/Franlinozz/Kerb",
  "firstCommitAt": "2026-09-18T23:38:38+01:00",
  "latestCommitAt": "2026-09-23T14:31:44+02:00",
  "commits": 203,
  "commitsPerDay": [
   {
    "date": "2026-09-18",
    "count": 9
   },
   {
    "date": "2026-09-19",
    "count": 13
   },
   "... 4 more"
  ],
  "buildPeriodMarkdown": "# BUILD_PERIOD.md\n## What was built when\n\nOfficial build period: 18 Sep 2026 to 25 Sep 2026 23:59 UTC (OKX Dev Day 2026, Build a Market).\nPlanning documents ...",
  "tests": {
   "startedAt": "2026-09-22T12:36:06Z",
   "finishedAt": "2026-09-22T12:37:06Z",
   "commit": "e6d78fda6d1087ab986e55693bf9b69637a6f8ee",
   "typescript": {
    "passed": 545,
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
   "... 20 more"
  ],
  "latestPosts": [
   {
    "chainId": 1952,
    "symbol": "BMNRx",
    "observedAt": "2026-09-23T12:33:59.000Z",
    "tx": "0xa0503cc4a3a71bc0699c75c7fbb282bde62a45eaa89f2cc3bac65499d2d7123b",
    "explorer": "https://www.oklink.com/x-layer-testnet/tx/0xa0503cc4a3a71bc0699c75c7fbb282bde62a45eaa89f2cc3bac65499d2d7123b",
    "gasUsed": "69533",
    "builderCode": [
     "kt0hl6xyhlx8xmt"
    ]
   },
   {
    "chainId": 1952,
    "symbol": "ICEx",
    "observedAt": "2026-09-23T12:33:58.000Z",
    "tx": "0x5312dbe9cbfc43108c7218b7e895a581b44ebd59ed57233d6a7a4890713748c5",
    "explorer": "https://www.oklink.com/x-layer-testnet/tx/0x5312dbe9cbfc43108c7218b7e895a581b44ebd59ed57233d6a7a4890713748c5",
    "gasUsed": "66829",
    "builderCode": [
     "kt0hl6xyhlx8xmt"
    ]
   },
   "... 8 more"
  ],
  "postCounts": [
   {
    "chainId": 196,
    "count": 4529
   },
   {
    "chainId": 1952,
    "count": 4714
   }
  ]
 },
 "data": {
  "sources": [
   {
    "source": "xlayer:uniswap-v3",
    "lastObservedAt": "2026-09-23T12:35:59.827Z",
    "ageSec": 54,
    "rows": 88875
   },
   {
    "source": "xstocks:price-data",
    "lastObservedAt": "2026-09-23T12:36:38.865Z",
    "ageSec": 15,
    "rows": 58742
   },
   "... 14 more"
  ],
  "totals": [
   {
    "table": "obs_multiplier",
    "rows": 11906
   },
   {
    "table": "terms_posts",
    "rows": 9243
   },
   "... 4 more"
  ],
  "latestBundle": {
   "symbol": "BMNRx",
   "inputsHash": "0x7338a61a4b86f4abd2a64356bf98345fc5ffc043ce84babba6c198acdd212530",
   "cid": "bafkreifmkpdz2aqif37yxmscses2itjmuiovo24jrpvjdwq67y4hnzaf54",
   "pinStatus": "unpinned",
   "gateway": null,
   "apiUrl": "/v1/bundle/0x7338a61a4b86f4abd2a64356bf98345fc5ffc043ce84babba6c198acdd212530"
  },
  "pinning": {
   "recentPosts": 2740,
   "pinned": 0,
   "unpinned": 2740,
   "storedByApi": 2740,
   "retrievable": 2740,
   "note": "Every bundle posted after K-43 resolves from its inputsHash through the Kerb API. Earlier posts have a documented IPFS gap caused by the pinning quota. In th..."
  }
 },
 "risk": {
  "report": {
   "symbol": "BMNRx",
   "observedAt": "2026-09-23T12:33:59.000Z",
   "inputsHash": "0x7338a61a4b86f4abd2a64356bf98345fc5ffc043ce84babba6c198acdd212530",
   "cid": "bafkreifmkpdz2aqif37yxmscses2itjmuiovo24jrpvjdwq67y4hnzaf54",
   "recomputeCommand": "pnpm --filter @kerb/engine kerb verify 0x7338a61a4b86f4abd2a64356bf98345fc5ffc043ce84babba6c198acdd212530"
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
 ],
 "creditFlow": {
  "file": "data/credit-flow-2026-09-22.json",
  "what": "Golden path on the release build (staging, cut over to www.usekerb.xyz): two fresh wallets; the borrower deposits kKOx and borrows with Session Max; at the d...",
  "borrower": "0x094bA62F4C1c088EDEb74D836531f6b7c7AbEaD5",
  "curer": "0x4A29A2b7e704BAFdEc4509fa279435ce5EA01b77",
  "steps": [
   {
    "at": "2026-09-22T15:05:29.473Z",
    "note": "borrower 0x094bA62F4C1c088EDEb74D836531f6b7c7AbEaD5 funded with 0.004 test OKB",
    "tx": "0x405a4d27f490fedc701bec6160ea6b0470a970768651f92d8d4c1643352072e0",
    "explorer": "https://www.oklink.com/x-layer-testnet/tx/0x405a4d27f490fedc701bec6160ea6b0470a970768651f92d8d4c1643352072e0",
    "status": "success"
   },
   {
    "at": "2026-09-22T15:05:30.719Z",
    "note": "curer 0x4A29A2b7e704BAFdEc4509fa279435ce5EA01b77 funded with 0.004 test OKB",
    "tx": "0x91bac81b9a178d1897d3df5605bc44eead9fef1e28e083941d8849f68f78e04e",
    "explorer": "https://www.oklink.com/x-layer-testnet/tx/0x91bac81b9a178d1897d3df5605bc44eead9fef1e28e083941d8849f68f78e04e",
    "status": "success"
   },
   "... 15 more"
  ]
 },
 "verify": {
  "inputsHash": "0x7338a61a4b86f4abd2a64356bf98345fc5ffc043ce84babba6c198acdd212530",
  "chainId": 1952,
  "symbol": "BMNRx",
  "tx": "0xa0503cc4a3a71bc0699c75c7fbb282bde62a45eaa89f2cc3bac65499d2d7123b",
  "kts": "0.2",
  "checkedAt": "2026-09-23T12:36:39.949Z",
  "fields": [
   {
    "field": "creditMark",
    "verdict": "matches"
   },
   {
    "field": "carryLTV",
    "verdict": "matches"
   },
   "... 3 more"
  ],
  "ok": true
 }
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
 "generatedAt": "2026-09-23T12:36:54.143Z",
 "posts": [
  {
   "symbol": "BMNRx",
   "chainId": 1952,
   "regime": "NORMAL",
   "c1": "8474.651367",
   "carryLTV": "0.05",
   "sessionMaxLTV": "0.05",
   "tx": "0xa0503cc4a3a71bc0699c75c7fbb282bde62a45eaa89f2cc3bac65499d2d7123b",
   "explorer": "https://www.oklink.com/x-layer-testnet/tx/0xa0503cc4a3a71bc0699c75c7fbb282bde62a45eaa89f2cc3bac65499d2d7123b",
   "observedAt": "2026-09-23T12:33:59.000Z"
  },
  {
   "symbol": "ICEx",
   "chainId": 1952,
   "regime": "NORMAL",
   "c1": "5801.038574",
   "carryLTV": "0.420179582762596448",
   "sessionMaxLTV": "0.499708020659877259",
   "tx": "0x5312dbe9cbfc43108c7218b7e895a581b44ebd59ed57233d6a7a4890713748c5",
   "explorer": "https://www.oklink.com/x-layer-testnet/tx/0x5312dbe9cbfc43108c7218b7e895a581b44ebd59ed57233d6a7a4890713748c5",
   "observedAt": "2026-09-23T12:33:58.000Z"
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
 "generatedAt": "2026-09-23T12:36:21.715Z",
 "obsPoolRows": 88875,
 "obsTotalRows": 320167,
 "postsByChain": [
  {
   "chainId": 196,
   "count": 4529
  },
  {
   "chainId": 1952,
   "count": 4714
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
  "totalSupplied": "80000192003",
  "totalDebt": "4716633019",
  "reserves": "21312",
  "utilisation": "58957771236638115",
  "borrowRate": "12947888561831905",
  "available": "75283558984"
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
    "carryLTV": "541700142808329699",
    "sessionMaxLTV": "590553372754632677",
    "creditMark": "88446147542817312785",
    "regime": 1,
    "usable": true,
    "debtCeiling": "9256902832",
    "maxPositionDebt": "3085634277",
    "observedAt": "2026-09-23T12:29:02.000Z"
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
    "carryLTV": "492786416701630881",
    "sessionMaxLTV": "497487800447401984",
    "creditMark": "49277274977633961580",
    "regime": 4,
    "usable": true,
    "debtCeiling": "12796409912",
    "maxPositionDebt": "4265469970",
    "observedAt": "2026-09-23T12:29:02.000Z"
   },
   "relayedFrom": {
    "symbol": "HKEXCx",
    "chainId": 196,
    "token": "0x64c1C1A6453Abb3ebBFC69e3E8f8e75953ABd46a"
   }
  }
 ],
 "disclaimer": "The credit plane runs on X Layer testnet with mirror collateral. Mirror tokens have no claim on any security. The risk data underneath them is the real mainn...",
 "generatedAt": "2026-09-23T12:36:58.208Z"
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
 "now": "2026-09-23T12:36:56.000Z",
 "phaseSec": 1378,
 "state": "SESSION",
 "nextCureOpensAt": "2026-09-23T12:53:58.000Z",
 "nextCureClosesAt": "2026-09-23T13:03:58.000Z",
 "nextSessionAt": "2026-09-23T13:13:58.000Z",
 "cycleStartedAt": "2026-09-23T12:13:58.000Z",
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
 "scannedToBlock": 41708165,
 "eventsSeen": 32,
 "positions": [
  {
   "user": "0x0d63f9eeb86813230b72017444cea16cd4a453f2",
   "assetId": "0x254b3d276908ccbf128e0dd59ab700de06581c83597bcef47a12d9cad8abb383",
   "symbol": "kKOx",
   "mode": "Session Max",
   "debt": "2716632946",
   "positionLTV": "540599181885793959",
   "carryTarget": "550000000000000000",
   "healthFactor": "1257863538771939784",
   "cure": {
    "eligible": false,
    "deadline": "2026-09-23T13:03:58.000Z",
    "requiredRepay": "0"
   },
   "lastCure": {
    "tx": "0x91c401511bf9839965318559a504f5c574aee37c19a0eec95baaddfb2590bbf9",
    "block": 41514829,
    "repaid": "630803513",
    "seized": "7366226488448688697",
    "target": "550000000000000000",
    "curer": "0x1b9587AD7e0bd6E1AC3588799999C62d0f0f0816"
   },
   "label": "Verified"
  },
  {
   "user": "0xaccd2b8b681ef9c5beb1a2d08872652170efc0f4",
   "assetId": "0x848d3f1b4ab86b2a27774b635a76429ae579620fc7dcaa2956e1ceb298b394bb",
   "symbol": "kHKEXCx",
   "mode": "Session Max",
   "debt": "2000000001",
   "positionLTV": "494622322425494202",
   "carryTarget": "491213156775012752",
   "healthFactor": "1273699085863150457",
   "cure": {
    "eligible": false,
    "deadline": "2026-09-23T13:03:58.000Z",
    "requiredRepay": "27491848"
   },
   "lastCure": {
    "tx": "0x5468b5ed9f5228da9881ff7a31882b5508a9493d9a4cbfab6bed73a4336089ca",
    "block": 41705996,
    "repaid": "26935387",
    "seized": "554807809733976823",
    "target": "489668091903784675",
    "curer": "0x66AE377c2441d85c2B08A7e14B331A5dbaeE9EC0"
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
 "debt": "2716632946",
 "positionLTV": "540599181885793959",
 "healthFactor": "1257863538771939784",
 "carryTarget": "550000000000000000",
 "mode": 1,
 "modeName": "Session Max",
 "cure": {
  "eligible": false,
  "deadline": "2026-09-23T13:03:58.000Z",
  "requiredRepay": "0"
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
 "reproduce": "pnpm --filter @kerb/engine market-time-report regenerates this file from the observation store. Every row is a SELECT over append-only tables whose UPDATE, D...",
 "appendix": {
  "label": "added 22 Sep",
  "addedAt": "2026-09-22T10:55:16.687Z",
  "what": "Executable depth C(1%) in USDG near the window's first and last reading (each row says the exact moment: the first instant every engine input existed), recom...",
  "paramsVersion": "2026-09-22.1",
  "rows": [
   {
    "symbol": "BRK.Bx",
    "startAt": "2026-09-19T06:37:30.540Z",
    "c1AtStart": "27663.132812",
    "endAt": "2026-09-21T00:52:26.368Z",
    "c1AtEnd": "17074.195312",
    "changePct": "-38.27"
   },
   {
    "symbol": "HKEXCx",
    "startAt": "2026-09-19T06:47:30.540Z",
    "c1AtStart": "12807.976562",
    "endAt": "2026-09-21T00:52:26.368Z",
    "c1AtEnd": "14108.860351",
    "changePct": "10.15"
   },
   "... 8 more"
  ],
  "reproduce": "pnpm --filter @kerb/engine exec tsx scripts/c1-appendix.ts 1"
 }
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

`/v1/bundle/0x48fc1601ae67a75efe130a25d93f505aee6c5eadabffac9d95bc0e9ef4f7f770`

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
   "contentHash": "0xca8197177139f0d34b9ce0d91d2f77b95bca3bd8415ca64f3c1fbe958033d43a",
   "currency": "HKD",
   "observedAtMs": 1790166479947,
   "perUsd": "7.8433",
   "source": "yahoo:chart:HKD=X"
  }
 ],
 "kts": "0.2",
 "market": {
  "code": "XNYS",
  "cureWindowSec": 3600
 },
 "observedAtMs": 1790166480004,
 "paramsVersion": "2026-09-22.1",
 "previous": null,
 "quotes": [
  {
   "amountIn": "11.036424847524271834",
   "contentHash": "0x69790b25999683ddfbacc344393db52e5fc5a53cf108fd174056cba21a6f0a31",
   "notional": "1000",
   "observedAtMs": 1790166302693,
   "quoteOut": "1000.454417",
   "router": "Uniswap V3:100%",
   "source": "okx-dex:v6-quote"
  },
  {
   "amountIn": "55.182124237621359169",
   "contentHash": "0x4a5d03d38bf81d1a33c14ea67432bf82834fce331a3a7aaf513d4590cc784042",
   "notional": "5000",
   "observedAtMs": 1790166304102,
   "quoteOut": "4986.749104",
   "router": "Uniswap V3:100%",
   "source": "okx-dex:v6-quote"
  },
  "... 2 more"
 ],
 "references": [
  {
   "contentHash": "0x4fd89bb426e46a1962bf954a5368c040448b16e0264cc25ae30998f2effdf877",
   "currency": "USD",
   "observedAtMs": 1790166458718,
   "source": "xstocks:price-data",
   "value": "88.795"
  },
  {
   "contentHash": "0x6233765de0669e191edb76f7fb551de6e965325fa4d64f90936faa232923dd91",
   "currency": "USD",
   "observedAtMs": 1790166479945,
   "source": "yahoo:chart:KO",
   "value": "88.61"
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
   "contentHash": "0xefbdb7a2f4ce75a5b20fab33b5fab658c09fd179f69a7e2d36e93787324cb68b",
   "decimals0": 6,
   "decimals1": 18,
   "legIndex": 0,
   "observedAtMs": 1790166480004,
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
    "blockHash": "0x6a898054cca0e24bbe68b74a518bbaa8fcbffb594d661e018059c3863db28a13",
    "blockNumber": "71397440",
    "blockTimestamp": "1790166476",
    "chainId": 196,
    "coveredTicks": {
     "lower": 220160,
     "upper": 240639
    },
    "fee": 500,
    "kind": "uniswap-v3-pool-snapshot",
    "liquidity": "134939014816499221",
    "observationCardinality": 32,
    "pool": "0x273DA512f76129ED59a2D93D68dFe198423a3114",
    "sqrtPriceX96": "8316057484982349699936397358150638",
    "tick": 231238,
    "tickSpacing": 10,
    "ticks": [
     "... 3 fields omitted",
     "... 3 fields omitted",
     "... 51 more"
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

## `GET /v1/terms/:chain/:asset/why`

Why the current terms are what they are (V3-04): three sentences with their numbers, computed from the latest post's own input bundle. Chain 196. Cached by inputsHash.

`/v1/terms/196/KOx/why`

```json
{
 "chainId": 196,
 "symbol": "KOx",
 "asOf": "2026-09-23T12:29:03.279Z",
 "tx": "0xf13f8939190aa0ffad69aadbf09b28bbd95d7a08ccd0cd4610b96043ce881bb1",
 "explorer": "https://www.oklink.com/xlayer/tx/0xf13f8939190aa0ffad69aadbf09b28bbd95d7a08ccd0cd4610b96043ce881bb1",
 "inputsHash": "0x48fc1601ae67a75efe130a25d93f505aee6c5eadabffac9d95bc0e9ef4f7f770",
 "kts": "0.2",
 "label": "Computed",
 "sentences": [
  {
   "field": "carryLTV",
   "sentence": "Carry is 10.86 points below the fixed 65.00% line: 2.5 \u00d7 0.92 volatility \u00d7 the 4.33% stressed gap over the 25h 02m until the next deep session (Thu 13:30 UTC..."
  },
  {
   "field": "sessionMaxLTV",
   "sentence": "Session Max only has to reach the cure deadline, 6h 32m away (Wed 19:00 UTC): margin 5.95 points. Posted tighter than the engine's 59.05% while a loosening w..."
  },
  "... 1 more"
 ]
}
```

## `GET /v1/terms/:chain/:asset/changes?hours=72`

Every material term change in the window (1 to 168 hours), newest first, each with its computed causes and the post that made it (V3-04). Cache 30 s.

`/v1/terms/196/KOx/changes?hours=72`

```json
{
 "chainId": 196,
 "symbol": "KOx",
 "hours": 72,
 "label": "Computed",
 "generatedAt": "2026-09-23T12:36:53.772Z",
 "changes": [
  {
   "at": "2026-09-23T12:19:03.839Z",
   "field": "carryLTV",
   "from": "0.54039215514308243",
   "to": "0.541413023829781982",
   "delta": "0.102087",
   "headline": "Carry up 54.04% to 54.14% (0.10 pts). A loosening held back earlier is released (0.09 pts).",
   "causes": [
    {
     "kind": "LOOSEN_CAP",
     "sentence": "A loosening held back earlier is released (0.09 pts).",
     "contribution": "0.085029"
    },
    {
     "kind": "HORIZON",
     "sentence": "Carry up 0.02 pts from the horizon: the loan must now survive 25h 11m until the next deep session (Thu 13:30 UTC) instead of 25h 17m; the stressed gap over t...",
     "contribution": "0.017058"
    }
   ],
   "residual": null,
   "tx": "0x8bf4dce2211f30f3bbe2130958fda81a42f3ad43fc3cebdae1393e246e4bd5fe",
   "explorer": "https://www.oklink.com/xlayer/tx/0x8bf4dce2211f30f3bbe2130958fda81a42f3ad43fc3cebdae1393e246e4bd5fe",
   "prevTx": "0x9c1284326530f1c56d0cff0c7dbb45af0f364c81062c13d8583b84ef230b4a08",
   "inputsHash": "0x614acbdd31b136605e5e40391758e0326e11fc8438b1e25080499f5d1b5d5a34"
  },
  {
   "at": "2026-09-23T12:19:03.839Z",
   "field": "sessionMaxLTV",
   "from": "0.587620268300281583",
   "to": "0.589898630852145874",
   "delta": "0.227836",
   "headline": "Session Max up 58.76% to 58.99% (0.23 pts). A loosening held back earlier is released (0.19 pts).",
   "causes": [
    {
     "kind": "LOOSEN_CAP",
     "sentence": "A loosening held back earlier is released (0.19 pts).",
     "contribution": "0.189238"
    },
    {
     "kind": "HORIZON",
     "sentence": "Session Max up 0.04 pts from the horizon: the loan must now survive 6h 41m to the cure deadline (Wed 19:00 UTC) instead of 6h 47m; the stressed gap over that...",
     "contribution": "0.038598"
    }
   ],
   "residual": null,
   "tx": "0x8bf4dce2211f30f3bbe2130958fda81a42f3ad43fc3cebdae1393e246e4bd5fe",
   "explorer": "https://www.oklink.com/xlayer/tx/0x8bf4dce2211f30f3bbe2130958fda81a42f3ad43fc3cebdae1393e246e4bd5fe",
   "prevTx": "0x9c1284326530f1c56d0cff0c7dbb45af0f364c81062c13d8583b84ef230b4a08",
   "inputsHash": "0x614acbdd31b136605e5e40391758e0326e11fc8438b1e25080499f5d1b5d5a34"
  },
  "... 230 more"
 ]
}
```

## `GET /v1/exit/:chain/:asset?hours=72`

The exit check (V3-06): the latest post's tick-walk C(1%) against the OKX DEX quote at the same notionals, which bound the capacity, the quote's age, and a summary of the window with a strip of checks. Cache 30 s.

`/v1/exit/196/KOx?hours=72`

```json
{
 "chainId": 196,
 "symbol": "KOx",
 "hours": 72,
 "label": "Computed",
 "generatedAt": "2026-09-23T12:36:59.759Z",
 "latest": {
  "at": "2026-09-23T12:29:03.279Z",
  "tx": "0xf13f8939190aa0ffad69aadbf09b28bbd95d7a08ccd0cd4610b96043ce881bb1",
  "explorer": "https://www.oklink.com/xlayer/tx/0xf13f8939190aa0ffad69aadbf09b28bbd95d7a08ccd0cd4610b96043ce881bb1",
  "inputsHash": "0x48fc1601ae67a75efe130a25d93f505aee6c5eadabffac9d95bc0e9ef4f7f770",
  "simulatedC1": "12342.537109",
  "quotedC1": "12340.847629",
  "usedC1": "12342.537109",
  "delta": "0.000136901455296301",
  "bound": "tick-walk",
  "unavailableReason": null,
  "quoteAgeSec": 173,
  "router": "Uniswap V3:100%",
  "source": "okx-dex:v6-quote"
 },
 "summary": {
  "checks": 430,
  "okxBound": 2,
  "medianDelta": "0.001450797369545305",
  "maxDelta": "0.4642502263271229",
  "unavailable": 82,
  "unavailableReasons": {
   "input bundle not retrievable": 82
  }
 },
 "strip": [
  {
   "at": "2026-09-23T12:29:03.279Z",
   "bound": "tick-walk"
  },
  {
   "at": "2026-09-23T12:19:03.839Z",
   "bound": "tick-walk"
  },
  "... 286 more"
 ]
}
```

## `GET /v1/credit/:chain/keeper`

The demo keeper's status line (V3-02): its address, the demo state, its position, the last action with its transaction, and what it does next. Read-only. Testnet 1952.

`/v1/credit/1952/keeper`

```json
{
 "address": "0xacCd2b8B681eF9C5BeB1A2d08872652170EfC0f4",
 "chainId": 1952,
 "collateral": "kHKEXCx",
 "updatedAt": "2026-09-23T12:36:11.544Z",
 "state": "SESSION",
 "position": "open",
 "debt": "2000.000001",
 "next": "Becomes curable when the demo Last Call opens",
 "nextAt": "2026-09-23T12:53:58.000Z",
 "note": "session, position already open",
 "lastAction": {
  "action": "borrow 2000 mUSDG with Session Max",
  "at": "2026-09-23T12:14:32.882Z",
  "tx": "0x3203c7e1e63ea259a25eb21159cecbdfcf683f194fd676a87a7b5732bca52594"
 },
 "running": true,
 "ageSec": 48,
 "label": "Observed"
}
```

## `GET /v1/agents/stats`

Kerb for Agents (V3-03): settled x402 calls by network with the latest settlement, the OKX.AI listing status, and the endpoints. Cache 15 s.

`/v1/agents/stats`

```json
{
 "label": "Observed",
 "generatedAt": "2026-09-23T12:36:59.800Z",
 "listingStatus": "unregistered",
 "live": {
  "network": "eip155:1952",
  "price": "$0.01",
  "currency": "USDT0"
 },
 "endpoints": {
  "creditCheck": "https://api.usekerb.xyz/agents/credit-check",
  "exitCheck": "https://api.usekerb.xyz/agents/exit-check",
  "terms": "https://api.usekerb.xyz/agents/terms",
  "mcp": "https://api.usekerb.xyz/mcp"
 },
 "paidCalls": []
}
```

## `GET /agents/terms/:asset`

Kerb for Agents, free: the latest posted terms for one asset with the why sentences. Served by kerb-agents.

`/agents/terms/HKEXCx`

```json
{
 "chainId": 196,
 "assetId": "0xceef091e9b937d639d95fcf4656486bded3108c3125a76fa4174553f533e01d3",
 "symbol": "HKEXCx",
 "observedAt": "2026-09-23T12:28:00.000Z",
 "ageSec": 540,
 "usable": true,
 "regime": {
  "value": "REFERENCE_CLOSED",
  "index": 4,
  "label": "Attested"
 },
 "creditMark": {
  "raw": "49278229050458649233",
  "decimals": 18,
  "label": "Attested"
 },
 "carryLTV": {
  "raw": "491718424024139429",
  "decimals": 18,
  "label": "Attested"
 },
 "sessionMaxLTV": {
  "raw": "496368318579332179",
  "decimals": 18,
  "label": "Attested"
 },
 "debtCeiling": {
  "raw": "2424143139",
  "decimals": 6,
  "label": "Attested"
 },
 "executableDepth1": {
  "raw": "17061879882",
  "decimals": 6,
  "label": "Attested"
 },
 "loanAsset": {
  "symbol": "USDG",
  "decimals": 6
 },
 "inputsHash": "0x47ea441f3fc683f169f17c6833307f8d6c86268490ad1043693b4e7137cbd4e7",
 "bundle": {
  "cid": "bafkreida25achnz4saeiz3cr7vlgxkrxz3watj46m6it3tibvkgmlpzvvy",
  "pinStatus": "unpinned",
  "pinned": false,
  "ipfsUrl": null,
  "url": "/v1/bundle/0x47ea441f3fc683f169f17c6833307f8d6c86268490ad1043693b4e7137cbd4e7",
  "servedByApi": true,
  "verifyCommand": "pnpm --filter @kerb/engine kerb verify 0x47ea441f3fc683f169f17c6833307f8d6c86268490ad1043693b4e7137cbd4e7"
 },
 "tx": "0x43b6c1976ee313cfffe6acdbdcb6ae9ebff0338d8c87f10639724c5e340b6803",
 "contracts": {
  "clock": "0xf765d374e0ce576860a463f0d796ad45c62161b8",
  "terms": "0x6d6eaf24c498df6cef0954f6d19ab4ea7b0102d5"
 },
 "why": [
  "Session Max margin is 10.3 pts: the loan must reach the cure deadline, 15h 2m away.",
  "Carry margin is 10.7 pts: it must survive until the next deep session, 16h 32m away."
 ],
 "whyKind": "now"
}
```

## Kerb for Agents: paid checks over x402 (V3-03)

`GET` or `POST /agents/credit-check` (asset, amount, unit token|usdg, mode carry|session_max) and `/agents/exit-check` (asset, sizeUSDG) are priced at $0.01 in USDT0 on X Layer and settled through the OKX facilitator. Bad input is a 400 or 404 before any payment is asked for; a 4xx or 5xx is never settled. The answer carries the posted tx, the inputsHash and the command that recomputes it. No model is in the path. Free MCP tools (kerb_terms, kerb_board, kerb_clock, kerb_why, kerb_position, kerb_paid_tools) are at `POST /mcp`, 60 calls a minute per address.

`curl -i -X POST https://api.usekerb.xyz/agents/credit-check` answers 402 with this `PAYMENT-REQUIRED` header, decoded:

```json
{
 "x402Version": 2,
 "error": "Payment required",
 "resource": {
  "url": "https://api.usekerb.xyz/agents/credit-check",
  "description": "Kerb Credit Check: safe borrow and cure deadline for a tokenized stock on X Layer",
  "mimeType": "application/json"
 },
 "accepts": [
  {
   "scheme": "exact",
   "network": "eip155:1952",
   "amount": "10000",
   "asset": "0x9e29b3aada05bf2d2c827af80bd28dc0b9b4fb0c",
   "payTo": "0x0d63f9eeb86813230b72017444cea16cd4a453f2",
   "maxTimeoutSeconds": 300,
   "extra": {
    "name": "USD\u20ae0",
    "version": "1"
   }
  }
 ]
}
```
