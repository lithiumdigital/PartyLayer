'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PartyLayerKit } from '@partylayer/react';
import { createCookieStorage } from '@partylayer/session';

/**
 * Client provider boundary. cookieStorage on the client uses document.cookie
 * (synchronous, flash-free), the SAME cookie the server reads in lib/session.ts,
 * so server HTML and client hydration agree.
 *
 * The QueryClient is created with useState so each browser client gets one stable
 * instance (never shared across server requests), the SSR-safe pattern for the
 * App Router. PartyLayer's data hooks (@partylayer/react/query) read this client;
 * the base session surface works without it, but it is set up so the query hooks
 * are ready when you reach for them.
 */
export function Providers({ children }: { children: ReactNode }) {
  const storage = useMemo(() => createCookieStorage(), []);
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <PartyLayerKit network="devnet" appName="{{PROJECT_NAME}}" sessionOptions={{ storage }}>
        {children}
      </PartyLayerKit>
    </QueryClientProvider>
  );
}
