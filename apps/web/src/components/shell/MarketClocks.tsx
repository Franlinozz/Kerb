"use client";
import { useEffect, useState } from "react";

/**
 * Exchange local time for New York and Hong Kong, at the real exchange floors. The session word
 * uses the weekday rule; V2-05 wires it to the Clock API so holidays read correctly.
 */
const MARKETS = [
  { city: "New York", code: "XNYS", tz: "America/New_York", coords: "40.7069° N 74.0113° W", open: [570, 960] as const, lunch: null },
  { city: "Hong Kong", code: "XHKG", tz: "Asia/Hong_Kong", coords: "22.2840° N 114.1580° E", open: [570, 960] as const, lunch: [720, 780] as const },
];

function local(tz: string, at: Date): { time: string; zone: string; minutes: number; weekend: boolean } {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23", weekday: "short", timeZoneName: "short" });
  const parts = f.formatToParts(at);
  const g = (t: string): string => parts.find((p) => p.type === t)?.value ?? "";
  return { time: `${g("hour")}:${g("minute")}:${g("second")}`, zone: tz === "Asia/Hong_Kong" ? "HKT" : g("timeZoneName"), minutes: Number(g("hour")) * 60 + Number(g("minute")), weekend: ["Sat", "Sun"].includes(g("weekday")) };
}

export function MarketClocks({ layout = "column" }: { layout?: "column" | "row" }): React.ReactElement {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { setNow(new Date()); const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  return (
    <div className={`clocks${layout === "row" ? " clocks-row" : ""}`}>
      {MARKETS.map((m) => {
        const l = now ? local(m.tz, now) : null;
        const inLunch = l && m.lunch ? l.minutes >= m.lunch[0] && l.minutes < m.lunch[1] : false;
        const open = l ? !l.weekend && l.minutes >= m.open[0] && l.minutes < m.open[1] && !inLunch : false;
        const word = !l ? "" : l.weekend ? "Closed" : inLunch ? "Lunch break" : open ? "Open" : l.minutes < m.open[0] ? "Pre-market" : "Closed";
        return (
          <div key={m.code} className="clock">
            <div className="t-label">{m.city} · {m.code}</div>
            <div className="t-label ink-3">{m.coords}</div>
            <div className="clock-time" suppressHydrationWarning>
              {l ? <>{l.time} {l.zone} · <span className="clock-state" data-open={open}>{word}</span></> : "Reading the clock"}
            </div>
          </div>
        );
      })}
    </div>
  );
}
