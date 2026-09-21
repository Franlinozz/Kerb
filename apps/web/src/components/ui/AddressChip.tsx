"use client";
import { Check, Copy, ExternalLink } from "lucide-react";
import { useState } from "react";
import { shortHash } from "@/lib/format";

/** A hash or address, truncated in the middle, with copy and an explorer link. */
export function AddressChip({ value, href, lead = 6, tail = 4, label }: { value: string; href?: string; lead?: number; tail?: number; label?: string }): React.ReactElement {
  const [copied, setCopied] = useState(false);
  const copy = async (): Promise<void> => {
    try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard refused */ }
  };
  return (
    <span className="chip" title={value}>
      <span>{shortHash(value, lead, tail)}</span>
      <button type="button" onClick={copy} aria-label={copied ? "Copied" : `Copy ${label ?? "value"}`}>{copied ? <Check /> : <Copy />}</button>
      {href ? <a href={href} target="_blank" rel="noreferrer" aria-label="Open on OKLink"><ExternalLink /></a> : null}
    </span>
  );
}

export function HashChip(props: { value: string; href?: string }): React.ReactElement {
  return <AddressChip {...props} lead={6} tail={4} label="hash" />;
}
