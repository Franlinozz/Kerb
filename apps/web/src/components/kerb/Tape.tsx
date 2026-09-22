"use client";

/**
 * The Tape (section 8): a slow ticker of the latest Terms posts on X Layer mainnet. Pauses on
 * hover and focus; a static list under reduced motion. Every item links to its transaction.
 */
import type { TapePost } from "@/lib/api";
import { shortHash, usd } from "@/lib/format";
import { RegimePill } from "./RegimePill";
import { useLive, useNow } from "./useLive";

function ago(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

export function Tape({ initial }: { initial: { posts: TapePost[] } | null }): React.ReactElement | null {
  const live = useLive<{ posts: TapePost[] }>("/v1/tape?limit=40", initial, 30_000);
  const now = useNow(15_000);
  const posts = (live.data?.posts ?? []).filter((p) => p.chainId === 196).slice(0, 14);
  if (posts.length === 0) return null;
  const item = (p: TapePost, k: string, hidden: boolean): React.ReactElement => (
    <li key={k} className="tape-item" aria-hidden={hidden || undefined}>
      <span className="tape-sym">{p.symbol}</span>
      <RegimePill regime={p.regime} size="sm" />
      <span className="ink-2">C(1%) <span className="ink">{usd(p.c1)}</span></span>
      <a className="mono ink-2 plain" href={p.explorer} target="_blank" rel="noreferrer" tabIndex={hidden ? -1 : 0} aria-label={`${p.symbol} Terms post ${shortHash(p.tx)} on OKLink`}>{shortHash(p.tx, 6, 4)}</a>
      <span className="ink-3" suppressHydrationWarning>{now === null ? "" : ago(now - Date.parse(p.observedAt))}</span>
    </li>
  );
  return (
    <section className="tape" aria-label="The Tape: latest Terms posted on X Layer mainnet">
      <span className="tape-label t-label">The Tape · X Layer 196</span>
      <div className="tape-viewport">
        <ul className="tape-track" role="list">
          {posts.map((p) => item(p, p.tx, false))}
          {posts.map((p) => item(p, `${p.tx}-2`, true))}
        </ul>
      </div>
    </section>
  );
}
