import type { Metadata } from "next";
import Link from "next/link";
import { SourceTrouble } from "@/components/States";
import { getMarketTimeIndex } from "@/lib/api";
import { group, utcStamp } from "@/lib/format";
import { PageStrip } from "@/components/PageStrip";

export const metadata: Metadata = { title: "Research", description: "Market-Time Reports: measured studies of what market time does to executable liquidity on X Layer." };
export const dynamic = "force-dynamic";

export default async function ReportsIndex(): Promise<React.ReactElement> {
  const index = await getMarketTimeIndex();

  return (
    <>
      <PageStrip />
      <h1>Market-Time Reports</h1>
      <p className="lede">
        Measured write-ups of what market time does to executable liquidity, generated from the observation store.
        Every figure is a reading Kerb took and kept. Where the record has a hole, the report says so instead of
        drawing a line across it.
      </p>

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
