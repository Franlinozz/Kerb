"use client";
/**
 * Your account (V3, operator request): everything the chain says about one address in Kerb
 * Credit. Holdings, liquidity supplied, each position with its health and covenant, the address's
 * own history (borrows, repays, cures given and received) and any agent calls it paid for.
 * The connected wallet by default, or any address through ?addr=. Nothing is stored about a
 * visitor: every line is read from chain or from Kerb's append-only records.
 */
import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import Link from "@/components/ui/Link";
import { AddressChip } from "@/components/ui/AddressChip";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProvMark } from "@/components/ui/ProvMark";
import { useHydratedAccount } from "@/lib/useHydrated";
import { fmtUnits } from "@/lib/creditMath";
import type { Account, AccountActivity, Holdings } from "@/lib/api";
import { group, round, shortHash, usdFull } from "@/lib/format";
import { useLive } from "@/components/kerb/useLive";

const OKLINK = "https://www.oklink.com/x-layer-testnet";
const pct = (wad: string | null): string => (wad === null ? "Not priced" : `${fmtUnits(BigInt(wad) * 100n, 18, 2)}%`);

function sentence(a: AccountActivity, sym: string, dec: number): string {
  const amt = a.amount === null ? "" : a.collateral && (a.kind === "CollateralDeposited" || a.kind === "CollateralWithdrawn") ? `${fmtUnits(BigInt(a.amount), 18, 4)} ${a.collateral}` : `${fmtUnits(BigInt(a.amount), dec, 2)} ${sym}`;
  const who = a.other ? shortHash(a.other, 6, 4) : "";
  switch (a.kind) {
    case "Supplied": return `Supplied ${amt} to the pool`;
    case "Withdrawn": return `Withdrew ${amt} of supplied liquidity`;
    case "CollateralDeposited": return `Deposited ${amt}`;
    case "CollateralWithdrawn": return `Withdrew ${amt}`;
    case "Borrowed": return `Borrowed ${amt} against ${a.collateral}`;
    case "Repaid": return a.role === "self" ? `Repaid ${amt} on ${a.collateral}` : a.role === "by-other" ? `${who} repaid ${amt} of this address's ${a.collateral} loan` : `Repaid ${amt} of ${who}'s ${a.collateral} loan`;
    case "Cured": return a.role === "by-other" ? `Cured by ${who} at Last Call: ${amt} repaid, collateral paid out as the bonus` : `Cured ${who}'s ${a.collateral} position at Last Call: repaid ${amt}, earned the cure bonus in ${a.collateral}`;
    case "Liquidated": return a.role === "by-other" ? `Liquidated by ${who}: ${amt} repaid` : `Liquidated ${who}: repaid ${amt}`;
    default: return a.kind;
  }
}

const STEPS = ["Connecting to X Layer testnet", "Reading KerbCredit positions", "Reading mirror tokens and mUSDG", "Scanning this address's history"];

/** While the chain is read: the page's own layout in placeholders, and what is being read right now. */
function Loading({ what, failed }: { what: string; failed?: boolean }): React.ReactElement {
  const [t, setT] = useState(0);
  useEffect(() => { const id = window.setInterval(() => setT((x) => x + 1), 1000); return () => window.clearInterval(id); }, []);
  const step = Math.min(STEPS.length - 1, Math.floor(t / 2));
  return (
    <div className="acct" aria-busy="true">
      <div className="acct-loading" role="status" aria-live="polite">
        <span className="acct-spin" aria-hidden="true" />
        <div>
          <strong>{failed ? "The chain did not answer yet. Retrying." : `${what}`}</strong>
          <span className="t-small ink-3">{STEPS[step]}… {t}s. A first read of an address takes a few seconds.</span>
        </div>
        <ol className="acct-steps" aria-hidden="true">{STEPS.map((x, i) => <li key={x} data-state={i < step ? "done" : i === step ? "now" : undefined} />)}</ol>
      </div>
      <section className="acct-section"><span className="t-label">Holdings</span>
        <div className="acct-cards">{[0, 1, 2, 3].map((i) => <div key={i}><span className="skel" style={{ display: "block", width: "40%", height: 10 }} /><span className="skel" style={{ display: "block", width: "70%", height: 26, marginTop: 10 }} /></div>)}</div>
      </section>
      <section className="acct-section"><span className="t-label">Positions</span><span className="skel" style={{ display: "block", height: 96, marginTop: 12 }} /></section>
      <section className="acct-section"><span className="t-label">Real xStocks on X Layer mainnet</span><span className="skel" style={{ display: "block", height: 64, marginTop: 12 }} /></section>
      <section className="acct-section"><span className="t-label">History in Kerb Credit</span>
        {[0, 1, 2, 3].map((i) => <span key={i} className="skel" style={{ display: "block", height: 14, width: `${80 - i * 12}%`, marginTop: 12 }} />)}
      </section>
    </div>
  );
}

export function AccountView(): React.ReactElement {
  const acct = useAccount();
  const { address: connected } = useHydratedAccount(acct);
  const [param, setParam] = useState<string | null>(null);
  const [paramRead, setParamRead] = useState(false);
  useEffect(() => { const a = new URLSearchParams(window.location.search).get("addr"); setParam(a && /^0x[0-9a-fA-F]{40}$/.test(a) ? a : null); setParamRead(true); }, []);
  // Until the URL is read and the wallet has had its chance to reconnect, the page is loading, not empty.
  const settling = !paramRead || acct.status === "reconnecting" || acct.status === "connecting";
  const addr = param ?? connected ?? null;
  const q = useLive<Account>(addr ? `/v1/credit/1952/account/${addr}` : null, null, 30_000, { asOf: (x) => x.generatedAt });
  const hq = useLive<Holdings>(addr ? `/v1/holdings/196/${addr}` : null, null, 60_000, { asOf: (x) => x.generatedAt });
  const [lookup, setLookup] = useState("");

  const look = (
    <form className="acct-lookup" onSubmit={(e) => { e.preventDefault(); if (/^0x[0-9a-fA-F]{40}$/.test(lookup.trim())) window.location.search = `?addr=${lookup.trim()}`; }}>
      <label className="t-label" htmlFor="acct-addr">Look up any address</label>
      <div className="row"><span className="fld-box"><input id="acct-addr" className="left mono" placeholder="0x..." value={lookup} onChange={(e) => setLookup(e.target.value)} spellCheck={false} /></span><button type="submit" className="btn">Open</button></div>
    </form>
  );
  if (!addr && settling) return <Loading what="Finding your wallet" />;
  if (!addr) return <div className="acct"><EmptyState title="Connect a wallet to see your account">Your holdings, positions and history in Kerb Credit, read from X Layer testnet. Or look up any address below, or open <a href="/account?addr=0xacCd2b8B681eF9C5BeB1A2d08872652170EfC0f4">the demo keeper</a>, which borrows at Session Max every demo cycle.</EmptyState>{look}</div>;
  const a = q.data;
  if (!a) return <Loading what={`Reading ${shortHash(addr, 6, 4)} from the chain`} failed={q.failed} />;
  const dec = a.loanAsset.decimals, sym = a.loanAsset.symbol;
  const src = "Read from X Layer testnet 1952: KerbCredit, the mirror tokens and mUSDG";
  return (
    <div className="acct">
      <div className="acct-head">
        <AddressChip value={a.address} href={`${OKLINK}/address/${a.address}`} label="address" />
        <span className="t-small ink-3">{param && param.toLowerCase() !== connected?.toLowerCase() ? "Viewing an address" : "Your connected wallet"} · {q.line ?? "Live"}</span>
      </div>

      <section className="acct-section" aria-labelledby="acct-holdings">
        <h2 id="acct-holdings" className="t-label">Holdings <ProvMark label="Verified" source={src} observedAt={a.generatedAt} /></h2>
        <dl className="acct-cards">
          <div><dt className="t-label">Test OKB</dt><dd className="t-num-l">{fmtUnits(BigInt(a.balances.okb), 18, 4)}</dd></div>
          <div><dt className="t-label">{sym}</dt><dd className="t-num-l">{fmtUnits(BigInt(a.balances.loan), dec, 2)}</dd></div>
          {a.balances.collateral.map((c) => <div key={c.symbol}><dt className="t-label">{c.symbol} in wallet</dt><dd className="t-num-l">{fmtUnits(BigInt(c.balance), 18, 4)}</dd></div>)}
          <div><dt className="t-label">Supplied to the pool</dt><dd className="t-num-l">{fmtUnits(BigInt(a.supplied), dec, 2)} <span className="kpi-unit">{sym}</span></dd></div>
        </dl>
      </section>

      <section className="acct-section" aria-labelledby="acct-positions">
        <h2 id="acct-positions" className="t-label">Positions</h2>
        {a.positions.length === 0 ? <p className="ink-2">No open position. <Link href="/credit">Borrow on Kerb Credit</Link>.</p> : (
          <ul className="acct-positions" role="list">
            {a.positions.map((p) => (
              <li key={p.symbol} data-lastcall={p.cure.eligible || undefined}>
                <div className="row between"><strong>{p.symbol}</strong><span className="t-label">{p.debt === "0" ? "Collateral only" : p.modeName}</span></div>
                <dl className="preview">
                  <div><dt className="t-label">Collateral</dt><dd>{fmtUnits(BigInt(p.collateralShares), 18, 4)} {p.symbol}</dd></div>
                  <div><dt className="t-label">Owing</dt><dd>{fmtUnits(BigInt(p.debt), dec, 2)} {sym}</dd></div>
                  <div><dt className="t-label">LTV</dt><dd>{p.debt === "0" ? "No debt" : pct(p.positionLTV)}</dd></div>
                  <div><dt className="t-label">Health</dt><dd>{p.healthFactor === null || p.debt === "0" ? "No debt" : fmtUnits(BigInt(p.healthFactor), 18, 2)}</dd></div>
                </dl>
                {p.cure.eligible ? <p className="t-small brass">Last Call: {fmtUnits(BigInt(p.cure.requiredRepay), dec, 2)} {sym} cures it back to Carry{p.cure.deadline ? ` by ${p.cure.deadline.slice(11, 16)} UTC` : ""}. <Link href="/credit">Open Credit</Link></p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="acct-section" aria-labelledby="acct-mainnet">
        <h2 id="acct-mainnet" className="t-label">Real xStocks on X Layer mainnet <ProvMark label="Verified" source="Token and wrapper balances on X Layer mainnet, each priced through KerbQuote on mainnet at one block" observedAt={hq.data?.generatedAt ?? null} /></h2>
        <p className="t-small ink-3">What this address could borrow against the real tokens it holds, under the live Kerb Terms. Read only: Kerb never holds these tokens, and mainnet credit is not offered.</p>
        {!hq.data ? (hq.failed ? <p className="t-small ink-3">X Layer mainnet did not answer; retrying.</p> : <div className="acct-subload" role="status"><span className="acct-spin" aria-hidden="true" /><span className="t-small ink-3">Reading ten xStocks on X Layer mainnet and pricing them through KerbQuote…</span><span className="skel" style={{ display: "block", height: 44, width: "100%" }} /></div>) : hq.data.holdings.length === 0 ? (
          <p className="ink-2">No xStocks held on X Layer mainnet (all {hq.data.assetsChecked} checked at block {hq.data.block}). For a worked example, open <a href={`/account?addr=0x34Fa7515d3364648F558aa876F73feC12e2bA507`}>the BRK.Bx pool</a>.</p>
        ) : (
          <div className="dt-wrap"><table className="dt" style={{ minWidth: 640 }}>
            <thead><tr><th>Asset</th><th className="num">Held</th><th className="num">Value at Credit Mark</th><th className="num">Max at Carry</th><th className="num">Max at Session Max</th></tr></thead>
            <tbody>{hq.data.holdings.map((h) => (
              <tr key={h.symbol}><td><Link href={`/asset/${h.symbol}`}>{h.symbol}</Link>{h.wrappedPart && h.wrappedPart !== "0" ? <span className="dt-under">includes wrapped shares</span> : null}</td>
                <td className="num">{group(round(h.balance, 4))}</td><td className="num">{usdFull(h.valueUSDG ?? null) ?? "Not priced"}</td>
                <td className="num">{h.usable ? usdFull(h.carryMaxBorrowUSDG ?? null) : "Not usable now"}</td><td className="num">{h.usable ? usdFull(h.sessionMaxBorrowUSDG ?? null) : "Not usable now"}</td></tr>
            ))}</tbody>
          </table></div>
        )}
        {hq.data ? <p className="t-small ink-3">Quoted by KerbQuote <a className="mono" href={`https://www.oklink.com/xlayer/address/${hq.data.quote}`} target="_blank" rel="noreferrer">{shortHash(hq.data.quote, 6, 4)}</a> at block {hq.data.block}. The smaller of LTV times value and the per-position cap.</p> : null}
      </section>

      <section className="acct-section" aria-labelledby="acct-activity">
        <h2 id="acct-activity" className="t-label">History in Kerb Credit · {a.activity.length} {a.activity.length === 1 ? "event" : "events"} <ProvMark label="Verified" source="KerbCredit events on X Layer testnet, scanned from the deploy block" /></h2>
        {a.activity.length === 0 ? <p className="ink-2">No activity yet for this address.</p> : (
          <ol className="acct-activity">
            {a.activity.map((x, i) => (
              <li key={`${x.tx}${i}`} data-kind={x.kind}>
                <span className="mono ink-3 acct-when">{x.at ? `${x.at.slice(5, 16).replace("T", " ")} UTC` : `block ${x.block}`}</span>
                <span className="acct-dot" aria-hidden="true" />
                <span>{sentence(x, sym, dec)}{x.explorer ? <> · <a className="mono" href={x.explorer} target="_blank" rel="noreferrer">{shortHash(x.tx ?? "", 6, 4)}</a></> : null}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {a.agentCalls.length ? (
        <section className="acct-section" aria-labelledby="acct-agents">
          <h2 id="acct-agents" className="t-label">Paid agent calls</h2>
          <ol className="acct-activity">{a.agentCalls.map((c) => <li key={c.tx ?? c.at}><span className="mono ink-3 acct-when">{c.at.slice(5, 16).replace("T", " ")} UTC</span><span className="acct-dot" aria-hidden="true" /><span>{c.route} paid over x402 on {c.network === "eip155:196" ? "X Layer mainnet" : "X Layer testnet"}{c.explorer ? <> · <a className="mono" href={c.explorer} target="_blank" rel="noreferrer">{shortHash(c.tx ?? "", 6, 4)}</a></> : null}</span></li>)}</ol>
        </section>
      ) : null}
      {look}
    </div>
  );
}
