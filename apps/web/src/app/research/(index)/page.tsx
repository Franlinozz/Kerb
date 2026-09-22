/**
 * Research index (V2-09, V2-DESIGN-SYSTEM.md section 11.5): forest band with The Record, the latest
 * report as a featured card with its three strongest measured numbers, the list, and a Scheduled
 * row for the next report with a live countdown.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { ErrorState } from "@/components/ui/ErrorState";
import { Countdown } from "@/components/kerb/Countdown";
import { PageRail } from "@/components/kerb/PageRail";
import { PlateHero } from "@/components/kerb/PlateHero";
import { getMarketTimeIndex, getMarketTimeReport } from "@/lib/api";
import { group, utcStamp } from "@/lib/format";
import { headline, SCHEDULED } from "@/lib/research";

export const metadata: Metadata = { title: "Research", description: "Market-Time Reports: measured studies of what market time does to executable liquidity on X Layer." };
export const revalidate = 300;

export default async function ReportsIndex(): Promise<React.ReactElement> {
  const index = await getMarketTimeIndex();
  const reports = index.ok ? index.data.reports : [];
  const latestId = reports[0]?.id;
  const latest = latestId !== undefined ? await getMarketTimeReport(latestId) : null;
  const scheduled = reports.some((r) => r.id === SCHEDULED.id) ? null : SCHEDULED;

  return (
    <div className="research">
      <PlateHero
        plate="p2-record"
        forest
        serif
        label={`Research · ${reports.length} published`}
        title="Market-Time Reports"
        lede={<p>Measured studies of what market time does to executable liquidity on X Layer. Generated from the append-only observation store; where the record has a hole, the report marks it instead of drawing across it.</p>}
      />
      <PageRail subject={{ kind: "lanes" }} />

      {!index.ok ? <ErrorState source="The report index" /> : null}

      {latest?.ok ? (
        <Link href={`/research/${latest.data.id}`} className="plain rs-feature">
          <span className="t-label">Latest · Report #{latest.data.id}</span>
          <h2 className="t-serif rs-feature-title">{latest.data.title}</h2>
          <div className="rs-nums">
            {headline(latest.data).map((h) => (
              <div key={h.label}><span className="t-num-xl">{h.value}</span><span className="t-small ink-2">{h.label}</span></div>
            ))}
          </div>
          <span className="t-small ink-3">{utcStamp(latest.data.window.from)} to {utcStamp(latest.data.window.to)} · {group(String(latest.data.window.observations))} readings across {latest.data.window.pools} pools · Read the report</span>
        </Link>
      ) : null}

      <section className="section">
        <h2>All reports</h2>
        <ol className="rs-list" role="list">
          {scheduled ? (
            <li className="rs-row rs-scheduled">
              <span className="rs-id mono">#{scheduled.id}</span>
              <span className="rs-title"><span className="t-serif">{scheduled.title}</span><span className="t-small ink-3">{scheduled.window}</span></span>
              <span className="rs-meta"><span className="t-label">Scheduled</span><span className="t-small ink-2">Publishes in <Countdown to={scheduled.publishAt} due="Publishing today" /></span></span>
            </li>
          ) : null}
          {reports.map((r) => (
            <li key={r.id} className="rs-row">
              <span className="rs-id mono">#{r.id}</span>
              <span className="rs-title"><Link href={`/research/${r.id}`} className="t-serif">{r.title}</Link><span className="t-small ink-3">{utcStamp(r.window)} to {utcStamp(r.windowTo)}</span></span>
              <span className="rs-meta"><span className="t-num">{r.hours} h</span><span className="t-small ink-2">{group(String(r.observations))} readings</span></span>
            </li>
          ))}
          {index.ok && reports.length === 0 ? <li className="rs-row"><span className="ink-2">No report is published yet.</span></li> : null}
        </ol>
      </section>
    </div>
  );
}
