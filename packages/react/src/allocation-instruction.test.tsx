// @vitest-environment jsdom
/**
 * useAllocationInstruction tests: the allocation sibling of useTransferInstruction,
 * a CIP-0056 typed Model 2 mutation for AllocationFactory_Allocate. Mirrors the
 * transfer-instruction test. Covers: the hook wraps the dApp's submit fetcher and
 * exposes the mutation shape plus submitAllocation/submitAllocationAsync aliases;
 * the fetcher is called with the typed request (expectedAdmin, the reused
 * TokenAllocationSpecification shape, inputHoldingCids including an empty case); a
 * resolved result flows through; a rejected submit yields isError; the mutationKey
 * uses allocationInstruction; and passthrough mutation options (onSuccess) fire.
 * Model 2: rendered with only a QueryClientProvider (no PartyLayerProvider).
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { useAllocationInstruction, type AllocationInstructionRequest } from './allocation-instruction';
import type { TokenAllocationSpecification } from './token-allocations';
import { partyLayerKeys } from './query-keys';

const spec: TokenAllocationSpecification = {
  settlement: {
    executor: 'party::executor-1',
    settlementRef: { id: 'settlement-1', cid: '00settlementCid' },
    requestedAt: '2026-07-22T00:00:00Z',
    allocateBefore: '2026-07-22T01:00:00Z',
    settleBefore: '2026-07-22T02:00:00Z',
  },
  transferLegId: 'leg-1',
  transferLeg: {
    sender: 'party::sender-1',
    receiver: 'party::receiver-1',
    amount: '42.5',
    instrumentId: { admin: 'party::registry-admin', id: 'USDC' },
  },
};

const request: AllocationInstructionRequest = {
  expectedAdmin: 'party::registry-admin',
  allocation: spec,
  requestedAt: '2026-07-22T00:00:00Z',
  inputHoldingCids: ['00holdingA', '00holdingB'],
  meta: { note: 'settlement-leg-1' },
};

interface MyResult {
  updateId: string;
  status: 'pending' | 'completed' | 'failed';
}
const result: MyResult = { updateId: '1220ff', status: 'pending' };

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('useAllocationInstruction (CIP-0056 typed allocation create, Model 2 mutation)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes the mutation shape + aliases (submitAllocation/submitAllocationAsync)', () => {
    const submit = vi.fn().mockResolvedValue(result);
    const { result: r } = renderHook(() => useAllocationInstruction<MyResult>({ submit }), { wrapper });
    expect(typeof r.current.submitAllocation).toBe('function');
    expect(typeof r.current.submitAllocationAsync).toBe('function');
    expect(typeof r.current.mutate).toBe('function');
    expect(r.current.isPending).toBe(false);
  });

  it('submitAllocation(request) calls the dApp submit fetcher with the typed request; data surfaces', async () => {
    const submit = vi.fn().mockResolvedValue(result);
    // Rendered with only QueryClientProvider (no PartyLayerProvider): if the hook
    // used usePartyLayer it would throw here. It resolves, proving it does not.
    const { result: r } = renderHook(() => useAllocationInstruction<MyResult>({ submit }), { wrapper });

    act(() => r.current.submitAllocation(request));
    await waitFor(() => expect(r.current.isSuccess).toBe(true));
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledWith(request);
    expect(r.current.data).toEqual(result);
    // Typed fields flow through: expectedAdmin, reused spec, inputHoldingCids.
    expect(submit.mock.calls[0][0].expectedAdmin).toBe('party::registry-admin');
    expect(submit.mock.calls[0][0].allocation.transferLeg.instrumentId.id).toBe('USDC');
    expect(submit.mock.calls[0][0].inputHoldingCids).toEqual(['00holdingA', '00holdingB']);
  });

  it('accepts an empty inputHoldingCids (off-ledger/auto-selecting registries)', async () => {
    const submit = vi.fn().mockResolvedValue(result);
    const { result: r } = renderHook(() => useAllocationInstruction<MyResult>({ submit }), { wrapper });
    const emptyHoldings: AllocationInstructionRequest = { ...request, inputHoldingCids: [] };
    await act(async () => { await r.current.submitAllocationAsync(emptyHoldings); });
    expect(submit).toHaveBeenCalledWith(emptyHoldings);
    expect(submit.mock.calls[0][0].inputHoldingCids).toEqual([]);
  });

  it('isPending toggles true while submitting, then false', async () => {
    let resolve: (v: MyResult) => void = () => {};
    const submit = vi.fn().mockReturnValue(new Promise((res) => { resolve = res; }));
    const { result: r } = renderHook(() => useAllocationInstruction<MyResult>({ submit }), { wrapper });

    act(() => r.current.submitAllocation(request));
    await waitFor(() => expect(r.current.isPending).toBe(true));
    act(() => resolve(result));
    await waitFor(() => expect(r.current.isPending).toBe(false));
    expect(r.current.isSuccess).toBe(true);
  });

  it('submitAllocationAsync resolves with the result and throws on error', async () => {
    const submit = vi.fn().mockResolvedValue(result);
    const { result: r } = renderHook(() => useAllocationInstruction<MyResult>({ submit }), { wrapper });
    let out: MyResult | undefined;
    await act(async () => { out = await r.current.submitAllocationAsync(request); });
    expect(out).toEqual(result);

    const submitFail = vi.fn().mockRejectedValue(new Error('allocate failed'));
    const { result: r2 } = renderHook(() => useAllocationInstruction<MyResult>({ submit: submitFail }), { wrapper });
    await expect(act(async () => { await r2.current.submitAllocationAsync(request); })).rejects.toThrow('allocate failed');
  });

  it('surfaces a fetcher rejection via isError/error (does not swallow)', async () => {
    const boom = new Error('registry getAllocationFactory failed');
    const submit = vi.fn().mockRejectedValue(boom);
    const { result: r } = renderHook(() => useAllocationInstruction<MyResult>({ submit }), { wrapper });

    act(() => r.current.submitAllocation(request));
    await waitFor(() => expect(r.current.isError).toBe(true));
    expect(r.current.error).toBe(boom);
  });

  it('uses the allocationInstruction mutationKey (distinct from transferInstruction)', () => {
    const submit = vi.fn().mockResolvedValue(result);
    const { result: r } = renderHook(() => useAllocationInstruction<MyResult>({ submit }), { wrapper });
    expect(r.current.mutate).toBeTypeOf('function');
    expect(partyLayerKeys.allocationInstruction()).toEqual(['partylayer', 'allocationInstruction']);
    expect(partyLayerKeys.allocationInstruction()).not.toEqual(partyLayerKeys.transferInstruction());
  });

  it('forwards pass-through mutation options (onSuccess fires with result + request)', async () => {
    const onSuccess = vi.fn();
    const submit = vi.fn().mockResolvedValue(result);
    const { result: r } = renderHook(
      () => useAllocationInstruction<MyResult>({ submit, mutation: { onSuccess } }),
      { wrapper },
    );
    act(() => r.current.submitAllocation(request));
    await waitFor(() => expect(r.current.isSuccess).toBe(true));
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onSuccess.mock.calls[0][0]).toEqual(result);
    expect(onSuccess.mock.calls[0][1]).toEqual(request);
  });
});
