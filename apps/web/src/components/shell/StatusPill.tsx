"use client";
import Link from "@/components/ui/Link";
import { useEffect, useState } from "react";
import { PUBLIC_API } from "@/lib/api";
import { age } from "@/lib/format";

type State = { kind: "loading" } | { kind: "down" } | { kind: "ok" | "late"; ageSec: number };

/** Live and the age of the last post on mainnet: moss when fresh, brass over 15 minutes, oxide when unreachable. */
export function StatusPill(): React.ReactElement {
  const [s, setS] = useState<State>({ kind: "loading" });
  useEffect(() => {
    let stop = false;
    const load = async (): Promise<void> => {
      try {
        const r = await fetch(`${PUBLIC_API}/health`, { cache: "no-store", signal: AbortSignal.timeout(8000) });
        if (!r.ok) throw new Error(String(r.status));
        const h = (await r.json()) as { now: string; posts: { chainId: number; lastAt: string }[] };
        const main = h.posts.find((p) => p.chainId === 196) ?? h.posts[0];
        if (!main) throw new Error("no posts");
        const ageSec = Math.max(0, Math.round((Date.parse(h.now) - Date.parse(main.lastAt)) / 1000));
        if (!stop) setS({ kind: ageSec > 900 ? "late" : "ok", ageSec });
      } catch {
        if (!stop) setS({ kind: "down" });
      }
    };
    void load();
    const t = setInterval(load, 30_000);
    return () => { stop = true; clearInterval(t); };
  }, []);
  const text = s.kind === "loading" ? "Checking" : s.kind === "down" ? "API unreachable" : `Live · posted ${age(s.ageSec)} ago`;
  return (
    <Link href="/proof" className="status-pill" data-state={s.kind} aria-label={`Status: ${text}. Open the proof page.`}>
      <span className="status-dot" aria-hidden="true" />
      <span className="status-text">{text}</span>
    </Link>
  );
}
