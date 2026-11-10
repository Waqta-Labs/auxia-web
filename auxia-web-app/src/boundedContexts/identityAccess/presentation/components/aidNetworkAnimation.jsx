import { useMemo } from 'react';

// Zonas afectadas alrededor del centro de mando. "priority" = zonas críticas del ranking.
const HUB = { x: 300, y: 300 };
const ZONES = [
  { id: 'Z-01', x: 105, y: 135, kind: 'priority', score: 94 },
  { id: 'Z-02', x: 300, y: 62, kind: 'normal', score: 61 },
  { id: 'Z-03', x: 492, y: 128, kind: 'normal', score: 58 },
  { id: 'Z-04', x: 540, y: 322, kind: 'priority', score: 87 },
  { id: 'Z-05', x: 438, y: 505, kind: 'normal', score: 49 },
  { id: 'Z-06', x: 205, y: 520, kind: 'priority', score: 82 },
  { id: 'Z-07', x: 62, y: 360, kind: 'normal', score: 44 },
];

function routePath(zone, index) {
  const mx = (HUB.x + zone.x) / 2;
  const my = (HUB.y + zone.y) / 2;
  const dx = zone.x - HUB.x;
  const dy = zone.y - HUB.y;
  const bend = (index % 2 === 0 ? 1 : -1) * 0.16;
  const cx = mx - dy * bend;
  const cy = my + dx * bend;
  return 'M' + HUB.x + ' ' + HUB.y + ' Q' + cx.toFixed(1) + ' ' + cy.toFixed(1) + ' ' + zone.x + ' ' + zone.y;
}

export default function AidNetworkAnimation() {
  const reduceMotion = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    []
  );

  return (
    <svg className="aid-net" viewBox="0 0 600 600" role="presentation" aria-hidden="true">
      <defs>
        <radialGradient id="aidHubGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#85d5f6" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#85d5f6" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="aidSweep" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#85d5f6" stopOpacity="0" />
          <stop offset="100%" stopColor="#85d5f6" stopOpacity="0.38" />
        </linearGradient>
      </defs>

      {/* Anillos de radar */}
      <g className="aid-net__rings">
        <circle cx={HUB.x} cy={HUB.y} r="90" />
        <circle cx={HUB.x} cy={HUB.y} r="170" />
        <circle cx={HUB.x} cy={HUB.y} r="250" />
      </g>
      <circle className="aid-net__orbit" cx={HUB.x} cy={HUB.y} r="210" />

      {/* Barrido del radar */}
      <path
        className="aid-net__sweep"
        d={'M' + HUB.x + ' ' + HUB.y + ' L' + (HUB.x + 255) + ' ' + HUB.y + ' A255 255 0 0 0 ' + (HUB.x + 255 * Math.cos(-0.7)).toFixed(1) + ' ' + (HUB.y + 255 * Math.sin(-0.7)).toFixed(1) + ' Z'}
        fill="url(#aidSweep)"
      />

      {/* Rutas de distribución */}
      {ZONES.map((zone, i) => (
        <path
          key={zone.id + '-route'}
          id={'aidRoute' + i}
          className={'aid-net__route aid-net__route--' + zone.kind}
          d={routePath(zone, i)}
          fill="none"
        />
      ))}

      {/* Paquetes de ayuda viajando hacia las zonas */}
      {!reduceMotion &&
        ZONES.map((zone, i) => (
          <circle key={zone.id + '-packet'} r={zone.kind === 'priority' ? 5 : 3.5}
            className={'aid-net__packet aid-net__packet--' + zone.kind}>
            <animateMotion
              dur={(zone.kind === 'priority' ? 2.6 : 3.8) + 's'}
              begin={(i * 0.55).toFixed(2) + 's'}
              repeatCount="indefinite"
              keyPoints="0;1"
              keyTimes="0;1"
              calcMode="linear"
            >
              <mpath href={'#aidRoute' + i} />
            </animateMotion>
          </circle>
        ))}

      {/* Zonas */}
      {ZONES.map((zone, i) => (
        <g key={zone.id} className={'aid-net__zone aid-net__zone--' + zone.kind}
          style={{ animationDelay: (i * 0.35) + 's' }}>
          {zone.kind === 'priority' && (
            <>
              <circle className="aid-net__pulse" cx={zone.x} cy={zone.y} r="14" style={{ animationDelay: (i * 0.4) + 's' }} />
              <circle className="aid-net__pulse aid-net__pulse--late" cx={zone.x} cy={zone.y} r="14" style={{ animationDelay: (i * 0.4 + 1.1) + 's' }} />
            </>
          )}
          <circle className="aid-net__dot" cx={zone.x} cy={zone.y} r={zone.kind === 'priority' ? 11 : 8} />
          <text className="aid-net__label" x={zone.x} y={zone.y - 20} textAnchor="middle">
            {zone.id + ' · ' + zone.score}
          </text>
        </g>
      ))}

      {/* Centro de mando */}
      <circle cx={HUB.x} cy={HUB.y} r="70" fill="url(#aidHubGlow)" />
      <g className="aid-net__hub">
        <circle cx={HUB.x} cy={HUB.y} r="26" className="aid-net__hub-core" />
        <circle cx={HUB.x} cy={HUB.y} r="38" className="aid-net__hub-ring" />
        <circle cx={HUB.x - 7} cy={HUB.y - 5} r="3.2" fill="#ffffff" />
        <circle cx={HUB.x + 8} cy={HUB.y - 8} r="2.6" fill="#ffffff" />
        <circle cx={HUB.x + 8} cy={HUB.y + 9} r="6" fill="#85d5f6" />
      </g>
    </svg>
  );
}
