// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toTrafficCost, type CostEstimation } from '@partylayer/core';

import { useTransactionCostEstimate } from './use-transaction-cost-estimate';
import { partyLayerKeys } from './query-keys';

const estimate: CostEstimation = {
  estimationTimestamp: '2026-06-26T00:00:00Z',
  confirmationRequestTrafficCostEstimation: toTrafficCost('100'),
  confirmationResponseTrafficCostEstimation: toTrafficCost('200'),
  totalTrafficCostEstimation: toTrafficCost('300'),
};

/**
 * Fresh QueryClient per call; retries off so error/loading tests are deterministic.
 * NOTE: only a QueryClientProvider — deliberately NO PartyLayerProvider. The hook
 * works here purely because it never touches the PartyLayer client (Model 2).
 */
function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}

describe('useTransactionCostEstimate (v2, dApp-supplied fetcher)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes the TanStack query shape + alias (costEstimate === data) on success', async () => {
    const fetcher = vi.fn().mockResolvedValue(estimate);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useTransactionCostEstimate({ estimate: fetcher }), { wrapper });
    expect(typeof result.current.refetch).toBe('function');
    expect('data' in result.current).toBe(true);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.costEstimate).toEqual(estimate); // alias === data
    expect(result.current.data).toEqual(estimate);
  });

  it('queryFn calls the provided estimate fetcher (no PartyLayer client involved)', async () => {
    const fetcher = vi.fn().mockResolvedValue(estimate);
    const { wrapper } = makeWrapper();
    // Renders with only QueryClientProvider (no PartyLayerProvider): if the hook
    // used usePartyLayer it would throw here. It resolves, proving it does not.
    const { result } = renderHook(() => useTransactionCostEstimate({ estimate: fetcher }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetcher).toHaveBeenCalledTimes(1);
    // The fetcher receives an AbortSignal.
    expect(fetcher.mock.calls[0][0]).toBeInstanceOf(AbortSignal);
    expect(result.current.costEstimate).toEqual(estimate);
  });

  it('null estimate (estimation disabled/absent): costEstimate === null, isSuccess true', async () => {
    const fetcher = vi.fn().mockResolvedValue(null);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useTransactionCostEstimate({ estimate: fetcher }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.costEstimate).toBeNull();
    expect(result.current.isError).toBe(false); // null is graceful, not an error
  });

  it('isLoading/isPending toggles true while pending, then false', async () => {
    let resolve: (v: CostEstimation | null) => void = () => {};
    const fetcher = vi.fn().mockReturnValue(new Promise((r) => { resolve = r; }));
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useTransactionCostEstimate({ estimate: fetcher }), { wrapper });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isPending).toBe(true);
    act(() => resolve(estimate));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isSuccess).toBe(true);
  });

  it('surfaces an error via isError/error (does not swallow)', async () => {
    const boom = new Error('prepare failed');
    const fetcher = vi.fn().mockRejectedValue(boom);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useTransactionCostEstimate({ estimate: fetcher }), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(boom);
    expect(result.current.costEstimate).toBeUndefined();
  });

  it('different input values produce different queryKeys (independent caching)', async () => {
    const fetcherA = vi.fn().mockResolvedValue(estimate);
    const otherEstimate: CostEstimation = { ...estimate, totalTrafficCostEstimation: toTrafficCost('999') };
    const fetcherB = vi.fn().mockResolvedValue(otherEstimate);
    const { queryClient, wrapper } = makeWrapper();

    const a = renderHook(() => useTransactionCostEstimate({ estimate: fetcherA, input: 'tx-A' }), { wrapper });
    await waitFor(() => expect(a.result.current.isSuccess).toBe(true));
    const b = renderHook(() => useTransactionCostEstimate({ estimate: fetcherB, input: 'tx-B' }), { wrapper });
    await waitFor(() => expect(b.result.current.isSuccess).toBe(true));

    // both fetchers ran (no cache collision between the two inputs)
    expect(fetcherA).toHaveBeenCalledTimes(1);
    expect(fetcherB).toHaveBeenCalledTimes(1);
    // each cached under its own input-scoped key
    expect(queryClient.getQueryData(partyLayerKeys.transactionCostEstimate({ input: 'tx-A' }))).toEqual(estimate);
    expect(queryClient.getQueryData(partyLayerKeys.transactionCostEstimate({ input: 'tx-B' }))).toEqual(otherEstimate);
  });
});
