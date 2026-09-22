/**
 * Window against the sessions (Research, section 11.5): the report's observation window over both
 * markets' sessions, with every hole in the record marked where it actually is. Server-rendered and
 * static: a report's window does not move.
 */
import type { Clock } from "@/lib/api";
import { clip, dayColumns, utcHm } from "@/lib/time";

export function WindowStrip({ fromMs, toMs, lanes, gaps }: {
  fromMs: number; toMs: number;
  lanes: { name: string; clock: Clock | null }[];
  gaps: { from: string; to: string; minutes: number }[] | null;
}): React.ReactElement {
  const days = dayColumns(fromMs, toMs);
  return (
    <figure className="wstrip" aria-label="The observation window against the New York and Hong Kong sessions">
      {lanes.map((l) => (
        <div key={l.name} className="wstrip-lane">
          <span className="t-label">{l.name}</span>
          <div className="rail-band">
            {l.clock ? l.clock.segments.filter((s) => s.kind !== "CLOSED").map((s) => {
              const c = clip(Date.parse(s.startsAt), Date.parse(s.endsAt), fromMs, toMs);
              return c ? <span key={s.startsAt} className={`rail-seg rail-${s.kind}`} style={{ left: `${c.left}%`, width: `${c.width}%` }} title={`${s.kind.toLowerCase()} ${utcHm(Date.parse(s.startsAt))} to ${utcHm(Date.parse(s.endsAt))} UTC`} /> : null;
            }) : <span className="wstrip-none t-small ink-3">Calendar not read</span>}
          </div>
        </div>
      ))}
      <div className="wstrip-lane">
        <span className="t-label">Record</span>
        <div className="rail-band wstrip-record">
          {(gaps ?? []).map((g) => {
            const c = clip(Date.parse(g.from), Date.parse(g.to), fromMs, toMs);
            return c ? <span key={g.from} className="wstrip-gap" style={{ left: `${c.left}%`, width: `${Math.max(c.width, 0.4)}%` }} title={`No readings ${utcHm(Date.parse(g.from))} to ${utcHm(Date.parse(g.to))} UTC, ${g.minutes} minutes`} /> : null;
          })}
        </div>
      </div>
      <div className="rail-days wstrip-days" aria-hidden="true">
        {days.map((d) => <span key={d.startMs} className="rail-day" style={{ left: `${d.left}%`, width: `${d.width}%` }}>{d.width > 8 ? <span className="rail-day-label">{d.label}</span> : null}</span>)}
      </div>
      <figcaption className="t-small ink-3">
        Light is a regular session, grey the extended hours. The record lane is solid where the collector read every minute{gaps && gaps.length ? `; hatched where it did not: ${gaps.map((g) => `${utcHm(Date.parse(g.from))} to ${utcHm(Date.parse(g.to))} UTC on ${g.from.slice(8, 10)} Sep (${g.minutes} min)`).join(", ")}` : gaps ? "; there is no hole longer than five minutes" : ""}.
      </figcaption>
    </figure>
  );
}
