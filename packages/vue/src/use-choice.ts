/**
 * Vue useChoice: the Vue mirror of React's useChoice, the write/exercise DAML
 * composable and the write counterpart to useDamlContract (the read composable). It
 * exercises a DAML choice through a dApp-supplied fetcher and wraps it in
 * vue-query's useMutation.
 *
 * MODEL 2: a choice exercise is a ledger write, which the dApp owns. Like
 * useDamlContract, this composable does NOT reach any ledger itself and does NOT
 * inject the session client. The dApp supplies its OWN exercise fetcher, typically a
 * command submission to its validator's ledger API, and the composable only wraps it
 * in useMutation and keys it. It is the mutation twin of useDamlContract (a
 * dApp-supplied fetcher, schema-agnostic), distinct from any client-based wallet-tx
 * composable.
 *
 * SCHEMA-AGNOSTIC + generic: generic over `R` (the exercise result) and `V` (the
 * exercise variables: which choice, what arguments, all dApp-defined and opaque to
 * PartyLayer). It does not model templateId/choiceName/choiceArgument; the dApp's
 * fetcher closes over the real exercise.
 *
 * Returns the vue-query mutation result (reactive fields as refs) plus wagmi-style
 * aliases:
 *  - `exerciseChoice`      === `mutate`      (fire-and-forget)
 *  - `exerciseChoiceAsync` === `mutateAsync` (returns Promise<R>; rejects on error)
 *
 * Unlike the query composables, a mutation has NO reactive queryKey, so there is no
 * MaybeRefOrGetter/computed-key handling here. vue-query's mutationFn receives the
 * variables and NO AbortSignal (same as React), so the exercise fetcher's `signal`
 * is reserved for the dApp's own cancellation and the composable calls
 * `exercise(variables)` with the variables only.
 *
 * The QueryClient is supplied by the CONSUMER via `VueQueryPlugin`
 * (`app.use(VueQueryPlugin)`), the Vue analog of React's `QueryClientProvider`.
 */
import {
  useMutation,
  type UseMutationOptions,
  type UseMutationReturnType,
} from '@tanstack/vue-query';
import { partyLayerKeys } from './query-keys';

export interface UseChoiceParameters<R, V> {
  /**
   * The dApp's exercise fetcher. Receives the exercise variables (the choice and
   * its arguments, dApp-defined) and resolves the exercise result. The `signal` is
   * optional and reserved for the dApp's own cancellation: vue-query mutations do
   * not provide an AbortSignal to `mutationFn`, so the composable calls this with
   * the variables only.
   */
  exercise: (variables: V, signal?: AbortSignal) => Promise<R>;
  /**
   * Pass-through vue-query `useMutation` options (e.g. `onSuccess`, `onError`).
   * `mutationFn` and `mutationKey` are managed by the composable and cannot be
   * overridden.
   */
  mutation?: Omit<UseMutationOptions<R, Error, V>, 'mutationFn' | 'mutationKey'>;
}

export type UseChoiceReturnType<R, V> = UseMutationReturnType<R, Error, V, unknown> & {
  /** Exercise the choice (fire-and-forget). Alias of `mutate`. */
  exerciseChoice: UseMutationReturnType<R, Error, V, unknown>['mutate'];
  /** Exercise the choice and await the result (rejects on error). Alias of `mutateAsync`. */
  exerciseChoiceAsync: UseMutationReturnType<R, Error, V, unknown>['mutateAsync'];
};

export function useChoice<R, V>(
  parameters: UseChoiceParameters<R, V>,
): UseChoiceReturnType<R, V> {
  const { exercise, mutation } = parameters;

  const result = useMutation<R, Error, V>({
    ...mutation,
    mutationKey: partyLayerKeys.exerciseChoice(),
    // mutationFn is the dApp's fetcher. PartyLayer does not own ledger transport.
    mutationFn: (variables) => exercise(variables),
  });

  return {
    ...result,
    exerciseChoice: result.mutate,
    exerciseChoiceAsync: result.mutateAsync,
  };
}
