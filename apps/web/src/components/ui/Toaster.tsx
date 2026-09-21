"use client";
import { X } from "lucide-react";
import { dismiss, useToasts } from "@/lib/toast";

export function Toaster(): React.ReactElement {
  const toasts = useToasts();
  return (
    <div className="toaster" aria-live="polite" aria-relevant="additions">
      {toasts.map((t) => (
        <div key={t.id} className="toast" data-tone={t.tone} role={t.tone === "error" ? "alert" : "status"}>
          <span className="toast-title">{t.title}</span>
          <button type="button" className="icon-btn" onClick={() => dismiss(t.id)} aria-label="Dismiss"><X size={14} /></button>
          {t.body || t.href ? (
            <span className="toast-body">
              {t.body}
              {t.href ? <> <a href={t.href} target="_blank" rel="noreferrer">{t.hrefLabel ?? "View on OKLink"}</a></> : null}
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}
