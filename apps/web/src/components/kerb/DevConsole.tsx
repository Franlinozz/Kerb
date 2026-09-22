"use client";

/**
 * Developers tabs (V2-DESIGN-SYSTEM.md section 11.8): SDK, REST, Solidity. Each has an install line,
 * a short example with copy, and a live response fetched in the browser from the public API, so
 * what a reader sees is exactly what their own code would get.
 */
import { useEffect, useState } from "react";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { Tabs } from "@/components/ui/Tabs";
import { utcStamp } from "@/lib/format";

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

export function DevConsole({ api, kerbTerms, symbol }: { api: string; kerbTerms: string; symbol: string }): React.ReactElement {
  // /developers#rest and #solidity open that tab (the footer links there); the tab keeps the hash.
  const [tab, setTab] = useState<string | undefined>(undefined);
  useEffect(() => {
    const read = (): void => { const h = window.location.hash.slice(1); if (h === "sdk" || h === "rest" || h === "solidity") setTab(h); };
    read(); window.addEventListener("hashchange", read); return () => window.removeEventListener("hashchange", read);
  }, []);
  const sdk = `import { Kerb, toDecimalString } from "./kerb";

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

  return (
    <Tabs label="Integration" {...(tab ? { value: tab } : {})} onChange={(id) => { setTab(id); history.replaceState(null, "", `#${id}`); }} tabs={[
      { id: "sdk", label: "SDK", content: (
        <div className="dev-tab">
          <p className="t-small ink-2">One TypeScript file with no dependencies. It is not on npm yet, so take it from the repository:</p>
          <CodeBlock variants={[{ lang: "shell", code: "curl -o kerb.ts https://raw.githubusercontent.com/Franlinozz/Kerb/main/packages/sdk/src/index.ts" }]} />
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
          <p className="t-small ink-2">The authoritative source: no API and no Kerb server in the path. assetId is keccak256(abi.encode(chainId, token)).</p>
          <CodeBlock variants={[{ lang: "shell", code: `cast call ${kerbTerms} "effectiveTerms(bytes32)(uint64,uint64,uint128,uint16,bool)" <assetId> --rpc-url https://rpc.xlayer.tech` }]} />
          <CodeBlock variants={[{ lang: "solidity", code: sol }]} />
          <LivePanel url={`${api}/v1/terms/196/${encodeURIComponent(symbol)}`} pick={pickOnchain} />
          <p className="t-small ink-3">The panel shows the values as last posted; the contract adds its own freshness check to usable at the block you read.</p>
        </div>
      ) },
    ]} />
  );
}
