// @vitest-environment happy-dom
/**
 * Vue CIP-0103 conformance harness.
 *
 * Validates Vue's CIP-0103 layer against the SAME conformance runner React uses
 * (`@partylayer/conformance-runner`, added here as a test-only devDependency). Vue's
 * CIP-0103 touchpoint differs from React's: Vue has no NativeCIP0103Adapter. Instead,
 * `createPartyLayerSession` / `provideSessionStore` ACCEPT a `CIP0103Provider` and wire
 * it into `@partylayer/session`'s `createSessionStore`. So two links are proven here:
 *  1. The provider Vue consumes passes `runCIP0103ConformanceTests` with zero failures
 *     (the literal "validated against the same CIP-0103 conformance runner" check),
 *     using a minimally conformant provider that mirrors PartyLayerProvider.
 *  2. Vue's `provideSessionStore` / `createPartyLayerSession` accept that conformant
 *     provider and wire it per the session contract: the resulting store is usable, the
 *     session composables resolve against it, and the provider's events drive Vue's
 *     reactive session state.
 *
 * The conformance runner depends on core + provider, never on vue, so this is a
 * one-directional, test-only devDependency. The runner's package entry is a CLI, so the
 * library function is deep-imported from its built module (exactly as React's harness
 * does).
 */
import { describe, it, expect } from 'vitest';
import { defineComponent, h, nextTick } from 'vue';
import { mount, flushPromises } from '@vue/test-utils';
import type { CIP0103Provider, CIP0103Account, CIP0103RequestPayload } from '@partylayer/core';
import { CIP0103_EVENTS } from '@partylayer/core';
import { runCIP0103ConformanceTests } from '@partylayer/conformance-runner/dist/cip0103-tests';
import { provideSessionStore, createPartyLayerSession } from '../provide';
import { useSession, useAccount } from '../composables';

const PRIMARY_ACCOUNT: CIP0103Account = {
  primary: true,
  partyId: 'party::mock-1',
  status: 'allocated',
  hint: '',
  publicKey: '',
  namespace: '',
  networkId: 'canton:da-devnet',
  signingProviderId: '',
};

const SIGNATURE = '0xmocksignature';

/**
 * A minimally conformant CIP-0103 provider: an EventEmitter-style on/emit/
 * removeListener plus a request() that handles every mandatory method, emits the full
 * txChanged lifecycle for prepareExecute, and throws a ProviderRpcError (numeric code
 * 4200) for unknown methods. Mirrors what PartyLayerProvider does, minimally (shared
 * with React's harness via the @partylayer/core contract).
 */
function createConformantProvider(): CIP0103Provider {
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>();

  const provider: CIP0103Provider = {
    async request<T = unknown>(args: CIP0103RequestPayload): Promise<T> {
      switch (args.method) {
        case 'connect':
          return { isConnected: true } as T;
        case 'disconnect':
          return undefined as T;
        case 'isConnected':
          return true as T;
        case 'status':
          return {
            connection: { isConnected: true },
            provider: { id: 'mock', version: '1', providerType: 'browser' },
            session: { accessToken: 'tok', userId: 'party::mock-1' },
          } as T;
        case 'getActiveNetwork':
          return { networkId: 'canton:da-devnet' } as T;
        case 'listAccounts':
          return [PRIMARY_ACCOUNT] as T;
        case 'getPrimaryAccount':
          return PRIMARY_ACCOUNT as T;
        case 'signMessage':
          return SIGNATURE as T;
        case 'prepareExecute': {
          provider.emit(CIP0103_EVENTS.TX_CHANGED, { status: 'pending', commandId: 'cmd-1' });
          provider.emit(CIP0103_EVENTS.TX_CHANGED, {
            status: 'signed',
            commandId: 'cmd-1',
            payload: { signature: SIGNATURE, signedBy: 'party::mock-1', party: 'party::mock-1' },
          });
          provider.emit(CIP0103_EVENTS.TX_CHANGED, {
            status: 'executed',
            commandId: 'cmd-1',
            payload: { updateId: '1220abc', completionOffset: 1 },
          });
          return { commandId: 'cmd-1', updateId: '1220abc', transactionHash: '0xtx', signedTx: { signed: true } } as T;
        }
        case 'ledgerApi':
          return { response: '{}' } as T;
        default: {
          const err = Object.assign(new Error(`Unsupported method: ${args.method}`), { code: 4200 });
          throw err;
        }
      }
    },
    on(event, listener) {
      let set = listeners.get(event);
      if (!set) {
        set = new Set();
        listeners.set(event, set);
      }
      set.add(listener as (...args: unknown[]) => void);
      return provider;
    },
    emit(event, ...args) {
      const set = listeners.get(event);
      if (!set || set.size === 0) return false;
      for (const listener of set) listener(...(args as unknown[]));
      return true;
    },
    removeListener(event, listener) {
      listeners.get(event)?.delete(listener as (...args: unknown[]) => void);
      return provider;
    },
  };

  return provider;
}

const VALID_STATUS = ['disconnected', 'connecting', 'reconnecting', 'connected'];

describe('Vue CIP-0103 conformance: the consumed provider passes the runner', () => {
  it('a minimally conformant provider passes runCIP0103ConformanceTests with 0 failures', async () => {
    const report = await runCIP0103ConformanceTests(createConformantProvider());
    expect(report.total).toBeGreaterThan(0);
    expect(report.failed).toBe(0);
    expect(report.passed).toBe(report.total);
    expect(report.results.filter((r) => !r.passed).map((r) => r.name)).toEqual([]);
  });
});

describe('Vue CIP-0103 conformance: createPartyLayerSession / provideSessionStore wire the conformant provider', () => {
  it('provideSessionStore({ provider }) builds a usable store and the conformant provider drives Vue session state', async () => {
    const provider = createConformantProvider();
    let store!: ReturnType<typeof provideSessionStore>;
    let session!: ReturnType<typeof useSession>;
    let account!: ReturnType<typeof useAccount>;

    const Child = defineComponent({
      setup() {
        session = useSession();
        account = useAccount();
        return () => h('div');
      },
    });
    const Root = defineComponent({
      setup() {
        // Vue's touchpoint: accept the conformant provider, wire it via createSessionStore.
        store = provideSessionStore({ provider });
        return () => h(Child);
      },
    });
    mount(Root);
    await flushPromises();
    await nextTick();

    // (a) the store was built from the conformant provider and is usable
    expect(typeof store.getSnapshot).toBe('function');
    expect(typeof store.subscribe).toBe('function');
    expect(typeof store.connect).toBe('function');
    expect(typeof store.disconnect).toBe('function');

    // (b) the session composables resolve against it
    expect(VALID_STATUS).toContain(session.status.value);

    // (c) the conformant provider's events flow into Vue's reactive session state
    provider.emit('statusChanged', {
      connection: { isConnected: true },
      network: { networkId: 'canton:da-devnet' },
    });
    provider.emit('accountsChanged', [PRIMARY_ACCOUNT]);
    await nextTick();

    expect(session.isConnected.value).toBe(true);
    expect(account.party.value).toBe('party::mock-1');
    expect(account.networkId.value).toBe('canton:da-devnet');
  });

  it('createPartyLayerSession({ provider }) returns a Vue plugin that provides a working session', async () => {
    const provider = createConformantProvider();
    const plugin = createPartyLayerSession({ provider });
    expect(typeof plugin.install).toBe('function'); // a Vue Plugin

    let session!: ReturnType<typeof useSession>;
    const Consumer = defineComponent({
      setup() {
        session = useSession();
        return () => h('div');
      },
    });
    mount(Consumer, { global: { plugins: [plugin] } });
    await flushPromises();

    // The plugin provided a session store the composables resolve against.
    expect(VALID_STATUS).toContain(session.status.value);
    expect(typeof session.connect).toBe('function');
  });
});
