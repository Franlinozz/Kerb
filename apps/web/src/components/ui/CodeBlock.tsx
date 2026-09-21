"use client";
import { Check, Copy } from "lucide-react";
import { useState } from "react";

/** A code block with a copy button and optional language tabs. */
export function CodeBlock({ variants }: { variants: { lang: string; code: string }[] }): React.ReactElement {
  const [i, setI] = useState(0);
  const [copied, setCopied] = useState(false);
  const current = variants[i] ?? variants[0];
  const copy = async (): Promise<void> => {
    try { await navigator.clipboard.writeText(current?.code ?? ""); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* refused */ }
  };
  return (
    <div className="code-block">
      <div className="code-block-head">
        {variants.length > 1 ? (
          <div className="tabs-list" role="tablist" aria-label="Language">
            {variants.map((v, j) => <button key={v.lang} role="tab" aria-selected={j === i} onClick={() => setI(j)}>{v.lang}</button>)}
          </div>
        ) : <span className="t-label">{current?.lang}</span>}
        <button type="button" className="icon-btn" style={{ border: 0 }} onClick={copy} aria-label={copied ? "Copied" : "Copy code"}>{copied ? <Check /> : <Copy />}</button>
      </div>
      <pre><code>{current?.code}</code></pre>
    </div>
  );
}
