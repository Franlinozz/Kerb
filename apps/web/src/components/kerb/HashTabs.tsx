"use client";

/** Tabs whose selection lives in the URL hash, so a tab can be linked to and survives reload. */
import { useEffect, useRef, useState, type ReactNode } from "react";

export function HashTabs({ tabs, label }: { tabs: { id: string; label: string; content: ReactNode }[]; label: string }): React.ReactElement {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => {
    const read = (): void => { const i = tabs.findIndex((t) => `#${t.id}` === window.location.hash); if (i >= 0) setActive(i); };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, [tabs]);
  const select = (i: number, focus = true): void => {
    setActive(i);
    const t = tabs[i];
    if (t) window.history.replaceState(null, "", `#${t.id}`);
    if (focus) refs.current[i]?.focus();
  };
  return (
    <div className="hash-tabs">
      <div role="tablist" aria-label={label} className="tabs-list">
        {tabs.map((t, i) => (
          <button key={t.id} ref={(el) => { refs.current[i] = el; }} role="tab" id={`tab-${t.id}`} aria-controls={`panel-${t.id}`} aria-selected={i === active} tabIndex={i === active ? 0 : -1}
            onClick={() => select(i, false)} onKeyDown={(e) => {
              if (e.key === "ArrowRight") select((i + 1) % tabs.length);
              if (e.key === "ArrowLeft") select((i - 1 + tabs.length) % tabs.length);
              if (e.key === "Home") select(0);
              if (e.key === "End") select(tabs.length - 1);
            }}>{t.label}</button>
        ))}
      </div>
      {tabs.map((t, i) => (
        <div key={t.id} role="tabpanel" id={`panel-${t.id}`} aria-labelledby={`tab-${t.id}`} hidden={i !== active} className="tabs-panel" tabIndex={0}>{t.content}</div>
      ))}
    </div>
  );
}
