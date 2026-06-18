import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const alt = 'PartyLayer Studio — Live, Runnable Canton Wallet Patterns';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #FFFBEB 0%, #FFF5CC 30%, #FFCC00 70%, #E6B800 100%)',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Bullseye-style logo mark (concentric, the real brand motif) */}
        <div
          style={{
            width: 96,
            height: 96,
            borderRadius: 28,
            background: '#0B0F1A',
            marginBottom: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: '#FFCC00',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#0B0F1A' }} />
          </div>
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: 58,
            fontWeight: 800,
            color: '#0B0F1A',
            letterSpacing: '-0.03em',
            lineHeight: 1.1,
            textAlign: 'center',
            marginBottom: 14,
          }}
        >
          PartyLayer Studio
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: 27,
            fontWeight: 500,
            color: '#334155',
            textAlign: 'center',
            marginBottom: 40,
          }}
        >
          Live, runnable Canton wallet patterns
        </div>

        {/* Scenario chips */}
        <div
          style={{
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
            justifyContent: 'center',
            maxWidth: 900,
          }}
        >
          {['Connect', 'Sign', 'Submit', 'Session resilience', 'React Query', 'React / Vue / Vanilla'].map(
            (name) => (
              <div
                key={name}
                style={{
                  padding: '10px 22px',
                  borderRadius: 40,
                  background: 'rgba(255,255,255,0.7)',
                  border: '1px solid rgba(15,23,42,0.1)',
                  fontSize: 18,
                  fontWeight: 600,
                  color: '#0B0F1A',
                }}
              >
                {name}
              </div>
            ),
          )}
        </div>

        {/* Bottom URL */}
        <div
          style={{
            position: 'absolute',
            bottom: 32,
            fontSize: 18,
            fontWeight: 500,
            color: '#475569',
          }}
        >
          studio.partylayer.xyz
        </div>
      </div>
    ),
    { ...size },
  );
}
