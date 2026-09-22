/**
 * Methodology (V2-10, V2-DESIGN-SYSTEM.md section 11.6): the Kerb Terms Standard, each rule with
 * its diagram first, then the rule in two sentences, then the live worked example. Parameters as
 * grouped lists that wrap: nothing is ever off-screen.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { ErrorState } from "@/components/ui/ErrorState";
import { ProvMark } from "@/components/ui/ProvMark";
import { ImpactChart } from "@/components/kerb/ImpactChart";
import { LtvLadder } from "@/components/kerb/LtvLadder";
import { MarkWaterfall } from "@/components/kerb/MarkWaterfall";
import { PlateHero } from "@/components/kerb/PlateHero";
import { REGIME_MEANING, REGIME_WORD } from "@/components/kerb/RegimePill";
import { ScrollSpy } from "@/components/kerb/ScrollSpy";
import { getBoard, getParams, getReport, getTerms, PUBLIC_API, type Regime } from "@/lib/api";
import { byDecimalDesc, ltv, price, round, shift, shortHash, usd } from "@/lib/format";
import { dayHm, utcHm } from "@/lib/time";

export const metadata: Metadata = { title: "Methodology", description: "The Kerb Terms Standard worked through on live numbers: regime, depth, mark, capacity, the cure covenant and reproducibility." };
export const revalidate = 60;

const ORDER: { rule: number; regime: Regime; when: string }[] = [
  { rule: 1, regime: "HALTED", when: "The token or the underlying is halted." },
  { rule: 2, regime: "STALE", when: "A source the mark uses is too old, or sources disagree beyond the dispersion guard." },
  { rule: 3, regime: "ACTION", when: "Inside a corporate action window, or the multiplier just changed." },
  { rule: 4, regime: "PRE_TRANSITION", when: "Inside the Last Call window before the session weakens." },
  { rule: 5, regime: "RECOVERY", when: "Inside the cooldown after the market reopens." },
  { rule: 6, regime: "REFERENCE_CLOSED", when: "The underlying market is in no session at all." },
  { rule: 7, regime: "THIN", when: "Executable depth is below the thin threshold, or unavailable." },
  { rule: 8, regime: "DEEP", when: "Depth at or above the deep threshold and the market in its main session." },
  { rule: 9, regime: "NORMAL", when: "Open, with adequate depth." },
];

const SECTIONS = [
  { id: "regime", label: "Regime" }, { id: "depth", label: "Depth" }, { id: "mark", label: "Mark" }, { id: "capacity", label: "Capacity" },
  { id: "covenant", label: "Covenant" }, { id: "reproducibility", label: "Reproducibility" }, { id: "parameters", label: "Parameters" }, { id: "limits", label: "Limits" },
];

const GROUP: Record<string, string> = { capacityDefaults: "Capacity", asymmetry: "Asymmetry", regime: "Regime", mark: "Mark", depth: "Depth", stress: "Stress" };
/** Keys the running formula ignores, kept so older bundles recompute under their own rules. */
const ONLY_01 = new Set(["carryMargin", "sessionMargin"]);

function ParamValue({ v, kts }: { v: unknown; kts?: string | undefined }): React.ReactElement {
  if (Array.isArray(v)) return <ul className="param-list" role="list">{v.map((x, i) => <li key={i} className="mono">{String(x)}</li>)}</ul>;
  if (v !== null && typeof v === "object") return <dl className="param-sub">{Object.entries(v as Record<string, unknown>).map(([k, x]) => <div key={k} data-legacy={(kts === "0.2" && ONLY_01.has(k)) || undefined}><dt className="mono">{k}{kts === "0.2" && ONLY_01.has(k) ? <span className="t-small ink-3"> KTS-0.1 only</span> : null}</dt><dd><ParamValue v={x} /></dd></div>)}</dl>;
  return <span className="mono">{String(v)}</span>;
}

export default async function MethodologyPage(): Promise<React.ReactElement> {
  const board = await getBoard();
  const rows = board.ok ? board.data.rows : [];
  const lead = rows.find((r) => r.symbol === "BRK.Bx") ?? [...rows].sort(byDecimalDesc((r) => r.debtCeiling.value))[0];
  const symbol = lead?.symbol ?? "BRK.Bx";
  const [report, terms, params] = await Promise.all([getReport(symbol), getTerms(symbol), getParams()]);
  const r = report.ok ? report.data : null;
  const kts = params.ok ? params.data.kts : r?.kts ?? "0.1";
  const liveRule = r?.regimeInputs?.rule;

  return (
    <div className="methodology">
      <PlateHero plate="p3-standard" label={`Methodology · KTS ${kts} · params ${params.ok ? params.data.paramsVersion : "not read"}`} title="The Kerb Terms Standard."
        lede={<p>Clock, Depth, Mark, Capacity, Terms and the cure covenant: the rules that turn observations into credit terms. Every example below is {symbol}, right now, from the numbers Kerb is publishing. Nothing here is illustrative.</p>} />

      <div className="method-grid">
        <aside className="method-toc"><ScrollSpy items={SECTIONS} /></aside>
        <div className="method-body">
          {/* ------------------------------------------------ regime */}
          <section id="regime" className="method-section">
            <span className="t-label">1 · Regime</span>
            <h2>The regime machine.</h2>
            <ol className="regime-ladder" role="list">
              {ORDER.map((o) => (
                <li key={o.rule} data-live={liveRule === o.rule || undefined}>
                  <span className="rl-rule mono">{o.rule}</span><span className="rl-name">{REGIME_WORD[o.regime]}</span><span className="rl-when t-small ink-2">{o.when}</span>
                  {liveRule === o.rule ? <span className="rl-live t-label">{symbol} now</span> : null}
                </li>
              ))}
            </ol>
            <p className="method-rule">The regime is the first rule, top to bottom, that holds. Worse states win: a halted asset is halted whatever its depth, and a stale source overrides an open market.</p>
            {r?.regimeInputs ? <p className="method-live">{symbol} is <b>{REGIME_WORD[r.regime]}</b> by rule {r.regimeInputs.rule}: {r.regimeInputs.reason}. {REGIME_MEANING[r.regime]}</p> : <ErrorState source="The live report" />}
          </section>

          {/* ------------------------------------------------ depth */}
          <section id="depth" className="method-section">
            <span className="t-label">2 · Depth</span>
            <h2>What the market could actually absorb.</h2>
            {r?.depth.venues[0] ? <ImpactChart venue={r.depth.venues[0]} crosscheck={r.depth.crosscheck && "quoted" in r.depth.crosscheck ? { quoted: r.depth.crosscheck.quoted, source: r.depth.crosscheck.source } : null} /> : null}
            <p className="method-rule">Kerb walks the real Uniswap V3 pool tick by tick in the direction of a sale and finds C(i), the largest notional whose impact stays within i. It cross-checks C(1%) against an aggregator quote and keeps the smaller of the two.</p>
            {r ? <p className="method-live">{symbol}: C(1%) <b>{usd(r.depth.C_1)}</b> across {r.depth.venues.length} venue{r.depth.venues.length === 1 ? "" : "s"}{r.depth.excluded.length ? `, ${r.depth.excluded.length} excluded` : ""}. The debt ceiling is built from this number. <Link href={`/asset/${symbol}#liquidity`}>The whole curve</Link>.</p> : null}
          </section>

          {/* ------------------------------------------------ mark */}
          <section id="mark" className="method-section">
            <span className="t-label">3 · Mark</span>
            <h2>A price you could sell at.</h2>
            {r ? <MarkWaterfall mark={r.mark} regime={r.regime} /> : <ErrorState source="The live report" />}
            <p className="method-rule">The Credit Mark is the lower of the reference median and the pool price along the whole path to the loan asset, less a haircut set by the regime. If the sources disagree beyond the dispersion guard, the regime becomes Stale and borrowing stops.</p>
            {r ? <p className="method-live">{symbol}: Credit Mark <b>{price(r.mark.creditMark)}</b>, a {round(shift(r.mark.haircut, 2), 2)}% haircut for {REGIME_WORD[r.regime].toLowerCase()}.</p> : null}
          </section>

          {/* ------------------------------------------------ capacity */}
          <section id="capacity" className="method-section">
            <span className="t-label">4 · Capacity · KTS {kts}</span>
            <h2>How far below the line, and for how long.</h2>
            {r ? <LtvLadder carry={r.capacity.carryLTV} session={r.capacity.sessionMaxLTV} lt={r.capacity.LT} kts={r.kts ?? null} margins={lead?.margins ?? null} /> : null}
            {kts === "0.2" && r?.capacity.margins ? (
              <>
                <p className="method-rule">In KTS 0.2 each mode keeps a margin below the fixed liquidation line equal to {r.capacity.margins.stressMultiplier} times the stressed price gap over the time it must survive, plus the cost of selling: Carry to the next deep market, Session Max only to the next Last Call. Before a long closure Carry tightens and the gap to Session Max widens; midweek they converge.</p>
                <div className="method-margins">
                  {([["Carry", r.capacity.margins.carry], ["Session Max", r.capacity.margins.session]] as const).map(([name, m]) => (
                    <div key={name} className="mm">
                      <span className="t-label">{name} margin</span>
                      <span className="t-num-l">{round(shift(m.used, 2), 2)}%</span>
                      <span className="t-small ink-2">{r.capacity.margins!.stressMultiplier} × {round(shift(m.volScaler, 0), 2)} vol × {round(shift(m.gap, 2), 2)}% gap over {round(m.horizonHours, 1)} h (to {dayHm(Date.parse(m.horizonEndsAt))} UTC) + {round(shift(m.exitCost, 2), 2)}% exit cost; floor {round(shift(m.floor, 2), 0)}%</span>
                    </div>
                  ))}
                </div>
                <details className="disclosure method-fig">
                  <summary>The replay: every asset, 72 hours of real observations, 0.1 against 0.2</summary>
                  <div className="disclosure-body">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/kts-0.2-replay.svg" alt="KTS-0.2 replay: Carry and Session Max for every asset over 72 hours of real observations, with regime bands. Under 0.2 they move with the time to the next deep market; under 0.1, dashed, they were flat." loading="lazy" width={900} height={1840} />
                  </div>
                </details>
                <p className="t-small ink-3 mt-3">Before going live, 0.2 was replayed over 3,286 real bundles and posted 1,357 times through the real KerbTerms on a mainnet fork with no contract revert. <a href="https://github.com/Franlinozz/Kerb/blob/main/docs/v2/KTS-0.2.md">The KTS-0.2 specification</a>.</p>
              </>
            ) : (
              <p className="method-rule">In KTS-0.1 the Carry to Session Max margin is fixed. What moves with market time is the debt ceiling, through measured depth, and the cure deadline.</p>
            )}
            {r ? <p className="method-live">{symbol} now: Carry <b>{ltv(r.capacity.carryLTV)}</b>, Session Max <b>{ltv(r.capacity.sessionMaxLTV)}</b>, liquidation <b>{ltv(r.capacity.LT)}</b> fixed; debt ceiling {usd(r.capacity.debtCeiling)}, one position at most {usd(r.capacity.maxPositionDebt)}.</p> : null}
          </section>

          {/* ------------------------------------------------ covenant */}
          <section id="covenant" className="method-section">
            <span className="t-label">5 · Covenant</span>
            <h2>Last Call, and the cure.</h2>
            <ol className="timeline" role="list">
              <li><span className="t-label">Session</span><span>Borrow up to Session Max, with the promise attached.</span></li>
              <li data-brass><span className="t-label">Last Call opens</span><span>{r?.regimeInputs ? `${utcHm(Date.parse(r.regimeInputs.cureWindowOpensAt))} UTC for ${symbol}` : "Before the session weakens"}. Anyone may repay the difference to Carry and take a bonus in collateral.</span></li>
              <li><span className="t-label">Cured</span><span>The position is back at its Carry target, only the difference repaid, never the whole loan.</span></li>
              <li><span className="t-label">Session weakens</span><span>{r?.regimeInputs ? `${dayHm(Date.parse(r.regimeInputs.nextWeakening.at))} UTC` : "The close"}. What is left is sized to survive the closure.</span></li>
            </ol>
            <p className="method-rule">Session Max borrowers precommit to be back at Carry before the session weakens; from Last Call anyone may enforce that for a small bonus. The liquidation threshold never moves: a cure is a partial, early repayment, not a liquidation.</p>
          </section>

          {/* ------------------------------------------------ reproducibility */}
          <section id="reproducibility" className="method-section">
            <span className="t-label">6 · Reproducibility</span>
            <h2>Every number recomputes from its inputs.</h2>
            <p className="method-rule">Each report pins its full input bundle, and the keccak256 of those bytes goes on chain with the terms. The engine is a pure function of the bundle and reads its own formula version from it, so a 0.1 report still recomputes under 0.1.</p>
            {terms.ok ? (
              <>
                <p className="method-live">Latest {symbol} inputs hash <span className="mono">{shortHash(terms.data.inputsHash, 10, 8)}</span>{terms.data.bundle.url ? <> · <a href={`${PUBLIC_API}${terms.data.bundle.url}`}>the bytes</a></> : null}.</p>
                <CodeBlock variants={[{ lang: "shell", code: terms.data.bundle.verifyCommand }]} />
              </>
            ) : <ErrorState source="Terms" />}
          </section>

          {/* ------------------------------------------------ parameters */}
          <section id="parameters" className="method-section">
            <span className="t-label">7 · Parameters · KTS {kts} · params {params.ok ? params.data.paramsVersion : ""}</span>
            <h2>The parameter set the engine is running on.</h2>
            {params.ok ? (
              <>
                <div className="params">
                  {(["capacityDefaults", "asymmetry", "regime", "mark", "depth", "stress"] as const).map((g) => (
                    <details key={g} className="disclosure" open={g === "capacityDefaults"}>
                      <summary>{GROUP[g]} <span className="mono t-small ink-3">{g}</span></summary>
                      <div className="disclosure-body"><ParamValue v={params.data[g]} kts={g === "capacityDefaults" ? kts : undefined} /></div>
                    </details>
                  ))}
                </div>
                <p className="t-small ink-3 mt-3">Read from config/kts-params.json as served at /v1/params <ProvMark label="Observed" source="config/kts-params.json, served at /v1/params" /></p>
                <p className="mt-4"><a className="btn btn-sm" href={`${PUBLIC_API}/v1/params`} target="_blank" rel="noreferrer">Download parameters JSON</a></p>
              </>
            ) : <ErrorState source="The parameter set" />}
          </section>

          {/* ------------------------------------------------ limits */}
          <section id="limits" className="method-section">
            <span className="t-label">8 · Limits</span>
            <h2>What this version does not do.</h2>
            <ul className="method-limits">
              <li>The gap at a horizon is read from daily closes by calendar time, which is conservative across a closure but not an intraday model.</li>
              <li>Instruments with less than five years of history take the most conservative quantile available, and say so.</li>
              <li>The reference price is issuer data plus an independent public chart; Chainlink Data Streams would be rung 1 and needs credentials.</li>
              <li>The credit plane runs on testnet with mirror collateral. The contracts are unaudited. <Link href="/proof">Every limitation, live</Link>.</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
