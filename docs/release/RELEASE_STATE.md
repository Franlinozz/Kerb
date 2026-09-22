# Release state

**Cut over 22 Sep 2026 16:00 to 16:02 UTC** (before the Thu 20:00 UTC freeze). Tag `v2.0.0` on commit
`c8a72c0` (also `v2-cutover`). Later fixes are deployed the same way and noted at the end.

| | |
|---|---|
| Product | https://www.usekerb.xyz (and https://usekerb.xyz) |
| API | https://api.usekerb.xyz (`/health`, docs in `docs/API.md`) |
| Staging | https://v2.usekerb.xyz (noindex) |
| Repository | https://github.com/Franlinozz/Kerb |
| Rollback | `bash scripts/deploy-web.sh rollback live` (previous release: V1, `dcd2877`) |

## Addresses

Mainnet risk plane (X Layer 196): KerbClock `0xf765d374e0ce576860a463f0d796ad45c62161b8`, KerbTerms `0x6d6eaf24c498df6cef0954f6d19ab4ea7b0102d5`.
Testnet credit plane (X Layer 1952): KerbClock `0x6c1de992e3219980138d7e51b67ecc523618bc5c`, KerbTerms `0x5a4942f55e37994370745ef984a21321edb75f7e`, KerbCredit `0xa1314645cd6c07e651359aba540e2600090b98a8`, KerbClockDemo `0xd2483b2d8bd759f87fadb21117498a5db36bcb0f`, kKOx `0x11827f0f59d516e3778951fde36bd0d961af4a16`, kHKEXCx `0x80da4036ee45e6d66a27dba415a4ce23eb9360f2`, MockUSDG `0x91fcf99262214c32f6fe342d94c7b0dfb2dba679`. All nine Sourcify exact match. Builder Code `kt0hl6xyhlx8xmt`.

## Verification at cutover

- Every route on the apex and on www: 200; `/market`, `/reports/1`: 308 to their V2 pages; an unknown asset: 404.
- `pnpm --filter @kerb/web e2e:live`: 47 of 47 passed against www.usekerb.xyz at 16:05 UTC.
- Golden path on the build cut over, fresh wallets, 13 transactions all successful (`data/credit-flow-2026-09-22.json`): deposit, Session Max borrow, Last Call (415.01 mUSDG), a stranger's cure from Curable now `0x7111f6e8...`, full repay, full withdraw.
- CI green; Lighthouse mobile 90 to 99 on every route (FINAL_AUDIT.md).

## Working flows

Reading every page without a wallet; Board filters and sort; asset tabs; theme (Night, Day, Market time); wallet connect through EIP-6963 with mapped errors; the wrong-network switch; mint test collateral and mUSDG; deposit, Carry or Session Max borrow; Last Call panel; cure from the public table; repay; withdraw; supply and withdraw supply; live recompute on `/proof`.

## Known issues

- No standing demo position: the keeper is written but not started (waits for the operator); the page says so.
- The rail transition E2E can miss its window under heavy parallel load; it passes on rerun and in CI.
- Report #2 is generated on Thu 24 Sep from the campaign-end captures; until then `/research` shows it as scheduled.
- The public testnet RPC is load balanced and occasionally rate limits (HTTP 403); reads retry, sends carry a wide gas margin.
