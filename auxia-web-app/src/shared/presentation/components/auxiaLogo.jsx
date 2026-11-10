// Aproximación vectorial del isotipo AuxIA. Para usar el logo oficial, guarda el SVG en
// src/assets/logos/ e impórtalo en lugar de este componente.
export default function AuxiaLogo({
  withWordmark = true,
  primary = '#ffffff',
  background = '#212161',
  accent = '#85d5f6',
  wordAux = '#85d5f6',
  wordIa = '#ffffff',
  height = 44,
  title = 'AuxIA',
}) {
  const width = withWordmark ? height * 3.1 : height;
  return (
    <svg
      role="img"
      aria-label={title}
      height={height}
      width={width}
      viewBox={withWordmark ? '0 0 200 64' : '0 0 64 64'}
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="30" cy="30" r="28" fill={primary} />
      <line x1="16" y1="16" x2="34" y2="34" stroke={background} strokeWidth="3" strokeLinecap="round" />
      <circle cx="15" cy="15" r="5.5" fill={background} />
      <circle cx="43" cy="43" r="19" fill={primary} />
      <circle cx="43" cy="43" r="16" fill={background} />
      <circle cx="37" cy="39" r="3" fill={primary} />
      <circle cx="49" cy="35" r="2.5" fill={primary} />
      <circle cx="50" cy="51" r="6" fill={accent} />
      {withWordmark && (
        <text x="68" y="50" fontFamily="Inter, system-ui, sans-serif" fontSize="42" letterSpacing="-1">
          <tspan fill={wordAux} fontWeight="400">aux</tspan>
          <tspan fill={wordIa} fontWeight="800">ia</tspan>
        </text>
      )}
    </svg>
  );
}
