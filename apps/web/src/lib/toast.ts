/** A tiny toast store. Toasts never carry raw library text: callers pass mapped sentences. */
import { useSyncExternalStore } from "react";

export type ToastTone = "info" | "success" | "error" | "warn";
export interface Toast { id: number; tone: ToastTone; title: string; body?: string | undefined; href?: string | undefined; hrefLabel?: string | undefined; ttl: number | null }

let toasts: Toast[] = [];
let next = 1;
const listeners = new Set<() => void>();
const emit = (): void => listeners.forEach((l) => l());

const TTL: Record<ToastTone, number | null> = { info: 4000, success: 5000, warn: 5000, error: null };

export function toast(t: Omit<Toast, "id" | "ttl"> & { ttl?: number | null }): number {
  const id = next++;
  const ttl = t.ttl === undefined ? TTL[t.tone] : t.ttl;
  toasts = [...toasts.slice(-3), { ...t, id, ttl }];
  emit();
  if (ttl !== null) setTimeout(() => dismiss(id), ttl);
  return id;
}

export function dismiss(id: number): void {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

const EMPTY: Toast[] = [];
export function useToasts(): Toast[] {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => toasts,
    () => EMPTY,
  );
}
