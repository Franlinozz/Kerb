"use client";
import { useId, useRef, useState, type ReactNode } from "react";

/** Tabs with arrow-key movement between tabs (WAI-ARIA tabs pattern). */
export function Tabs({ tabs, initial = 0, label, onChange }: { tabs: { id: string; label: string; content: ReactNode }[]; initial?: number; label: string; onChange?: (id: string) => void }): React.ReactElement {
  const [active, setActive] = useState(initial);
  const base = useId();
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
          {t.content}
        </div>
      ))}
    </div>
  );
}
