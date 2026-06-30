import { VueQueryPlugin } from '@tanstack/vue-query';
import { createPartyLayer } from '@partylayer/sdk';
import { createPartyLayerSession } from '@partylayer/vue';
import { createCookieStorage } from '@partylayer/session';

/**
 * Client-only plugin: create the PartyLayer client and provide the session store
 * app-wide. cookieStorage on the client uses document.cookie, the SAME cookie
 * the server reads for SSR (lib/session.ts). The connected/wallet UI is
 * client-side; the server-rendered party comes from the cookie directly.
 *
 * VueQueryPlugin supplies the QueryClient that PartyLayer's data composables
 * (useDamlContract, useChoice, the cost composables) build on. It is registered
 * client-side here, so there is no SSR query state to dehydrate; the base session
 * composables work without it, but it is set up so the query composables are
 * ready when you reach for them. For SSR query prefetch, see the Nuxt SSR guide.
 */
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(VueQueryPlugin);
  const client = createPartyLayer({ network: 'devnet', app: { name: '{{PROJECT_NAME}}' } });
  nuxtApp.vueApp.use(
    createPartyLayerSession({
      provider: client.asProvider(),
      storage: createCookieStorage(),
    }),
  );
});
