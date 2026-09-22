"use client";
import { useEffect, useState } from "react";

/** A sticky contents rail that highlights the section in view. */
export function ScrollSpy({ items }: { items: { id: string; label: string }[] }): React.ReactElement {
  const [active, setActive] = useState(items[0]?.id ?? "");
  useEffect(() => {
    const els = items.map((i) => document.getElementById(i.id)).filter((e): e is HTMLElement => e !== null);
    const io = new IntersectionObserver((entries) => {
      const seen = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (seen) setActive(seen.target.id);
    }, { rootMargin: "-80px 0px -60% 0px" });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
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
