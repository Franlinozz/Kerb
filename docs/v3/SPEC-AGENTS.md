# SPEC: KERB FOR AGENTS
## Paid credit answers on OKX.AI (A2MCP, x402 on X Layer) and a free MCP server

---

## 1. Why this is not theatre

OKX.AI's A2MCP service type is for capabilities that "take some parameters, return a clear result", read-only and deterministic, free or billed per call through x402, with the example challenge on network `eip155:196` in USDT0 (`0x779ded0c9e1022225f8e0630b35a9b54be713736`). Registration runs through Onchain OS skills with an Agentic Wallet email login; listing review completes within 24 hours. The OKX Payment SDK (`@okxweb3/x402-express`) handles the 402 challenge and onchain verification; prices are USD strings; switching to testnet is one constant (`eip155:1952`). (All E1, OKX docs linked from the Builder Kit.)

Kerb already computes exactly this kind of answer. There is no language model anywhere in this service. Every number comes from the posted mainnet terms and the engine's own report, with the transaction and inputs hash that let the caller verify it.

What is free stays free: public terms are public onchain, and `api.usekerb.xyz` keeps serving them with no key. What is sold is the computed, decision-ready answer to a specific question.

## 2. Surfaces

| Surface | Path | Price | Consumer |
|---|---|---|---|
| Credit check | `GET` or `POST https://api.usekerb.xyz/agents/credit-check` | $0.01, x402 | OKX.AI agents, any x402 client |
| Exit check | `GET` or `POST https://api.usekerb.xyz/agents/exit-check` | $0.01, x402 | Same |
| Free agent terms | `GET https://api.usekerb.xyz/agents/terms/:asset` | Free | Anyone |
| MCP server | `https://api.usekerb.xyz/mcp` (streamable HTTP) | Free tools | Claude, Cursor, any MCP client |
| Agent stats | `GET https://api.usekerb.xyz/v1/agents/stats` | Free | `/proof`, Developers |

Served by a new process `apps/agents` (Express, port 8740, PM2 `kerb-agents`) behind Caddy on the existing `api.usekerb.xyz` host: `handle /agents/*` and `handle /mcp*` go to 127.0.0.1:8740. No new DNS. The service reads the internal API at 127.0.0.1:8720 and never touches the collector, attester or keys.

## 3. `credit-check` contract

**Request** (query or JSON body)

| Field | Type | Required | Notes |
|---|---|---|---|
| `asset` | string | yes | Symbol (`HKEXCx`), token address, or assetId |
| `amount` | decimal string | yes | Collateral amount |
| `unit` | `"token"` or `"usdg"` | no, default `"token"` | `"usdg"` means the amount is already a value |
| `mode` | `"carry"` or `"session_max"` | no, default `"carry"` | |
| `chain` | 196 | no | Mainnet terms only |

**Response 200**

```json
{
  "asset": "HKEXCx",
  "chainId": 196,
  "asOf": "2026-09-23T08:28:01Z",
  "usable": true,
  "regime": "REFERENCE_CLOSED",
  "creditMark": "49.93",
  "collateralValueUSDG": "4993.00",
  "mode": "session_max",
  "ltv": { "carry": "0.478", "sessionMax": "0.547", "liquidation": "0.60", "liquidationFixed": true },
  "maxBorrowUSDG": "2731.17",
  "limits": { "maxPositionDebtUSDG": "3478.55", "debtCeilingUSDG": "1731.00", "boundBy": "ltv" },
  "covenant": { "cureRequired": true, "lastCallOpensAt": "2026-09-24T07:00:00Z", "cureDeadline": "2026-09-24T08:00:00Z" },
  "carrySurvivesUntil": "2026-09-24T01:30:00Z",
  "exit": { "c1USDG": "15900.00", "crosscheck": { "source": "okx-dex:v6-quote", "quotedUSDG": "16011.20", "bound": "tick-walk" } },
  "why": ["Session Max margin is 5.3 pts: the loan must reach the cure deadline in 23h 32m.", "Carry margin is 12.2 pts: it must survive until the next deep session, 16h 30m away."],
  "provenance": {
    "kts": "0.2",
    "contract": "0x6d6eaf24c498df6cef0954f6d19ab4ea7b0102d5",
    "tx": "0x…",
    "inputsHash": "0x…",
    "bundle": "https://api.usekerb.xyz/v1/bundle/0x…",
    "verify": "pnpm --filter @kerb/engine kerb verify 0x…"
  },
  "disclaimer": "Kerb Terms describe measured risk. Not investment advice."
}
```

Values above are illustrative placeholders for the shape only. Every real value comes from the live terms and report.

**Computation rules**
- Collateral value: reuse the engine's valuation helper exactly as `KerbCredit` and the engine value collateral (Credit Mark times the token-to-underlying conversion the engine applies). Add a test that the helper reproduces the testnet `KerbCredit` valuation for a mirror position to the wei.
- `maxBorrowUSDG = min(value × ltv(mode), maxPositionDebt)`; `boundBy` names the binding constraint. `debtCeilingUSDG` is informational (it is market-wide).
- `usable: false` whenever `effectiveTerms.usable` is false; `maxBorrowUSDG` is then `"0"` and `reason` states the regime or staleness.
- `why` comes from the attribution module (`SPEC-TERM-ATTRIBUTION.md`), never from hand-written text.
- Decimal strings everywhere; no floats in the computation path.

**Errors:** 400 with a plain reason for bad input; 404 unknown asset; 503 when the internal API or chain read fails. **No settlement on any non-2xx response** (test it).

## 4. `exit-check` contract

**Request:** `asset`, `sizeUSDG` (decimal string).
**Response 200:** `asOf`, `impactAtSize` (interpolated on the latest walked curve, stating the two bracketing curve points), `withinOnePercent`, `c05USDG`, `c1USDG`, `c3USDG`, `route` (token path and pool addresses), `crosscheck` (source, simulated, quoted, delta, which bound), `provenance` as above. If the size exceeds the walked curve, say `"beyondMeasuredCurve": true` rather than extrapolating.

## 5. x402 configuration

```ts
// apps/agents/src/pay.ts (shape, not final code)
import { paymentMiddleware, x402ResourceServer } from "@okxweb3/x402-express";
import { ExactEvmScheme } from "@okxweb3/x402-evm/exact/server";
import { OKXFacilitatorClient } from "@okxweb3/x402-core";

const NETWORK = process.env.KERB_X402_NETWORK ?? "eip155:1952"; // mainnet only after the operator's go
const PAY_TO = must(process.env.KERB_PAY_TO);                    // receive-only address, no key on the server
const facilitator = new OKXFacilitatorClient({ apiKey: must(env.OKX_API_KEY), secretKey: must(env.OKX_SECRET_KEY), passphrase: must(env.OKX_PASSPHRASE) });
const server = new x402ResourceServer(facilitator);
server.register(NETWORK, new ExactEvmScheme());

const route = (description: string) => ({
  accepts: [{ scheme: "exact", network: NETWORK, payTo: PAY_TO, price: process.env.KERB_X402_PRICE ?? "$0.01" }],
  description, mimeType: "application/json",
});

app.use(paymentMiddleware({
  "GET /agents/credit-check": route("Kerb Credit Check: safe borrow and cure deadline for a tokenized stock on X Layer"),
  "POST /agents/credit-check": route("Kerb Credit Check: safe borrow and cure deadline for a tokenized stock on X Layer"),
  "GET /agents/exit-check": route("Kerb Exit Check: measured executable exit for a tokenized stock on X Layer"),
  "POST /agents/exit-check": route("Kerb Exit Check: measured executable exit for a tokenized stock on X Layer"),
}, server));
```

Pin exact package versions after checking the npm registry. Facilitator credentials live only in the VPS environment. The server holds no private key.

## 6. Payment evidence

New append-only table `agent_calls` (same trigger pattern as the observation store): `ts, route, network, payer, amount, currency, settlement_tx, response_sha256, inputs_hash, as_of`. Parse the settlement proof from the SDK's `PAYMENT-RESPONSE`. Also append to `data/agents/payments.jsonl`.

`GET /v1/agents/stats` returns counts by network, the latest settlement tx per network, listing status (from a config value the operator updates when the OKX email arrives: `unregistered`, `registered`, `under_review`, `listed`), endpoint URLs and price.

## 7. MCP server

`@modelcontextprotocol/sdk`, streamable HTTP transport at `/mcp`, stateless. Tools (all free, read-only, deterministic):

| Tool | Input | Output |
|---|---|---|
| `kerb_terms` | `asset` | Latest terms with provenance |
| `kerb_board` | none | Every asset, compact |
| `kerb_clock` | `asset` | Session now, next transition, next weakening, cure window |
| `kerb_why` | `asset` | Current attribution sentences with numbers |
| `kerb_position` | `address`, `collateral` | Testnet Kerb Credit position: health, LTV, carry target, cure status |
| `kerb_paid_tools` | none | The x402 endpoints, price, network, and how to call them |

Each tool description says: deterministic, no model, numbers from X Layer mainnet terms, verify with the returned inputs hash. Rate limit 60 calls per minute per IP. Optional stdio wrapper in `packages/mcp` (bin `kerb-mcp`) that calls the public API, for local clients.

## 8. Registration runbook (operator plus agent)

1. In Claude Code or any agent with a shell: `Install Onchain OS via npx skills add okx/onchainos-skills --yes -g, then log in to Agentic Wallet with my email`.
2. Self-check first: `curl -i -X POST https://api.usekerb.xyz/agents/credit-check` returns **402** with a `PAYMENT-REQUIRED` header. Fix until it does.
3. `Help me register an A2MCP ASP on OKX.AI using OKX Agent Identity from Onchain OS`. Name: **Kerb Credit Check**. Description (under 300 characters): *How much can you safely borrow against a tokenized stock on X Layer, and until when. Deterministic answer from Kerb's live onchain terms: max borrow for Carry or Session Max, cure deadline, measured exit capacity cross-checked with OKX DEX, plus the tx and inputs hash to verify.* Price: 0.01. Endpoint: `https://api.usekerb.xyz/agents/credit-check`.
4. `Help me list my ASP on OKX.AI using Onchain OS`. Record the time. Review completes within 24 hours by email.
5. Optionally register **Kerb Exit Check** the same way.
6. Update the listing status config and `PROJECT_STATE.md` at each step.

Do steps 3 and 4 by **Wed 23 Sep 18:00 UTC**.

## 9. The one real payment

1. Testnet first: `KERB_X402_NETWORK=eip155:1952`, test USDT0 and OKB from the X Layer faucet into a test Agentic Wallet, follow OKX's "My Agent buys services" guide, call `credit-check`, confirm the 200 and the settlement tx on the testnet explorer.
2. Operator writes "go x402 mainnet". Switch to `eip155:196`. Operator funds their Agentic Wallet with about 2 USDT0 on X Layer mainnet.
3. From an agent session: *Use Onchain OS to call https://api.usekerb.xyz/agents/credit-check?asset=HKEXCx&amount=100&mode=session_max and pay with my Agentic Wallet.* Record the settlement tx, the response, and a screen recording (this is a video shot).
4. `/proof` shows the tile; `CLAIM_EVIDENCE.md` records the tx and states the payer was the operator's own wallet.

## 10. UI

- Developers: a fourth tab **Agents** after SDK, REST, Solidity. Content: what it answers (one sentence), price and network, listing status from `/v1/agents/stats`, `curl -i` showing the 402, the Onchain OS sentence an agent user types, the MCP config block for Claude Desktop and Cursor, the tools table, and the latest settled payment with its OKLink link.
- Proof: new tile **Agents**: "{n} paid calls settled on X Layer · latest {short tx}" plus listing status. Real data only; before the first payment the tile reads "x402 live on {network}, no settled mainnet call yet".
- Home: the consumers section (see `V3-POSITIONING.md` section 2).

## 11. Tests

Success with a mocked facilitator; 402 without payment; bad input 400; unknown asset 404; upstream failure 503 with no settlement; unusable terms 200 with `usable:false` and `maxBorrowUSDG:"0"`; valuation parity with `KerbCredit`; decimal-string round trip; MCP tool list and one call per tool; rate limit 429 with a plain reason.

## 12. Claims allowed

Before listing: "Kerb Credit Check is live as an x402 endpoint on X Layer and registered on OKX.AI (listing under review)."
After listing: "Listed on OKX.AI as an A2MCP service."
After the mainnet payment: "Agents can pay Kerb one cent in USDT0 on X Layer for a credit check; first settlement {tx} (our own test wallet)."
Never: "AI-powered", "agentic risk engine", "autonomous underwriting".
