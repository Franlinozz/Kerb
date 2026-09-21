"use client";
import { Check, Clock, Moon, Sun } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PUBLIC_API } from "@/lib/api";
import { applyMode, readMode, THEME_KEY, type ThemeMode } from "@/lib/theme";

const OPTIONS: { mode: ThemeMode; label: string; Icon: typeof Sun }[] = [
  { mode: "night", label: "Night", Icon: Moon },
  { mode: "day", label: "Day", Icon: Sun },
  { mode: "market", label: "Market time", Icon: Clock },
];

/** Is the New York regular session open, holidays included? Asks the Clock; null if it cannot. */
async function nyOpenFromClock(): Promise<boolean | null> {
  try {
    const r = await fetch(`${PUBLIC_API}/v1/clock/196/KOx`, { signal: AbortSignal.timeout(6000) });
    if (!r.ok) return null;
    const c = (await r.json()) as { clock?: { session?: { kind?: string } } };
    return c.clock?.session?.kind ? c.clock.session.kind === "REGULAR" : null;
  } catch { return null; }
}

export function useThemeMode(): [ThemeMode, (m: ThemeMode) => void] {
  const [mode, setMode] = useState<ThemeMode>("night");
  useEffect(() => { setMode(readMode()); }, []);
  // Market time re-resolves every minute, against the real calendar when the Clock answers.
  useEffect(() => {
    if (mode !== "market") return;
    let stop = false;
    const tick = async (): Promise<void> => { const open = await nyOpenFromClock(); if (!stop) applyMode("market", open ?? undefined); };
    void tick();
    const t = setInterval(tick, 60_000);
    return () => { stop = true; clearInterval(t); };
  }, [mode]);
  const set = (m: ThemeMode): void => {
    setMode(m);
    try { window.localStorage.setItem(THEME_KEY, m); } catch { /* storage refused */ }
    applyMode(m);
  };
  return [mode, set];
}

export function ThemeMenu(): React.ReactElement {
  const [mode, setMode] = useThemeMode();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent): void => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, [open]);
  const Current = (OPTIONS.find((o) => o.mode === mode) ?? OPTIONS[0])!.Icon;
  return (
    <div className="theme-menu" ref={ref}>
      <button type="button" className="icon-btn" aria-haspopup="menu" aria-expanded={open} aria-label={`Theme: ${mode}. Change theme`} onClick={() => setOpen((o) => !o)}>
        <Current />
      </button>
      {open ? (
        <div className="popover" role="menu" aria-label="Theme">
          {OPTIONS.map(({ mode: m, label, Icon }) => (
            <button key={m} type="button" role="menuitemradio" aria-checked={m === mode} onClick={() => { setMode(m); setOpen(false); }}>
              <Icon />{label}{m === mode ? <Check className="check" /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** The same three choices as a flat radio row, for the mobile drawer. */
export function ThemeChoices(): React.ReactElement {
  const [mode, setMode] = useThemeMode();
  return (
    <div className="row" role="radiogroup" aria-label="Theme">
      {OPTIONS.map(({ mode: m, label, Icon }) => (
        <button key={m} type="button" role="radio" aria-checked={m === mode} className={`btn btn-sm${m === mode ? " btn-primary" : ""}`} onClick={() => setMode(m)}>
          <Icon size={15} />{label}
        </button>
      ))}
    </div>
  );
}
