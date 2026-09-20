"use client";

/**
 * Theme toggle. Both themes are first class, so the choice is remembered and the correct one is
 * painted before first paint by the inline script in the layout: no flash of the wrong theme.
 */
import { useEffect, useState } from "react";

type Mode = "dark" | "light";

export function ThemeToggle(): React.ReactElement {
  const [mode, setMode] = useState<Mode>("dark");

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    setMode(current === "light" ? "light" : "dark");
  }, []);

  const flip = (): void => {
    const next: Mode = mode === "dark" ? "light" : "dark";
    setMode(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      window.localStorage.setItem("kerb-theme", next);
    } catch {
      // A browser that refuses storage still gets the theme it just asked for.
    }
  };

  return (
    <button type="button" className="theme-toggle" onClick={flip} aria-label={`Switch to the ${mode === "dark" ? "light" : "dark"} theme`}>
      {mode === "dark" ? "Light" : "Dark"}
    </button>
  );
}
