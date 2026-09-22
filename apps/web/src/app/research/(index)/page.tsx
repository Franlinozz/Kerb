import type { Metadata } from "next";
import Link from "next/link";
import { SourceTrouble } from "@/components/States";
import { getMarketTimeIndex, getMarketTimeReport } from "@/lib/api";
import { PlateHero } from "@/components/kerb/PlateHero";
import { group, utcStamp } from "@/lib/format";
import { PageRail } from "@/components/kerb/PageRail";

export const metadata: Metadata = { title: "Research", description: "Market-Time Reports: measured studies of what market time does to executable liquidity on X Layer." };
export const dynamic = "force-dynamic";

export default async function ReportsIndex(): Promise<React.ReactElement> {
  const index = await getMarketTimeIndex();
  const latestId = index.ok ? index.data.reports[0]?.id : undefined;
  const latest = latestId !== undefined ? await getMarketTimeReport(latestId) : null;
  const falls = latest?.ok ? latest.data.pools.filter((p) => p.role === "asset" && p.changePct !== null) : [];
  const fell = falls.filter((p) => (p.changePct ?? "").startsWith("-")).length;

  return (
    <>
      <PlateHero
        plate="p2-record"
        label={`Research · Market-Time Reports · ${index.ok ? index.data.reports.length : 0} published`}
        title={<>Market-Time<br /><span className="t-olive">Reports.</span></>}
        lede={<p>Measured studies of what market time does to executable liquidity on X Layer, generated from the observation store. Where the record has a hole, the report says so instead of drawing a line across it.</p>}
        evidence={latest?.ok ? (
          <>
            <span className="evidence-num"><span className="t-label">Report #{latest.data.id} · window</span><span className="t-num-l">{latest.data.window.hours} h</span></span>
            <span className="evidence-num"><span className="t-label">Pool readings</span><span className="t-num-l">{group(String(latest.data.window.observations))}</span></span>
            <span className="evidence-num"><span className="t-label">Asset pools that lost depth</span><span className="t-num-l">{fell} of {falls.length}</span></span>
          </>
        ) : undefined}
      />
      <PageRail subject={{ kind: "lanes" }} />

      {!index.ok ? (
        <SourceTrouble what="the report index" detail={index.error} />
      ) : index.data.reports.length === 0 ? (
        <div className="empty">
          No report has been published yet. The first one publishes once there is enough of a record behind it to
          say something measured.
        </div>
      ) : (
        <div className="scroll-x">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th className="wrap-cell">Title</th>
                <th>Window</th>
                <th className="num">Hours</th>
                <th className="num">Readings</th>
              </tr>
            </thead>
            <tbody>
              {index.data.reports.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link href={`/research/${r.id}`}>#{r.id}</Link>
                  </td>
                  <td className="wrap-cell">
                    <Link href={`/research/${r.id}`}>{r.title}</Link>
                  </td>
                  <td className="dim">
                    {utcStamp(r.window)} → {utcStamp(r.windowTo)}
                  </td>
                  <td className="num">{r.hours}</td>
                  <td className="num">{group(String(r.observations))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
