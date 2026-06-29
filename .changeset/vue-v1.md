---
"@partylayer/vue": major
---

v1.0: the first stable release of the Vue 3 bindings.

@partylayer/vue v1.0 provides Vue 3 composables and components for PartyLayer, with API
parity to @partylayer/react. It mirrors React's reactive cache model using TanStack
vue-query (a peer dependency), so the two packages share the same query/mutation patterns
and cache keys.

What v1.0 includes:
- Reactive session state composables: useSession, useAccount, and usePartyState (each
  field a ComputedRef), plus useAccountEffect for session-transition side effects.
- CIP-0104 cost composables: useTransactionCostEstimate (pre-submission) and
  usePaidTrafficCost (post-execution), both Model 2 (the dApp supplies the fetcher).
- DAML read and write composables: useDamlContract (Model 2 read, generic and
  schema-agnostic) and useChoice (Model 2 write).
- Presentational components: CostPreview (CIP-0104), PartyAvatar, SynchronizerSwitcher,
  and TransactionToast.
- Suspense-ready query composables (the useQuery suspense function, used in an async
  setup inside Suspense).
- An optional Pinia integration on the @partylayer/vue/pinia subpath (pinia is an
  optional peer dependency).
- Nuxt 3 SSR support: the package is SSR-safe, with server-side fetching of query data
  via onServerPrefetch and the suspense function plus dehydrate and hydrate.
- CIP-0103 conformance validated against the shared conformance runner.

The session bindings (provide-inject and the composables) remain the default; the
QueryClient is supplied by the consumer via VueQueryPlugin, the Vue analog of React's
QueryClientProvider. See the package README and the docs/vue-suspense, docs/vue-pinia,
and docs/vue-nuxt-ssr guides.
