# V3 POSITIONING
## One story, told the same way on the site, the README, the form and the video

---

## 1. The sentence

**Kerb is the market-time risk layer for tokenized stocks on X Layer.** It measures how much of a position could actually be sold in X Layer pools and how long a loan must survive before the next deep market, then publishes both as credit terms anyone can recompute. Kerb Credit lends against them. So can any contract, agent or app.

Tagline unchanged: **Credit on the market's clock.**
Creed unchanged: **Never lend more than you can liquidate.**

Hierarchy, always in this order: **Kerb Terms** (the layer) → consumers: **Kerb Credit** (reference market), **Agents** (OKX.AI, x402), **Contracts** (KerbQuote), **Developers** (REST, SDK, MCP).

## 2. Site copy changes

**Home hero lede** (replace):
> Tokenized stocks trade around the clock. Liquidation conditions don't. Kerb measures the exit in real X Layer pools and turns it into credit terms. Kerb Credit lends against them. So can anyone.

**Home, "How a term is made" lede** (fix the false word):
> Five layers, each measured or computed from the one below, each published in an input bundle anyone can fetch and recompute.

**Home, new section after "How a term is made"**, replacing the Verify band's top half:

Kicker: `KERB TERMS · ONE TERM, FOUR CONSUMERS`
Title: **Read by a credit market, contracts, agents and code.**

| Card | Line | Live evidence line |
|---|---|---|
| Kerb Credit | The reference market: borrow at Carry or Session Max against mirror collateral on X Layer testnet. | "{n} positions opened · last cure {age} ago" |
| Agents | Pay one cent in USDT0 on X Layer for a credit check, through OKX.AI. | "{n} paid calls settled · {listing status}" |
| Contracts | Call KerbQuote on X Layer mainnet: max borrow and cure deadline in one read. | "0x… · Sourcify exact match" |
| Developers | REST, SDK and MCP. Public terms need no key. | "{n} endpoints · MCP at api.usekerb.xyz/mcp" |

Every evidence line is live or absent. No card shows a number it cannot fetch.

Keep the "Verify everything" strip below it (contracts, Builder Code, test counts, Open the proof).

**Developers h1** unchanged ("Read Kerb Terms from anywhere."). Tabs: SDK · REST · Solidity · Agents.

**Research index lede** (add one sentence):
> Report #2 measures what happened to executable depth in X Layer xStocks pools when the X Liquidity incentives ended on 24 Sep.

**Credit empty state** once the keeper runs:
> A standing demo position opens every cycle and becomes curable when the demo Last Call opens in {t}. Cure it from any wallet and earn the bonus in mirror collateral.

## 3. Claims

**Allowed** (each needs its row in `CLAIM_EVIDENCE.md`):
- Terms posted on X Layer mainnet every few minutes, with the Builder Code on every Kerb transaction.
- Executable depth measured by walking the real Uniswap V3 pools tick by tick, cross-checked against OKX DEX quotes; the smaller wins.
- Carry and Session Max margins tied to the survival horizon (KTS 0.2); the liquidation threshold is fixed.
- Every published term recomputes from its published inputs.
- The credit lifecycle runs on X Layer testnet with mirror collateral; the risk plane is on mainnet; no user funds on mainnet.
- Kerb Credit Check is an x402 endpoint on X Layer (and, only when true: registered on OKX.AI, listed on OKX.AI, first paid call settled at tx).
- KerbQuote is deployed and verified on X Layer mainnet (only when true).

**Forbidden, anywhere:**
"first", "only", "the leading", "guaranteed", "audited", "trustless", "decentralised" (there is one attester), "real-time" (say "every few minutes"), "pinned" (unless that CID resolves), "AI-powered", "autonomous underwriting", "institutional-grade", "Chainlink-powered", "lending protocols treat every moment as identical", "integrated by lenders", "production lending", any competitor not listed in section 4.

## 4. The competitor paragraph (README FAQ, and the only way to talk about others)

> **Isn't this what Aave or Morpho do?** Tokenized-stock lending exists: Kamino runs an xStocks market on Solana, Morpho lists Ondo and Coinbase stock tokens on Ethereum and Base, and Aave has announced equity lending for V4. Those markets price collateral with oracles and set risk parameters per market; a Morpho market fixes its liquidation LTV when it is created. Kerb is the layer such a market would read: a measured, recomputable answer to how much of a position the onchain pool could absorb and how long a loan must survive before the next deep market, published on X Layer. Chainlink's 24/5 equity streams tell you what a stock is worth and whether its market is open; Kerb tells you whether the exit is there. They complement each other, and Chainlink is Kerb's planned rung-1 reference once credentials are in place.

Sources to link in the README: morpho.org/stories/ondo, the Block on Kamino xStocks (July 2025), Aave V4 tokenized-stock announcement (26 June 2026), chain.link blog on 24/5 US Equities Streams (20 Jan 2026).

## 5. README top (replace the first screen)

```
# Kerb
[CI badge]

**Credit on the market's clock.** Kerb is the market-time risk layer for tokenized stocks on X Layer.
It measures the exit that is really there in X Layer pools, and how long a loan must survive before
the next deep market, and posts both as credit terms on X Layer mainnet every few minutes.
Kerb Credit lends against them. So can any contract, agent or app.

[Home screenshot, Night]

**Watch the 3-minute demo:** {link}  ·  **Live:** www.usekerb.xyz  ·  **API:** api.usekerb.xyz
Built for OKX Dev Day 2026 · Build a Market · Remote

## For judges: five minutes
1. Board: which stocks are in Last Call now, and what each can safely support.        /board
2. An asset: the exit check (tick-walk against the OKX DEX quote) and why its terms moved.  /asset/HKEXCx
3. Credit: borrow at Session Max, watch the demo Last Call, cure the standing position.    /credit
4. Proof: every contract, the Builder Code decoded, a term recomputed from its inputs.     /proof
5. Agents and contracts: the x402 credit check on OKX.AI, and KerbQuote on mainnet.        /developers
```

Then the existing "How it works", "Try it", deployments, verify, repository map, limitations, plus the section 4 FAQ.

## 6. Form summary (brief, paste-ready; pick the bracket that is true on the day)

> **Kerb is the market-time risk layer for tokenized stocks on X Layer.**
>
> **Product.** Tokenized stocks trade 24/7; their exit does not. Kerb walks the real Uniswap V3 pools on X Layer tick by tick, cross-checked against OKX DEX quotes, to measure how much could actually be sold, reads each stock's own market clock, and posts credit terms on X Layer mainnet every few minutes: Carry, sized to survive until the next deep market; Session Max, more now with a promise to cure at Last Call; a debt ceiling capped by measured depth. Every term recomputes from its published inputs.
>
> **Users.** Tokenized-stock holders who want credit without selling; lenders and curators who need exit-aware limits; agents that need a verifiable answer before taking risk.
>
> **Core integration.** KerbClock and KerbTerms on X Layer mainnet with ERC-8021 Builder Codes; Kerb Credit (borrow, Last Call, permissionless cure) on X Layer testnet; KerbQuote, a read adapter any X Layer contract can call; and paid credit checks for agents via x402 on X Layer [listed on OKX.AI | registered on OKX.AI, listing under review].

About 150 words. Verify every bracket and number on the morning of 25 Sep.

## 7. Report #2 framing

Title (already set): *What happened when the X Liquidity incentives ended.*
Lede: *On 24 Sep at 07:00 UTC, OKX's X Liquidity incentives on ten X Layer xStocks pools ended. Kerb had been measuring those pools every minute for five days. This is what executable depth did, pool by pool, measured, not modelled.*
If depth held: *"Depth held" is the finding, and it is useful: the incentives had built liquidity that stayed.* Never force a fall.
Close with: the dataset download and the reproduce command.

## 8. Words (use exactly these)

Kerb Terms · Kerb Credit · Carry · Session Max · Last Call · cure · Credit Mark · C(1%) · executable depth · the Board · Market-Time Report · KTS 0.2 · KerbQuote · Kerb Credit Check (the agent service) · mirror collateral · mUSDG · risk plane (mainnet) · credit plane (testnet).

## 9. Your X post (rough draft, edit freely)

> been measuring the xStocks pools on X Layer every minute for 6 days.
> when the liquidity incentives ended thursday, [what the report actually shows, one line].
>
> Kerb turns that into credit terms: how much you could actually sell, and how long a loan has to survive before the market's deep again. posted onchain every few minutes. agents can pay a cent for the answer.
>
> demo: {link}
>
> what would you check before lending against a tokenized stock?
