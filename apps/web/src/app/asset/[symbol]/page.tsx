import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AssetRail } from "@/components/kerb/SessionRail";
import { railWindow } from "@/lib/time";
import { ImpactCurve } from "@/components/ImpactCurve";
import { RegimeTag, REGIME_MEANING } from "@/components/Regime";
import { Field, Prov, Value } from "@/components/Value";
import { SourceTrouble } from "@/components/States";
import { explorerAddress, explorerTx, getBoard, getClock, getReport, getTerms, PUBLIC_API } from "@/lib/api";
import { age, compact, duration, group, round, scale, shift, shortHash, utcStamp } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ symbol: string }> }): Promise<Metadata> {
  const { symbol } = await params;
  return { title: decodeURIComponent(symbol) };
}

const pct = (v: string, places = 2): string => `${round(shift(v, 2), places)}%`;

export default async function AssetPage({ params }: { params: Promise<{ symbol: string }> }): Promise<React.ReactElement> {
  const { symbol: raw } = await params;
  const symbol = decodeURIComponent(raw);

  const [board, clock, terms, report] = await Promise.all([
    getBoard(), getClock(symbol, 196, railWindow(Date.now())), getTerms(symbol), getReport(symbol),
  ]);

  const row = board.ok ? board.data.rows.find((r) => r.symbol.toLowerCase() === symbol.toLowerCase()) : undefined;
  if (board.ok && !row) notFound();

  return (
    <>
      {clock.ok ? (
        <AssetRail symbol={symbol} initial={clock.data} regime={row?.regime.value ?? (terms.ok ? terms.data.regime.value : null)} tz={row?.market?.tz ?? clock.data.timezone} />
      ) : (
        <SourceTrouble what="the Clock" detail={clock.error} />
      )}

      <div className="rowbar" style={{ marginTop: 22 }}>
        <h1>{symbol}</h1>
        {row ? (
          <span className="faint">
            {row.underlying.symbol} on {row.underlying.market} · pool quoted in {row.pool.quote} ·{" "}
            <a href={row.pool.explorer} target="_blank" rel="noreferrer">pool {shortHash(row.pool.address)}</a>
          </span>
        ) : null}
      </div>

      {/* ------------------------------------------------------------ terms */}
      <section className="section">
        <h2>Terms</h2>
        <p className="section-note">
          What is posted on chain right now, signed by the Kerb attester inside the contract guardrails.
        </p>
        {terms.ok ? (
          <dl>
            <Field label="Regime">
              <RegimeTag regime={terms.data.regime.value} />
              <Prov label={terms.data.regime.label} />
              <div className="faint field-note">{REGIME_MEANING[terms.data.regime.value]}</div>
            </Field>
            <Field label="Credit Mark">
              <Value value={group(round(scale(terms.data.creditMark.raw, terms.data.creditMark.decimals), 6))}
                label={terms.data.creditMark.label} observedAt={terms.data.observedAt} />
              {report.ok ? (
                <div className="faint field-note">
                  band {group(round(report.data.mark.band[0], 4))} to {group(round(report.data.mark.band[1], 4))}
                </div>
              ) : null}
            </Field>
            <Field label="Carry LTV" note="The ceiling a position can be drawn to and still be safe to hold through the next weakening.">
              <Value value={pct(scale(terms.data.carryLTV.raw, terms.data.carryLTV.decimals))} label={terms.data.carryLTV.label} />
            </Field>
            <Field label="Session Max LTV" note="Only available while the session holds, and only with the cure covenant attached.">
              <Value value={pct(scale(terms.data.sessionMaxLTV.raw, terms.data.sessionMaxLTV.decimals))} label={terms.data.sessionMaxLTV.label} />
            </Field>
            <Field label="Debt ceiling" note={`In ${terms.ok ? terms.data.loanAsset.symbol : "the loan asset"}, the total debt this asset may support.`}>
              <Value value={group(round(scale(terms.data.debtCeiling.raw, terms.data.debtCeiling.decimals), 2))} label={terms.data.debtCeiling.label} />
            </Field>
            <Field label="Executable depth at 1%" note={`The notional that can be sold into the real pools for at most 1% impact, in ${terms.ok ? terms.data.loanAsset.symbol : "the loan asset"}.`}>
              <Value value={group(round(scale(terms.data.executableDepth1.raw, terms.data.executableDepth1.decimals), 2))} label={terms.data.executableDepth1.label} />
            </Field>
            <Field label="Usable for new risk">
              {terms.data.usable ? (
                <span>yes</span>
              ) : (
                <span className="badge badge-warn">no: stale or halted</span>
              )}
              <div className="faint field-note">
                Posted {utcStamp(terms.data.observedAt)}, {age(terms.data.ageSec)} ago.{" "}
                <a href={explorerTx(terms.data.tx)} target="_blank" rel="noreferrer">transaction</a>
              </div>
            </Field>
            <Field label="Input bundle">
              {terms.data.bundle.url ? (
                <a className="mono" href={`${PUBLIC_API}${terms.data.bundle.url}`} target="_blank" rel="noreferrer">
                  {shortHash(terms.data.inputsHash, 10, 8)}
                </a>
              ) : (
                <span className="mono">{shortHash(terms.data.inputsHash, 10, 8)}</span>
              )}
              <div className="faint field-note">
                The keccak256 of the canonical inputs, posted on chain with the report.{" "}
                {terms.data.bundle.url ? (
                  <>
                    Every number above is computed from{" "}
                    <a href={`${PUBLIC_API}${terms.data.bundle.url}`} target="_blank" rel="noreferrer">
                      these exact bytes
                    </a>
                    {terms.data.bundle.pinned && terms.data.bundle.ipfsUrl ? (
                      <>
                        , also{" "}
                        <a href={terms.data.bundle.ipfsUrl} target="_blank" rel="noreferrer">pinned to IPFS</a> where
                        they are addressed by their own hash
                      </>
                    ) : (
                      <>, served by the Kerb API. This one is not on IPFS: pinning is being refused right now, and
                      that is reported on <Link href="/proof">the proof page</Link> rather than hidden</>
                    )}
                    . Recompute them yourself:{" "}
                  </>
                ) : (
                  <>The bundle for this report is not retrievable. Recompute it locally: </>
                )}
                <span className="mono">{terms.data.bundle.verifyCommand}</span>
              </div>
            </Field>
          </dl>
        ) : (
          <SourceTrouble what="Terms" detail={terms.error} />
        )}
      </section>

      {/* ------------------------------------------------------------ depth */}
      <section className="section">
        <h2>Executable depth</h2>
        <p className="section-note">
          Simulated by walking the real pool tick by tick, in the direction of a sale, from the pool state Kerb
          observed. Not an aggregator estimate.
        </p>
        {report.ok ? (
          <>
            {report.data.depth.venues.map((v) => (
              <div key={v.pools.join("-")} className="venue">
                <div className="rowbar">
                  <h3>{v.path.join(" → ")}</h3>
                  <span className="faint">
                    C(0.5%) {compact(v.C_0_5.notional)} · C(1%) {compact(v.C_1.notional)} · C(3%) {compact(v.C_3.notional)}
                  </span>
                </div>
                <ImpactCurve venue={v} c1={v.C_1.notional} />
                <p className="faint" style={{ fontSize: "0.78rem", marginTop: 6 }}>
                  {v.pools.map((pool, i) => (
                    <span key={pool}>
                      {i > 0 ? " · " : ""}
                      <a href={explorerAddress(pool)} target="_blank" rel="noreferrer" className="mono">{shortHash(pool)}</a>
                    </span>
                  ))}
                </p>
              </div>
            ))}
            <dl style={{ marginTop: 14 }}>
              <Field label="Aggregate depth">
                <Value value={group(round(report.data.depth.C_1, 2))} label="Computed" suffix=" at 1%" />
                <div className="faint field-note">
                  C(0.5%) {group(round(report.data.depth.C_0_5, 2))} · C(3%) {group(round(report.data.depth.C_3, 2))} ·
                  fragmentation factor {report.data.depth.fragmentationFactor} applied across eligible venues.
                </div>
              </Field>
              {report.data.depth.crosscheck ? (
                report.data.depth.crosscheck.status === "unavailable" ? (
                  <Field
                    label="Cross-check"
                    note={`Executable depth is on rung ${report.data.depth.crosscheck.rung} for this asset: the tick-walk stands on its own until the aggregator answers again.`}
                  >
                    <span className="badge badge-warn">unavailable</span>
                    <div className="faint field-note">
                      {report.data.depth.crosscheck.source}: {report.data.depth.crosscheck.reason}
                    </div>
                  </Field>
                ) : (
                  <Field
                    label="Cross-check"
                    note={
                      report.data.depth.crosscheck.flag
                        ? "The two disagree beyond the configured maximum, so the smaller number is used. Kerb never takes the larger."
                        : "The tick-walk and the independent aggregator quote agree within the configured maximum."
                    }
                  >
                    <Value value={group(round(report.data.depth.crosscheck.used, 2))} label="Computed" />
                    <div className="faint field-note">
                      simulated {group(round(report.data.depth.crosscheck.simulated, 2))} against{" "}
                      {report.data.depth.crosscheck.source} {group(round(report.data.depth.crosscheck.quoted, 2))}, a
                      difference of {pct(report.data.depth.crosscheck.delta, 3)}
                    </div>
                  </Field>
                )
              ) : null}
              {report.data.depth.excluded.length > 0 ? (
                <Field label="Excluded venues" note="Every exclusion is recorded with its reason. A venue is never silently dropped.">
                  {report.data.depth.excluded.map((e) => (
                    <div key={e.pools.join("-")} className="faint" style={{ fontSize: "0.82rem" }}>
                      {e.path.join(" → ")}: {e.reason}
                    </div>
                  ))}
                </Field>
              ) : null}
            </dl>
          </>
        ) : (
          <SourceTrouble what="the depth simulation" detail={report.error} />
        )}
      </section>

      {/* ------------------------------------------------------------ mark provenance */}
      <section className="section">
        <h2>How the Credit Mark was made</h2>
        <p className="section-note">
          The conservative minimum of the reference median and the pool price, after the dispersion guard and
          the regime haircut. Every component names its sources.
        </p>
        {report.ok ? (
          <dl>
            <Field label="Reference" note={`Sources used: ${report.data.mark.reference.usedSources?.join(", ") ?? report.data.mark.reference.sources.join(", ")}`}>
              <Value value={group(round(report.data.mark.reference.value, 6))} label={report.data.mark.reference.label} />
              {report.data.mark.reference.excluded && report.data.mark.reference.excluded.length > 0 ? (
                <div className="faint field-note">
                  Excluded: {report.data.mark.reference.excluded.map((e) => `${e.source} (${e.reason})`).join("; ")}
                </div>
              ) : null}
            </Field>
            <Field label="Pool" note={`${report.data.mark.pool.basis === "twap" ? `Time-weighted average over ${report.data.mark.pool.twapWindowSec ?? 0}s` : "Spot"} along ${report.data.mark.pool.sources.map((x) => (x.startsWith("0x") ? shortHash(x) : x)).join(" → ")}`}>
              <Value value={group(round(report.data.mark.pool.value, 6))} label={report.data.mark.pool.label} />
            </Field>
            <Field label="Dispersion" note={report.data.mark.dispersionBreach ? "Beyond the guard: the mark is forced conservative." : "Within the guard."}>
              <Value value={pct(report.data.mark.dispersion, 3)} label="Computed" />
            </Field>
            <Field label="Regime haircut">
              <Value value={pct(report.data.mark.haircut, 3)} label="Computed" />
            </Field>
            <Field label="Credit Mark">
              <Value value={group(round(report.data.mark.creditMark, 6))} label="Computed" />
              <div className="faint field-note">
                Band {group(round(report.data.mark.band[0], 6))} to {group(round(report.data.mark.band[1], 6))}.{" "}
                {report.data.mark.quoteAssumption}
              </div>
            </Field>
          </dl>
        ) : null}
      </section>

      {/* ------------------------------------------------------------ clock */}
      {clock.ok ? (
        <section className="section">
          <h2>Next transitions</h2>
          <p className="section-note">
            Resolved from the Kerb calendar, {clock.data.clock.calendarVersion}. The onchain KerbClock is
            equivalence-tested against this same resolver.
          </p>
          <dl>
            <Field label="Session now">
              {clock.data.clock.session.kind} <Prov label="Computed" />
              <div className="faint field-note">
                {clock.data.market} · {clock.data.timezone} · since {utcStamp(clock.data.clock.session.startedAt)}
              </div>
            </Field>
            <Field label="Next transition">
              {clock.data.clock.nextTransition.type.replace(/_/g, " ").toLowerCase()} <Prov label="Computed" />
              <div className="faint field-note">
                {utcStamp(clock.data.clock.nextTransition.at)} · in{" "}
                {duration(Date.parse(clock.data.clock.nextTransition.at) - Date.parse(clock.data.at))}
              </div>
            </Field>
            <Field label="Next weakening" note="The deadline a Session Max position must cure by.">
              {clock.data.clock.nextWeakening.type.replace(/_/g, " ").toLowerCase()} <Prov label="Computed" />
              <div className="faint field-note">{utcStamp(clock.data.clock.nextWeakening.at)}</div>
            </Field>
            <Field label="Last Call window">
              {clock.data.clock.cureWindow.open ? <span className="badge badge-warn">open now</span> : "closed"}
              <Prov label="Computed" />
              <div className="faint field-note">
                {utcStamp(clock.data.clock.cureWindow.opensAt)} to {utcStamp(clock.data.clock.cureWindow.closesAt)} ·{" "}
                {duration(clock.data.clock.cureWindow.lengthSec * 1000)} long
              </div>
            </Field>
          </dl>
        </section>
      ) : null}

      {/* ------------------------------------------------------------ history */}
      {terms.ok && terms.data.history.length > 0 ? (
        <section className="section">
          <h2>Terms history</h2>
          <p className="section-note">Every post Kerb has made for this asset, newest first, each one a transaction.</p>
          <p className="scroll-hint">Scroll the table sideways for capacity and the transaction.</p>
          <div className="scroll-x">
            <table className="history">
              <thead>
                <tr>
                  <th>Posted</th>
                  <th>Regime</th>
                  <th className="num">Credit Mark</th>
                  <th className="num">Carry</th>
                  <th className="num">Session Max</th>
                  <th className="num hide-sm">Debt ceiling</th>
                  <th>Tx</th>
                </tr>
              </thead>
              <tbody>
                {terms.data.history.slice(0, 25).map((h) => (
                  <tr key={h.tx + h.observedAt}>
                    <td className="dim">{utcStamp(h.observedAt)}</td>
                    <td><RegimeTag regime={h.regime} title={false} /></td>
                    <td className="num">{group(round(scale(h.creditMark, 18), 4))}</td>
                    <td className="num">{pct(scale(h.carryLTV, 18))}</td>
                    <td className="num">{pct(scale(h.sessionMaxLTV, 18))}</td>
                    <td className="num hide-sm">{compact(scale(h.debtCeiling, terms.data.loanAsset.decimals))}</td>
                    <td>
                      <a className="mono" href={explorerTx(h.tx)} target="_blank" rel="noreferrer">{shortHash(h.tx)}</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <p style={{ marginTop: 30 }}>
        <Link href="/board">← All assets</Link>
      </p>
    </>
  );
}
