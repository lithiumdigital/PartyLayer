/**
 * connect() error taxonomy for discovery-adapter (popup/remote) wallets:
 *  - registered                          → connects (no error)
 *  - in-registry as discovery, NOT wired → AdapterNotRegisteredError (actionable)
 *  - truly unknown                       → WalletNotFoundError (unchanged)
 *  - in-registry but NOT discovery, NOT wired → WalletNotFoundError (scoped)
 */
import { describe, it, expect, vi } from 'vitest';

// createPartyLayer pulls the Console adapter transitively — stub its SDK.
vi.mock('@console-wallet/dapp-sdk', () => ({
  consoleWallet: {
    checkExtensionAvailability: async () => ({ status: 'not-installed' }),
    isConnected: async () => ({ isConnected: false }),
  },
}));

import {
  toWalletId,
  WalletNotFoundError,
  AdapterNotRegisteredError,
  type CIP0103Provider,
  type OfficialAdapterFactory,
} from '@partylayer/core';
import { createPartyLayer } from './client';

const NETWORK_HOSTS = { devnet: 'https://dev.walley.cc', testnet: 'https://staging.walley.cc', mainnet: 'https://walley.cc' };

function eventlessProvider(): CIP0103Provider {
  const handlers: Record<string, unknown> = {
    connect: { isConnected: true },
    getPrimaryAccount: { partyId: 'party::walley-1', networkId: 'canton:da-devnet' },
    status: { connection: { isConnected: true }, network: { networkId: 'canton:da-devnet' } },
    disconnect: null,
  };
  const provider: CIP0103Provider = {
    request: vi.fn(async (a: { method: string }) => handlers[a.method]) as CIP0103Provider['request'],
    on: () => provider, emit: () => false, removeListener: () => provider,
  };
  return provider;
}

function walleyFactory(): OfficialAdapterFactory {
  return {
    providerId: 'walley',
    name: 'Walley',
    create: vi.fn(() => ({
      providerId: 'walley', name: 'Walley', type: 'browser',
      detect: vi.fn(async () => true), provider: vi.fn(() => eventlessProvider()),
    })),
  } as OfficialAdapterFactory;
}

/** registry entry as the discovery-adapter Walley (or a non-discovery variant). */
function walleyEntry(transport: string | undefined = 'discovery-adapter') {
  return {
    id: 'walley', name: 'Walley', homepage: 'https://walley.cc', icon: '', supportedNetworks: ['devnet'],
    capabilities: {}, sdkVersion: '>=0',
    adapter: { type: '@k2flabs/walley-dapp-sdk', transport, config: { providerId: 'walley' }, networkHosts: NETWORK_HOSTS },
  };
}

function makeClient(adapters: unknown[], registryWallets: unknown[]) {
  const client = createPartyLayer({ network: 'devnet', app: { name: 'test' }, adapters: adapters as never });
  vi.spyOn(client.registryClient, 'getWallets').mockResolvedValue([]); // gated list is empty unless wired
  vi.spyOn(client.registryClient, 'getRegistry').mockResolvedValue({
    metadata: { registryVersion: '1', schemaVersion: '1', publishedAt: 'x', channel: 'stable', sequence: 1 },
    wallets: registryWallets as never,
  } as never);
  return client;
}

describe('connect() — discovery-adapter error taxonomy', () => {
  it('(a) registered discovery wallet → connects, no error', async () => {
    const client = makeClient([walleyFactory()], [walleyEntry()]);
    const session = await client.connect({ walletId: toWalletId('walley') });
    expect(session.partyId).toBe('party::walley-1');
  });

  it('(b) in-registry discovery wallet, NOT registered → AdapterNotRegisteredError', async () => {
    const client = makeClient([], [walleyEntry()]);
    let err: unknown;
    try { await client.connect({ walletId: toWalletId('walley') }); } catch (e) { err = e; }
    expect(err).toBeInstanceOf(AdapterNotRegisteredError);
    expect((err as AdapterNotRegisteredError).code).toBe('ADAPTER_NOT_REGISTERED');
    const msg = (err as Error).message;
    expect(msg).toContain("providerId: 'walley'"); // generic, from the registry entry
    expect(msg).toContain('adapters:'); // the actionable register-it snippet
  });

  it('(c) truly-unknown walletId → WalletNotFoundError (unchanged)', async () => {
    const client = makeClient([], []); // not in registry, not registered
    let err: unknown;
    try { await client.connect({ walletId: toWalletId('ghost') }); } catch (e) { err = e; }
    expect(err).toBeInstanceOf(WalletNotFoundError);
    expect(err).not.toBeInstanceOf(AdapterNotRegisteredError);
  });

  it('(d) in-registry but NON-discovery, NOT registered → WalletNotFoundError (scoped)', async () => {
    const client = makeClient([], [walleyEntry('injected')]); // transport != discovery-adapter
    let err: unknown;
    try { await client.connect({ walletId: toWalletId('walley') }); } catch (e) { err = e; }
    expect(err).toBeInstanceOf(WalletNotFoundError);
    expect(err).not.toBeInstanceOf(AdapterNotRegisteredError);
  });
});
