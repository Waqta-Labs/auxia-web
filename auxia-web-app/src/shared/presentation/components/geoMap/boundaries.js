import { project, unproject } from './mercator.js';

// Límites administrativos del Perú (departamentos, provincias y distritos) como datos propios del proyecto.
// Los polígonos se cargan bajo demanda (import dinámico) y se guardan en "píxeles de mundo" a zoom 0.
export const LEVELS = ['departments', 'provinces', 'districts'];
const KIND = { departments: 'department', provinces: 'province', districts: 'district' };
const LOADERS = {
  departments: () => import('./data/departments.json'),
  provinces: () => import('./data/provinces.json'),
  districts: () => import('./data/districts.json'),
};
const cache = {};

export const normalizeText = (text) => String(text).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();

function decode(level, data) {
  const scale = data.scale;
  return data.f.map((meta, index) => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let bestArea = -1;
    let center = null;
    const polys = data.s[index].map((rings) => {
      const decoded = rings.map((flat) => {
        const ring = new Float64Array(flat.length);
        let x = 0;
        let y = 0;
        for (let i = 0; i < flat.length; i += 2) {
          x += flat[i];
          y += flat[i + 1];
          const p = project(y / scale, x / scale, 0);
          ring[i] = p.x;
          ring[i + 1] = p.y;
        }
        return ring;
      });
      // Caja y centroide (del polígono más grande) para etiquetas y encuadres.
      const outer = decoded[0];
      let area = 0;
      let cx = 0;
      let cy = 0;
      for (let i = 0; i < outer.length; i += 2) {
        const x0 = outer[i];
        const y0 = outer[i + 1];
        minX = Math.min(minX, x0);
        maxX = Math.max(maxX, x0);
        minY = Math.min(minY, y0);
        maxY = Math.max(maxY, y0);
        const j = (i + 2) % outer.length;
        const cross = x0 * outer[j + 1] - outer[j] * y0;
        area += cross;
        cx += (x0 + outer[j]) * cross;
        cy += (y0 + outer[j + 1]) * cross;
      }
      if (Math.abs(area) > bestArea && Math.abs(area) > 0) {
        bestArea = Math.abs(area);
        center = { x: cx / (3 * area), y: cy / (3 * area) };
      }
      return decoded;
    });
    const feature = {
      level,
      kind: KIND[level],
      key: level + ':' + meta[meta.length - 1],
      name: meta[0],
      norm: normalizeText(meta[0]),
      polys,
      bbox: [minX, minY, maxX, maxY],
      center: center ?? { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
    };
    if (level === 'provinces') feature.department = meta[1];
    if (level === 'districts') { feature.province = meta[1]; feature.department = meta[2]; }
    return feature;
  });
}

export function loadBoundaries(level) {
  if (!cache[level]) {
    cache[level] = LOADERS[level]().then((module) => decode(level, module.default ?? module));
    cache[level].catch(() => { delete cache[level]; });
  }
  return cache[level];
}

// "Chosica, Lima, Lima" (distrito, provincia, departamento).
export const describe = (feature) => [feature.name, feature.province, feature.department].filter(Boolean).join(', ');

function inRing(ring, x, y) {
  let inside = false;
  for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
    const xi = ring[i];
    const yi = ring[i + 1];
    const xj = ring[j];
    const yj = ring[j + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function contains(feature, x, y) {
  const [minX, minY, maxX, maxY] = feature.bbox;
  if (x < minX || x > maxX || y < minY || y > maxY) return false;
  return feature.polys.some((rings) => rings.reduce((inside, ring) => (inRing(ring, x, y) ? !inside : inside), false));
}

// Qué distrito (o provincia / departamento, si aún no cargó el detalle) contiene ese punto; null si cae fuera del Perú.
export function locate(boundaries, lat, lng) {
  const p = project(lat, lng, 0);
  for (const level of ['districts', 'provinces', 'departments']) {
    const hit = boundaries[level]?.find((feature) => contains(feature, p.x, p.y));
    if (hit) return hit;
  }
  return null;
}

// Esquinas (lat/lng) de la caja de un límite, para encuadrarlo con boundsView.
export function featureBounds(feature) {
  const [minX, minY, maxX, maxY] = feature.bbox;
  return [unproject(minX, maxY, 0), unproject(maxX, minY, 0)];
}

// Búsqueda por nombre (sin tildes ni mayúsculas) entre los límites ya cargados.
export function searchRegions(boundaries, query, limit = 6) {
  const q = normalizeText(query);
  if (q.length < 2) return [];
  const found = [];
  LEVELS.forEach((level, order) => {
    for (const feature of boundaries[level] ?? []) {
      const at = feature.norm.indexOf(q);
      if (at < 0) continue;
      const rank = feature.norm === q ? 0 : at === 0 ? 1 : feature.norm.includes(' ' + q) ? 2 : 3;
      found.push({ feature, rank, order });
    }
  });
  found.sort((a, b) => a.rank - b.rank || a.order - b.order || a.feature.name.localeCompare(b.feature.name));
  return found.slice(0, limit).map((item) => item.feature);
}

// "-11.94, -76.69" -> { lat, lng } (null si no son coordenadas válidas).
export function parseCoordinates(text) {
  const match = String(text).trim().match(/^(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 ? { lat, lng } : null;
}
