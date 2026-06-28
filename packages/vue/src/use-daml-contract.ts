/**
 * Vue useDamlContract: the Vue mirror of React's useDamlContract, the read-side
 * DAML composable. The read counterpart to useChoice (the write/exercise
 * composable). It reads a DAML contract through a dApp-supplied fetcher and wraps
 * it in vue-query.
 *
 * MODEL 2: PartyLayer does NOT own ledger transport. Like the cost composables,
 * this does not reach any ledger/validator itself. The dApp supplies its OWN
 * contract-read fetcher (`read`), typically a query against its validator's ledger
 * API for active contracts, and the composable only wraps it in vue-query's
 * useQuery and keys it. That keeps it ledgerApi-independent, wallet-agnostic, and
 * generic-bridge-compatible: a thin, standard UX/cache layer over a query the dApp
 * already performs.
 *
 * SCHEMA-AGNOSTIC: PartyLayer does not know the dApp's DAML schema, so the
 * composable is GENERIC over `T` (the contract data the dApp's query returns) and
 * the cache-identifying `key` is OPAQUE (`unknown`): a template id, contract id, or
 * filter the dApp keys on. It deliberately does not model template/choice/args; the
 * dApp's fetcher closes over the actual query.
 *
 * `read` may resolve `null`: a contract can be absent or archived, which is a
 * successful result, not an error. So `T | null`, and `contract` may be `null`.
 *
 * VUE IDIOM (mirrors the cost composables):
 *  - `contract` is a `ComputedRef` over the query result's `data` ref (Vue's idiom),
 *    where React returns a plain value. Read with `.value` (or auto-unwrap in
 *    templates).
 *  - `key` is a `MaybeRefOrGetter`, and the `queryKey` is a `computed` over
 *    `toValue(key)`, so when a reactive key changes the query refetches with the
 *    new key. Reading the key inside the computed via `toValue` preserves
 *    reactivity (the main vue-query pitfall).
 *
 * The QueryClient is supplied by the CONSUMER via `VueQueryPlugin`
 * (`app.use(VueQueryPlugin)`), the Vue analog of React's `QueryClientProvider`.
 */
import { computed, toValue, type ComputedRef, type MaybeRefOrGetter } from 'vue';
import { useQuery, type UseQueryOptions, type UseQueryReturnType } from '@tanstack/vue-query';
import { partyLayerKeys } from './query-keys';

export interface UseDamlContractParameters<T> {
  /**
   * The dApp's contract-read fetcher. Queries the dApp's own validator/ledger for
   * the contract and resolves its data, or `null` when the contract is
   * absent/archived. Receives the query's `AbortSignal` so the dApp can cancel
   * in-flight requests.
   */
  read: (signal?: AbortSignal) => Promise<T | null>;
  /**
   * Opaque identifier for the contract/query being read (a template id, contract
   * id, or filter the dApp keys on), folded into the queryKey so different reads
   * cache independently. May be reactive (a `ref`/`computed`/getter): when it
   * changes, the query refetches. Does not need to be forwarded to `read` (the
   * dApp's fetcher already closes over its query).
   */
  key?: MaybeRefOrGetter<unknown>;
  /**
   * Pass-through vue-query `useQuery` options (e.g. `staleTime`, `enabled`).
   * `queryKey` and `queryFn` are managed by the composable and cannot be overridden.
   */
  query?: Omit<UseQueryOptions<T | null, Error>, 'queryKey' | 'queryFn'>;
}

export type UseDamlContractReturnType<T> = UseQueryReturnType<T | null, Error> & {
  /**
   * The contract data (a `ComputedRef` alias of `data`). `undefined` until loaded;
   * `null` when the contract is absent/archived (a successful result, not an error).
   */
  contract: ComputedRef<T | null | undefined>;
};

export function useDamlContract<T>(
  parameters: UseDamlContractParameters<T>,
): UseDamlContractReturnType<T> {
  const { read, key, query } = parameters;

  const result = useQuery<T | null, Error>({
    ...query,
    // Computed key tracks the opaque key's reactivity: key changes -> queryKey
    // changes -> refetch. PartyLayer does not own ledger transport (Model 2).
    queryKey: computed(() => partyLayerKeys.damlContract({ key: toValue(key) })),
    queryFn: ({ signal }) => read(signal),
  });

  return {
    ...result,
    contract: computed(() => result.data.value),
  };
}
