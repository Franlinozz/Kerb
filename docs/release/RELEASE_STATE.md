# Release state, Kerb v3.0.0

Tag `v3.0.0`, cut 25 Sep 2026 before 04:00 UTC (code freeze). V2 was tagged `v2.0.0` on `c8a72c0` (22 Sep). Web deploys are blue-green (`scripts/deploy-web.sh`); every later fix is listed at the end.

| | |
|---|---|
| Product | https://www.usekerb.xyz (and https://usekerb.xyz) |
| API | https://api.usekerb.xyz (`/health`; every endpoint in `docs/API.md`) |
| For language models | https://www.usekerb.xyz/llms.txt |
| Staging | https://v2.usekerb.xyz (noindex) |
| Repository | https://github.com/Franlinozz/Kerb (public) |
| SDK | https://www.npmjs.com/package/kerb-sdk (`npm i kerb-sdk`, 0.1.0) |
| MCP | https://api.usekerb.xyz/mcp (free, stateless streamable HTTP) |
| Paid agent endpoints | https://api.usekerb.xyz/agents/credit-check and /agents/exit-check (x402, $0.01 USDT0, `eip155:196`) |
| OKX.AI | Agent #13887 "Kerb", ASP, two A2MCP services; registration tx `0x942ea858c0afb2e8aaadcd0588c02646ef9a3eff9f7c14087a93878a18b558e6`; listing submitted 25 Sep 01:05 UTC, **under review** |
| Telegram alerts | https://t.me/KerbAlertsBot |
| Rollback | `bash scripts/deploy-web.sh rollback live` |

## Addresses

**X Layer mainnet (196), risk plane.** KerbClock `0xf765d374e0ce576860a463f0d796ad45c62161b8` · KerbTerms `0x6d6eaf24c498df6cef0954f6d19ab4ea7b0102d5` · KerbQuote `0x223d5e2a97d751403300b55aa92c88a42920e52a` · KerbMarkFeedFactory `0x6aababf6d83fcfb81459f8ffee3f6dd9b83d7f6f` · ten KerbMarkFeed (listed in `config/deployments.json`, on /developers#solidity and /proof).

**X Layer testnet (1952), credit plane.** KerbClock `0x6c1de992e3219980138d7e51b67ecc523618bc5c` · KerbTerms `0x5a4942f55e37994370745ef984a21321edb75f7e` · KerbCredit `0xa1314645cd6c07e651359aba540e2600090b98a8` · KerbClockDemo `0xd2483b2d8bd759f87fadb21117498a5db36bcb0f` · kKOx `0x11827f0f59d516e3778951fde36bd0d961af4a16` · kHKEXCx `0x80da4036ee45e6d66a27dba415a4ce23eb9360f2` · MockUSDG `0x91fcf99262214c32f6fe342d94c7b0dfb2dba679` · KerbQuote `0xfd688bc3a93d04976bfced0b2ea7f90c11561c05` · KerbMarkFeedFactory `0xc363050c142ff447910cf6f31480605f7dbdbe6b`.

All 34 deployments are Sourcify exact matches. Builder Code `kt0hl6xyhlx8xmt` on every Kerb transaction (ERC-8021 suffix).

## Running processes (PM2)

kerb-collector, kerb-attester (testnet), kerb-attester-mainnet, kerb-mirror-relay, kerb-indexer, kerb-api, kerb-attribution, kerb-agents (x402, MCP, Telegram), kerb-demo-keeper, kerb-web (live, :3300), kerb-web-v2 (staging, :3301), kerb-web-warmer. Leave all running through judging.

## Keeper

Wallet `0xacCd2b8B681eF9C5BeB1A2d08872652170EfC0f4`, testnet only, debt capped at 2,000 mUSDG. Opens a Session Max position every demo cycle on kHKEXCx, or on kKOx when HKEXCx has no room between Carry and Session Max (fallback added 25 Sep 02:48 UTC after HKEXCx's Stale period left both at 5.2%; first kKOx position `0x2d40ac96650efec0a248b40ffb3397309fe6aa502bacda82d7d5fd0f9dc8edae`). Status at `/v1/credit/1952/keeper`; every action with its tx in `data/keeper.log`.

## Verification (25 Sep, 02:20 to 02:55 UTC)

- Every route 200 on apex and www; `/llms.txt`, `/sitemap.xml`, `/robots.txt` answer.
- E2E: 79 tests; against the live build 78 passed and one chain-read timing test passed on rerun. Axe: 0 serious or critical on 17 routes in both themes (live build).
- Unit: 594 TypeScript, 120 Solidity, 0 failing (`data/test-report.json`, commit `1bd8178`).
- `kerb verify` with no database reproduces a live KOx post from KerbTerms on chain, and an HKEXCx post by `--tx` (`data/release/crucible-2026-09-25/`).
- KerbQuote on mainnet: `maxBorrow(KOx, 25 tokens, Carry) = 992393683`, equal to the API's posted mark × 25 × Carry, floored.
- Exit checks: 6,342 of 6,342 mainnet checks follow the selection rule (smaller figure when they differ by more than 25%, otherwise the tick-walk).
- Secret scan over the full history of every branch: 0 matches for 11 live secret values.

## Changes after V2 (the V3 line)

Freshness guard and warmer; the demo keeper; x402 on mainnet with the first settlement `0xb0befc3e…e982e`; MCP; term attribution ("why" sentences, change timeline); KerbQuote and ten Credit Mark feeds on mainnet; the exit check against OKX DEX with 72-hour history; Last Call browser alerts and @KerbAlertsBot; Market-Time Report #2 and the dataset; the account page with mainnet holdings via KerbQuote; Docs, FAQ, whitepaper, terms, privacy and risk pages; the guided tour; Developers and Docs menus; the operator's brand across the site; the system diagram; llms.txt; `kerb verify` without a database; `kerb-sdk` on npm; OKX.AI registration.

## Known issues

- OKX.AI listing is under review; the site says so and changes only on OKX's email.
- Four x402 calls from the OKX.AI review payer (`0xbc59…2033`, 25 Sep 01:04 to 01:06 UTC) were reported settled by the facilitator without a transaction hash; no matching USDT0 transfer is on chain. They are counted as unconfirmed, never as settled.
- IPFS pinning stopped at the free plan limit on 21 Sep; bundles are served by the API and verified by hash.
- Lighthouse mobile performance on Home varies between 70 and 81 across runs on the shared host (24 Sep run: 85+ on every route).
