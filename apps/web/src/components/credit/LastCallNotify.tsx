"use client";
/**
 * The covenant's last mile (V3-08): a Session Max borrower asks to be told when Last Call opens.
 * Browser notifications from this open tab only: one when the window opens, one five minutes
 * before it closes. Cancelled when the position no longer needs a cure (repaid, cured, closed).
 */
import { useEffect, useState } from "react";
import { utcHm } from "@/lib/time";

type State = "off" | "armed" | "denied" | "unsupported";

export function LastCallNotify({ opensAt, closesAt, active, what }: { opensAt: number; closesAt: number; active: boolean; what: string }): React.ReactElement | null {
  const [state, setState] = useState<State>("off");
  useEffect(() => { if (typeof window !== "undefined" && !("Notification" in window)) setState("unsupported"); }, []);
  useEffect(() => {
    if (state !== "armed" || !active) return undefined;
    const timers: number[] = [];
    const at = (ms: number, title: string, body: string): void => {
      const wait = ms - Date.now();
      if (wait > 0 && wait < 2 ** 31 - 1) timers.push(window.setTimeout(() => { try { new Notification(title, { body, tag: `kerb-${ms}` }); } catch { /* the page may have lost permission */ } }, wait));
    };
    at(opensAt, "Kerb: Last Call is open", `${what}: cure back to Carry by ${utcHm(closesAt)} UTC.`);
    at(closesAt - 5 * 60_000, "Kerb: five minutes of Last Call left", `${what}: after ${utcHm(closesAt)} UTC anyone may cure it for a bonus.`);
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [state, active, opensAt, closesAt, what]);
  if (!active) return null;
  if (state === "unsupported") return <p className="t-small ink-3">This browser cannot show notifications; the countdown above is the reminder.</p>;
  const arm = async (): Promise<void> => {
    const p = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    setState(p === "granted" ? "armed" : "denied");
  };
  return (
    <div className="notify-line t-small">
      {state === "armed" ? (
        <><span className="ink-2">You will be notified at {utcHm(opensAt)} and {utcHm(closesAt - 5 * 60_000)} UTC, while this tab stays open.</span> <button type="button" className="btn btn-sm btn-quiet" onClick={() => setState("off")}>Stop</button></>
      ) : state === "denied" ? (
        <span className="ink-3">Notifications are blocked for this site; allow them in the browser to use this.</span>
      ) : (
        <><button type="button" className="btn btn-sm" onClick={() => void arm()}>Notify me when Last Call opens</button> <span className="ink-3">Works while this tab stays open.</span></>
      )}
    </div>
  );
}
