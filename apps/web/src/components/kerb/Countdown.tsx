"use client";
import { useNow } from "./useLive";
import { countdown } from "@/lib/time";

/** A live countdown to a planned time; past it, it says the thing is due rather than going negative. */
export function Countdown({ to, due = "Due now" }: { to: string; due?: string }): React.ReactElement {
  const now = useNow(1000);
  const target = Date.parse(to);
  if (now === null) return <span className="mono">&nbsp;</span>;
  return <span className="mono">{target > now ? countdown(target, now) : due}</span>;
}
