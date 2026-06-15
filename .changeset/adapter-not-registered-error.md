---
"@partylayer/core": minor
"@partylayer/provider": patch
"@partylayer/sdk": patch
---

Add `AdapterNotRegisteredError` — an actionable, catchable error when connecting to a popup/remote (`transport: 'discovery-adapter'`) wallet whose app-supplied provider adapter was never registered.

Previously `connect({ walletId: 'walley' })` for a known-but-unwired discovery wallet threw a bare `WalletNotFoundError` ("Wallet 'walley' not found"), conflating a config gap with a missing wallet. Now the SDK throws `AdapterNotRegisteredError` (code `ADAPTER_NOT_REGISTERED`) with a generic, registry-derived message that tells you how to wire it: `adapters: [{ providerId, create }]`. Distinct from `WalletNotFoundError` so higher-level UIs (e.g. PartyLayerKit) can catch it specifically. Scoped strictly to `discovery-adapter` entries; truly-unknown wallets still throw `WalletNotFoundError`. Maps to JSON-RPC `INVALID_PARAMS` on the provider surface.
