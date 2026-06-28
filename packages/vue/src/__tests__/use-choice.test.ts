// @vitest-environment happy-dom
/**
 * Vue useChoice tests: the Vue mirror of React's useChoice tests, using the
 * vue-query harness (a QueryClient via VueQueryPlugin, the composable in a component
 * setup()). Model 2: mounted with ONLY VueQueryPlugin, no session store/provider,
 * proving useChoice does not inject the session client. Covers: the
 * exerciseChoice/exerciseChoiceAsync aliases call the dApp fetcher with the variables
 * and resolve the result; a fetcher rejection surfaces as the mutation error (and
 * exerciseChoiceAsync rejects); pass-through mutation options (onSuccess) fire; and
 * generic R/V typing flows.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { defineComponent, h } from 'vue';
import { mount, flushPromises } from '@vue/test-utils';
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { useChoice } from '../use-choice';

/** Arbitrary dApp-owned exercise variables and result. PartyLayer is schema-agnostic. */
interface MyVars {
  contractId: string;
  choice: string;
  argument: { amount: string };
}
interface MyResult {
  updateId: string;
  exerciseResult: { newContractId: string };
}

const vars: MyVars = { contractId: '00abc', choice: 'Transfer', argument: { amount: '42' } };
const result: MyResult = { updateId: '1220ff', exerciseResult: { newContractId: '00def' } };

/** Mount with ONLY VueQueryPlugin (no session store): proves Model 2 (no client inject). */
function mountWithQuery(setup: () => unknown) {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const Comp = defineComponent({ setup });
  const wrapper = mount(Comp, { global: { plugins: [[VueQueryPlugin, { queryClient }]] } });
  return { wrapper, queryClient };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useChoice (Vue, vue-query useMutation, Model 2, generic over R/V)', () => {
  it('exposes the mutation shape + aliases (exerciseChoice/exerciseChoiceAsync)', () => {
    const exercise = vi.fn().mockResolvedValue(result);
    let r!: ReturnType<typeof useChoice<MyResult, MyVars>>;
    mountWithQuery(() => {
      r = useChoice<MyResult, MyVars>({ exercise });
      return () => h('div');
    });
    expect(typeof r.exerciseChoice).toBe('function');
    expect(typeof r.exerciseChoiceAsync).toBe('function');
    expect(typeof r.mutate).toBe('function');
    expect(r.isPending.value).toBe(false);
  });

  it('exerciseChoice(variables) calls the dApp exercise fetcher with the variables; data reflects result', async () => {
    const exercise = vi.fn().mockResolvedValue(result);
    let r!: ReturnType<typeof useChoice<MyResult, MyVars>>;
    mountWithQuery(() => {
      r = useChoice<MyResult, MyVars>({ exercise });
      return () => h('div');
    });

    r.exerciseChoice(vars);
    await flushPromises();
    expect(exercise).toHaveBeenCalledTimes(1);
    expect(exercise).toHaveBeenCalledWith(vars);
    expect(r.isSuccess.value).toBe(true);
    expect(r.data.value).toEqual(result);
    // generic typing flows: exerciseResult is typed, not unknown
    expect(r.data.value?.exerciseResult.newContractId).toBe('00def');
  });

  it('exerciseChoiceAsync resolves with the result and rejects on error', async () => {
    const exercise = vi.fn().mockResolvedValue(result);
    let r!: ReturnType<typeof useChoice<MyResult, MyVars>>;
    mountWithQuery(() => {
      r = useChoice<MyResult, MyVars>({ exercise });
      return () => h('div');
    });
    const out = await r.exerciseChoiceAsync(vars);
    expect(out).toEqual(result);

    const exerciseFail = vi.fn().mockRejectedValue(new Error('exercise failed'));
    let r2!: ReturnType<typeof useChoice<MyResult, MyVars>>;
    mountWithQuery(() => {
      r2 = useChoice<MyResult, MyVars>({ exercise: exerciseFail });
      return () => h('div');
    });
    await expect(r2.exerciseChoiceAsync(vars)).rejects.toThrow('exercise failed');
  });

  it('surfaces a fetcher rejection via isError/error (does not swallow)', async () => {
    const boom = new Error('ledger exercise failed');
    const exercise = vi.fn().mockRejectedValue(boom);
    let r!: ReturnType<typeof useChoice<MyResult, MyVars>>;
    mountWithQuery(() => {
      r = useChoice<MyResult, MyVars>({ exercise });
      return () => h('div');
    });
    r.exerciseChoice(vars);
    await flushPromises();
    expect(r.isError.value).toBe(true);
    expect(r.error.value).toBe(boom);
  });

  it('forwards pass-through mutation options (onSuccess fires with result + variables)', async () => {
    const onSuccess = vi.fn();
    const exercise = vi.fn().mockResolvedValue(result);
    let r!: ReturnType<typeof useChoice<MyResult, MyVars>>;
    mountWithQuery(() => {
      r = useChoice<MyResult, MyVars>({ exercise, mutation: { onSuccess } });
      return () => h('div');
    });
    r.exerciseChoice(vars);
    await flushPromises();
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onSuccess.mock.calls[0][0]).toEqual(result);
    expect(onSuccess.mock.calls[0][1]).toEqual(vars);
  });
});
