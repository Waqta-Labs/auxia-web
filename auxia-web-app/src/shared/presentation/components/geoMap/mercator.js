// Matemática del mapa: proyección Web Mercator (la misma de OpenStreetMap), teselas de 256 px.
export const TILE = 256;
export const MIN_ZOOM = 3;
export const MAX_ZOOM = 19;
const MAX_LAT = 85.05112878;

export const clampZoom = (zoom) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));

// lat/lng -> píxeles del mundo a ese zoom (el zoom puede ser fraccionario).
export function project(lat, lng, zoom) {
  const scale = TILE * 2 ** zoom;
  const clamped = Math.max(-MAX_LAT, Math.min(MAX_LAT, lat));
  const sin = Math.sin((clamped * Math.PI) / 180);
  return {
    x: ((lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  };
}

// Píxeles del mundo -> lat/lng.
export function unproject(x, y, zoom) {
  const scale = TILE * 2 ** zoom;
  const cy = Math.max(0, Math.min(scale, y));
  const n = Math.PI - (2 * Math.PI * cy) / scale;
  return {
    lat: (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))),
    lng: (x / scale) * 360 - 180,
  };
}

export const metersPerPixel = (lat, zoom) => (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom;

// Distancia en metros entre dos puntos (haversine).
export function distanceMeters(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371008.8 * Math.asin(Math.sqrt(h));
}

// Plantilla de teselas: {z} {x} {y}, {s} = servidor a|b|c, {r} = @2x en pantallas densas.
export function tileUrl(template, x, y, z) {
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio : 1;
  return template
    .replace('{s}', ['a', 'b', 'c'][(x + y) % 3])
    .replace('{r}', dpr > 1 ? '@2x' : '')
    .replace('{z}', z)
    .replace('{x}', x)
    .replace('{y}', y);
}

// Vista (centro + zoom) que encuadra todos los puntos dentro de un lienzo de width x height.
export function boundsView(points, width, height, { padding = 90, maxZoom = 16 } = {}) {
  if (!points || points.length === 0) return null;
  if (points.length === 1) return { lat: points[0].lat, lng: points[0].lng, zoom: Math.min(15, maxZoom) };
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    const p = project(point.lat, point.lng, 0);
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const spanX = Math.max(maxX - minX, 1e-9);
  const spanY = Math.max(maxY - minY, 1e-9);
  const fitX = Math.log2(Math.max(width - 2 * padding, 80) / spanX);
  const fitY = Math.log2(Math.max(height - 2 * padding, 80) / spanY);
  const zoom = clampZoom(Math.min(fitX, fitY, maxZoom));
  const center = unproject((minX + maxX) / 2, (minY + maxY) / 2, 0);
  return { lat: center.lat, lng: center.lng, zoom };
}

// Agrupa marcadores que quedan a menos de "radius" píxeles (greedy, de mayor a menor puntaje).
export function clusterPoints(items, toScreen, radius) {
  const clusters = [];
  for (const item of items) {
    const s = toScreen(item.lat, item.lng);
    const near = radius > 0 ? clusters.find((c) => Math.hypot(c.x - s.x, c.y - s.y) <= radius) : null;
    if (near) {
      near.items.push(item);
      continue;
    }
    clusters.push({ key: item.id, x: s.x, y: s.y, lat: item.lat, lng: item.lng, items: [item] });
  }
  return clusters;
}
