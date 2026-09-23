"use client";
/**
 * Scroll reveal for Home sections (V3, operator request). Progressive: the attribute that hides a
 * section is added by script, so without JavaScript, and under reduced motion, everything is simply
 * visible. A section already on screen at load is never hidden.
 */
import { useEffect } from "react";

export function RevealOnScroll({ selector = ".home-section" }: { selector?: string }): null {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return undefined;
    const els = [...document.querySelectorAll<HTMLElement>(selector)].filter((el) => el.getBoundingClientRect().top > window.innerHeight);
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { e.target.setAttribute("data-in", ""); io.unobserve(e.target); }
    }, { rootMargin: "0px 0px -8% 0px" });
    for (const el of els) { el.setAttribute("data-reveal", ""); io.observe(el); }
    return () => io.disconnect();
  }, [selector]);
  return null;
}
