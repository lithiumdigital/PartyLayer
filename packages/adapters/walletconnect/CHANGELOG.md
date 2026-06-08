# @partylayer/adapter-walletconnect

## 0.2.0

### Minor Changes

- e43863b: Add `@partylayer/adapter-walletconnect` — an opt-in PartyLayer `WalletAdapter`
  that wraps the official `@canton-network/dapp-sdk` `WalletConnectAdapter`, so
  dApps can connect Canton wallets over WalletConnect (hosted/mobile wallets, e.g.
  Nightly mobile).
  - Wraps (does not reimplement) the official adapter: SIWX, the `canton_` method
    mapping, `session_event` handling, and restore all come from dapp-sdk.
  - Config: `projectId` (required), `metadata`, `onUri` (wire to the connect
    modal's QR UI), optional `signInWithCanton`/`onSignInWithCanton`. `chainId` is
    left unset by default (request the `canton` namespace per the Canton WC spec).
  - **Opt-in:** NOT in `getBuiltinAdapters()`. Apps enable it by registering it via
    `config.adapters` and installing the optional `@walletconnect/sign-client` +
    `@walletconnect/types` peers.
  - **Lazy:** the dapp-sdk barrel (which statically imports `@walletconnect/sign-client`)
    is loaded only via dynamic `import()` inside `connect()`/`restore()`; importing
    this package's entry pulls neither dapp-sdk nor sign-client, so non-WC
    consumers' webpack/Next builds are unaffected.

  Runtime deps: `@partylayer/core` + `@canton-network/dapp-sdk`. `@walletconnect/*`
  are optional peers.

  Pending (separate step): live WC E2E against a real Canton WC wallet + real
  `projectId`.

### Patch Changes

- 53b1714: WalletConnect / QR-only wallets now show a scannable QR **in the connect modal**
  out of the box (no integrator wiring), with a mobile deep-link, and the official
  dapp-sdk blank `about:blank` popup is suppressed.
  - **core / sdk:** add an optional `onDisplayUri(uri)` callback to the adapter
    `connect()` options and to `ConnectOptions`. Adapters call it with a
    pairing/display URI (e.g. a WalletConnect `wc:` URI) the moment one is
    produced, before approval; the connect UI uses it to render a QR / deep-link.
    Backward-compatible (optional).
  - **adapter-walletconnect:** the official adapter's `onUri` is now always
    wrapped so the pairing URI is fanned out to BOTH the integrator's
    `config.onUri` AND the per-connect `onDisplayUri` — no hand-wiring needed. The
    adapter also narrowly intercepts the official adapter's blank
    `window.open('', 'wallet-popup')` during connect (no config flag exists to
    disable it) and restores `window.open` afterward.
  - **react:** the modal renders the WC QR itself. `handleWalletClick` passes
    `onDisplayUri` for non-dual (QR-only / remote-signer) wallets and enters the
    QR view only once a URI actually arrives (wallets that draw their own QR are
    unaffected). QR generated via `qrcode` (new dependency). Copy is
    wallet-agnostic for the generic WalletConnect entry ("Scan with your Canton
    wallet" / "Open wallet"). The dual-transport (Console) extension + placeholder
    QR-fallback flow is unchanged.

- dd6932c: Fix: implement the `signMessage` and `ledgerApi` methods that the adapter
  already declared in `getCapabilities()` but never implemented.

  Previously the adapter listed `signMessage` and `ledgerApi` as capabilities
  while providing no corresponding methods, so `client.signMessage(...)` /
  `client.ledgerApi(...)` threw `CapabilityNotSupportedError` in
  `@partylayer/sdk` — the request never reached the wallet. Both now delegate to
  the official `@canton-network/dapp-sdk` adapter (mirroring `submitTransaction`):
  - `signMessage` → `canton_signMessage` (`SignMessageParams { message }` →
    `SignedMessage { signature, partyId, message, … }`).
  - `ledgerApi` → `canton_ledgerApi` (proxies a JSON Ledger API request; response
    normalized to `{ response: string }`).

  `signTransaction` intentionally still throws (Canton WalletConnect fuses
  sign-and-submit — use `submitTransaction` → `canton_prepareSignExecute`).
  A capability/method integrity test now asserts every method-capability has a
  working method, to catch this class of mismatch.

- Updated dependencies [53b1714]
  - @partylayer/core@0.4.0
