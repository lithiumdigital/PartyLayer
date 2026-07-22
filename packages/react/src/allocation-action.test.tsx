// @vitest-environment jsdom
/**
 * useAllocationAction tests: the funded-allocation action sibling of
 * useTransferInstructionAction, a CIP-0056 typed Model 2 mutation for the standard
 * Allocation_ExecuteTransfer / _Cancel / _Withdraw choices. Mirrors the
 * transfer-instruction-action test. Covers: the hook wraps the dApp's submit
 * fetcher and exposes the mutation shape plus submitAction/submitActionAsync
 * aliases; the fetcher is called with the typed request; each of the three action
 * kinds passes through verbatim; a resolved result flows through; a rejected submit
 * yields isError; the mutationKey uses allocationAction; and passthrough mutation
 * options (onSuccess) fire. Model 2: rendered with only a QueryClientProvider.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import {
  useAllocationAction,
  type AllocationActionRequest,
  type AllocationActionKind,
} from './allocation-action';
import { partyLayerKeys } from './query-keys';

const request: AllocationActionRequest = {
  allocationCid: '00allocationCid',
  action: 'executeTransfer',
  meta: { note: 'settle-now' },
};

interface MyResult {
  updateId: string;
  status: 'pending' | 'completed' | 'failed';
}
const result: MyResult = { updateId: '1220ff', status: 'completed' };

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('useAllocationAction (CIP-0056 typed funded-allocation action, Model 2 mutation)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes the mutation shape + aliases (submitAction/submitActionAsync)', () => {
    const submit = vi.fn().mockResolvedValue(result);
    const { result: r } = renderHook(() => useAllocationAction<MyResult>({ submit }), { wrapper });
    expect(typeof r.current.submitAction).toBe('function');
    expect(typeof r.current.submitActionAsync).toBe('function');
    expect(typeof r.current.mutate).toBe('function');
    expect(r.current.isPending).toBe(false);
  });

  it('submitAction(request) calls the dApp submit fetcher with the typed request; data surfaces', async () => {
    const submit = vi.fn().mockResolvedValue(result);
    // Rendered with only QueryClientProvider (no PartyLayerProvider): if the hook
    // used usePartyLayer it would throw here. It resolves, proving it does not.
    const { result: r } = renderHook(() => useAllocationAction<MyResult>({ submit }), { wrapper });

    act(() => r.current.submitAction(request));
    await waitFor(() => expect(r.current.isSuccess).toBe(true));
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledWith(request);
    expect(r.current.data).toEqual(result);
    expect(submit.mock.calls[0][0].allocationCid).toBe('00allocationCid');
    expect(submit.mock.calls[0][0].action).toBe('executeTransfer');
  });

  it('passes each of the three action kinds through verbatim', async () => {
    const kinds: AllocationActionKind[] = ['executeTransfer', 'cancel', 'withdraw'];
    for (const action of kinds) {
      const submit = vi.fn().mockResolvedValue(result);
      const { result: r } = renderHook(() => useAllocationAction<MyResult>({ submit }), { wrapper });
      const req: AllocationActionRequest = { allocationCid: '00cid', action };
      await act(async () => { await r.current.submitActionAsync(req); });
      expect(submit).toHaveBeenCalledWith(req);
      expect(submit.mock.calls[0][0].action).toBe(action);
    }
  });

  it('isPending toggles true while submitting, then false', async () => {
    let resolve: (v: MyResult) => void = () => {};
    const submit = vi.fn().mockReturnValue(new Promise((res) => { resolve = res; }));
    const { result: r } = renderHook(() => useAllocationAction<MyResult>({ submit }), { wrapper });

    act(() => r.current.submitAction(request));
    await waitFor(() => expect(r.current.isPending).toBe(true));
    act(() => resolve(result));
    await waitFor(() => expect(r.current.isPending).toBe(false));
    expect(r.current.isSuccess).toBe(true);
  });

  it('submitActionAsync resolves with the result and throws on error', async () => {
    const submit = vi.fn().mockResolvedValue(result);
    const { result: r } = renderHook(() => useAllocationAction<MyResult>({ submit }), { wrapper });
    let out: MyResult | undefined;
    await act(async () => { out = await r.current.submitActionAsync(request); });
    expect(out).toEqual(result);

    const submitFail = vi.fn().mockRejectedValue(new Error('cancel failed'));
    const { result: r2 } = renderHook(() => useAllocationAction<MyResult>({ submit: submitFail }), { wrapper });
    await expect(act(async () => { await r2.current.submitActionAsync(request); })).rejects.toThrow('cancel failed');
  });

  it('surfaces a fetcher rejection via isError/error (does not swallow)', async () => {
    const boom = new Error('registry allocation choice context fetch failed');
    const submit = vi.fn().mockRejectedValue(boom);
    const { result: r } = renderHook(() => useAllocationAction<MyResult>({ submit }), { wrapper });

    act(() => r.current.submitAction(request));
    await waitFor(() => expect(r.current.isError).toBe(true));
    expect(r.current.error).toBe(boom);
  });

  it('uses the allocationAction mutationKey (distinct from transferInstructionAction)', () => {
    const submit = vi.fn().mockResolvedValue(result);
    const { result: r } = renderHook(() => useAllocationAction<MyResult>({ submit }), { wrapper });
    expect(r.current.mutate).toBeTypeOf('function');
    expect(partyLayerKeys.allocationAction()).toEqual(['partylayer', 'allocationAction']);
    expect(partyLayerKeys.allocationAction()).not.toEqual(partyLayerKeys.transferInstructionAction());
  });

  it('forwards pass-through mutation options (onSuccess fires with result + request)', async () => {
    const onSuccess = vi.fn();
    const submit = vi.fn().mockResolvedValue(result);
    const { result: r } = renderHook(
      () => useAllocationAction<MyResult>({ submit, mutation: { onSuccess } }),
      { wrapper },
    );
    act(() => r.current.submitAction(request));
    await waitFor(() => expect(r.current.isSuccess).toBe(true));
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onSuccess.mock.calls[0][0]).toEqual(result);
    expect(onSuccess.mock.calls[0][1]).toEqual(request);
  });
});
