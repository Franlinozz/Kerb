/**
 * /llms.txt: a plain map of Kerb for language models and automated evaluators (llmstxt.org).
 * Everything here is a pointer to a live page, endpoint, contract or file where the claim can be
 * checked; nothing is asserted that the linked evidence does not show.
 */
export const dynamic = "force-static";

const BODY = `# Kerb

> Kerb is the market-time risk layer for tokenized stocks on X Layer. It measures the exit that is really there in X Layer pools (executable depth at 1% price impact, by tick-walk, cross-checked against OKX DEX quotes) and how long a loan must survive before the next deep market session, and posts both as signed credit terms on X Layer mainnet every few minutes. Kerb Credit lends against those terms on X Layer testnet with mirror collateral. Any contract, agent or app can read the same terms.

Built for OKX Dev Day 2026, Build a Market track, remote. Studio: Xyndicate Labs. Source: https://github.com/Franlinozz/Kerb (public). On X: https://x.com/usekerb. Unaudited; credit runs on testnet only.

## What to check first
- [The film](https://www.usekerb.xyz/film): three and a half minutes of the live product, from the Board to a public Cure, with chapters and captions
- [Home](https://www.usekerb.xyz/): the idea, live KPIs, the system diagram, four consumers of one term
- [Board](https://www.usekerb.xyz/board): every asset's regime, Credit Mark, C(1%), Carry and Session Max, right now
- [Asset: HKEXCx](https://www.usekerb.xyz/asset/HKEXCx): "why these terms" sentences computed from the post's own inputs; the exit check against the OKX DEX quote
- [Credit](https://www.usekerb.xyz/credit): borrow at Carry or Session Max on a demo clock (a trading week every hour), Last Call, public cure
- [Proof](https://www.usekerb.xyz/proof): every contract, the Builder Code decoded from a real transaction, paid agent calls, and a term recomputed live from its input bundle
- [Research](https://www.usekerb.xyz/research): Market-Time Reports measured from the observation store

## Documentation
- [Docs](https://www.usekerb.xyz/docs): every surface, start to finish, with the system diagram
- [FAQ](https://www.usekerb.xyz/faq)
- [Whitepaper](https://www.usekerb.xyz/whitepaper) and [PDF](https://www.usekerb.xyz/kerb-whitepaper.pdf)
- [Methodology, the Kerb Terms Standard (KTS 0.2)](https://www.usekerb.xyz/methodology)
- [Developers: SDK, REST, Solidity, Agents](https://www.usekerb.xyz/developers)
- [Changelog](https://www.usekerb.xyz/changelog)
- [README](https://github.com/Franlinozz/Kerb#readme), [Architecture](https://github.com/Franlinozz/Kerb/blob/main/docs/ARCHITECTURE.md), [API reference with captured responses](https://github.com/Franlinozz/Kerb/blob/main/docs/API.md), [Claim evidence ledger](https://github.com/Franlinozz/Kerb/blob/main/docs/release/CLAIM_EVIDENCE.md)

## Legal
- [Terms of use](https://www.usekerb.xyz/legal/terms)
- [Privacy](https://www.usekerb.xyz/legal/privacy)
- [Risk disclosure](https://www.usekerb.xyz/legal/risk)

## Onchain (X Layer mainnet, chain 196; all 34 Kerb deployments are Sourcify exact matches)
- KerbTerms 0x6d6eaf24c498df6cef0954f6d19ab4ea7b0102d5: guardrailed registry of signed terms, each with the hash of its inputs
- KerbClock 0xf765d374e0ce576860a463f0d796ad45c62161b8: exchange calendars and regimes, resolved from chain time
- KerbQuote 0x223d5e2a97d751403300b55aa92c88a42920e52a: max borrow, cure deadline and usability in one view call
- KerbMarkFeedFactory 0x6aababf6d83fcfb81459f8ffee3f6dd9b83d7f6f: ten KerbMarkFeed contracts, the Credit Mark behind a Chainlink-shaped latestRoundData that fails closed
- Every post carries OKX Builder Code kt0hl6xyhlx8xmt (ERC-8021 data suffix)
- Explorer: https://www.oklink.com/xlayer

## APIs
- REST, no key: https://api.usekerb.xyz (for example /v1/board, /v1/terms/196/KOx, /v1/terms/196/KOx/why, /v1/exit/196/KOx, /v1/stats, /v1/proof, /v1/bundle/{inputsHash})
- MCP server, free, stateless streamable HTTP: https://api.usekerb.xyz/mcp
- Paid agent checks over x402 on X Layer (USDT0, OKX facilitator): POST https://api.usekerb.xyz/agents/credit-check and /agents/exit-check
- OKX.AI: registered as agent #13887 (A2MCP services Kerb Credit Check and Kerb Exit Check); listing under review
- SDK: npm i kerb-sdk
- Telegram Last Call alerts: https://t.me/KerbAlertsBot

## Design commitments
- Deterministic: the engine is pure functions over decimal strings; every posted report recomputes byte for byte from its published input bundle
- No model near the numbers: no LLM or learned model in measurement, pricing or posting
- Append-only observation store; the chain is canonical and Postgres is a rebuildable view
- Terms tighten fast and loosen slowly; the attester may only clamp tighter than the engine
- The liquidation threshold is fixed; the clock moves the borrowing limits, never the liquidation line
`;

export function GET(): Response {
  return new Response(BODY, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" } });
}
