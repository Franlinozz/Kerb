"use client";

/**
 * Exchange local time for New York and Hong Kong at the real exchange floors, ticking each
 * second. Coordinates come from the API's market metadata; the session word comes from the Clock,
 * so a holiday reads as a holiday.
 */
import type { Clock, MarketMeta } from "@/lib/api";
import { KIND_WORD } from "./SessionRail";
import { clockPath, railWindow } from "@/lib/time";
import { useLive, useNow } from "./useLive";

const FALLBACK: MarketMeta[] = [
  { code: "XNYS", city: "New York", tz: "America/New_York", lat: 40.7069, lon: -74.0113 },
  { code: "XHKG", city: "Hong Kong", tz: "Asia/Hong_Kong", lat: 22.284, lon: 114.158 },
];
const LEAD: Record<string, string> = { XNYS: "KOx", XHKG: "HKEXCx" };

const coord = (m: MarketMeta): string =>
  `${Math.abs(m.lat).toFixed(4)}° ${m.lat >= 0 ? "N" : "S"} ${Math.abs(m.lon).toFixed(4)}° ${m.lon >= 0 ? "E" : "W"}`;

function localTime(tz: string, at: number): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23", timeZoneName: "short" }).formatToParts(new Date(at));
  const g = (t: string): string => parts.find((p) => p.type === t)?.value ?? "";
  return `${g("hour")}:${g("minute")}:${g("second")} ${tz === "Asia/Hong_Kong" ? "HKT" : g("timeZoneName")}`;
}

function Row({ m, now, compact }: { m: MarketMeta; now: number | null; compact: boolean }): React.ReactElement {
  const w = railWindow(now ?? Date.now());
  const { data } = useLive<Clock>(LEAD[m.code] ? clockPath(LEAD[m.code] as string, w) : null, null, 60_000);
  const kind = data?.clock.session.kind;
  const word = kind ? (kind === "REGULAR" ? "Open" : KIND_WORD[kind]) : "";
  return (
    <div className="clock">
      <div className="t-label">{m.city} · {m.code}</div>
      {compact ? null : <div className="t-label ink-3">{coord(m)}</div>}
      <div className="clock-time" suppressHydrationWarning>
        {now === null ? "Reading the clock" : <>{localTime(m.tz, now)}{word ? <> · <span className="clock-state" data-open={kind === "REGULAR"}>{word}</span></> : null}</>}
      </div>
    </div>
  );
}

export function MarketClocks({ layout = "column", compact = false, align = "left", only }: { layout?: "column" | "row"; compact?: boolean; align?: "left" | "right"; only?: "XNYS" | "XHKG" }): React.ReactElement {
  const now = useNow();
  const stats = useLive<{ marketMeta?: MarketMeta[] }>("/v1/stats", null, 300_000);
  const meta = stats.data?.marketMeta ?? FALLBACK;
  const markets = (only ? [only] : ["XNYS", "XHKG"]).map((c) => meta.find((m) => m.code === c) ?? FALLBACK.find((m) => m.code === c)!);
  return (
    <div className={`clocks${layout === "row" ? " clocks-row" : ""}${align === "right" ? " clocks-right" : ""}`}>
      {markets.map((m) => <Row key={m.code} m={m} now={now} compact={compact} />)}
    </div>
  );
}
