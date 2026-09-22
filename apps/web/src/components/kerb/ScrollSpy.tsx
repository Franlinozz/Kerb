"use client";
import { useEffect, useState } from "react";

/** A sticky contents rail that highlights the last section whose heading has passed the header. */
export function ScrollSpy({ items }: { items: { id: string; label: string }[] }): React.ReactElement {
  const [active, setActive] = useState(items[0]?.id ?? "");
  useEffect(() => {
    let raf = 0;
    const pick = (): void => {
      raf = 0;
      let cur = items[0]?.id ?? "";
      for (const i of items) {
        const el = document.getElementById(i.id);
        if (el && el.getBoundingClientRect().top <= 140) cur = i.id;
      }
      // At the very bottom the last short sections can never reach the line: take the last.
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) cur = items[items.length - 1]?.id ?? cur;
      setActive(cur);
    };
    const on = (): void => { if (!raf) raf = requestAnimationFrame(pick); };
    pick();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => { window.removeEventListener("scroll", on); window.removeEventListener("resize", on); if (raf) cancelAnimationFrame(raf); };
  }, [items]);
  return (
    <nav className="spy" aria-label="On this page">
      <span className="t-label">Contents</span>
      <ol role="list">
        {items.map((i) => <li key={i.id}><a href={`#${i.id}`} aria-current={active === i.id ? "location" : undefined} className="plain">{i.label}</a></li>)}
      </ol>
    </nav>
  );
}
