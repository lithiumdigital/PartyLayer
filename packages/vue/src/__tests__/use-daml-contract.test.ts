// @vitest-environment happy-dom
/**
 * Vue useDamlContract tests: the Vue mirror of React's useDamlContract tests, using
 * the vue-query harness (a QueryClient via VueQueryPlugin, the composable called in
 * a component setup()). Covers: resolves a contract value of a generic T (the
 * contract ComputedRef reflects data), null-is-valid, the opaque key scopes the
 * cache, AbortSignal pass-through, fetcher rejection surfaces as the query error,
 * and CRITICALLY the reactivity proof: a reactive key change refetches.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { defineComponent, h, ref, nextTick } from 'vue';
import { mount, flushPromises } from '@vue/test-utils';
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { useDamlContract } from '../use-daml-contract';
import { partyLayerKeys } from '../query-keys';

/** An arbitrary dApp-owned contract type. PartyLayer is schema-agnostic. */
interface MyContract {
  contractId: string;
  payload: { owner: string; amount: string };
}

const contract: MyContract = {
  contractId: '00abc',
  payload: { owner: 'party::owner-1', amount: '42' },
};

function mountWithQuery(setup: () => unknown) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Comp = defineComponent({ setup });
  const wrapper = mount(Comp, { global: { plugins: [[VueQueryPlugin, { queryClient }]] } });
  return { wrapper, queryClient };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useDamlContract (Vue, vue-query, Model 2, generic over T)', () => {
  it('resolves a contract; the contract ComputedRef reflects data (generic T flows)', async () => {
    const reader = vi.fn().mockResolvedValue(contract);
    let r!: ReturnType<typeof useDamlContract<MyContract>>;
    mountWithQuery(() => {
      r = useDamlContract<MyContract>({ read: reader });
      return () => h('div');
    });
    await flushPromises();
    expect(r.isSuccess.value).toBe(true);
    expect(r.contract.value).toEqual(contract); // ComputedRef alias of data
    expect(r.data.value).toEqual(contract);
    // generic typing flows through: payload is typed, not unknown
    expect(r.contract.value?.payload.owner).toBe('party::owner-1');
    // queryFn received an AbortSignal (vue-query context, like React)
    expect(reader.mock.calls[0][0]).toBeInstanceOf(AbortSignal);
  });

  it('resolves null as a valid value (absent/archived), not an error', async () => {
    const reader = vi.fn().mockResolvedValue(null);
    let r!: ReturnType<typeof useDamlContract<MyContract>>;
    mountWithQuery(() => {
      r = useDamlContract<MyContract>({ read: reader });
      return () => h('div');
    });
    await flushPromises();
    expect(r.isSuccess.value).toBe(true);
    expect(r.contract.value).toBeNull();
    expect(r.isError.value).toBe(false);
  });

  it('surfaces a fetcher rejection via isError/error (does not swallow)', async () => {
    const boom = new Error('ledger query failed');
    const reader = vi.fn().mockRejectedValue(boom);
    let r!: ReturnType<typeof useDamlContract<MyContract>>;
    mountWithQuery(() => {
      r = useDamlContract<MyContract>({ read: reader });
      return () => h('div');
    });
    await flushPromises();
    expect(r.isError.value).toBe(true);
    expect(r.error.value).toBe(boom);
    expect(r.contract.value).toBeUndefined();
  });

  it('opaque key scopes the cache (different keys cache independently)', async () => {
    const reader = vi.fn().mockResolvedValue(contract);
    let queryClient!: QueryClient;
    ({ queryClient } = mountWithQuery(() => {
      useDamlContract<MyContract>({ read: reader, key: 'tmpl-A' });
      return () => h('div');
    }));
    await flushPromises();
    expect(queryClient.getQueryData(partyLayerKeys.damlContract({ key: 'tmpl-A' }))).toEqual(contract);
    expect(queryClient.getQueryData(partyLayerKeys.damlContract({ key: 'tmpl-B' }))).toBeUndefined();
  });

  it('REACTIVITY: a reactive key change refetches with the new key', async () => {
    const reader = vi.fn().mockResolvedValue(contract);
    const key = ref('tmpl-1');
    let queryClient!: QueryClient;
    ({ queryClient } = mountWithQuery(() => {
      useDamlContract<MyContract>({ read: reader, key }); // reactive ref key
      return () => h('div');
    }));
    await flushPromises();
    expect(reader).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryData(partyLayerKeys.damlContract({ key: 'tmpl-1' }))).toEqual(contract);

    // change the reactive key -> new queryKey -> refetch
    key.value = 'tmpl-2';
    await nextTick();
    await flushPromises();
    expect(reader).toHaveBeenCalledTimes(2);
    expect(queryClient.getQueryData(partyLayerKeys.damlContract({ key: 'tmpl-2' }))).toEqual(contract);
  });
});
