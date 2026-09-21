"use client";

/**
 * The Session Strip. docs/ARCHITECTURE.md section 9: the trading week as a band of session segments,
 * a live cursor, the regime named in words with its glyph, and a countdown to the next transition.
 *
 * The geometry comes from the Clock endpoint, which runs the same resolver the onchain KerbClock
 * is equivalence-tested against. The only thing computed in the browser is where "now" sits
 * between two timestamps the server already sent, and the countdown text.
 *
 * There is exactly one orchestrated motion in the product and this is it: the regime change.
 * Under reduced motion it swaps instantly.
 */
import { useEffect, useRef, useState } from "react";
import type { Clock, ClockSegment, Regime } from "@/lib/api";
import { duration, utcTime } from "@/lib/format";
import { RegimeTag } from "./Regime";

const KIND_LABEL: Record<ClockSegment["kind"], string> = {
  PRE: "Pre-market",
  REGULAR: "Regular session",
  LUNCH: "Lunch break",
  POST: "After hours",
  CLOSED: "Closed",
};

const REASON_LABEL: Record<string, string> = {
  SESSION: "",
  OVERNIGHT: "overnight",
  WEEKEND: "weekend",
  HOLIDAY: "holiday",
  EARLY_CLOSE: "early close",
  HALF_DAY: "half day",
  HOLIDAY_HOURS: "holiday hours",
};

function dayLabel(iso: string): string {
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(iso).getUTCDay()] ?? "";
}

export function SessionStrip({ clock, regime, compact = false }: {
  clock: Clock;
  regime: Regime | null;
  compact?: boolean;
}): React.ReactElement {
  const fromMs = Date.parse(clock.window.from);
  const toMs = Date.parse(clock.window.to);
  const span = toMs - fromMs;

  const [nowMs, setNowMs] = useState<number>(() => Date.parse(clock.at));
  const [flash, setFlash] = useState(false);
  const lastRegime = useRef<Regime | null>(regime);

  // The cursor advances on the client; nothing else about the strip is computed here.
  useEffect(() => {
    const tick = (): void => setNowMs(Date.now());
    tick();
    const t = window.setInterval(tick, 1000);
    return () => window.clearInterval(t);
  }, []);

  // The one orchestrated motion: a regime change pulses the strip once.
  useEffect(() => {
    if (lastRegime.current !== null && regime !== null && lastRegime.current !== regime) {
      setFlash(true);
      const t = window.setTimeout(() => setFlash(false), 1400);
      lastRegime.current = regime;
      return () => window.clearTimeout(t);
    }
    lastRegime.current = regime;
    return undefined;
  }, [regime]);

  const pct = (ms: number): number => Math.max(0, Math.min(100, ((ms - fromMs) / span) * 100));
  const cursor = pct(nowMs);
  const next = clock.clock.nextTransition;
  const untilMs = Date.parse(next.at) - nowMs;

  // Day boundaries for the ticks under the band.
  const days: { at: number; label: string }[] = [];
  const firstMidnight = Math.ceil(fromMs / 86_400_000) * 86_400_000;
  for (let t = firstMidnight; t < toMs; t += 86_400_000) days.push({ at: t, label: dayLabel(new Date(t).toISOString()) });

  return (
    <section className={`strip${flash ? " strip-changed" : ""}${compact ? " strip-compact" : ""}`} aria-label={`Session strip for ${clock.symbol}`}>
      <div className="strip-head">
        <div className="strip-now">
          {regime ? <RegimeTag regime={regime} /> : <span className="dim">No regime posted</span>}
          <span className="strip-sep" aria-hidden="true">·</span>
          <span className="dim">
            {KIND_LABEL[clock.clock.session.kind]}
            {REASON_LABEL[clock.clock.session.reason] ? ` (${REASON_LABEL[clock.clock.session.reason]})` : ""}
            {clock.clock.session.names.length > 0 ? `: ${clock.clock.session.names.join(", ")}` : ""}
          </span>
        </div>
        <div className="strip-next">
          <span className="faint">{transitionWords(next.type)} in</span>{" "}
          <span className="strip-count" suppressHydrationWarning>{duration(untilMs)}</span>{" "}
          <span className="faint" suppressHydrationWarning>({utcTime(next.at)})</span>
        </div>
      </div>

      <div className="strip-band" role="img" aria-label={bandDescription(clock)}>
        {clock.segments.map((g) => {
          const a = pct(Date.parse(g.startsAt));
          const b = pct(Date.parse(g.endsAt));
          if (b <= a) return null;
          return (
            <span
              key={g.startsAt + g.kind}
              className={`seg seg-${g.kind}`}
              style={{ left: `${a}%`, width: `${b - a}%` }}
              title={`${KIND_LABEL[g.kind]} ${utcTime(g.startsAt)} to ${utcTime(g.endsAt)}${g.names.length ? ` · ${g.names.join(", ")}` : ""}`}
            />
          );
        })}
        {/* The cure window sits on top of the band: the Last Call the covenant is measured against. */}
        <span
          className="seg-cure"
          style={{
            left: `${pct(Date.parse(clock.clock.cureWindow.opensAt))}%`,
            width: `${pct(Date.parse(clock.clock.cureWindow.closesAt)) - pct(Date.parse(clock.clock.cureWindow.opensAt))}%`,
          }}
          title={`Last Call ${utcTime(clock.clock.cureWindow.opensAt)} to ${utcTime(clock.clock.cureWindow.closesAt)}`}
        />
        <span className="strip-cursor" style={{ left: `${cursor}%` }} suppressHydrationWarning aria-hidden="true" />
      </div>

      <div className="strip-axis" aria-hidden="true">
        {days.map((d) => (
          <span key={d.at} className="strip-day" style={{ left: `${pct(d.at)}%` }}>
            {d.label}
          </span>
        ))}
      </div>
    </section>
  );
}

function transitionWords(type: string): string {
  const words: Record<string, string> = {
    PRE_OPEN: "Pre-market opens",
    SESSION_OPEN: "Session opens",
    SESSION_CLOSE: "Session closes",
    LUNCH_START: "Lunch break",
    LUNCH_END: "Session resumes",
    POST_OPEN: "After hours",
    POST_CLOSE: "Market closes",
    EARLY_CLOSE: "Early close",
  };
  return words[type] ?? type.replace(/_/g, " ").toLowerCase();
}

function bandDescription(c: Clock): string {
  return `${c.market} sessions from ${c.window.from.slice(0, 10)} to ${c.window.to.slice(0, 10)}. Currently ${KIND_LABEL[c.clock.session.kind]}, next ${transitionWords(c.clock.nextTransition.type)} at ${c.clock.nextTransition.at}.`;
}
