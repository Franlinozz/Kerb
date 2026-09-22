"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

/**
 * The app-wide query cache. The wallet layer (wagmi, viem) is not here: it loads as its own
 * island where it is needed (components/WalletLayer.tsx), so reading pages hydrate without it.
 */
export function Providers({ children }: { children: React.ReactNode }): React.ReactElement {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 10_000, retry: 1 } } }),
  );
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
