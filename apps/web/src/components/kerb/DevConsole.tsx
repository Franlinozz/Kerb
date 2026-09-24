"use client";

/**
 * Developers tabs (V2-DESIGN-SYSTEM.md section 11.8): SDK, REST, Solidity. Each has an install line,
 * a short example with copy, and a live response fetched in the browser from the public API, so
 * what a reader sees is exactly what their own code would get.
 */
import { useEffect, useState } from "react";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { Tabs } from "@/components/ui/Tabs";
import { shortHash, utcStamp } from "@/lib/format";
import type { AgentStats } from "@/lib/api";
import { QuoteLive } from "./QuoteLive";

export interface ConsumerInfo { quote: `0x${string}`; chainId: number; token: `0x${string}`; assetId: `0x${string}`; symbol: string; feeds: { symbol: string; address: string; explorer: string }[]; verification: string | null }

type Live = { state: "loading" } | { state: "ok"; at: string; body: string } | { state: "error" };

function trim(o: unknown, depth = 0): unknown {
  if (Array.isArray(o)) return depth >= 1 ? [...o.slice(0, 1).map((x) => trim(x, depth + 1)), ...(o.length > 1 ? [`${o.length - 1} more`] : [])] : o.map((x) => trim(x, depth + 1));
  if (o && typeof o === "object") return Object.fromEntries(Object.entries(o as Record<string, unknown>).map(([k, v]) => [k, trim(v, depth + 1)]));
  return o;
}

function LivePanel({ url, pick }: { url: string; pick: (j: unknown) => unknown }): React.ReactElement {
  const [live, setLive] = useState<Live>({ state: "loading" });
  useEffect(() => {
    const ac = new AbortController();
    fetch(url, { signal: ac.signal })
      .then(async (r) => { if (!r.ok) throw new Error("status"); return r.json() as Promise<unknown>; })
      .then((j) => setLive({ state: "ok", at: new Date().toISOString(), body: JSON.stringify(trim(pick(j)), null, 2) }))
      .catch(() => { if (!ac.signal.aborted) setLive({ state: "error" }); });
    return () => ac.abort();
  }, [url, pick]);
  return (
    <div className="dev-live" aria-live="polite">
      <div className="dev-live-head">
        <span className="t-label">Live response</span>
        <span className="t-small ink-3 mono">{live.state === "ok" ? `GET ${url.replace(/^https?:\/\/[^/]+/, "")} · ${utcStamp(live.at)}` : live.state === "loading" ? "Fetching" : "The API did not answer from this browser"}</span>
      </div>
      <pre tabIndex={0} aria-label="Live response body"><code>{live.state === "ok" ? live.body : live.state === "loading" ? "" : `Open ${url} directly to see the response.`}</code></pre>
    </div>
  );
}

const pickTerms = (j: unknown): unknown => {
  const t = j as Record<string, unknown>;
  return { symbol: t["symbol"], observedAt: t["observedAt"], usable: t["usable"], regime: t["regime"], carryLTV: t["carryLTV"], sessionMaxLTV: t["sessionMaxLTV"], creditMark: t["creditMark"], debtCeiling: t["debtCeiling"], inputsHash: t["inputsHash"] };
};
const pickBoard = (j: unknown): unknown => {
  const b = j as { rows?: Record<string, unknown>[] };
  const r = b.rows?.[0] ?? {};
  return { rows: `${b.rows?.length ?? 0} assets, first shown`, first: { symbol: r["symbol"], regime: r["regime"], carryLTV: r["carryLTV"], sessionMaxLTV: r["sessionMaxLTV"], lt: r["lt"], debtCeiling: r["debtCeiling"], kts: r["kts"] } };
};
const pickOnchain = (j: unknown): unknown => {
  const t = j as Record<string, { raw?: string; index?: number } | boolean | string>;
  const raw = (k: string): string | undefined => (t[k] as { raw?: string } | undefined)?.raw;
  return { "effectiveTerms(assetId)": { carryLTV: raw("carryLTV"), sessionMaxLTV: raw("sessionMaxLTV"), creditMark: raw("creditMark"), regime: (t["regime"] as { index?: number } | undefined)?.index, usable: t["usable"] }, postedIn: t["tx"] };
};

export function DevConsole({ api, kerbTerms, symbol, consumer = null, agents = null }: { api: string; kerbTerms: string; symbol: string; consumer?: ConsumerInfo | null; agents?: AgentStats | null }): React.ReactElement {
  // /developers#rest and #solidity open that tab (the footer links there); the tab keeps the hash.
  const [tab, setTab] = useState<string | undefined>(undefined);
  useEffect(() => {
    const read = (): void => { const h = window.location.hash.slice(1); if (h === "sdk" || h === "rest" || h === "solidity" || h === "agents") setTab(h); };
    read(); window.addEventListener("hashchange", read); return () => window.removeEventListener("hashchange", read);
  }, []);
  const sdk = `import { Kerb, toDecimalString } from "kerb-sdk";

const kerb = new Kerb();                       // X Layer mainnet, ${api}
const t = await kerb.terms("${symbol}");

if (!t.usable) throw new Error("no new exposure: terms stale or regime unsound");

// Decimal strings all the way: a risk number parsed into a float quietly goes wrong.
const carry = toDecimalString(t.carryLTV);      // lend up to this across the close
const ceiling = toDecimalString(t.debtCeiling); // loan-asset units, not WAD`;

  const rest = `BASE=${api}

# Every asset with its regime, capacities, fixed LT and margins
curl -s "$BASE/v1/board?chain=196" | jq '.rows[0]'

# One asset's latest posted terms and the bundle behind them
curl -s "$BASE/v1/terms/196/${symbol}" | jq '{usable, carryLTV, debtCeiling}'

# The exact bytes: keccak256 of this body equals inputsHash
curl -s "$BASE/v1/bundle/<inputsHash>" | cast keccak`;

  const sol = `interface IKerbTerms {
    function effectiveTerms(bytes32 assetId) external view
        returns (uint64 carryLTV, uint64 sessionMaxLTV, uint128 creditMark, uint16 regime, bool usable);
}

contract Lender {
    IKerbTerms constant KERB = IKerbTerms(${kerbTerms}); // X Layer mainnet

    function maxBorrow(bytes32 assetId, uint256 amount) external view returns (uint256) {
        (uint64 carry,, uint128 mark,, bool usable) = KERB.effectiveTerms(assetId);
        if (!usable) return 0;                   // no new risk; repay and cure still work
        return amount * mark / 1e18 * carry / 1e18;
    }
}`;

  const kq = consumer ? `KerbQuote.Quote memory q = KerbQuote(${consumer.quote}).quoteToken(TOKEN, amount, KerbQuote.Mode.Carry);
require(q.usable, "Kerb: terms not usable");
require(debt <= q.maxBorrow, "Kerb: above Carry capacity");
// q.cureDeadline (Session Max), q.inputsHash: the bundle that recomputes these numbers
// quote(assetId, amount, mode) takes the assetId directly: keccak256(abi.encode(196, token))` : "";
  const cast = consumer ? `cast call ${consumer.quote} "maxBorrow(bytes32,uint256,uint8)(uint256)" ${consumer.assetId} 10000000000000000000 0 --rpc-url ${consumer.chainId === 196 ? "https://rpc.xlayer.tech" : "https://testrpc.xlayer.tech"}` : "";
  const mcp = `{
  "mcpServers": {
    "kerb": { "type": "http", "url": "${api}/mcp" }
  }
}`;
  const pay = `curl -i -X POST ${api}/agents/credit-check \
  -H 'content-type: application/json' \
  -d '{"asset":"HKEXCx","amount":"100","mode":"session_max"}'
# HTTP 402 with PAYMENT-REQUIRED: sign the EIP-3009 transfer it describes and retry
# with PAYMENT-SIGNATURE. Any x402 client does this, for example @okxweb3/x402-fetch.`;
  const latestPaid = agents?.paidCalls.find((p) => p.network === "eip155:196")?.latest ?? agents?.paidCalls.find((p) => p.latest)?.latest ?? null;

  return (
    <Tabs label="Integration" {...(tab ? { value: tab } : {})} onChange={(id) => { setTab(id); history.replaceState(null, "", `#${id}`); }} tabs={[
      { id: "sdk", label: "SDK", content: (
        <div className="dev-tab">
          <p className="t-small ink-2">One TypeScript module with no dependencies, on npm as <a href="https://www.npmjs.com/package/kerb-sdk" target="_blank" rel="noreferrer">kerb-sdk</a>, or taken from the repository as one file:</p>
          <CodeBlock variants={[{ lang: "npm", code: "npm i kerb-sdk" }, { lang: "shell", code: "curl -o kerb.ts https://raw.githubusercontent.com/Franlinozz/Kerb/main/packages/sdk/src/index.ts" }, { lang: "degit", code: "npx degit Franlinozz/Kerb/packages/sdk kerb-sdk" }]} />
          <CodeBlock variants={[{ lang: "typescript", code: sdk }]} />
          <LivePanel url={`${api}/v1/terms/196/${encodeURIComponent(symbol)}`} pick={pickTerms} />
        </div>
      ) },
      { id: "rest", label: "REST", content: (
        <div className="dev-tab">
          <p className="t-small ink-2">No key. CORS open for GET. Values are decimal strings with their scale and provenance label.</p>
          <CodeBlock variants={[{ lang: "shell", code: `curl -s ${api}/health` }]} />
          <CodeBlock variants={[{ lang: "shell", code: rest }]} />
          <LivePanel url={`${api}/v1/board?chain=196`} pick={pickBoard} />
        </div>
      ) },
      { id: "solidity", label: "Solidity", content: (
        <div className="dev-tab">
          {consumer ? (
            <div className="dev-use">
              <h3>Use Kerb from your contract</h3>
              <p className="t-small ink-2">KerbQuote reads the posted terms and the clock and returns max borrow, cure deadline and usability in one call, valuing collateral exactly as Kerb Credit does. It holds nothing and has no owner. {consumer.chainId === 196 ? "On X Layer mainnet" : "On X Layer testnet for now; the mainnet deployment is pending"}, <a className="mono" href={`https://www.oklink.com/${consumer.chainId === 196 ? "xlayer" : "x-layer-testnet"}/address/${consumer.quote}`} target="_blank" rel="noreferrer">{shortHash(consumer.quote, 8, 6)}</a>{consumer.verification ? `, ${consumer.verification}` : ""}.</p>
              <CodeBlock variants={[{ lang: "solidity", code: kq }]} />
              <QuoteLive quote={consumer.quote} chainId={consumer.chainId} assetId={consumer.assetId} symbol={consumer.symbol} />
              <CodeBlock variants={[{ lang: "shell", code: cast }]} />
              {consumer.feeds.length ? (
                <>
                  <p className="t-small ink-2 mt-4">KerbMarkFeed puts the Credit Mark behind a Chainlink-shaped latestRoundData (8 decimals), and fails closed when the terms are not usable. The mark is conservative by construction, not a mid-market price.</p>
                  <dl className="dev-endpoints">{consumer.feeds.map((f) => <div key={f.address}><dt>{f.symbol}</dt><dd><a className="mono" href={f.explorer} target="_blank" rel="noreferrer">{shortHash(f.address, 8, 6)}</a></dd></div>)}</dl>
                </>
              ) : null}
            </div>
          ) : null}
          <h3 className="mt-5">Or read KerbTerms directly</h3>
          <p className="t-small ink-2">The authoritative source: no API and no Kerb server in the path. assetId is keccak256(abi.encode(chainId, token)).</p>
          <CodeBlock variants={[{ lang: "shell", code: `cast call ${kerbTerms} "effectiveTerms(bytes32)(uint64,uint64,uint128,uint16,bool)" <assetId> --rpc-url https://rpc.xlayer.tech` }]} />
          <CodeBlock variants={[{ lang: "solidity", code: sol }]} />
          <LivePanel url={`${api}/v1/terms/196/${encodeURIComponent(symbol)}`} pick={pickOnchain} />
          <p className="t-small ink-3">The panel shows the values as last posted; the contract adds its own freshness check to usable at the block you read.</p>
        </div>
      ) },
      { id: "agents", label: "Agents", content: (
        <div className="dev-tab">
          <p className="t-small ink-2">Kerb Credit Check answers how much can be borrowed against a tokenized stock on X Layer, and until when, with the transaction and inputs hash that recompute it. Deterministic: no model anywhere in the path.</p>
          <dl className="dev-endpoints">
            <div><dt>Price</dt><dd>{agents ? `${agents.live.price} in ${agents.live.currency} per call, x402 on ${agents.live.network === "eip155:196" ? "X Layer mainnet" : "X Layer testnet"}` : "$0.01 in USDT0 per call, x402 on X Layer"}</dd></div>
            <div><dt>OKX.AI</dt><dd>{agents ? { unregistered: "Not listed", registered: "Registered", under_review: "Registered, listing under review", listed: "Listed as an A2MCP service" }[agents.listingStatus] : "Status unavailable"}</dd></div>
            <div><dt>Latest settled payment</dt><dd>{latestPaid ? <a className="mono" href={latestPaid.explorer} target="_blank" rel="noreferrer">{shortHash(latestPaid.tx, 10, 8)}</a> : "None settled yet"}</dd></div>
          </dl>
          <CodeBlock variants={[{ lang: "shell", code: pay }]} />
          <h3 className="mt-5">Free MCP server</h3>
          <p className="t-small ink-2">Six read-only tools for Claude, Cursor or any MCP client: kerb_terms, kerb_board, kerb_clock, kerb_why, kerb_position, kerb_paid_tools. Streamable HTTP, 60 calls a minute.</p>
          <CodeBlock variants={[{ lang: "json", code: mcp }]} />
        </div>
      ) },
    ]} />
  );
}
