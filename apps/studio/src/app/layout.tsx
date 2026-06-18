import type { Metadata } from 'next';
import './globals.css';

const TITLE = 'PartyLayer Studio — Live, Runnable Canton Wallet Patterns';
const OG_DESCRIPTION =
  'Interactive pattern workbench for PartyLayer — live, runnable Canton wallet integration patterns with editable code.';

export const metadata: Metadata = {
  metadataBase: new URL('https://studio.partylayer.xyz'),
  title: {
    default: TITLE,
    template: '%s | PartyLayer Studio',
  },
  description:
    'Interactive pattern workbench for PartyLayer — live, runnable Canton wallet integration patterns in Sandpack with editable code. Connect, sign, submit, session resilience, React Query, and a React/Vue/Vanilla framework toggle, all backed by a mock CIP-0103 wallet.',
  keywords: [
    'PartyLayer Studio',
    'Canton wallet patterns',
    'Sandpack playground',
    'interactive SDK',
    'CIP-0103',
    'Canton Network',
    'wallet integration',
    'React wallet hooks',
    'Vue Canton',
    'session resilience',
    'React Query',
    'live code playground',
    'PartyLayer',
    'Canton dApp',
    'wallet SDK examples',
  ],
  icons: {
    icon: '/favicon-new.svg',
  },
  openGraph: {
    type: 'website',
    siteName: 'PartyLayer Studio',
    locale: 'en_US',
    url: 'https://studio.partylayer.xyz',
    title: TITLE,
    description: OG_DESCRIPTION,
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: TITLE,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@partylayerkit',
    title: TITLE,
    description: OG_DESCRIPTION,
    images: ['/opengraph-image'],
  },
  alternates: {
    canonical: 'https://studio.partylayer.xyz',
  },
};

// Minimal WebSite identity block (mirrors the demo's approach — no SearchAction,
// since the Studio has no query endpoint that runs a search).
const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'PartyLayer Studio',
  url: 'https://studio.partylayer.xyz',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        {children}
      </body>
    </html>
  );
}
