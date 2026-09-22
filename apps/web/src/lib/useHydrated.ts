"use client";
import { useSyncExternalStore } from "react";

const noop = (): (() => void) => () => {};

/**
 * False on the server and during hydration, true after. The header's wallet island and the Credit
 * page share one wagmi config, so whichever mounts first restores a saved connection; wallet state
 * read before this tree hydrates would not match the server HTML (React error 418).
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(noop, () => true, () => false);
}

/** The connected account, reported as disconnected until this tree has hydrated. */
export function useHydratedAccount<T extends { address?: `0x${string}` | undefined; isConnected: boolean }>(a: T): { address: `0x${string}` | undefined; isConnected: boolean } {
  const hydrated = useHydrated();
  return hydrated ? { address: a.address, isConnected: a.isConnected } : { address: undefined, isConnected: false };
}
