"use client";
/**
 * Loads the guided tour only after the page is idle (performance: V3-10 Lighthouse). The tour's
 * code is not in the first bundle; a "kerb-tour" event before it loads is replayed once it does.
 */
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const Tour = dynamic(() => import("./Tour").then((m) => m.Tour), { ssr: false });

export function TourMount(): React.ReactElement | null {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let pending = false;
    const early = (): void => { pending = true; (window as Window & { __kerbTourAsked?: boolean }).__kerbTourAsked = true; setReady(true); };
    window.addEventListener("kerb-tour", early, { once: true });
    const go = (): void => setReady(true);
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    const id = w.requestIdleCallback ? w.requestIdleCallback(go, { timeout: 4000 }) : window.setTimeout(go, 2500);
    return () => { window.removeEventListener("kerb-tour", early); if (!w.requestIdleCallback) clearTimeout(id); void pending; };
  }, []);
  return ready ? <Tour /> : null;
}
