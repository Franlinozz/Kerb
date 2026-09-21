import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SourceTrouble } from "@/components/States";
import { Prov } from "@/components/Value";
import { explorerAddress, getMarketTimeReport } from "@/lib/api";
import { group, round, shortHash, utcStamp } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: `Market-Time Report #${id}` };
}

/** In-range liquidity L is a raw uint128. Show it in units of 1e18 so the column is readable. */
const liq = (raw: string): string => {
  const v = BigInt(raw);
  const whole = v / 10n ** 18n;
  const frac = (v % 10n ** 18n).toString().padStart(18, "0").slice(0, 3);
  return group(`${whole}.${frac}`);
};

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }): Promise<React.ReactElement> {
  const { id } = await params;
  if (!/^[0-9]{1,4}$/.test(id)) notFound();
  const report = await getMarketTimeReport(Number(id));
  if (!report.ok) {
    if (report.status === 404) notFound();
    return (
      <>
        <h1>Market-Time Report #{id}</h1>
        <SourceTrouble what="the report" detail={report.error} />
      </>
    );
  }
  const r = report.data;
  const assets = r.pools.filter((p) => p.role === "asset");
  const routes = r.pools.filter((p) => p.role === "route");

  return (
    <>
      <div className="rowbar">
        <h1>Market-Time Report #{r.id}</h1>
        <span className="faint">generated {utcStamp(r.generatedAt)}</span>
      </div>
      <p className="lede">{r.title}.</p>

      <section className="section">
        <h2>What was measured</h2>
        <dl>
          <div className="field">
            <dt>Window</dt>
            <dd>
              {utcStamp(r.window.from)} to {utcStamp(r.window.to)} <Prov label="Observed" />
              <div className="faint field-note">{r.window.hours} hours</div>
            </dd>
          </div>
          <div className="field">
            <dt>Readings</dt>
            <dd>
              {group(String(r.window.observations))} across {r.window.pools} pools <Prov label="Observed" />
            </dd>
          </div>
          <div className="field">
            <dt>Largest hole in the record</dt>
            <dd>
              {r.window.largestGap ?? "none"} <Prov label="Observed" />
              <div className="faint field-note">
                Reported rather than interpolated across. Nothing in this report is filled in over it.
              </div>
            </dd>
          </div>
        </dl>
        <p className="section-note" style={{ marginTop: 10 }}>{r.method}</p>
      </section>

      <section className="section">
        <h2>Findings</h2>
        {r.findings.map((f) => (
          <div key={f.claim} className="callout">
            <strong>{f.claim}</strong>
            <div className="faint" style={{ marginTop: 4 }}>{f.evidence}</div>
          </div>
        ))}
      </section>

      <section className="section">
        <h2>In-range liquidity, pool by pool</h2>
        <p className="section-note">
          The first and last reading of the window, and the range it moved through in between. A negative change
          means the pool ended the window with less in-range liquidity than it started with.
        </p>
        <p className="scroll-hint">Scroll the table sideways for the range and the pool address.</p>
        <div className="scroll-x">
          <table className="board">
            <thead>
              <tr>
                <th>Asset</th>
                <th className="num">At start</th>
                <th className="num">At end</th>
                <th className="num">Change</th>
                <th className="num">Low</th>
                <th className="num">High</th>
                <th className="num">Readings</th>
                <th>Pool</th>
              </tr>
            </thead>
            <tbody>
              {[...assets, ...routes].map((p) => (
                <tr key={p.pool}>
                  <td>
                    {p.symbol ? <Link href={`/asset/${p.symbol}`}>{p.symbol}</Link> : <span className="faint">route leg</span>}
                  </td>
                  <td className="num">{liq(p.liquidityAtStart)}</td>
                  <td className="num">{liq(p.liquidityAtEnd)}</td>
                  <td className="num" style={p.changePct?.startsWith("-") ? { color: "var(--danger)" } : undefined}>
                    {p.changePct === null ? "—" : `${p.changePct}%`}
                  </td>
                  <td className="num">{liq(p.liquidityMin)}</td>
                  <td className="num">{liq(p.liquidityMax)}</td>
                  <td className="num">{group(String(p.observations))}</td>
                  <td>
                    <a className="mono" href={explorerAddress(p.pool, 196)} target="_blank" rel="noreferrer">
                      {shortHash(p.pool)}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section">
        <h2>Sources behind this report</h2>
        <div className="scroll-x">
          <table className="sources">
            <thead>
              <tr>
                <th>Source</th>
                <th className="num">Observations</th>
                <th>First</th>
                <th>Last</th>
              </tr>
            </thead>
            <tbody>
              {r.sources.map((s) => (
                <tr key={s.source}>
                  <td className="mono">{s.source}</td>
                  <td className="num">{group(String(s.observations))}</td>
                  <td className="dim">{utcStamp(s.firstAt)}</td>
                  <td className="dim">{utcStamp(s.lastAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section">
        <h2>What this report does not show</h2>
        <ul className="plain">
          {r.limitations.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </section>

      <section className="section">
        <h2>Reproduce it</h2>
        <p className="section-note">{r.reproduce}</p>
        <p className="section-note">
          <Link href="/proof">The proof page carries the live row counts these figures come from →</Link>
        </p>
      </section>
    </>
  );
}
