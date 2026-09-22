import type { Metadata } from "next";
import Link from "next/link";
import { RegimeTag } from "@/components/Regime";
import { Field, Prov, Value } from "@/components/Value";
import { SourceTrouble } from "@/components/States";
import { PositionLookup } from "@/components/PositionLookup";
import { BorrowPanel } from "@/components/BorrowPanel";
import { CurePanel } from "@/components/CurePanel";
import { ChainGuard } from "@/components/Wallet";
import { SupplyPanel } from "@/components/SupplyPanel";
import { Positions } from "@/components/Positions";
import { explorerAddress, getCreditMarket, REGIME_BY_INDEX, CREDIT_CHAIN_ID } from "@/lib/api";
import { group, round, scale, shift, shortHash, utcStamp } from "@/lib/format";
import { PageRail } from "@/components/kerb/PageRail";

export const metadata: Metadata = { title: "Credit", description: "Borrow against tokenized stocks on the market's clock: Carry or Session Max, Last Call and the cure, on X Layer testnet with mirror collateral." };
export const dynamic = "force-dynamic";

const pct = (raw: string, places = 2): string => `${round(shift(scale(raw, 18), 2), places)}%`;

export default async function MarketPage(): Promise<React.ReactElement> {
  const market = await getCreditMarket();
  if (!market.ok) {
    return (
      <>
        <h1>Credit</h1>
        <SourceTrouble what="the credit market" detail={market.error} />
      </>
    );
  }
  const m = market.data;
  const loan = m.loanAsset;

  return (
    <>
      <PageRail subject={{ kind: "demo" }} />
      <div className="rowbar">
        <h1>Credit</h1>
        <span className="faint">
          Kerb Credit on X Layer testnet ·{" "}
          {m.contracts.KerbCredit ? (
            <a href={explorerAddress(m.contracts.KerbCredit, m.chainId)} target="_blank" rel="noreferrer" className="mono">
              {shortHash(m.contracts.KerbCredit)}
            </a>
          ) : null}
        </span>
      </div>

      {/* The things a reader must know before reading a single number on this page. */}
      <div className="callout callout-warn" role="note">
        <strong>Testnet, with mirror collateral.</strong> {m.disclaimer}
        {loan.isMock ? (
          <>
            {" "}
            The loan asset here is <span className="mono">{loan.symbol}</span>, a labelled stand-in: the real Paxos
            testnet USDG at{" "}
            <a href={explorerAddress(loan.standsInFor ?? "", m.chainId)} target="_blank" rel="noreferrer" className="mono">
              {shortHash(loan.standsInFor ?? "")}
            </a>{" "}
            has a permissioned mint and no faucet, so it cannot be obtained.
          </>
        ) : null}
        {m.contracts.clockIsDemo ? (
          <>
            {" "}
            The clock is <strong>KerbClockDemo</strong>: one compressed trading week per hour, so the covenant can be
            demonstrated in minutes. It is never deployed to mainnet.
          </>
        ) : null}
      </div>

      <section className="section">
        <h2>Pool</h2>
        <p className="section-note">One loan asset, whitelisted collateral, shares-based accounting on both sides.</p>
        <dl>
          <Field label="Supplied">
            <Value value={`${group(round(scale(m.pool.totalSupplied, loan.decimals), 2))} ${loan.symbol}`} label="Verified" />
          </Field>
          <Field label="Borrowed">
            <Value value={`${group(round(scale(m.pool.totalDebt, loan.decimals), 2))} ${loan.symbol}`} label="Verified" />
          </Field>
          <Field label="Available to borrow">
            <Value value={`${group(round(scale(m.pool.available, loan.decimals), 2))} ${loan.symbol}`} label="Verified" />
          </Field>
          <Field label="Utilisation">
            <Value value={pct(m.pool.utilisation)} label="Verified" />
          </Field>
          <Field label="Borrow rate" note="Two-slope kink model on utilisation, with a reserve factor.">
            <Value value={`${pct(m.pool.borrowRate)} per year`} label="Verified" />
          </Field>
          <Field label="Reserves">
            <Value value={`${group(round(scale(m.pool.reserves, loan.decimals), 6))} ${loan.symbol}`} label="Verified" />
          </Field>
        </dl>
      </section>

      <ChainGuard>
        <SupplyPanel market={m} />
      </ChainGuard>

      <Positions market={m} />

      <section className="section">
        <h2>Collateral</h2>
        <p className="section-note">
          Each mirror carries the real Credit Mark of the asset it mirrors, relayed from X Layer mainnet. The
          liquidation threshold is fixed when the collateral is listed and has no setter: sessions move borrowing
          capacity and the cure covenant, never the liquidation line.
        </p>

        {m.collaterals.length === 0 ? (
          <div className="empty">No collateral is listed on this market yet.</div>
        ) : (
          m.collaterals.map((c) => (
            <div key={c.assetId} className="venue">
              <div className="rowbar">
                <h3>
                  k{c.mirrors} <span className="badge">mirror</span>
                </h3>
                <span className="faint">
                  {c.relayedFrom ? `mark relayed from ${c.relayedFrom.symbol} on X Layer mainnet` : "no source asset"}
                </span>
              </div>
              <dl>
                <Field label="Regime">
                  <RegimeTag regime={REGIME_BY_INDEX[c.terms.regime] ?? "STALE"} />
                  <Prov label="Attested" />
                </Field>
                <Field label="Credit Mark">
                  <Value
                    value={group(round(scale(c.terms.creditMark, 18), 6))}
                    label="Attested"
                    observedAt={c.terms.observedAt}
                  />
                </Field>
                <Field label="Carry LTV" note="Held through the next weakening, with no covenant attached.">
                  <Value value={pct(c.terms.carryLTV)} label="Attested" />
                </Field>
                <Field label="Session Max LTV" note="Available only while the session holds, and only with the cure covenant.">
                  <Value value={pct(c.terms.sessionMaxLTV)} label="Attested" />
                </Field>
                <Field
                  label="Liquidation threshold"
                  note="Fixed at listing. No report, no session and no passage of time can move it."
                >
                  <Value value={pct(c.liquidationThreshold)} label="Verified" />
                </Field>
                <Field label="Debt ceiling">
                  <Value value={`${group(round(scale(c.terms.debtCeiling, loan.decimals), 2))} ${loan.symbol}`} label="Attested" />
                </Field>
                <Field label="Maximum per position">
                  <Value value={`${group(round(scale(c.terms.maxPositionDebt, loan.decimals), 2))} ${loan.symbol}`} label="Attested" />
                </Field>
                <Field label="Cure bonus" note="Paid to whoever cures the position. Cure is permissionless.">
                  <Value value={pct(c.cureBonus)} label="Verified" />
                </Field>
                <Field label="Default bonus and close factor">
                  <Value value={`${pct(c.defaultBonus)} bonus, ${pct(c.closeFactor)} close factor`} label="Verified" />
                </Field>
                <Field label="Usable for new risk">
                  {c.terms.usable ? "yes" : <span className="badge badge-warn">no: stale or halted</span>}
                  <div className="faint field-note">
                    token{" "}
                    <a href={explorerAddress(c.token, m.chainId)} target="_blank" rel="noreferrer" className="mono">
                      {shortHash(c.token)}
                    </a>{" "}
                    · assetId <span className="mono">{shortHash(c.assetId, 10, 8)}</span>
                    {c.terms.observedAt ? ` · terms posted ${utcStamp(c.terms.observedAt)}` : ""}
                  </div>
                </Field>
              </dl>
              <ChainGuard quiet>
                <BorrowPanel market={m} collateral={c} />
              </ChainGuard>
            </div>
          ))
        )}
      </section>

      <section className="section">
        <h2>Cure a position</h2>
        <p className="section-note">
          Cure is permissionless: any address may bring a position back to its Carry target while Last Call is
          open, and is paid a bonus in collateral for doing it. Kerb runs no privileged keeper, which is why this
          is here for anyone to use.
        </p>
        <ChainGuard quiet>
          <CurePanel market={m} collaterals={m.collaterals} />
        </ChainGuard>
      </section>

      <section className="section">
        <h2>Look up a position</h2>
        <p className="section-note">
          Anyone can read any position: its health against the fixed threshold, its covenant target, and the exact
          amount a cure would repay. Cure is permissionless, so this has to be public.
        </p>
        <PositionLookup collaterals={m.collaterals.map((c) => ({ assetId: c.assetId, label: `k${c.mirrors}` }))} chainId={CREDIT_CHAIN_ID} loanDecimals={loan.decimals} loanSymbol={loan.symbol} />
      </section>

      <p style={{ marginTop: 30 }}>
        <Link href="/proof">Proof, including every address on this page →</Link>
      </p>
    </>
  );
}
