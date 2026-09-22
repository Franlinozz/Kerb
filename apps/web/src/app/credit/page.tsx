/**
 * Kerb Credit (V2-08): where the demo's hero moment is filmed. Testnet, mirror collateral and the
 * demo clock are said at the top, the demo rail shows the next Last Call, and the workspace does
 * the rest. The pool strip closes the page.
 */
import type { Metadata } from "next";
import { CreditWorkspace } from "@/components/credit/CreditWorkspace";
import { CurableTable } from "@/components/credit/CurableTable";
import { TestnetDrawer } from "@/components/credit/TestnetDrawer";
import { fmtUnits } from "@/components/credit/usePosition";
import { DemoRail } from "@/components/kerb/SessionRail";
import { ErrorState } from "@/components/ui/ErrorState";
import { ProvMark } from "@/components/ui/ProvMark";
import { getCreditMarket, getDemoClock } from "@/lib/api";

export const metadata: Metadata = { title: "Credit", description: "Borrow against tokenized stocks on the market's clock: Carry or Session Max, Last Call and the cure, on X Layer testnet with mirror collateral." };
export const dynamic = "force-dynamic";

export default async function CreditPage(): Promise<React.ReactElement> {
  const [market, demo] = await Promise.all([getCreditMarket(), getDemoClock()]);
  if (!market.ok) return <ErrorState source="The credit market" />;
  const m = market.data;
  const dec = m.loanAsset.decimals, sym = m.loanAsset.symbol;
  const pool: [string, string][] = [
    ["Supplied", `${fmtUnits(BigInt(m.pool.totalSupplied), dec, 2)} ${sym}`],
    ["Borrowed", `${fmtUnits(BigInt(m.pool.totalDebt), dec, 2)} ${sym}`],
    ["Available", `${fmtUnits(BigInt(m.pool.available), dec, 2)} ${sym}`],
    ["Utilisation", `${fmtUnits(BigInt(m.pool.utilisation) * 100n, 18, 1)}%`],
    ["Borrow rate", `${fmtUnits(BigInt(m.pool.borrowRate) * 100n, 18, 2)}% a year`],
    ["Reserves", `${fmtUnits(BigInt(m.pool.reserves), dec, 2)} ${sym}`],
  ];
  return (
    <div className="credit">
      <header className="credit-head">
        <div className="row between">
          <span className="t-label">Kerb Credit · X Layer testnet 1952 · demo clock</span>
          <TestnetDrawer market={m} />
        </div>
        <h1 className="mt-3">Borrow against tokenized stocks, on the market&rsquo;s clock.</h1>
      </header>
      <div className="mt-5">{demo.ok ? <DemoRail initial={demo.data} /> : <ErrorState source="The demo clock" />}</div>
      {demo.ok ? <CreditWorkspace market={m} demo={demo.data} /> : null}
      {demo.ok ? <CurableTable market={m} demo={demo.data} /> : null}
      <section className="pool-strip" aria-label="The pool">
        <span className="t-label">Pool <ProvMark label="Verified" source={`KerbCredit ${m.contracts.KerbCredit ?? ""}, read from chain`} /></span>
        {pool.map(([k, v]) => <span key={k} className="pool-cell"><span className="t-label ink-3">{k}</span><span>{v}</span></span>)}
      </section>
    </div>
  );
}
