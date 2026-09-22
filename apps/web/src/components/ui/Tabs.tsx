"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/** Tabs with arrow-key movement between tabs (WAI-ARIA tabs pattern). */
export function Tabs({ tabs, initial = 0, label, onChange, value }: { tabs: { id: string; label: string; content: ReactNode }[]; initial?: number; label: string; onChange?: (id: string) => void; value?: string }): React.ReactElement {
  const [active, setActive] = useState(initial);
  // Controlled when a value is given: another part of the page can switch the tab.
  useEffect(() => { if (value === undefined) return; const i = tabs.findIndex((t) => t.id === value); if (i >= 0) setActive(i); }, [value, tabs]);
  const base = useId();
  // A panel mounts the first time it is shown and stays mounted after, so its state survives a
  // switch; panels nobody opens never hydrate.
  const [seen, setSeen] = useState<Set<number>>(() => new Set([initial]));
  useEffect(() => { setSeen((s) => (s.has(active) ? s : new Set(s).add(active))); }, [active]);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const select = (i: number): void => { setActive(i); refs.current[i]?.focus(); const t = tabs[i]; if (t && onChange) onChange(t.id); };
  return (
    <div>
      <div role="tablist" aria-label={label} className="tabs-list">
        {tabs.map((t, i) => (
          <button
            key={t.id} ref={(el) => { refs.current[i] = el; }} role="tab" id={`${base}-t-${i}`} aria-controls={`${base}-p-${i}`}
            aria-selected={i === active} tabIndex={i === active ? 0 : -1} onClick={() => select(i)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") select((i + 1) % tabs.length);
              if (e.key === "ArrowLeft") select((i - 1 + tabs.length) % tabs.length);
            }}
          >{t.label}</button>
        ))}
      </div>
      {tabs.map((t, i) => (
        <div key={t.id} role="tabpanel" id={`${base}-p-${i}`} aria-labelledby={`${base}-t-${i}`} hidden={i !== active} className="tabs-panel" tabIndex={0}>
          {seen.has(i) || i === active ? t.content : null}
        </div>
      ))}
    </div>
  );
}
