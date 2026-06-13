# Registry signing — hardening debt (post-M1)

**Status: tracked, NOT yet implemented. The production wallet registry is currently UNSIGNED, by design, at the dev stage.**

## Why this exists

The wallet registry (`registry/v1/<channel>/registry.json`) supports Ed25519
signature verification end-to-end, but verification is **gated entirely on the
consumer configuring `registryPublicKeys`** — and no shipping consumer does:

- `RegistryClient.verifyRegistrySignature()` returns `true` (skips) when
  `publicKeys.length === 0` — see `packages/registry-client/src/client.ts:181-184`.
- `requireSignature = this.publicKeys.length > 0` (`client.ts:213`); when false,
  the `.sig` is **not even fetched** (`client.ts:286-314`).
- `this.publicKeys = options.registryPublicKeys || []` defaults empty
  (`client.ts:100`); `PartyLayerClient` only forwards `config.registryPublicKeys`
  (`packages/sdk/src/client.ts:181`).
- No shipping consumer sets `registryPublicKeys` (the demo passes `registryUrl`
  but no keys; `examples/` set none) — so the sole rejection path,
  `RegistryVerificationFailedError` (`client.ts:305-310`), is unreachable in
  production today.

Consequently the committed `registry/v1/*/registry.sig` files are empty and
CI's "Verify Registry Signatures" step (`.github/workflows/ci.yml:57-66`) is
conditional on a committed `.sig` + `registry/keys/dev.pub`, both absent, so it
no-ops. `gate:registry` validates shape + the CIP-0103 footgun guard +
provider.id disjointness — deliberately **not** the signature.

Adding/updating registry entries while unsigned therefore breaks no consumer.
This is acceptable at the current stage; making signatures **real** end-to-end
is the hardening slice below.

## The proper-signing slice (STEP-0 this separately before building)

1. **Key generation** — mint the production Ed25519 keypair
   (`pnpm registry:sign --generate-key` produces `registry/keys/dev-<ts>.{pub,key}`;
   the production key must NOT reuse a dev key).
2. **Secure key storage** — the **private** key lives out-of-repo (gitignored,
   like the npm token); never committed. Decide the custody mechanism (CI
   secret / external secret manager) before generating the real key.
3. **Sign on release** — wire `pnpm registry:sign --channel <c> --key <path>`
   into the registry release flow so every registry change reproduces a fresh
   `registry.sig`. (Re-sign on every content change — the signature is over the
   exact JSON bytes.)
4. **Activate CI verification** — commit the **public** key (`registry/keys/dev.pub`)
   and a real `registry.sig`; the existing conditional verify step in
   `ci.yml` then runs for real (`pnpm registry:verify --channel <c> --pubkey …`).
5. **Consumer-side distribution** — define how `registryPublicKeys` reaches
   consumers (SDK-bundled default? documented opt-in?) so verification is
   actually enforced end-to-end, not just available. Until this step, signing is
   produced-but-unverified.

## Scope note

This is its OWN hardening slice — explicitly NOT folded into Walley go-live or
any single registry-entry change. Entries ship unsigned until step 5 lands.
