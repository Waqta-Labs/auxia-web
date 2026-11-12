// Color del marcador según el nivel de prioridad (mismos tonos que la rampa del mapa de calor).
export const LEVEL_COLORS = {
  critical: '#ff4d4d',
  high: '#ff9d3d',
  moderate: '#f3e65b',
  low: '#bcfb89',
  unscored: '#989b96',
};

export const BRIGADE_COLORS = { available: '#bcfb89', deployed: '#85d5f6', offDuty: '#989b96' };

// Peso (0-1) y radio (m) con que cada zona aporta al mapa de calor. Sin puntaje no aporta calor.
export function heatPointOf(zone) {
  if (zone.urgencyScore === null || !zone.hasPosition) return null;
  const score = zone.urgencyScore;
  return {
    id: zone.id,
    lat: zone.latitude,
    lng: zone.longitude,
    weight: Math.min(1, Math.max(zone.manualPriority ? 0.9 : 0.12, score / 100)),
    radiusM: 500 + score * 9,
  };
}

export function formatDistance(meters, lng) {
  if (meters < 1000) return Math.round(meters) + ' m';
  return new Intl.NumberFormat(lng, { maximumFractionDigits: 2 }).format(meters / 1000) + ' km';
}
