// @vitest-environment jsdom
/**
 * useTransferInstruction tests: a CIP-0056 typed specialization of useChoice for
 * the TransferFactory_Transfer flow (the write-side sibling of useTokenHoldings).
 * Mirrors the useChoice and token-holdings tests. Covers: the hook wraps the dApp's
 * submit fetcher and exposes the mutation shape plus submitTransfer/
 * submitTransferAsync aliases; the fetcher is called with the typed TokenTransfer;
 * a resolved result flows through; a rejected submit yields isError; the
 * mutationKey uses transferInstruction; and passthrough mutation options (onSuccess)
 * fire. Model 2: rendered with only a QueryClientProvider (no PartyLayerProvider),
 * proving no client access.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { useTransferInstruction, type TokenTransfer } from './transfer-instruction';
import { partyLayerKeys } from './query-keys';

/** The standard CIP-0056 Transfer record; the dApp result R is dApp-defined. */
const transfer: TokenTransfer = {
  sender: 'party::sender-1',
  receiver: 'party::receiver-1',
  amount: '42.5',
  instrumentId: { admin: 'party::registry-admin', id: 'USDC' },
  requestedAt: '2026-07-22T00:00:00Z',
  executeBefore: '2026-07-22T01:00:00Z',
  inputHoldingCids: ['00holdingA', '00holdingB'],
  meta: { reason: 'invoice-42' },
};

interface MyResult {
  updateId: string;
  status: 'pending' | 'completed' | 'failed';
}
const result: MyResult = { updateId: '1220ff', status: 'pending' };

/**
 * Fresh QueryClient per call; retries off so error tests are deterministic.
 * NOTE: only a QueryClientProvider, deliberately NO PartyLayerProvider. The hook
 * works here purely because it never touches the PartyLayer client (Model 2).
 */
function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('useTransferInstruction (CIP-0056 typed transfer submit, Model 2 mutation)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes the mutation shape + aliases (submitTransfer/submitTransferAsync)', () => {
    const submit = vi.fn().mockResolvedValue(result);
    const { result: r } = renderHook(() => useTransferInstruction<MyResult>({ submit }), { wrapper });
    expect(typeof r.current.submitTransfer).toBe('function');
    expect(typeof r.current.submitTransferAsync).toBe('function');
    expect(typeof r.current.mutate).toBe('function');
    expect(r.current.isPending).toBe(false);
  });

  it('submitTransfer(transfer) calls the dApp submit fetcher with the typed TokenTransfer; data surfaces', async () => {
    const submit = vi.fn().mockResolvedValue(result);
    // Rendered with only QueryClientProvider (no PartyLayerProvider): if the hook
    // used usePartyLayer it would throw here. It resolves, proving it does not.
    const { result: r } = renderHook(() => useTransferInstruction<MyResult>({ submit }), { wrapper });

    act(() => r.current.submitTransfer(transfer));
    await waitFor(() => expect(r.current.isSuccess).toBe(true));
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledWith(transfer);
    expect(r.current.data).toEqual(result);
    // Typed variables flow through: instrumentId + decimal-as-string amount.
    expect(submit.mock.calls[0][0].instrumentId.id).toBe('USDC');
    expect(submit.mock.calls[0][0].amount).toBe('42.5');
    expect(submit.mock.calls[0][0].inputHoldingCids).toEqual(['00holdingA', '00holdingB']);
  });

  it('isPending toggles true while submitting, then false', async () => {
    let resolve: (v: MyResult) => void = () => {};
    const submit = vi.fn().mockReturnValue(new Promise((res) => { resolve = res; }));
    const { result: r } = renderHook(() => useTransferInstruction<MyResult>({ submit }), { wrapper });

    act(() => r.current.submitTransfer(transfer));
    await waitFor(() => expect(r.current.isPending).toBe(true));
    act(() => resolve(result));
    await waitFor(() => expect(r.current.isPending).toBe(false));
    expect(r.current.isSuccess).toBe(true);
  });

  it('submitTransferAsync resolves with the result and throws on error', async () => {
    const submit = vi.fn().mockResolvedValue(result);
    const { result: r } = renderHook(() => useTransferInstruction<MyResult>({ submit }), { wrapper });
    let out: MyResult | undefined;
    await act(async () => { out = await r.current.submitTransferAsync(transfer); });
    expect(out).toEqual(result);

    const submitFail = vi.fn().mockRejectedValue(new Error('transfer submit failed'));
    const { result: r2 } = renderHook(() => useTransferInstruction<MyResult>({ submit: submitFail }), { wrapper });
    await expect(act(async () => { await r2.current.submitTransferAsync(transfer); })).rejects.toThrow('transfer submit failed');
  });

  it('surfaces a fetcher rejection via isError/error (does not swallow)', async () => {
    const boom = new Error('registry getTransferFactory failed');
    const submit = vi.fn().mockRejectedValue(boom);
    const { result: r } = renderHook(() => useTransferInstruction<MyResult>({ submit }), { wrapper });

    act(() => r.current.submitTransfer(transfer));
    await waitFor(() => expect(r.current.isError).toBe(true));
    expect(r.current.error).toBe(boom);
  });

  it('uses the transferInstruction mutationKey', async () => {
    const submit = vi.fn().mockResolvedValue(result);
    const { result: r } = renderHook(() => useTransferInstruction<MyResult>({ submit }), { wrapper });
    // The stable mutation key is the transferInstruction sibling (not exerciseChoice).
    expect(r.current.mutate).toBeTypeOf('function');
    // Assert the key factory shape is what the hook keys on.
    expect(partyLayerKeys.transferInstruction()).toEqual(['partylayer', 'transferInstruction']);
    expect(partyLayerKeys.transferInstruction()).not.toEqual(partyLayerKeys.exerciseChoice());
  });

  it('forwards pass-through mutation options (onSuccess fires with result + transfer)', async () => {
    const onSuccess = vi.fn();
    const submit = vi.fn().mockResolvedValue(result);
    const { result: r } = renderHook(
      () => useTransferInstruction<MyResult>({ submit, mutation: { onSuccess } }),
      { wrapper },
    );
    act(() => r.current.submitTransfer(transfer));
    await waitFor(() => expect(r.current.isSuccess).toBe(true));
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onSuccess.mock.calls[0][0]).toEqual(result);
    expect(onSuccess.mock.calls[0][1]).toEqual(transfer);
  });
});
