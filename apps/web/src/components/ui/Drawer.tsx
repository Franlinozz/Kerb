"use client";
import { X } from "lucide-react";
import { useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { IconButton } from "./IconButton";
import { Mark } from "./Mark";
import { Wordmark } from "./Wordmark";
import { useFocusTrap } from "./useFocusTrap";

export function Drawer({ open, onClose, label, children }: { open: boolean; onClose: () => void; label: string; children: ReactNode }): React.ReactElement | null {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, open, onClose);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <>
      <div className="drawer-scrim" onClick={onClose} aria-hidden="true" />
      <div ref={ref} className="drawer" role="dialog" aria-modal="true" aria-label={label}>
        <div className="drawer-head">
          <span className="brand" aria-label="Kerb"><Mark /><Wordmark /></span>
          <IconButton label="Close menu" onClick={onClose}><X /></IconButton>
        </div>
        {children}
      </div>
    </>,
    document.body,
  );
}
