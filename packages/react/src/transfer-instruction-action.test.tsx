// @vitest-environment jsdom
/**
 * useTransferInstructionAction tests: the completion sibling of useTransferInstruction,
 * a CIP-0056 typed Model 2 mutation for the standard TransferInstruction_Accept /
 * _Reject / _Withdraw choices. Mirrors the transfer-instruction test. Covers: the
 * hook wraps the dApp's submit fetcher and exposes the mutation shape plus
 * submitAction/submitActionAsync aliases; the fetcher is called with the typed
 * request; each of the three action kinds passes through verbatim; a resolved
 * result flows through; a rejected submit yields isError; the mutationKey uses
 * transferInstructionAction; and passthrough mutation options (onSuccess) fire.
 * Model 2: rendered with only a QueryClientProvider (no PartyLayerProvider).
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import {
  useTransferInstructionAction,
  type TransferInstructionActionRequest,
  type TransferInstructionActionKind,
} from './transfer-instruction-action';
import { partyLayerKeys } from './query-keys';

const request: TransferInstructionActionRequest = {
  instructionCid: '00instructionCid',
  action: 'accept',
  meta: { note: 'invoice-42' },
};

interface MyResult {
  updateId: string;
  status: 'pending' | 'completed' | 'failed';
}
const result: MyResult = { updateId: '1220ff', status: 'completed' };

/**
 * Fresh QueryClient per call; retries off so error tests are deterministic.
 * NOTE: only a QueryClientProvider, deliberately NO PartyLayerProvider. The hook
 * works here purely because it never touches the PartyLayer client (Model 2).
 */
function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('useTransferInstructionAction (CIP-0056 typed transfer completion, Model 2 mutation)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes the mutation shape + aliases (submitAction/submitActionAsync)', () => {
    const submit = vi.fn().mockResolvedValue(result);
    const { result: r } = renderHook(() => useTransferInstructionAction<MyResult>({ submit }), { wrapper });
    expect(typeof r.current.submitAction).toBe('function');
    expect(typeof r.current.submitActionAsync).toBe('function');
    expect(typeof r.current.mutate).toBe('function');
    expect(r.current.isPending).toBe(false);
  });

  it('submitAction(request) calls the dApp submit fetcher with the typed request; data surfaces', async () => {
    const submit = vi.fn().mockResolvedValue(result);
    // Rendered with only QueryClientProvider (no PartyLayerProvider): if the hook
    // used usePartyLayer it would throw here. It resolves, proving it does not.
    const { result: r } = renderHook(() => useTransferInstructionAction<MyResult>({ submit }), { wrapper });

    act(() => r.current.submitAction(request));
    await waitFor(() => expect(r.current.isSuccess).toBe(true));
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledWith(request);
    expect(r.current.data).toEqual(result);
    expect(submit.mock.calls[0][0].instructionCid).toBe('00instructionCid');
    expect(submit.mock.calls[0][0].action).toBe('accept');
  });

  it('passes each of the three action kinds through verbatim', async () => {
    const kinds: TransferInstructionActionKind[] = ['accept', 'reject', 'withdraw'];
    for (const action of kinds) {
      const submit = vi.fn().mockResolvedValue(result);
      const { result: r } = renderHook(() => useTransferInstructionAction<MyResult>({ submit }), { wrapper });
      const req: TransferInstructionActionRequest = { instructionCid: '00cid', action };
      await act(async () => { await r.current.submitActionAsync(req); });
      expect(submit).toHaveBeenCalledWith(req);
      expect(submit.mock.calls[0][0].action).toBe(action);
    }
  });

  it('isPending toggles true while submitting, then false', async () => {
    let resolve: (v: MyResult) => void = () => {};
    const submit = vi.fn().mockReturnValue(new Promise((res) => { resolve = res; }));
    const { result: r } = renderHook(() => useTransferInstructionAction<MyResult>({ submit }), { wrapper });

    act(() => r.current.submitAction(request));
    await waitFor(() => expect(r.current.isPending).toBe(true));
    act(() => resolve(result));
    await waitFor(() => expect(r.current.isPending).toBe(false));
    expect(r.current.isSuccess).toBe(true);
  });

  it('submitActionAsync resolves with the result and throws on error', async () => {
    const submit = vi.fn().mockResolvedValue(result);
    const { result: r } = renderHook(() => useTransferInstructionAction<MyResult>({ submit }), { wrapper });
    let out: MyResult | undefined;
    await act(async () => { out = await r.current.submitActionAsync(request); });
    expect(out).toEqual(result);

    const submitFail = vi.fn().mockRejectedValue(new Error('reject failed'));
    const { result: r2 } = renderHook(() => useTransferInstructionAction<MyResult>({ submit: submitFail }), { wrapper });
    await expect(act(async () => { await r2.current.submitActionAsync(request); })).rejects.toThrow('reject failed');
  });

  it('surfaces a fetcher rejection via isError/error (does not swallow)', async () => {
    const boom = new Error('registry choice context fetch failed');
    const submit = vi.fn().mockRejectedValue(boom);
    const { result: r } = renderHook(() => useTransferInstructionAction<MyResult>({ submit }), { wrapper });

    act(() => r.current.submitAction(request));
    await waitFor(() => expect(r.current.isError).toBe(true));
    expect(r.current.error).toBe(boom);
  });

  it('uses the transferInstructionAction mutationKey (distinct from transferInstruction)', () => {
    const submit = vi.fn().mockResolvedValue(result);
    const { result: r } = renderHook(() => useTransferInstructionAction<MyResult>({ submit }), { wrapper });
    expect(r.current.mutate).toBeTypeOf('function');
    expect(partyLayerKeys.transferInstructionAction()).toEqual(['partylayer', 'transferInstructionAction']);
    expect(partyLayerKeys.transferInstructionAction()).not.toEqual(partyLayerKeys.transferInstruction());
  });

  it('forwards pass-through mutation options (onSuccess fires with result + request)', async () => {
    const onSuccess = vi.fn();
    const submit = vi.fn().mockResolvedValue(result);
    const { result: r } = renderHook(
      () => useTransferInstructionAction<MyResult>({ submit, mutation: { onSuccess } }),
      { wrapper },
    );
    act(() => r.current.submitAction(request));
    await waitFor(() => expect(r.current.isSuccess).toBe(true));
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onSuccess.mock.calls[0][0]).toEqual(result);
    expect(onSuccess.mock.calls[0][1]).toEqual(request);
  });
});
