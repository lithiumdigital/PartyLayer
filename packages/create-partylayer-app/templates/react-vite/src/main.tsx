import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './index.css';

// PartyLayer's data hooks (the `@partylayer/react/query` entrypoint:
// useDamlContract, useChoice, the cost hooks) are built on TanStack Query, so
// they need a QueryClient in context. Create one here and wrap the app. The base
// session surface (PartyLayerKit, ConnectButton, useAccount) works without it,
// but having it set up means the query hooks are ready when you reach for them.
const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
