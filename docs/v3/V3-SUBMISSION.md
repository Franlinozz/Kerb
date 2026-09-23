# V3-SUBMISSION.md
## Every field of the OKX Dev Day 2026 form, answered. Verify the bracketed items on the morning of 25 Sep.

Form: https://forms.gle/81S2gnFCzqSoeDEA7 · Deadline 25 Sep 2026, 23:59 UTC · Target: submitted by 16:00 UTC.

Write every answer in a text file first, check every link from a private window on your phone, then paste.

---

## Page 1

| Field | Answer |
|---|---|
| Team Name | Xyndicate Labs |
| Team Size | 1 |
| Team Members' Names | [Your exact full legal name, as on your ID] |
| Track | Build a Market, build with X Layer |
| Participation Route | Remote |
| Able to attend the in-person finale? | 0: Unable to |
| Team Display Picture (1:1) | `docs/release/team-display.png` (Kerb mark, bone on black, 1024 × 1024) |
| Project Name | Kerb |
| Project Summary | Paste `V3-POSITIONING.md` section 6, choosing the true bracket |
| Repository Link | https://github.com/Franlinozz/Kerb |
| Demo Video | [Public or unlisted YouTube link, also posted on X] |
| Product Link | https://www.usekerb.xyz · Read pages need no wallet. Credit runs on X Layer testnet with any browser wallet; the page adds the network and links the faucet. Public API: https://api.usekerb.xyz |
| New project or existing? | **Yes, new project.** First commit 18 Sep 2026 22:38 UTC, inside the build period; day-by-day work in `BUILD_PERIOD.md` |

## Pages 2 and 3 (fields not visible on page 1; prepared answers for what these forms usually ask)

**Contract addresses (X Layer mainnet 196)**
KerbClock `0xf765d374e0ce576860a463f0d796ad45c62161b8` · KerbTerms `0x6d6eaf24c498df6cef0954f6d19ab4ea7b0102d5` · [KerbQuote `0x…` · KerbMarkFeedFactory `0x…`]

**Contract addresses (X Layer testnet 1952)**
KerbClock `0x6c1de992e3219980138d7e51b67ecc523618bc5c` · KerbTerms `0x5a4942f55e37994370745ef984a21321edb75f7e` · KerbCredit `0xa1314645cd6c07e651359aba540e2600090b98a8` · KerbClockDemo `0xd2483b2d8bd759f87fadb21117498a5db36bcb0f` · kKOx `0x11827f0f59d516e3778951fde36bd0d961af4a16` · kHKEXCx `0x80da4036ee45e6d66a27dba415a4ce23eb9360f2` · MockUSDG `0x91fcf99262214c32f6fe342d94c7b0dfb2dba679`
All Sourcify exact match. Builder Code `kt0hl6xyhlx8xmt` on every Kerb transaction.

**Technical links**
Proof (every contract, posts, recompute): https://www.usekerb.xyz/proof
API docs: https://github.com/Franlinozz/Kerb/blob/main/docs/API.md
Standard: https://github.com/Franlinozz/Kerb/blob/main/docs/v2/KTS-0.2.md
Agents: https://api.usekerb.xyz/agents/credit-check (x402) · MCP https://api.usekerb.xyz/mcp · [OKX.AI listing link]

**How Kerb uses X Layer (if asked)**
> Ten live xStocks pools on X Layer are measured every minute by walking their Uniswap V3 ticks, cross-checked against OKX DEX quotes. KerbClock and KerbTerms on X Layer mainnet post signed, reproducible credit terms for each asset every few minutes with ERC-8021 Builder Code attribution. Kerb Credit on X Layer testnet runs the full borrow, Last Call and permissionless cure lifecycle against those terms. [KerbQuote on mainnet lets any X Layer contract read them.] [Agent payments for credit checks settle in USDT0 on X Layer via x402.]

**How Kerb uses OKX AI (if asked)**
> [Kerb Credit Check is an A2MCP service on OKX.AI: an agent pays one cent per call through x402 on X Layer and receives a deterministic credit answer from Kerb's posted terms, with the transaction and inputs hash to verify it. No model in the path.] If not listed: "registered on OKX.AI, listing under review", with the same description.

**What was built during the build period (if asked)**
> Everything. The repository starts on 18 Sep 2026: calendars and onchain clock, tick-walk depth engine, OKX DEX cross-check, Credit Mark, KTS 0.1 and 0.2, mainnet and testnet contracts, credit market with the cure covenant, indexer, public API and SDK, the web app, two Market-Time Reports, [agent endpoints, consumer contracts]. 188+ commits, day by day in BUILD_PERIOD.md.

**Contact**
Email: [your email] · Telegram: [@handle] · X: @xyndicatepro

**Declaration**
Read it. Tick it.

## Before you press Submit

- [ ] Every number in the summary matches the live site this morning.
- [ ] The summary bracket for OKX.AI matches reality (listed, or under review).
- [ ] Video plays logged out, in a private window, on a phone; length 2:00 to 4:00.
- [ ] Repo opens logged out; README shows the video link at the top.
- [ ] https://www.usekerb.xyz loads cold, Board fresh (Updated under a minute ago).
- [ ] Contract links open on OKLink.
- [ ] Name matches your ID exactly.

## After you submit

1. Save the receipt email as PDF to `docs/release/submission-receipt.pdf`; commit.
2. Post the video on X (draft in `V3-POSITIONING.md` section 9), tag the official X Layer and OKX accounts (check the handles first).
3. Post the link in the builder Telegram.
4. Keep collector, attester, keeper, agents and the warmer running. Reply to any OKX email or Telegram message within 24 hours (the kit says so).
