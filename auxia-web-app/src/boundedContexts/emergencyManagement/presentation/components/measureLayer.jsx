import { distanceMeters } from '@shared/presentation/components/geoMap/mercator.js';
import { formatDistance } from '../utils/gisColors.js';

// Regla: línea que une los puntos marcados con la distancia de cada tramo.
export default function MeasureLayer({ ctx, points, lng }) {
  if (points.length === 0) return null;
  const screen = points.map((point) => ctx.toScreen(point.lat, point.lng));
  const path = screen.map((s) => s.x + ',' + s.y).join(' ');
  return (
    <svg className="gm-measure" width={ctx.size.w} height={ctx.size.h} aria-hidden="true">
      {screen.length > 1 && <polyline points={path} />}
      {screen.slice(1).map((s, index) => {
        const from = screen[index];
        const meters = distanceMeters(points[index], points[index + 1]);
        return (
          <text key={index} x={(from.x + s.x) / 2} y={(from.y + s.y) / 2 - 8} textAnchor="middle">{formatDistance(meters, lng)}</text>
        );
      })}
      {screen.map((s, index) => <circle key={index} cx={s.x} cy={s.y} r="5" />)}
    </svg>
  );
}
