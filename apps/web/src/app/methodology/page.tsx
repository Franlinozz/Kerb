import type { Metadata } from "next";
import Link from "next/link";
import { RegimeTag, REGIME_MEANING } from "@/components/Regime";
import { Field, Prov, Value } from "@/components/Value";
import { SourceTrouble } from "@/components/States";
import { getBoard, getClock, getParams, getReport, getTerms, type Regime } from "@/lib/api";
import { byDecimalDesc, duration, group, round, scale, shift, shortHash, utcStamp } from "@/lib/format";
import { PageStrip } from "@/components/PageStrip";

export const metadata: Metadata = { title: "Methodology" };
export const dynamic = "force-dynamic";

const pct = (v: string, places = 2): string => `${round(shift(v, 2), places)}%`;

const REGIME_ORDER: Regime[] = [
  "HALTED", "STALE", "ACTION", "PRE_TRANSITION", "REFERENCE_CLOSED", "THIN", "NORMAL", "DEEP", "RECOVERY",
];

export default async function MethodologyPage(): Promise<React.ReactElement> {
  const board = await getBoard();
  // Work the example on whichever asset currently carries the most debt capacity: a real one.
  const lead = board.ok ? [...board.data.rows].sort(byDecimalDesc((r) => r.debtCeiling.value))[0] : undefined;
  const symbol = lead?.symbol ?? "KOx";
  const [report, terms, clock, params] = await Promise.all([
    getReport(symbol), getTerms(symbol), getClock(symbol), getParams(),
  ]);

  return (
    <>
      <PageStrip />
      <h1>Methodology</h1>
      <p className="lede">
        The Kerb Terms Standard, version 0.1, is the rulebook that turns observations into credit terms. This page
        states each rule and then works it through on <strong>{symbol}</strong> using the numbers Kerb is publishing
        right now. <strong>Nothing here is illustrative.</strong> The specification carries a worked example marked
        &ldquo;not measured&rdquo;; it is deliberately not reproduced, because a placeholder number on a page that
        looks authoritative is how people get misled.
      </p>

      {!report.ok ? <SourceTrouble what="the live report" detail={report.error} /> : null}

      {/* ------------------------------------------------------------ regimes */}
      <section className="section">
        <h2>1. The regime machine</h2>
        <p className="section-note">
          A regime is a statement about the quality of the market Kerb would have to liquidate into. The resolution
          order is strict: the first rule that fires wins, and the dangerous states are checked first so a weaker
          signal can never mask a stronger one.
        </p>
        <div className="scroll-x">
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>Regime</th>
                <th>In the report</th>
                <th className="wrap-cell">What it says</th>
              </tr>
            </thead>
            <tbody>
              {REGIME_ORDER.map((r, i) => (
                <tr key={r}>
                  <td className="num">{i + 1}</td>
                  <td>
                    <RegimeTag regime={r} title={false} />
                  </td>
                  <td className="mono faint">{r}</td>
                  <td className="dim wrap-cell">{REGIME_MEANING[r]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="section-note" style={{ marginTop: 12 }}>
          Terms tighten immediately and loosen only after a cooldown, and only by a bounded step. A market that
          just came back is not yet a market you can lend into at full size.
        </p>
        {report.ok ? (
          <dl>
            <Field label={`${symbol} right now`}>
              <RegimeTag regime={report.data.regime} />
              <Prov label="Computed" />
            </Field>
          </dl>
        ) : null}
      </section>

      {/* ------------------------------------------------------------ depth */}
      <section className="section">
        <h2>2. Executable depth</h2>
        <p className="section-note">
          Depth is not a pool balance and not an aggregator estimate. Kerb walks the real Uniswap V3 pool tick by
          tick in the direction of a sale, consuming liquidity in each initialised range and applying the fee, and
          asks: what is the largest notional whose realised price impact is at most <em>i</em>? That answer is
          C(i). Where a pool is quoted in something other than the loan asset, each leg is simulated in turn and
          the impacts compound. Venues that cannot be simulated are excluded with a recorded reason, never
          silently dropped.
        </p>
        {report.ok ? (
          <dl>
            <Field label="C(1%)" note="The notional the debt ceiling is built from.">
              <Value value={group(round(report.data.depth.C_1, 2))} label="Computed" />
            </Field>
            <Field label="C(0.5%) and C(3%)">
              <Value value={`${group(round(report.data.depth.C_0_5, 2))} and ${group(round(report.data.depth.C_3, 2))}`} label="Computed" />
            </Field>
            <Field label="Path">
              {report.data.depth.venues.map((v) => v.path.join(" → ")).join("; ")}
              <Prov label="Computed" />
            </Field>
            <Field label="Cross-check" note="Kerb takes the smaller of the two whenever they disagree beyond the configured maximum. Never the larger.">
              {report.data.depth.crosscheck ? (
                report.data.depth.crosscheck.status === "unavailable" ? (
                  <span className="dim">unavailable: {report.data.depth.crosscheck.reason}</span>
                ) : (
                  <>
                    simulated {group(round(report.data.depth.crosscheck.simulated, 2))} against{" "}
                    {group(round(report.data.depth.crosscheck.quoted, 2))} quoted, a difference of{" "}
                    {pct(report.data.depth.crosscheck.delta, 3)} <Prov label="Computed" />
                  </>
                )
              ) : (
                <span className="faint">not recorded</span>
              )}
            </Field>
          </dl>
        ) : null}
        <p className="section-note">
          <Link href={`/asset/${symbol}`}>See the whole curve for {symbol} →</Link>
        </p>
      </section>

      {/* ------------------------------------------------------------ mark */}
      <section className="section">
        <h2>3. The Credit Mark</h2>
        <p className="section-note">
          The mark a lender may act on is the conservative one. Kerb takes the median of the fresh reference
          sources, compares it with the pool price along the whole path to the loan asset, measures the dispersion
          between them, applies the regime&rsquo;s haircut, and publishes the lower of the two with a band. A
          wrapped collateral token is valued as <span className="mono">convertToAssets(shares)</span> times the
          Credit Mark: the wrapper exchange rate converts shares to units and is never itself used as a price.
        </p>
        {report.ok ? (
          <dl>
            <Field label="Reference median" note={`from ${report.data.mark.reference.usedSources?.join(", ") ?? report.data.mark.reference.sources.join(", ")}`}>
              <Value value={group(round(report.data.mark.reference.value, 6))} label={report.data.mark.reference.label} />
            </Field>
            <Field label="Pool price" note={report.data.mark.pool.basis === "twap" ? "time-weighted" : "spot"}>
              <Value value={group(round(report.data.mark.pool.value, 6))} label={report.data.mark.pool.label} />
            </Field>
            <Field label="Dispersion and haircut">
              <Value value={`${pct(report.data.mark.dispersion, 3)} dispersion, ${pct(report.data.mark.haircut, 3)} haircut`} label="Computed" />
            </Field>
            <Field label="Credit Mark" note={`band ${group(round(report.data.mark.band[0], 4))} to ${group(round(report.data.mark.band[1], 4))}`}>
              <Value value={group(round(report.data.mark.creditMark, 6))} label="Computed" />
            </Field>
          </dl>
        ) : null}
      </section>

      {/* ------------------------------------------------------------ capacity */}
      <section className="section">
        <h2>4. Capacity</h2>
        <p className="section-note">
          Three constraints, and the tightest wins. <strong>Stress capacity</strong> asks how far the underlying
          could gap over the horizon the position must survive, using the 99th percentile move over comparable
          intervals scaled by recent volatility, plus the impact of liquidating at a reference size, the
          liquidation bonus and a buffer. <strong>Liquidity capacity</strong> sets the debt ceiling at a fraction
          of C(1%): never lend more than you can liquidate. <strong>Position capacity</strong> caps what a single
          borrower may owe. Carry and Session Max are the same calculation over two different horizons — Carry
          must survive the next weakening, Session Max only the rest of the session, which is why it comes with
          the covenant.
        </p>
        {report.ok ? (
          <dl>
            <Field label="Horizon" note="Carry is measured to the far side of the next weakening; Session Max to the cure deadline.">
              <Value value={`${round(report.data.stress.horizonHoursWeak, 2)}h weak, ${round(report.data.stress.horizonHoursCure, 2)}h to cure`} label="Computed" />
            </Field>
            <Field label="Gap quantile and volatility scaler" note={report.data.stress.historySufficient ? "From at least five years of daily bars." : "This instrument has less than five years of history, so the most conservative available quantile is used and this is reported rather than hidden."}>
              <Value value={`${pct(report.data.stress.gapQuantileWeak, 3)} at the ${pct(report.data.stress.quantile, 0)} quantile, scaler ${round(report.data.stress.volScaler, 4)}`} label="Computed" />
            </Field>
            <Field label="Carry LTV">
              <Value value={pct(report.data.capacity.carryLTV)} label="Computed" />
            </Field>
            <Field label="Session Max LTV">
              <Value value={pct(report.data.capacity.sessionMaxLTV)} label="Computed" />
            </Field>
            <Field label="Liquidation threshold" note="Fixed. It does not move with the session, and changing it is a timelocked admin action.">
              <Value value={pct(report.data.capacity.LT)} label="Computed" />
            </Field>
            <Field label="Debt ceiling and position cap">
              <Value value={`${group(round(report.data.capacity.debtCeiling, 2))} and ${group(round(report.data.capacity.maxPositionDebt, 2))}`} label="Computed" />
            </Field>
            {report.data.capacity.clamped.length > 0 ? (
              <Field label="Clamped" note="Guardrail clamping is recorded, never silent.">
                <span className="dim">{report.data.capacity.clamped.join(", ")}</span>
              </Field>
            ) : null}
          </dl>
        ) : null}
      </section>

      {/* ------------------------------------------------------------ covenant */}
      <section className="section">
        <h2>5. The cure covenant</h2>
        <p className="section-note">
          Drawing above the Carry ceiling records a target: the Carry LTV at the moment of the draw. When the
          underlying market is about to weaken, the Last Call window opens and the position becomes curable.
          Anyone may repay exactly the amount that brings it back to that target and is paid a bonus in
          collateral for doing it. Cure is not liquidation: it cannot repay more than the covenant requires, it
          cannot run outside the window, and it stops being available the moment the borrower reaches target by
          repaying or adding collateral. A position that breaches the fixed liquidation threshold takes the
          ordinary default path instead.
        </p>
        <p className="section-note">
          Because the cure also seizes the collateral that pays its own bonus, the amount required is not simply
          the shortfall. It solves <span className="mono">R = (debt − target × value) / (1 − target × (1 + bonus))</span>,
          so that the position is actually at target once the cure has run.
        </p>
        {clock.ok ? (
          <dl>
            <Field label={`Next weakening for ${symbol}`}>
              {clock.data.clock.nextWeakening.type.replace(/_/g, " ").toLowerCase()} <Prov label="Computed" />
              <div className="faint field-note">
                {utcStamp(clock.data.clock.nextWeakening.at)} · in{" "}
                {duration(Date.parse(clock.data.clock.nextWeakening.at) - Date.parse(clock.data.at))}
              </div>
            </Field>
            <Field label="Last Call window">
              {clock.data.clock.cureWindow.open ? <span className="badge badge-warn">open now</span> : "closed"}
              <Prov label="Computed" />
              <div className="faint field-note">
                {duration(clock.data.clock.cureWindow.lengthSec * 1000)} long, opening{" "}
                {utcStamp(clock.data.clock.cureWindow.opensAt)}
              </div>
            </Field>
          </dl>
        ) : null}
        <p className="section-note">
          <Link href="/market">Try it on testnet, with mirror collateral →</Link>
        </p>
      </section>

      {/* ------------------------------------------------------------ reproducibility */}
      <section className="section">
        <h2>6. Reproducibility</h2>
        <p className="section-note">
          The engine is a pure function of its input bundle: no clock reads, no network calls and no randomness
          inside the computation path. Every report canonicalises its inputs, hashes them with keccak256, pins the
          bytes to IPFS, and posts the hash on chain alongside the terms. Anyone holding only that hash can
          recover the exact inputs and arrive at the same numbers.
        </p>
        {terms.ok ? (
          <dl>
            <Field label={`Latest ${symbol} inputs hash`}>
              <span className="mono">{terms.data.inputsHash}</span>
            </Field>
            <Field label="Recompute it">
              <span className="mono">pnpm --filter @kerb/engine kerb verify {shortHash(terms.data.inputsHash, 10, 8)}</span>
              <div className="faint field-note">
                That resolves the pinned CID, fetches the bytes, checks they hash to that CID, recomputes every
                number and compares them with what is on chain.
              </div>
            </Field>
          </dl>
        ) : null}
        <p className="section-note">
          <Link href="/proof">The proof page carries the live version of all of this →</Link>
        </p>
      </section>


      {/* ------------------------------------------------------------ parameters */}
      <section className="section">
        <h2>7. The parameter set</h2>
        <p className="section-note">
          Every constant the engine runs on, read from the same file the engine reads. Parameters are versioned
          with the report, so a number published under one version can never be re-explained by another.
        </p>
        {params.ok ? (
          <>
            <p className="section-note">
              Params version <span className="mono">{params.data.paramsVersion}</span>, KTS{" "}
              <span className="mono">{params.data.kts}</span>.
            </p>
            <p className="scroll-hint">Scroll the table sideways for the values.</p>
            <div className="scroll-x">
              <table>
                <thead>
                  <tr>
                    <th>Group</th>
                    <th>Parameter</th>
                    <th className="num">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {(["depth", "mark", "regime", "asymmetry", "capacityDefaults", "stress"] as const).flatMap((group) =>
                    Object.entries(params.data[group] as Record<string, unknown>).map(([k, v]) => (
                      <tr key={`${group}.${k}`}>
                        <td className="dim">{group}</td>
                        <td className="mono">{k}</td>
                        <td className="num mono">
                          {typeof v === "object" && v !== null
                            ? Object.entries(v as Record<string, unknown>)
                                .map(([kk, vv]) => `${kk}=${String(vv)}`)
                                .join("  ")
                            : String(v)}
                        </td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <SourceTrouble what="the parameter set" detail={params.error} />
        )}
      </section>

      {/* ------------------------------------------------------------ limits */}
      <section className="section">
        <h2>8. What v0.1 does not do</h2>
        <ul className="plain">
          <li>It does not model correlated liquidation across several assets at once.</li>
          <li>
            It measures the gap horizon in underlying sessions rather than continuous time, which is stated as a
            v0.1 limitation rather than smoothed over.
          </li>
          <li>
            It treats the loan asset as worth one dollar and observes the peg separately rather than folding it
            into the mark.
          </li>
          <li>
            It cannot price an instrument with no history: assets younger than five years use the most
            conservative quantile available and say so.
          </li>
          <li>These contracts are unaudited. <Link href="/proof">See the limitations in full →</Link></li>
        </ul>
      </section>
    </>
  );
}
