// Mapa GIS multivariable (W_02) con motor de mapa PROPIO. Uso (en la raíz del proyecto): node buildGisMap.mjs   (se puede repetir)
// No usa Leaflet ni iframes: proyección Web Mercator, teselas de OpenStreetMap (datos públicos) y una capa de calor
// dibujada en canvas con el color de la prioridad de cada zona. Backend: GET /emergencies/{id}/zones, GET /zones/{id},
// POST /emergencies/{id}/zones (registrar zona).
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

const write = (path, content) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content.replace(/^\n/, ''));
  console.log('+ ' + path);
};
const deepMerge = (a, b) => {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = v && typeof v === 'object' && !Array.isArray(v) ? deepMerge(a?.[k] ?? {}, v) : v;
  return out;
};
const mergeJson = (path, patchObject) => {
  const current = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
  writeFileSync(path, JSON.stringify(deepMerge(current, patchObject), null, 2) + '\n');
  console.log('~ ' + path);
};

const EM = 'src/boundedContexts/emergencyManagement/';
if (!existsSync(EM + 'infrastructure/container.js')) throw new Error('Estate en la raíz del proyecto (donde está package.json).');

// Lee con \n y respeta los \r\n de Windows al escribir de vuelta.
const readLf = (path) => {
  const raw = readFileSync(path, 'utf8');
  return { text: raw.replace(/\r\n/g, '\n'), crlf: raw.includes('\r\n') };
};
const writeLf = (path, text, crlf) => writeFileSync(path, crlf ? text.replace(/\n/g, '\r\n') : text);
// Reemplaza un fragmento; si el resultado ya está, no hace nada (se puede correr varias veces).
const patch = (path, pairs) => {
  let { text, crlf } = readLf(path);
  for (const [from, to] of pairs) {
    if (to !== '' && text.includes(to)) continue;
    if (!text.includes(from)) { if (to === '') continue; throw new Error('No encontré el fragmento esperado en ' + path + ':\n' + from); }
    text = text.replace(from, to);
  }
  writeLf(path, text, crlf);
  console.log('~ ' + path);
};
// Igual que patch, pero si el fragmento no está solo avisa (mejoras opcionales que no deben detener el script).
const softPatch = (path, pairs) => {
  try { patch(path, pairs); } catch { console.log('! No se pudo ajustar ' + path + ' (opcional): ' + 'el botón "Asignar brigada" del mapa abrirá el detalle de la zona.'); }
};
const appendOnce = (path, marker, css) => {
  const { text, crlf } = readLf(path);
  if (text.includes(marker)) return;
  writeLf(path, text.replace(/\s*$/, '\n') + '\n' + marker + '\n' + css, crlf);
  console.log('~ ' + path);
};

/* ════════════════════════ CONFIGURACIÓN DE TESELAS (datos de OpenStreetMap) ════════════════════════ */
patch('src/shared/infrastructure/config/env.js', [[
  '\n});',
  "\n  // Teselas del mapa propio: datos de OpenStreetMap con estilo oscuro. Se puede cambiar con VITE_MAP_TILES_URL\n" +
  "  // (plantilla con {z}/{x}/{y}; {s} = a|b|c y {r} = @2x en pantallas densas).\n" +
  "  mapTilesUrl: import.meta.env.VITE_MAP_TILES_URL || 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',\n" +
  "  mapAttribution: import.meta.env.VITE_MAP_ATTRIBUTION || '© OpenStreetMap contributors © CARTO',\n});",
]]);

/* ════════════════════════ MOTOR DE MAPA (shared) ════════════════════════ */
const GM = 'src/shared/presentation/components/geoMap/';

write(GM + 'mercator.js', String.raw`
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
`);

write(GM + 'heatLayer.jsx', String.raw`
import { useEffect, useRef } from 'react';

// Rampa de calor: de demanda baja (verde) a crítica (rojo). La leyenda usa la misma rampa.
export const HEAT_RAMP = [
  [0, '#bcfb89'],
  [0.4, '#f3e65b'],
  [0.65, '#ffb020'],
  [0.85, '#ff7043'],
  [1, '#ff4d4d'],
];

export const rampGradient = (angle = 90) =>
  'linear-gradient(' + angle + 'deg, ' + HEAT_RAMP.map(([stop, color]) => color + ' ' + stop * 100 + '%').join(', ') + ')';

const hex = (color) => [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));

// Tabla intensidad (0-255) -> RGBA, calculada una sola vez.
const PALETTE = (() => {
  const table = new Uint8ClampedArray(256 * 4);
  for (let i = 0; i < 256; i += 1) {
    const t = i / 255;
    let k = 0;
    while (k < HEAT_RAMP.length - 2 && t > HEAT_RAMP[k + 1][0]) k += 1;
    const [t0, c0] = HEAT_RAMP[k];
    const [t1, c1] = HEAT_RAMP[k + 1];
    const mix = Math.min(1, Math.max(0, (t - t0) / (t1 - t0)));
    const a = hex(c0);
    const b = hex(c1);
    for (let channel = 0; channel < 3; channel += 1) table[i * 4 + channel] = a[channel] + (b[channel] - a[channel]) * mix;
    table[i * 4 + 3] = Math.round(Math.min(1, t ** 1.15 * 1.5) * 0.82 * 255);
  }
  return table;
})();

const QUALITY = 0.5; // el calor se dibuja a media resolución: es difuso y así se mueve fluido

// points: [{ lat, lng, weight (0-1), radiusM }]. Las zonas cercanas suman intensidad: más calor donde se juntan.
export default function HeatLayer({ points, view, size, toScreen, metersPerPixel, opacity = 0.75 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.w === 0 || size.h === 0) return;
    const w = Math.max(1, Math.round(size.w * QUALITY));
    const h = Math.max(1, Math.round(size.h * QUALITY));
    canvas.width = w;
    canvas.height = h;
    const g = canvas.getContext('2d', { willReadFrequently: true });
    g.clearRect(0, 0, w, h);

    const mpp = metersPerPixel;
    for (const point of points) {
      const s = toScreen(point.lat, point.lng);
      const r = Math.min(280, Math.max(40, point.radiusM / mpp)) * QUALITY; // sin tope el calor taparía todo al acercar
      const x = s.x * QUALITY;
      const y = s.y * QUALITY;
      if (x + r < 0 || y + r < 0 || x - r > w || y - r > h) continue;
      const gradient = g.createRadialGradient(x, y, 0, x, y, r);
      gradient.addColorStop(0, 'rgba(0,0,0,' + point.weight + ')');
      gradient.addColorStop(0.4, 'rgba(0,0,0,' + point.weight * 0.75 + ')');
      gradient.addColorStop(0.75, 'rgba(0,0,0,' + point.weight * 0.3 + ')');
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gradient;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }

    const image = g.getImageData(0, 0, w, h);
    const data = image.data;
    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3];
      if (alpha === 0) continue;
      const p = alpha * 4;
      data[i] = PALETTE[p];
      data[i + 1] = PALETTE[p + 1];
      data[i + 2] = PALETTE[p + 2];
      data[i + 3] = PALETTE[p + 3];
    }
    g.putImageData(image, 0, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, view.lat, view.lng, view.zoom, size.w, size.h]);

  return <canvas ref={canvasRef} className="gm__heat" style={{ width: size.w, height: size.h, opacity }} aria-hidden="true" />;
}
`);

write(GM + 'geoMap.jsx', String.raw`
import { useCallback, useEffect, useRef, useState } from 'react';
import { env } from '@shared/infrastructure/config/env.js';
import { MAX_ZOOM, MIN_ZOOM, TILE, boundsView, clampZoom, metersPerPixel, project, tileUrl, unproject } from './mercator.js';
import './geoMap.css';

const MAX_TILE_ZOOM = 19;
const NICE_METERS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000, 1000000, 2000000];

function scaleBar(lat, zoom) {
  const mpp = metersPerPixel(lat, zoom);
  let nice = NICE_METERS[0];
  for (const meters of NICE_METERS) if (meters <= 110 * mpp) nice = meters;
  return { width: nice / mpp, label: nice >= 1000 ? nice / 1000 + ' km' : nice + ' m' };
}

// Mapa propio: teselas de OpenStreetMap + arrastrar, rueda, pellizco, doble clic y teclado.
//  - view = { lat, lng, zoom } lo maneja quien lo usa (onViewChange).
//  - fit = { key, points, padding }: encuadra los puntos cada vez que cambia "key".
//  - children recibe { view, size, toScreen, metersPerPixel } para dibujar capas encima.
//  - Los elementos interactivos que se dibujen encima deben llevar data-map-ui para no arrastrar el mapa.
export default function GeoMap({ view, onViewChange, fit = null, mode = 'move', onMapClick, onRecenter, label, zoomInLabel, zoomOutLabel, recenterLabel, children }) {
  const rootRef = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const viewRef = useRef(view);
  const sizeRef = useRef(size);
  const changeRef = useRef(onViewChange);
  const clickRef = useRef(onMapClick);
  viewRef.current = view;
  sizeRef.current = size;
  changeRef.current = onViewChange;
  clickRef.current = onMapClick;
  const pointers = useRef(new Map());
  const gesture = useRef(null);

  useEffect(() => {
    const el = rootRef.current;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Encuadre automático.
  const ready = size.w > 0 && size.h > 0;
  useEffect(() => {
    if (!fit || !ready) return;
    const next = boundsView(fit.points, sizeRef.current.w, sizeRef.current.h, { padding: fit.padding });
    if (next) changeRef.current(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fit?.key, ready]);

  const zoomAround = useCallback((sx, sy, nextZoom) => {
    const v = viewRef.current;
    const s = sizeRef.current;
    const zoom = clampZoom(nextZoom);
    const c = project(v.lat, v.lng, v.zoom);
    const under = unproject(c.x + sx - s.w / 2, c.y + sy - s.h / 2, v.zoom);
    const p = project(under.lat, under.lng, zoom);
    const center = unproject(p.x - (sx - s.w / 2), p.y - (sy - s.h / 2), zoom);
    changeRef.current({ lat: center.lat, lng: center.lng, zoom });
  }, []);

  const panBy = useCallback((dx, dy) => {
    const v = viewRef.current;
    const c = project(v.lat, v.lng, v.zoom);
    const center = unproject(c.x - dx, c.y - dy, v.zoom);
    changeRef.current({ ...v, lat: center.lat, lng: center.lng });
  }, []);

  const toLatLng = useCallback((sx, sy) => {
    const v = viewRef.current;
    const s = sizeRef.current;
    const c = project(v.lat, v.lng, v.zoom);
    return unproject(c.x + sx - s.w / 2, c.y + sy - s.h / 2, v.zoom);
  }, []);

  // Rueda: listener nativo (no pasivo) para poder evitar el scroll de la página.
  useEffect(() => {
    const el = rootRef.current;
    const onWheel = (event) => {
      event.preventDefault();
      const rect = el.getBoundingClientRect();
      const step = Math.max(-0.75, Math.min(0.75, -event.deltaY * 0.0025));
      zoomAround(event.clientX - rect.left, event.clientY - rect.top, viewRef.current.zoom + step);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAround]);

  const local = (event) => {
    const rect = rootRef.current.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const onPointerDown = (event) => {
    if (event.target.closest('[data-map-ui]')) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    rootRef.current.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 1) {
      gesture.current = { startX: event.clientX, startY: event.clientY, lastX: event.clientX, lastY: event.clientY, moved: false, pinch: null };
    } else if (pointers.current.size === 2 && gesture.current) {
      const [a, b] = [...pointers.current.values()];
      gesture.current.moved = true;
      gesture.current.pinch = { distance: Math.hypot(a.x - b.x, a.y - b.y), zoom: viewRef.current.zoom };
    }
  };

  const onPointerMove = (event) => {
    if (!pointers.current.has(event.pointerId) || !gesture.current) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const g = gesture.current;
    if (pointers.current.size >= 2 && g.pinch) {
      const [a, b] = [...pointers.current.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const rect = rootRef.current.getBoundingClientRect();
      zoomAround((a.x + b.x) / 2 - rect.left, (a.y + b.y) / 2 - rect.top, g.pinch.zoom + Math.log2(distance / g.pinch.distance));
      return;
    }
    if (!g.moved && Math.hypot(event.clientX - g.startX, event.clientY - g.startY) < 5) return;
    g.moved = true;
    panBy(event.clientX - g.lastX, event.clientY - g.lastY);
    g.lastX = event.clientX;
    g.lastY = event.clientY;
  };

  const onPointerUp = (event) => {
    if (!pointers.current.has(event.pointerId)) return;
    const wasSingle = pointers.current.size === 1;
    pointers.current.delete(event.pointerId);
    const g = gesture.current;
    if (wasSingle && g && !g.moved && event.type === 'pointerup') {
      const { x, y } = local(event);
      const point = toLatLng(x, y);
      clickRef.current?.({ lat: point.lat, lng: point.lng, x, y });
    }
    if (pointers.current.size === 0) gesture.current = null;
    else if (gesture.current) gesture.current.pinch = null;
  };

  const onDoubleClick = (event) => {
    if (mode !== 'move' || event.target.closest('[data-map-ui]')) return;
    const { x, y } = local(event);
    zoomAround(x, y, viewRef.current.zoom + 1);
  };

  const onKeyDown = (event) => {
    const keys = { ArrowLeft: [80, 0], ArrowRight: [-80, 0], ArrowUp: [0, 80], ArrowDown: [0, -80] };
    if (keys[event.key]) {
      event.preventDefault();
      panBy(...keys[event.key]);
    } else if (event.key === '+' || event.key === '=') {
      zoomAround(sizeRef.current.w / 2, sizeRef.current.h / 2, viewRef.current.zoom + 1);
    } else if (event.key === '-' || event.key === '_') {
      zoomAround(sizeRef.current.w / 2, sizeRef.current.h / 2, viewRef.current.zoom - 1);
    }
  };

  // Teselas visibles.
  const tiles = [];
  if (ready) {
    const tz = Math.min(MAX_TILE_ZOOM, Math.max(0, Math.round(view.zoom)));
    const scale = 2 ** (view.zoom - tz);
    const c = project(view.lat, view.lng, tz);
    const n = 2 ** tz;
    const x0 = Math.floor((c.x - size.w / 2 / scale) / TILE);
    const x1 = Math.floor((c.x + size.w / 2 / scale) / TILE);
    const y0 = Math.max(0, Math.floor((c.y - size.h / 2 / scale) / TILE));
    const y1 = Math.min(n - 1, Math.floor((c.y + size.h / 2 / scale) / TILE));
    for (let x = x0; x <= x1; x += 1) {
      for (let y = y0; y <= y1; y += 1) {
        const wrapped = ((x % n) + n) % n;
        tiles.push(
          <img
            key={tz + '/' + x + '/' + y}
            className="gm__tile"
            alt=""
            draggable={false}
            src={tileUrl(env.mapTilesUrl, wrapped, y, tz)}
            style={{
              width: TILE * scale + 1,
              height: TILE * scale + 1,
              transform: 'translate(' + ((x * TILE - c.x) * scale + size.w / 2) + 'px,' + ((y * TILE - c.y) * scale + size.h / 2) + 'px)',
            }}
            onError={(event) => { event.currentTarget.style.visibility = 'hidden'; }}
          />,
        );
      }
    }
  }

  const center = project(view.lat, view.lng, view.zoom);
  const toScreen = (lat, lng) => {
    const p = project(lat, lng, view.zoom);
    return { x: p.x - center.x + size.w / 2, y: p.y - center.y + size.h / 2 };
  };
  const mpp = metersPerPixel(view.lat, view.zoom);
  const bar = scaleBar(view.lat, view.zoom);

  return (
    <div
      ref={rootRef}
      className="gm"
      data-mode={mode}
      role="application"
      aria-label={label}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={onDoubleClick}
      onKeyDown={onKeyDown}
    >
      <div className="gm__tiles" aria-hidden="true">{tiles}</div>
      {ready && (typeof children === 'function' ? children({ view, size, toScreen, metersPerPixel: mpp }) : children)}

      <div className="gm__corner" data-map-ui>
        <div className="gm__zoom">
          <button type="button" aria-label={zoomInLabel} disabled={view.zoom >= MAX_ZOOM} onClick={() => zoomAround(size.w / 2, size.h / 2, view.zoom + 1)}>+</button>
          <button type="button" aria-label={zoomOutLabel} disabled={view.zoom <= MIN_ZOOM} onClick={() => zoomAround(size.w / 2, size.h / 2, view.zoom - 1)}>−</button>
        </div>
        {onRecenter && (
          <button type="button" className="gm__recenter" aria-label={recenterLabel} title={recenterLabel} onClick={onRecenter}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" /></svg>
          </button>
        )}
        <div className="gm__scale" aria-hidden="true"><span style={{ width: bar.width }} />{bar.label}</div>
        <p className="gm__attr">{env.mapAttribution}</p>
      </div>
    </div>
  );
}
`);

write(GM + 'geoMap.css', String.raw`
.gm {
  position: relative; width: 100%; height: 100%; overflow: hidden; touch-action: none; user-select: none; outline: none;
  background-color: #0b0b2e;
  background-image: linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px);
  background-size: 64px 64px;
  cursor: grab;
}
.gm:active { cursor: grabbing; }
.gm[data-mode='measure'], .gm[data-mode='create'] { cursor: crosshair; }
.gm:focus-visible { box-shadow: inset 0 0 0 2px var(--color-sky); }
.gm__tiles { position: absolute; inset: 0; overflow: hidden; }
.gm__tile { position: absolute; left: 0; top: 0; max-width: none; pointer-events: none; filter: saturate(0.85) brightness(0.95); }
.gm__tiles::after { content: ''; position: absolute; inset: 0; background: rgba(16, 16, 58, 0.28); pointer-events: none; }
.gm__heat { position: absolute; left: 0; top: 0; pointer-events: none; mix-blend-mode: screen; transition: opacity 0.2s; }

.gm__corner { position: absolute; right: 12px; bottom: 12px; display: grid; justify-items: end; gap: 8px; z-index: 30; cursor: default; }
.gm__zoom { display: grid; border-radius: 12px; overflow: hidden; border: 1px solid var(--cc-line); background: rgba(33, 33, 97, 0.94); }
.gm__zoom button { width: 40px; height: 40px; border: 0; background: transparent; color: #fff; font: inherit; font-size: 1.25rem; font-weight: 700; cursor: pointer; }
.gm__zoom button + button { border-top: 1px solid var(--cc-line); }
.gm__zoom button:hover:not(:disabled) { background: rgba(255, 255, 255, 0.08); }
.gm__zoom button:disabled { opacity: 0.4; cursor: not-allowed; }
.gm__zoom button:focus-visible { outline: 2px solid var(--color-sky); outline-offset: -2px; }
.gm__recenter { display: grid; place-items: center; width: 40px; height: 40px; padding: 0; border: 1px solid var(--cc-line); border-radius: 12px; background: rgba(33, 33, 97, 0.94); color: #fff; cursor: pointer; }
.gm__recenter:hover { background: rgba(255, 255, 255, 0.12); }
.gm__recenter:focus-visible { outline: 2px solid var(--color-sky); outline-offset: 2px; }
.gm__scale { display: flex; align-items: center; gap: 8px; padding: 2px 8px; border-radius: 6px; background: rgba(11, 11, 46, 0.7); color: var(--night-100); font-size: 0.6875rem; font-weight: 600; }
.gm__scale span { display: block; height: 6px; border: 1.5px solid var(--night-100); border-top: 0; }
.gm__attr { margin: 0; padding: 2px 8px; border-radius: 6px; background: rgba(11, 11, 46, 0.7); color: var(--night-100); font-size: 0.625rem; }
`);

/* ════════════════════════ BÚSQUEDA DE LUGARES (Nominatim, datos de OSM) ════════════════════════ */
write('src/shared/infrastructure/geocoding/placeSearch.js', String.raw`
// Búsqueda de lugares con Nominatim (OpenStreetMap): sirve para ubicar bien una zona antes de registrarla.
// Solo se consulta cuando la persona lo pide (Enter): el servicio público admite poco tráfico.
const ENDPOINT = 'https://nominatim.openstreetmap.org/search';

// "-11.94, -76.69" -> { lat, lng } (null si no son coordenadas válidas).
export function parseCoordinates(text) {
  const match = String(text).trim().match(/^(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 ? { lat, lng } : null;
}

export async function searchPlaces(query, { language = 'es', signal } = {}) {
  const url = ENDPOINT + '?format=jsonv2&limit=5&accept-language=' + encodeURIComponent(language) + '&q=' + encodeURIComponent(query);
  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('placeSearch ' + response.status);
  const items = await response.json();
  return items.map((item) => ({ label: item.display_name, lat: Number(item.lat), lng: Number(item.lon) }));
}
`);

/* ════════════════════════ DOMINIO / APLICACIÓN / INFRAESTRUCTURA: REGISTRAR ZONA ════════════════════════ */
write(EM + 'domain/repositories/zoneRepository.js', String.raw`
// Contrato.
//  - findRanking: GET /emergencies/{id}/zones (+ GET /zones/{id} por zona si se piden coordenadas).
//  - findDetail: GET /zones/{id}
//  - findScoreExplanation: GET /zones/{id}/score
//  - setManualPriority / clearManualPriority: PUT / DELETE /zones/{id}/manual-priority (solo AUTHORITY)
//  - register: POST /emergencies/{id}/zones (solo AUTHORITY)
//  - updatePopulationImpact: PATCH /zones/{id}/population-impact (solo AUTHORITY)
export class ZoneRepository {
  // eslint-disable-next-line no-unused-vars
  async findRanking(emergencyId, { withPosition } = {}) {
    throw new Error('ZoneRepository.findRanking no implementado');
  }

  // eslint-disable-next-line no-unused-vars
  async findDetail(zoneId) {
    throw new Error('ZoneRepository.findDetail no implementado');
  }

  // eslint-disable-next-line no-unused-vars
  async findScoreExplanation(zoneId) {
    throw new Error('ZoneRepository.findScoreExplanation no implementado');
  }

  // eslint-disable-next-line no-unused-vars
  async setManualPriority(zoneId, reason) {
    throw new Error('ZoneRepository.setManualPriority no implementado');
  }

  // eslint-disable-next-line no-unused-vars
  async clearManualPriority(zoneId) {
    throw new Error('ZoneRepository.clearManualPriority no implementado');
  }

  // eslint-disable-next-line no-unused-vars
  async register(emergencyId, { name, latitude, longitude, damageLevel, impact }) {
    throw new Error('ZoneRepository.register no implementado');
  }

  // eslint-disable-next-line no-unused-vars
  async updatePopulationImpact(zoneId, impact) {
    throw new Error('ZoneRepository.updatePopulationImpact no implementado');
  }
}
`);

write(EM + 'domain/enums/damageLevel.js', String.raw`
// Nivel de daño que acepta el backend al registrar una zona.
export const DamageLevel = Object.freeze({
  LOW: 'LOW',
  MODERATE: 'MODERATE',
  SEVERE: 'SEVERE',
  CRITICAL: 'CRITICAL',
});

export const DAMAGE_LEVELS = Object.values(DamageLevel);
`);

write(EM + 'domain/services/populationImpact.js', String.raw`
// Conteos del impacto en la población (POST /emergencies/{id}/zones y PATCH /zones/{id}/population-impact).
export const IMPACT_FIELDS = ['population', 'familiesAffected', 'peopleAffected', 'children', 'elderlyPeople', 'disabledPeople'];

const MAX_COUNT = 2147483647;

// values: { campo: '600', ... } (texto de los inputs). Devuelve solo los campos llenados, como enteros >= 0.
export function parseImpact(values = {}) {
  const impact = {};
  for (const field of IMPACT_FIELDS) {
    const raw = values[field];
    if (raw === '' || raw === null || raw === undefined) continue;
    const count = Number(raw);
    if (!Number.isInteger(count) || count < 0 || count > MAX_COUNT) throw new Error('countInvalid');
    impact[field] = count;
  }
  return impact;
}
`);

write(EM + 'application/useCases/registerZone.js', String.raw`
import { parseImpact } from '../../domain/services/populationImpact.js';

const MAX_NAME = 150;

// Registra una zona en la emergencia. Los errores de validación son claves de i18n (gisMap.errors.*).
export class RegisterZone {
  constructor(zoneRepository) {
    this.zoneRepository = zoneRepository;
  }

  async execute({ emergencyId, name, latitude, longitude, damageLevel, impact }) {
    if (!emergencyId) throw new Error('noEmergency');
    const cleanName = String(name ?? '').trim();
    if (!cleanName) throw new Error('nameRequired');
    if (cleanName.length > MAX_NAME) throw new Error('nameTooLong');

    const lat = Number(latitude);
    const lng = Number(longitude);
    if (latitude === '' || latitude === null || !Number.isFinite(lat) || lat < -90 || lat > 90) throw new Error('latitudeInvalid');
    if (longitude === '' || longitude === null || !Number.isFinite(lng) || lng < -180 || lng > 180) throw new Error('longitudeInvalid');

    return this.zoneRepository.register(emergencyId, {
      name: cleanName,
      latitude: lat,
      longitude: lng,
      damageLevel: damageLevel || null,
      impact: parseImpact(impact),
    });
  }
}
`);

write(EM + 'application/useCases/updatePopulationImpact.js', String.raw`
import { parseImpact } from '../../domain/services/populationImpact.js';

// Cambia solo los conteos indicados; el backend recalcula el puntaje de urgencia.
export class UpdatePopulationImpact {
  constructor(zoneRepository) {
    this.zoneRepository = zoneRepository;
  }

  async execute({ zoneId, impact }) {
    const counts = parseImpact(impact);
    if (Object.keys(counts).length === 0) throw new Error('impactEmpty');
    return this.zoneRepository.updatePopulationImpact(zoneId, counts);
  }
}
`);


write(EM + 'infrastructure/http/zoneHttpRepository.js', String.raw`
import { ZoneRepository } from '../../domain/repositories/zoneRepository.js';
import { toZone, toZoneDetail, toScoreExplanation } from '../mappers/emergencyMapper.js';
import { httpClient } from '@shared/infrastructure/http/httpClient.js';
import { asList } from '@shared/infrastructure/http/asList.js';
import { toApiError } from '@shared/infrastructure/http/toApiError.js';

const call = async (request) => {
  try {
    return await request();
  } catch (error) {
    throw toApiError(error);
  }
};

export class ZoneHttpRepository extends ZoneRepository {
  async findRanking(emergencyId, { withPosition = true } = {}) {
    const { data } = await call(() => httpClient.get('/emergencies/' + emergencyId + '/zones'));
    const items = asList(data);
    if (!withPosition) return items.map((item) => toZone(item, null, emergencyId));

    // El ranking no trae coordenadas: se piden una a una (si una falla, esa zona queda sin marcador).
    const details = await Promise.allSettled(items.map((item) => httpClient.get('/zones/' + item.id)));
    return items.map((item, i) =>
      toZone(item, details[i].status === 'fulfilled' ? details[i].value.data : null, emergencyId),
    );
  }

  async findDetail(zoneId) {
    const { data } = await call(() => httpClient.get('/zones/' + zoneId));
    return toZoneDetail(data);
  }

  async findScoreExplanation(zoneId) {
    const { data } = await call(() => httpClient.get('/zones/' + zoneId + '/score'));
    return toScoreExplanation(data);
  }

  async setManualPriority(zoneId, reason) {
    await call(() => httpClient.put('/zones/' + zoneId + '/manual-priority', { reason }));
  }

  async clearManualPriority(zoneId) {
    await call(() => httpClient.delete('/zones/' + zoneId + '/manual-priority'));
  }

  // POST /emergencies/{id}/zones
  // Cuerpo: { name, geolocation: { latitude, longitude }, populationImpact?: { population, familiesAffected, peopleAffected,
  // children, elderlyPeople, disabledPeople }, damageLevel? }. Con población el backend calcula el puntaje al instante.
  async register(emergencyId, { name, latitude, longitude, damageLevel, impact }) {
    const body = { name, geolocation: { latitude, longitude } };
    if (impact && Object.keys(impact).length > 0) body.populationImpact = impact;
    if (damageLevel) body.damageLevel = damageLevel;
    const { data } = await call(() => httpClient.post('/emergencies/' + emergencyId + '/zones', body));
    return { id: data?.id ?? null, name: data?.name ?? name };
  }

  // PATCH /zones/{id}/population-impact: solo cambian los conteos enviados y se recalcula el puntaje.
  async updatePopulationImpact(zoneId, impact) {
    await call(() => httpClient.patch('/zones/' + zoneId + '/population-impact', impact));
  }
}
`);

write(EM + 'infrastructure/mock/zoneMockRepository.js', String.raw`
import { ZoneRepository } from '../../domain/repositories/zoneRepository.js';
import { toZone, toZoneDetail, toScoreExplanation } from '../mappers/emergencyMapper.js';
import { delay } from '@shared/infrastructure/mock/delay.js';
import { zoneDtos, scoreDtos } from './fixtures.js';

const notFound = () => Object.assign(new Error('Zona no encontrada'), { status: 404, detail: 'Zona no encontrada' });

const priorityOf = (score) => {
  if (score === null) return null;
  if (score > 85) return 'CRITICAL';
  if (score >= 60) return 'HIGH';
  if (score >= 40) return 'MEDIUM';
  return 'LOW';
};

const DAMAGE_POINTS = { LOW: 10, MODERATE: 30, SEVERE: 50, CRITICAL: 68 };
const damageOf = (score) => (score === null || score <= 40 ? 'LOW' : score <= 60 ? 'MODERATE' : score > 85 ? 'CRITICAL' : 'SEVERE');

// Puntaje de prueba (el real lo calcula el servicio de IA del backend).
const estimateScore = (damageLevel, impact) => {
  if (impact.population === undefined && impact.peopleAffected === undefined) return null;
  const people = impact.peopleAffected ?? Math.round((impact.population ?? 0) * 0.4);
  const children = impact.children ?? 0;
  return Math.min(98, Math.round((DAMAGE_POINTS[damageLevel] ?? 25) + Math.min(30, people / 20) + Math.min(10, children / 20)));
};

const impactFrom = (dto) => dto.impact ?? {
  population: dto.score === null ? null : dto.peopleAffected * 4,
  familiesAffected: Math.round(dto.peopleAffected / 4),
  peopleAffected: dto.peopleAffected,
  children: Math.round(dto.peopleAffected * 0.22),
  elderlyPeople: Math.round(dto.peopleAffected * 0.12),
  disabledPeople: Math.round(dto.peopleAffected * 0.04),
};

export class ZoneMockRepository extends ZoneRepository {
  constructor() {
    super();
    this.items = zoneDtos.map((dto) => ({ ...dto })); // las zonas registradas o editadas viven mientras no se recargue la página
    this.synthetic = new Set(); // zonas cuya explicación de puntaje se calcula aquí
    this.manualPriorities = new Map(); // zoneId -> { reason, setBy, setAt }
  }

  // eslint-disable-next-line no-unused-vars
  async findRanking(emergencyId, options) {
    await delay(500);
    return this.items.map((dto) => toZone({ ...dto, manualPriority: this.manualPriorities.get(dto.id) ?? null }, dto, emergencyId));
  }

  async findDetail(zoneId) {
    await delay(350);
    const dto = this.items.find((zone) => zone.id === zoneId);
    if (!dto) throw notFound();
    return toZoneDetail({
      ...dto,
      emergencyId: 'em-0001',
      populationImpact: impactFrom(dto),
      manualPriority: this.manualPriorities.get(zoneId) ?? null,
    });
  }

  async findScoreExplanation(zoneId) {
    await delay(250);
    const dto = this.items.find((zone) => zone.id === zoneId);
    if (!dto) throw notFound();
    if (!this.synthetic.has(zoneId) && scoreDtos[zoneId]) return toScoreExplanation(scoreDtos[zoneId]);
    if (dto.score === null) {
      return toScoreExplanation({ available: false, score: null, topFeatures: [], modelVersion: null, missingVariables: ['population'] });
    }
    return toScoreExplanation({
      available: true,
      score: dto.score,
      topFeatures: [
        { feature: 'peopleAffected', contribution: Math.round(dto.score * 0.55 * 10) / 10 },
        { feature: 'damageLevel', contribution: Math.round(dto.score * 0.45 * 10) / 10 },
      ],
      modelVersion: 'urgency-1.3.0',
      missingVariables: [],
    });
  }

  async setManualPriority(zoneId, reason) {
    await delay(400);
    if (!this.items.some((zone) => zone.id === zoneId)) throw notFound();
    this.manualPriorities.set(zoneId, {
      reason,
      setBy: 'mock-user',
      setAt: new Date().toISOString().slice(0, 19),
    });
  }

  async clearManualPriority(zoneId) {
    await delay(300);
    this.manualPriorities.delete(zoneId);
  }

  async register(emergencyId, { name, latitude, longitude, damageLevel, impact }) {
    await delay(500);
    const score = estimateScore(damageLevel, impact);
    const id = 'zn-new-' + (this.items.length + 1);
    this.items.push({
      id,
      name,
      status: score === null ? 'REGISTERED' : 'PRIORITIZED',
      damageLevel: damageLevel ?? (score === null ? 'LOW' : damageOf(score)),
      peopleAffected: impact.peopleAffected ?? Math.round((impact.population ?? 0) * 0.4),
      score,
      priorityLevel: priorityOf(score),
      needs: [],
      manualPriority: null,
      geolocation: { latitude, longitude },
      lastAidReceivedAt: null,
      impact: { population: null, familiesAffected: null, peopleAffected: null, children: null, elderlyPeople: null, disabledPeople: null, ...impact },
    });
    this.synthetic.add(id);
    return { id, name };
  }

  async updatePopulationImpact(zoneId, impact) {
    await delay(500);
    const dto = this.items.find((zone) => zone.id === zoneId);
    if (!dto) throw notFound();
    dto.impact = { ...impactFrom(dto), ...impact };
    dto.peopleAffected = dto.impact.peopleAffected ?? dto.peopleAffected;
    dto.score = estimateScore(dto.damageLevel, dto.impact);
    dto.priorityLevel = priorityOf(dto.score);
    if (dto.score !== null && dto.status === 'REGISTERED') dto.status = 'PRIORITIZED';
    this.synthetic.add(zoneId);
  }
}
`);


patch(EM + 'infrastructure/container.js', [
  [
    "import { GetZoneRanking } from '../application/useCases/getZoneRanking.js';\n",
    "import { GetZoneRanking } from '../application/useCases/getZoneRanking.js';\nimport { RegisterZone } from '../application/useCases/registerZone.js';\nimport { UpdatePopulationImpact } from '../application/useCases/updatePopulationImpact.js';\n",
  ],
  [
    'export const getZoneRankingUseCase = new GetZoneRanking(zoneRepository);\n',
    'export const getZoneRankingUseCase = new GetZoneRanking(zoneRepository);\nexport const registerZoneUseCase = new RegisterZone(zoneRepository);\nexport const updatePopulationImpactUseCase = new UpdatePopulationImpact(zoneRepository);\n',
  ],
]);

write(EM + 'presentation/hooks/useRegisterZone.js', String.raw`
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { registerZoneUseCase } from '../../infrastructure/container.js';

export function useRegisterZone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input) => registerZoneUseCase.execute(input),
    // El mapa, el tablero y la bandeja vuelven a pedir las zonas.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['zones'] }),
  });
}
`);

write(EM + 'presentation/hooks/useUpdatePopulationImpact.js', String.raw`
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updatePopulationImpactUseCase } from '../../infrastructure/container.js';

export function useUpdatePopulationImpact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input) => updatePopulationImpactUseCase.execute(input),
    // El puntaje se recalcula: se refrescan el ranking, el detalle y el mapa.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['zones'] }),
  });
}
`);


/* ════════════════════════ PRESENTACIÓN DEL MAPA GIS ════════════════════════ */
const PR = EM + 'presentation/';

write(PR + 'utils/gisColors.js', String.raw`
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
`);

write(PR + 'components/mapMarkers.jsx', String.raw`
import { clusterPoints } from '@shared/presentation/components/geoMap/mercator.js';
import { LEVEL_COLORS, BRIGADE_COLORS } from '../utils/gisColors.js';

const CLUSTER_PX = 34;
const NO_CLUSTER_ZOOM = 16;

// Marcadores de zona (agrupados cuando se tocan) y de brigadas, sobre el mapa.
export default function MapMarkers({ ctx, zones, brigades, showZones, showBrigades, selectedId, onSelect, onCluster, clusterLabel, brigadeLabel }) {
  const { view, toScreen } = ctx;

  const clusters = showZones
    ? clusterPoints(
        zones.map((zone) => ({ id: zone.id, lat: zone.latitude, lng: zone.longitude, zone })),
        toScreen,
        view.zoom >= NO_CLUSTER_ZOOM ? 0 : CLUSTER_PX,
      )
    : [];

  return (
    <>
      {showBrigades &&
        brigades.map((brigade) => {
          const s = toScreen(brigade.latitude, brigade.longitude);
          const color = brigade.isAvailable ? BRIGADE_COLORS.available : brigade.isDeployed ? BRIGADE_COLORS.deployed : BRIGADE_COLORS.offDuty;
          return (
            <span
              key={brigade.id}
              className="gm-brigade"
              style={{ transform: 'translate(' + s.x + 'px,' + s.y + 'px) rotate(45deg)', background: color }}
              title={brigadeLabel(brigade)}
            />
          );
        })}

      {clusters.map((cluster) => {
        const best = cluster.items.reduce((top, item) => ((item.zone.urgencyScore ?? -1) > (top.zone.urgencyScore ?? -1) ? item : top), cluster.items[0]);
        const color = LEVEL_COLORS[best.zone.level];
        if (cluster.items.length > 1) {
          return (
            <button
              key={cluster.key}
              type="button"
              data-map-ui
              className="gm-cluster"
              style={{ transform: 'translate(' + cluster.x + 'px,' + cluster.y + 'px)', '--pin': color }}
              aria-label={clusterLabel(cluster.items.length)}
              onClick={() => onCluster(cluster.items.map((item) => ({ lat: item.lat, lng: item.lng })))}
            >
              {cluster.items.length}
            </button>
          );
        }
        const zone = best.zone;
        const selected = zone.id === selectedId;
        return (
          <button
            key={zone.id}
            type="button"
            data-map-ui
            className={'gm-pin' + (selected ? ' is-selected' : '') + (zone.isCritical ? ' is-critical' : '')}
            style={{ transform: 'translate(' + cluster.x + 'px,' + cluster.y + 'px)', '--pin': color }}
            aria-label={zone.name + (zone.urgencyScore !== null ? ' · ' + zone.urgencyScore : '')}
            aria-pressed={selected}
            onClick={() => onSelect(zone.id)}
          >
            <span className="gm-pin__label">{zone.name}</span>
          </button>
        );
      })}
    </>
  );
}
`);

write(PR + 'components/measureLayer.jsx', String.raw`
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
`);

write(PR + 'components/mapSearch.jsx', String.raw`
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { parseCoordinates, searchPlaces } from '@shared/infrastructure/geocoding/placeSearch.js';

const normalize = (text) => String(text).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Busca entre las zonas (al escribir) y, al pulsar Enter, entre lugares de OpenStreetMap o coordenadas.
export default function MapSearch({ zones, onPickZone, onPickPlace }) {
  const { t, i18n } = useTranslation('emergencyManagement');
  const [text, setText] = useState('');
  const [places, setPlaces] = useState([]);
  const [status, setStatus] = useState('idle'); // idle | loading | done | error
  const [open, setOpen] = useState(false);
  const abortRef = useRef(null);
  const rootRef = useRef(null);

  const zoneResults = useMemo(() => {
    const query = normalize(text.trim());
    if (query.length < 2) return [];
    return zones.filter((zone) => normalize(zone.name).includes(query)).slice(0, 5);
  }, [text, zones]);

  useEffect(() => {
    const onDown = (event) => { if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false); };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, []);
  useEffect(() => () => abortRef.current?.abort(), []);

  const submit = async (event) => {
    event.preventDefault();
    const query = text.trim();
    if (!query) return;
    setOpen(true);
    const coordinates = parseCoordinates(query);
    if (coordinates) {
      setPlaces([{ label: t('gisMap.search.coordinates', { value: coordinates.lat + ', ' + coordinates.lng }), ...coordinates }]);
      setStatus('done');
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus('loading');
    try {
      setPlaces(await searchPlaces(query, { language: i18n.resolvedLanguage, signal: controller.signal }));
      setStatus('done');
    } catch (error) {
      if (error.name !== 'AbortError') setStatus('error');
    }
  };

  const pickZone = (zone) => { setOpen(false); setText(zone.name); onPickZone(zone); };
  const pickPlace = (place) => { setOpen(false); onPickPlace(place); };

  const showList = open && (zoneResults.length > 0 || status !== 'idle');
  return (
    <form className="gm-search" role="search" ref={rootRef} onSubmit={submit} data-map-ui>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
      <input
        type="search"
        value={text}
        placeholder={t('gisMap.search.placeholder')}
        aria-label={t('gisMap.search.label')}
        onChange={(event) => { setText(event.target.value); setStatus('idle'); setPlaces([]); setOpen(true); }}
        onFocus={() => setOpen(true)}
      />
      {showList && (
        <ul className="gm-search__list" role="listbox" aria-label={t('gisMap.search.label')}>
          {zoneResults.map((zone) => (
            <li key={zone.id}>
              <button type="button" role="option" onClick={() => pickZone(zone)}>
                <small>{t('gisMap.search.zone')}</small>{zone.name}
              </button>
            </li>
          ))}
          {status === 'loading' && <li className="gm-search__note">{t('gisMap.search.searching')}</li>}
          {status === 'error' && <li className="gm-search__note is-error">{t('gisMap.search.error')}</li>}
          {status === 'done' && places.length === 0 && <li className="gm-search__note">{t('gisMap.search.noResults')}</li>}
          {places.map((place) => (
            <li key={place.label + place.lat}>
              <button type="button" role="option" onClick={() => pickPlace(place)}>
                <small>{t('gisMap.search.place')}</small>{place.label}
              </button>
            </li>
          ))}
          {status === 'idle' && zoneResults.length > 0 && <li className="gm-search__note">{t('gisMap.search.hint')}</li>}
        </ul>
      )}
    </form>
  );
}
`);

write(PR + 'components/layersPanel.jsx', String.raw`
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HEAT_RAMP } from '@shared/presentation/components/geoMap/heatLayer.jsx';

const DOTS = { heat: HEAT_RAMP[3][1], zones: '#ffffff', brigades: '#85d5f6' };

// Capas del mapa: interruptores y opacidad del calor.
export default function LayersPanel({ layers, onToggle, opacity, onOpacity, hasBrigades }) {
  const { t } = useTranslation('emergencyManagement');
  const [open, setOpen] = useState(() => (typeof window === 'undefined' ? true : window.innerWidth >= 1000));
  const rows = [
    ['heat', t('gisMap.layers.heat')],
    ['zones', t('gisMap.layers.zones')],
    ['brigades', t('gisMap.layers.brigades')],
  ];
  return (
    <section className="gm-panel gm-layers" data-map-ui aria-label={t('gisMap.layers.title')}>
      <button type="button" className="gm-panel__head" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <h2>{t('gisMap.layers.title')}</h2>
        <span aria-hidden="true">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="gm-layers__body">
          {rows.map(([key, label]) => (
            <label key={key} className="gm-switch">
              <input type="checkbox" role="switch" checked={layers[key]} disabled={key === 'brigades' && !hasBrigades} onChange={() => onToggle(key)} />
              <span className="gm-switch__track" aria-hidden="true" />
              <i style={{ background: DOTS[key] }} aria-hidden="true" />
              {label}
            </label>
          ))}
          <label className="gm-opacity">
            <span>{t('gisMap.layers.opacity')} <b>{opacity}%</b></span>
            <input type="range" min="20" max="100" step="5" value={opacity} onChange={(event) => onOpacity(Number(event.target.value))} disabled={!layers.heat} />
          </label>
          <p className="gm-note">{t('gisMap.layers.unavailable')}</p>
        </div>
      )}
    </section>
  );
}
`);

write(PR + 'components/mapLegend.jsx', String.raw`
import { useTranslation } from 'react-i18next';
import { humanize } from '@shared/utils/formatters.js';
import { rampGradient } from '@shared/presentation/components/geoMap/heatLayer.jsx';

// Leyenda del calor y filtro por necesidad.
export default function MapLegend({ needs, activeNeed, onNeed }) {
  const { t } = useTranslation('emergencyManagement');
  return (
    <section className="gm-panel gm-legend" data-map-ui aria-label={t('gisMap.legend.title')}>
      <h2>{t('gisMap.legend.title')}</h2>
      <div className="gm-legend__bar" style={{ background: rampGradient(90) }} role="img" aria-label={t('gisMap.legend.low') + ' → ' + t('gisMap.legend.critical')} />
      <div className="gm-legend__ends"><span>{t('gisMap.legend.low')}</span><span>{t('gisMap.legend.critical')}</span></div>
      {needs.length > 0 && (
        <div className="gm-chips" role="group" aria-label={t('gisMap.legend.needs')}>
          <button type="button" className="gm-chip" aria-pressed={activeNeed === null} onClick={() => onNeed(null)}>{t('gisMap.legend.all')}</button>
          {needs.map((need) => (
            <button key={need} type="button" className="gm-chip" aria-pressed={activeNeed === need} onClick={() => onNeed(activeNeed === need ? null : need)}>
              {t('needs.' + need, { defaultValue: humanize(need) })}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
`);

write(PR + 'components/zonePopup.jsx', String.raw`
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { routes } from '@app/router/routes.js';
import { formatNumber, humanize } from '@shared/utils/formatters.js';
import { useZonePriorityDetail } from '../hooks/useZonePriorityDetail.js';
import { featureLabel, formatContribution } from '../utils/featureLabel.js';
import { LEVEL_COLORS } from '../utils/gisColors.js';

// Tarjeta de la zona elegida en el mapa: por qué está priorizada y salto al detalle / asignación.
export default function ZonePopup({ zone, canManage, onEditImpact, onClose }) {
  const { t, i18n } = useTranslation('emergencyManagement');
  const lng = i18n.resolvedLanguage;
  const detail = useZonePriorityDetail(zone.id);
  const features = (detail.data?.explanation?.features ?? []).slice(0, 3);
  const needs = zone.needs.map((need) => t('needs.' + need, { defaultValue: humanize(need) })).join(', ');
  const base = routes.prioritization + '?zone=' + zone.id;

  const rows = [
    [t('gisMap.popup.needs'), needs || '—'],
    [t('gisMap.popup.damage'), zone.damageLevel ? t('damage.' + zone.damageLevel) : '—'],
    [t('gisMap.popup.people'), zone.peopleAffected === null ? '—' : formatNumber(zone.peopleAffected, lng)],
    [t('gisMap.popup.status'), zone.status ? t('zoneStatus.' + zone.status) : '—'],
    [t('gisMap.popup.gps'), zone.latitude.toFixed(4) + ', ' + zone.longitude.toFixed(4)],
  ];

  return (
    <aside className="gm-panel gm-popup" data-map-ui aria-label={zone.name}>
      <header>
        <span className="gm-popup__score" style={{ background: LEVEL_COLORS[zone.level] }}>{zone.urgencyScore ?? '—'}</span>
        <div>
          <h2>{zone.name}</h2>
          <p>{zone.manualPriority ? t('gisMap.popup.manual') : zone.priorityLevel ? t('gisMap.popup.level.' + zone.priorityLevel) : t('gisMap.popup.noScore')}</p>
        </div>
        <button type="button" className="gm-x" onClick={onClose} aria-label={t('gisMap.popup.close')}>×</button>
      </header>

      <div className="gm-popup__why">
        <h3>{t('gisMap.popup.reasons')}</h3>
        {detail.isLoading && <p>…</p>}
        {!detail.isLoading && features.length === 0 && <p>{zone.urgencyScore === null ? t('gisMap.popup.noScoreHint') : t('gisMap.popup.noReasons')}</p>}
        {features.length > 0 && (
          <ul>
            {features.map((feature) => (
              <li key={feature.key}><span>{featureLabel(t, feature.key)}</span><b>{formatContribution(feature.contribution)}</b></li>
            ))}
          </ul>
        )}
      </div>

      <dl className="gm-popup__facts">
        {rows.map(([label, value]) => (<div key={label}><dt>{label}</dt><dd>{value}</dd></div>))}
      </dl>

      {canManage && (
        <button type="button" className="gm-link" onClick={() => onEditImpact({ id: zone.id, name: zone.name, values: detail.data?.zone ?? null })}>
          {t('gisMap.popup.editImpact')}
        </button>
      )}

      <div className="gm-popup__actions">
        {canManage && <Link className="gm-btn-lime" to={base + '&view=assign'}>{t('gisMap.popup.assign')}</Link>}
        <Link className="gm-btn-outline" to={base}>{t('gisMap.popup.detail')}</Link>
      </div>
    </aside>
  );
}
`);

write(PR + 'components/impactFields.jsx', String.raw`
import { useTranslation } from 'react-i18next';
import { IMPACT_FIELDS } from '../../domain/services/populationImpact.js';

const EXAMPLES = { population: '600', familiesAffected: '35', peopleAffected: '140', children: '40', elderlyPeople: '15', disabledPeople: '0' };

// Los seis conteos del impacto en la población (todos opcionales). values: { campo: texto }.
export default function ImpactFields({ values, onChange }) {
  const { t } = useTranslation('emergencyManagement');
  return (
    <fieldset className="gm-impact">
      <legend>{t('gisMap.impact.title')}</legend>
      <div className="gm-impact__grid">
        {IMPACT_FIELDS.map((field) => (
          <label key={field} className="gm-field">{t('gisMap.impact.' + field)}
            <input inputMode="numeric" value={values[field]} placeholder={EXAMPLES[field]} onChange={(event) => onChange({ ...values, [field]: event.target.value })} />
          </label>
        ))}
      </div>
    </fieldset>
  );
}
`);

write(PR + 'components/newZoneDialog.jsx', String.raw`
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DAMAGE_LEVELS } from '../../domain/enums/damageLevel.js';
import { useRegisterZone } from '../hooks/useRegisterZone.js';
import ImpactFields from './impactFields.jsx';

const EMPTY_IMPACT = { population: '', familiesAffected: '', peopleAffected: '', children: '', elderlyPeople: '', disabledPeople: '' };

// Registra una zona en el punto marcado en el mapa. La ubicación se puede ajustar a mano.
export default function NewZoneDialog({ emergencyId, point, onClose, onCreated }) {
  const { t } = useTranslation('emergencyManagement');
  const register = useRegisterZone();
  const [name, setName] = useState('');
  const [latitude, setLatitude] = useState(point.lat.toFixed(6));
  const [longitude, setLongitude] = useState(point.lng.toFixed(6));
  const [damageLevel, setDamageLevel] = useState('');
  const [impact, setImpact] = useState(EMPTY_IMPACT);
  const [error, setError] = useState(null);
  const nameRef = useRef(null);

  useEffect(() => { nameRef.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = (event) => {
    event.preventDefault();
    setError(null);
    register.mutate(
      { emergencyId, name, latitude, longitude, damageLevel, impact },
      {
        onSuccess: (zone) => onCreated(zone),
        onError: (failure) => setError(t('gisMap.errors.' + failure.message, { defaultValue: failure.detail ?? t('gisMap.errors.generic') })),
      },
    );
  };

  return (
    <>
      <div className="gm-backdrop" onClick={onClose} />
      <form className="gm-dialog" role="dialog" aria-modal="true" aria-labelledby="gm-new-zone" onSubmit={submit} noValidate>
        <h2 id="gm-new-zone">{t('gisMap.dialog.title')}</h2>
        <p className="gm-note">{t('gisMap.dialog.intro')}</p>
        <label className="gm-field">{t('gisMap.dialog.name')}
          <input ref={nameRef} value={name} maxLength={150} placeholder={t('gisMap.dialog.namePlaceholder')} onChange={(event) => setName(event.target.value)} />
        </label>
        <div className="gm-field-row">
          <label className="gm-field">{t('gisMap.dialog.latitude')}
            <input inputMode="decimal" value={latitude} onChange={(event) => setLatitude(event.target.value)} />
          </label>
          <label className="gm-field">{t('gisMap.dialog.longitude')}
            <input inputMode="decimal" value={longitude} onChange={(event) => setLongitude(event.target.value)} />
          </label>
        </div>
        <label className="gm-field">{t('gisMap.dialog.damage')}
          <select value={damageLevel} onChange={(event) => setDamageLevel(event.target.value)}>
            <option value="">{t('gisMap.dialog.damageNone')}</option>
            {DAMAGE_LEVELS.map((level) => <option key={level} value={level}>{t('damage.' + level)}</option>)}
          </select>
        </label>
        <ImpactFields values={impact} onChange={setImpact} />
        {error && <p className="gm-error" role="alert">{error}</p>}
        <div className="gm-dialog__actions">
          <button type="button" className="gm-btn-outline" onClick={onClose}>{t('gisMap.dialog.cancel')}</button>
          <button type="submit" className="gm-btn-lime" disabled={register.isPending}>{register.isPending ? t('gisMap.dialog.creating') : t('gisMap.dialog.create')}</button>
        </div>
      </form>
    </>
  );
}
`);

write(PR + 'components/impactDialog.jsx', String.raw`
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IMPACT_FIELDS } from '../../domain/services/populationImpact.js';
import { useUpdatePopulationImpact } from '../hooks/useUpdatePopulationImpact.js';
import ImpactFields from './impactFields.jsx';

const textOf = (value) => (value === null || value === undefined ? '' : String(value));

// Edita la población afectada de una zona (p. ej. una registrada sin ella): solo cambian los datos que se escriban.
export default function ImpactDialog({ zone, onClose, onSaved }) {
  const { t } = useTranslation('emergencyManagement');
  const update = useUpdatePopulationImpact();
  const [impact, setImpact] = useState(() => Object.fromEntries(IMPACT_FIELDS.map((field) => [field, textOf(zone.values?.[field])])));
  const [error, setError] = useState(null);
  const closeRef = useRef(null);

  useEffect(() => { closeRef.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = (event) => {
    event.preventDefault();
    setError(null);
    update.mutate(
      { zoneId: zone.id, impact },
      {
        onSuccess: () => onSaved(zone),
        onError: (failure) => setError(t('gisMap.errors.' + failure.message, { defaultValue: failure.detail ?? t('gisMap.errors.generic') })),
      },
    );
  };

  return (
    <>
      <div className="gm-backdrop" onClick={onClose} />
      <form className="gm-dialog" role="dialog" aria-modal="true" aria-labelledby="gm-impact" onSubmit={submit} noValidate>
        <h2 id="gm-impact">{t('gisMap.dialog.impactTitle', { name: zone.name })}</h2>
        <p className="gm-note">{t('gisMap.dialog.impactIntro')}</p>
        <ImpactFields values={impact} onChange={setImpact} />
        {error && <p className="gm-error" role="alert">{error}</p>}
        <div className="gm-dialog__actions">
          <button type="button" ref={closeRef} className="gm-btn-outline" onClick={onClose}>{t('gisMap.dialog.cancel')}</button>
          <button type="submit" className="gm-btn-lime" disabled={update.isPending}>{update.isPending ? t('gisMap.dialog.saving') : t('gisMap.dialog.save')}</button>
        </div>
      </form>
    </>
  );
}
`);


write(PR + 'pages/gisMapPage.jsx', String.raw`
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePermissions } from '@bc/identityAccess/presentation/hooks/usePermissions.js';
import { useBrigadeOverview } from '@bc/resourceManagement/presentation/hooks/useBrigadeOverview.js';
import GeoMap from '@shared/presentation/components/geoMap/geoMap.jsx';
import HeatLayer from '@shared/presentation/components/geoMap/heatLayer.jsx';
import { boundsView, distanceMeters } from '@shared/presentation/components/geoMap/mercator.js';
import { useActiveEmergency } from '../hooks/useActiveEmergency.js';
import { useZoneRanking } from '../hooks/useZoneRanking.js';
import { formatDistance, heatPointOf } from '../utils/gisColors.js';
import MapMarkers from '../components/mapMarkers.jsx';
import MeasureLayer from '../components/measureLayer.jsx';
import MapSearch from '../components/mapSearch.jsx';
import LayersPanel from '../components/layersPanel.jsx';
import MapLegend from '../components/mapLegend.jsx';
import ZonePopup from '../components/zonePopup.jsx';
import NewZoneDialog from '../components/newZoneDialog.jsx';
import ImpactDialog from '../components/impactDialog.jsx';
import '../styles/gisMap.css';

const DEFAULT_VIEW = { lat: -11.94, lng: -76.69, zoom: 12 };
const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Mapa GIS multivariable: mapa propio con capa de calor por prioridad, zonas, brigadas, regla y registro de zonas.
export default function GisMapPage() {
  const { t, i18n } = useTranslation('emergencyManagement');
  const lng = i18n.resolvedLanguage;
  const { isAuthority } = usePermissions();

  const emergency = useActiveEmergency();
  const emergencyId = emergency.data?.id;
  const ranking = useZoneRanking(emergencyId, { explainTop: 0 });
  const brigadeQuery = useBrigadeOverview();

  const [view, setView] = useState(DEFAULT_VIEW);
  const [layers, setLayers] = useState({ heat: true, zones: true, brigades: true });
  const [opacity, setOpacity] = useState(75);
  const [need, setNeed] = useState(null);
  const [mode, setMode] = useState('move'); // move | measure | create
  const [measure, setMeasure] = useState([]);
  const [draft, setDraft] = useState(null);
  const [impactZone, setImpactZone] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [notice, setNotice] = useState(null);
  const [recenter, setRecenter] = useState(0);
  const flight = useRef(null);
  const pendingFocus = useRef(null);
  const viewRef = useRef(view);
  viewRef.current = view;

  const zones = useMemo(() => ranking.data ?? [], [ranking.data]);
  const placed = useMemo(() => zones.filter((zone) => zone.hasPosition), [zones]);
  const visible = useMemo(() => placed.filter((zone) => (need ? zone.needs.includes(need) : true)), [placed, need]);
  const heatPoints = useMemo(() => (layers.heat ? visible.map(heatPointOf).filter(Boolean) : []), [visible, layers.heat]);
  const brigades = useMemo(() => (brigadeQuery.data?.brigades ?? []).filter((brigade) => brigade.hasPosition), [brigadeQuery.data]);
  const needs = useMemo(() => [...new Set(placed.flatMap((zone) => zone.needs))], [placed]);
  const selected = zones.find((zone) => zone.id === selectedId && zone.hasPosition) ?? null;
  const criticalCount = placed.filter((zone) => zone.isCritical).length;

  // Encuadre inicial: cuando llegan las zonas con coordenadas (y cada vez que se pulsa "Recentrar").
  const fit = useMemo(
    () => ({ key: (placed.length > 0 ? emergencyId : 'none') + ':' + recenter, points: placed.map((zone) => ({ lat: zone.latitude, lng: zone.longitude })), padding: 110 }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [placed.length > 0, emergencyId, recenter],
  );

  const flyTo = useCallback((target) => {
    cancelAnimationFrame(flight.current);
    const from = viewRef.current;
    if (reduceMotion()) { setView(target); return; }
    const start = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - start) / 550);
      const e = 1 - (1 - p) ** 3;
      setView({ lat: from.lat + (target.lat - from.lat) * e, lng: from.lng + (target.lng - from.lng) * e, zoom: from.zoom + (target.zoom - from.zoom) * e });
      if (p < 1) flight.current = requestAnimationFrame(step);
    };
    flight.current = requestAnimationFrame(step);
  }, []);
  useEffect(() => () => cancelAnimationFrame(flight.current), []);

  // Cualquier gesto del usuario cancela el vuelo en curso.
  const onViewChange = useCallback((next) => { cancelAnimationFrame(flight.current); setView(next); }, []);

  // Tras registrar una zona, cuando aparece en el ranking se vuelve a enfocar.
  useEffect(() => {
    const id = pendingFocus.current;
    if (!id) return;
    const zone = zones.find((item) => item.id === id && item.hasPosition);
    if (zone) {
      pendingFocus.current = null;
      setSelectedId(zone.id);
      flyTo({ lat: zone.latitude, lng: zone.longitude, zoom: 15 });
    }
  }, [zones, flyTo]);

  const selectZone = (id) => {
    setSelectedId(id);
    const zone = zones.find((item) => item.id === id);
    if (zone?.hasPosition) flyTo({ lat: zone.latitude, lng: zone.longitude, zoom: Math.max(viewRef.current.zoom, 14) });
  };

  const onMapClick = ({ lat, lng: lon }) => {
    if (mode === 'measure') setMeasure((points) => [...points, { lat, lng: lon }]);
    else if (mode === 'create') setDraft({ lat, lng: lon });
    else setSelectedId(null);
  };

  const changeMode = (next) => { setMode(next); setNotice(null); if (next !== 'create') setDraft(null); };
  const total = measure.slice(1).reduce((sum, point, index) => sum + distanceMeters(measure[index], point), 0);

  const hint =
    mode === 'measure' ? (measure.length > 1 ? t('gisMap.hints.measure', { distance: formatDistance(total, lng) }) : t('gisMap.hints.measureEmpty'))
    : mode === 'create' ? t('gisMap.hints.create')
    : notice;

  const noEmergency = !emergency.isLoading && !emergency.isError && !emergency.data;
  const loading = emergency.isLoading || ranking.isLoading;
  const failed = emergency.isError || ranking.isError;

  return (
    <div className="gm-page">
      <header className="gm-head">
        <div>
          <h1>{t('gisMap.title')}</h1>
          <p>{noEmergency ? t('gisMap.noEmergency') : t('gisMap.subtitle', { zones: placed.length, critical: criticalCount })}</p>
        </div>
      </header>

      <div className="gm-stage">
        <GeoMap
          view={view}
          onViewChange={onViewChange}
          fit={fit}
          mode={mode}
          onMapClick={onMapClick}
          onRecenter={placed.length > 0 ? () => setRecenter((n) => n + 1) : undefined}
          recenterLabel={t('gisMap.tools.recenter')}
          label={t('gisMap.map.label')}
          zoomInLabel={t('gisMap.map.zoomIn')}
          zoomOutLabel={t('gisMap.map.zoomOut')}
        >
          {(ctx) => (
            <>
              <HeatLayer points={heatPoints} view={ctx.view} size={ctx.size} toScreen={ctx.toScreen} metersPerPixel={ctx.metersPerPixel} opacity={opacity / 100} />
              <MeasureLayer ctx={ctx} points={measure} lng={lng} />
              <MapMarkers
                ctx={ctx}
                zones={visible}
                brigades={brigades}
                showZones={layers.zones}
                showBrigades={layers.brigades}
                selectedId={selected?.id ?? null}
                onSelect={selectZone}
                onCluster={(points) => { const next = boundsView(points, ctx.size.w, ctx.size.h, { padding: 140, maxZoom: 17 }); if (next) flyTo(next); }}
                clusterLabel={(count) => t('gisMap.cluster', { count })}
                brigadeLabel={(brigade) => t('gisMap.brigade', { name: brigade.name })}
              />
              {draft && (() => { const s = ctx.toScreen(draft.lat, draft.lng); return <span className="gm-draft" style={{ transform: 'translate(' + s.x + 'px,' + s.y + 'px)' }} aria-hidden="true" />; })()}
            </>
          )}
        </GeoMap>

        <div className="gm-top">
          <MapSearch
            zones={placed}
            onPickZone={(zone) => selectZone(zone.id)}
            onPickPlace={(place) => flyTo({ lat: place.lat, lng: place.lng, zoom: 15 })}
          />
          <div className="gm-tools" role="toolbar" aria-label={t('gisMap.tools.label')} data-map-ui>
            <button type="button" aria-pressed={mode === 'move'} onClick={() => changeMode('move')}>{t('gisMap.tools.move')}</button>
            <button type="button" aria-pressed={mode === 'measure'} onClick={() => changeMode('measure')}>{t('gisMap.tools.measure')}</button>
            {isAuthority && <button type="button" aria-pressed={mode === 'create'} onClick={() => changeMode('create')}>{t('gisMap.tools.newZone')}</button>}
            {measure.length > 0 && <button type="button" onClick={() => setMeasure([])}>{t('gisMap.tools.clear')}</button>}
          </div>
          {hint && <p className="gm-hint" role="status" data-map-ui>{hint}</p>}
        </div>

        <LayersPanel layers={layers} onToggle={(key) => setLayers((current) => ({ ...current, [key]: !current[key] }))} opacity={opacity} onOpacity={setOpacity} hasBrigades={brigades.length > 0} />
        {selected && <ZonePopup key={selected.id} zone={selected} canManage={isAuthority} onEditImpact={setImpactZone} onClose={() => setSelectedId(null)} />}
        <MapLegend needs={needs} activeNeed={need} onNeed={setNeed} />

        {(loading || failed || noEmergency || (!loading && placed.length === 0)) && (
          <div className="gm-state" data-map-ui>
            {loading && <p>{t('gisMap.loading')}</p>}
            {failed && <p role="alert">{(emergency.error ?? ranking.error)?.detail ?? t('gisMap.loadError')}</p>}
            {noEmergency && <p>{t('gisMap.noEmergency')}</p>}
            {!loading && !failed && !noEmergency && placed.length === 0 && <p>{t('gisMap.empty')}{isAuthority ? ' ' + t('gisMap.emptyHint') : ''}</p>}
          </div>
        )}

        {impactZone && (
          <ImpactDialog
            key={impactZone.id}
            zone={impactZone}
            onClose={() => setImpactZone(null)}
            onSaved={(zone) => { setImpactZone(null); setNotice(t('gisMap.hints.updated', { name: zone.name })); }}
          />
        )}

        {draft && (
          <NewZoneDialog
            key={draft.lat + ',' + draft.lng}
            emergencyId={emergencyId}
            point={draft}
            onClose={() => setDraft(null)}
            onCreated={(zone) => {
              setDraft(null);
              setMode('move');
              setNotice(t('gisMap.hints.created', { name: zone.name }));
              if (zone.id) pendingFocus.current = zone.id;
              else flyTo({ lat: draft.lat, lng: draft.lng, zoom: 15 });
            }}
          />
        )}
      </div>
    </div>
  );
}
`);

write(PR + 'styles/gisMap.css', String.raw`
.gm-page { display: grid; align-content: start; gap: var(--space-3); }
.gm-head h1 { margin: 0 0 4px; font-size: 1.75rem; font-weight: 700; letter-spacing: -0.02em; }
.gm-head p { margin: 0; color: var(--night-100); }
.gm-stage { position: relative; height: clamp(560px, calc(100vh - 190px), 920px); border: 1px solid var(--cc-line); border-radius: 16px; overflow: hidden; background: #0b0b2e; }

/* Paneles flotantes */
.gm-panel { position: absolute; z-index: 20; padding: 14px 16px; border: 1px solid var(--cc-line); border-radius: 14px; background: rgba(33, 33, 97, 0.94); backdrop-filter: blur(6px); cursor: default; }
.gm-panel h2 { margin: 0; font-size: 1rem; font-weight: 700; }
.gm-note { margin: 0; font-size: 0.75rem; color: var(--night-100); }

.gm-layers { top: 12px; left: 12px; width: 290px; }
.gm-panel__head { display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 0; border: 0; background: transparent; color: #fff; font: inherit; cursor: pointer; }
.gm-layers__body { display: grid; gap: 12px; margin-top: 12px; }
.gm-switch { display: flex; align-items: center; gap: 10px; font-size: 0.875rem; cursor: pointer; }
.gm-switch input { position: absolute; opacity: 0; width: 1px; height: 1px; }
.gm-switch__track { position: relative; flex: none; width: 36px; height: 20px; border-radius: 999px; background: rgba(255, 255, 255, 0.18); transition: background 0.2s; }
.gm-switch__track::after { content: ''; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: #fff; transition: transform 0.2s; }
.gm-switch input:checked + .gm-switch__track { background: var(--color-emerald); }
.gm-switch input:checked + .gm-switch__track::after { transform: translateX(16px); }
.gm-switch input:focus-visible + .gm-switch__track { outline: 2px solid var(--color-sky); outline-offset: 2px; }
.gm-switch input:disabled ~ * { opacity: 0.45; }
.gm-switch i { flex: none; width: 9px; height: 9px; border-radius: 50%; }
.gm-opacity { display: grid; gap: 6px; font-size: 0.75rem; color: var(--night-100); }
.gm-opacity b { color: #fff; float: right; }
.gm-opacity input { width: 100%; accent-color: var(--color-lime); }

/* Barra superior central: búsqueda, herramientas y avisos */
.gm-top { position: absolute; z-index: 25; top: 12px; left: 322px; right: 410px; display: grid; justify-items: center; gap: 8px; pointer-events: none; }
.gm-top > * { pointer-events: auto; }
.gm-search { position: relative; display: flex; align-items: center; gap: 8px; width: min(460px, 100%); height: 42px; padding: 0 14px; border: 1px solid var(--cc-line); border-radius: 12px; background: rgba(33, 33, 97, 0.94); color: var(--night-100); }
.gm-search input { flex: 1; min-width: 0; height: 100%; border: 0; outline: 0; background: transparent; color: #fff; font: inherit; }
.gm-search:focus-within { border-color: var(--color-sky); }
.gm-search__list { position: absolute; top: calc(100% + 6px); left: 0; right: 0; display: grid; margin: 0; padding: 6px; list-style: none; border: 1px solid var(--cc-line); border-radius: 12px; background: #1a1a58; box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4); max-height: 300px; overflow-y: auto; }
.gm-search__list button { display: grid; gap: 2px; width: 100%; padding: 8px 10px; border: 0; border-radius: 8px; background: transparent; color: #fff; font: inherit; font-size: 0.8125rem; text-align: left; cursor: pointer; }
.gm-search__list button:hover, .gm-search__list button:focus-visible { background: rgba(255, 255, 255, 0.08); outline: none; }
.gm-search__list small { font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--color-sky); }
.gm-search__note { padding: 8px 10px; font-size: 0.75rem; color: var(--night-100); }
.gm-search__note.is-error { color: #ff9b9b; }

.gm-tools { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px; padding: 4px; border: 1px solid var(--cc-line); border-radius: 12px; background: rgba(33, 33, 97, 0.94); }
.gm-tools button { min-height: 34px; padding: 0 14px; border: 0; border-radius: 9px; background: transparent; color: var(--night-100); font: inherit; font-size: 0.8125rem; font-weight: 600; cursor: pointer; transition: background 0.15s, color 0.15s; }
.gm-tools button:hover:not(:disabled) { background: rgba(255, 255, 255, 0.08); color: #fff; }
.gm-tools button[aria-pressed='true'] { background: var(--color-lime); color: var(--night-600); }
.gm-tools button:disabled { opacity: 0.4; cursor: not-allowed; }
.gm-tools button:focus-visible { outline: 2px solid var(--color-sky); outline-offset: 1px; }
.gm-hint { margin: 0; padding: 6px 14px; border-radius: 999px; background: rgba(33, 33, 97, 0.94); border: 1px solid var(--cc-line); font-size: 0.8125rem; text-align: center; }

/* Tarjeta de la zona */
.gm-popup { top: 12px; right: 12px; width: 374px; max-height: calc(100% - 24px); overflow-y: auto; display: grid; gap: 12px; }
.gm-popup header { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 12px; }
.gm-popup header p { margin: 2px 0 0; font-size: 0.75rem; color: var(--night-100); }
.gm-popup__score { display: grid; place-items: center; min-width: 40px; height: 28px; padding: 0 8px; border-radius: 999px; color: var(--night-600); font-weight: 800; font-size: 0.8125rem; }
.gm-x { width: 32px; height: 32px; border: 0; border-radius: 8px; background: transparent; color: var(--night-100); font-size: 1.25rem; cursor: pointer; }
.gm-x:hover { background: rgba(255, 255, 255, 0.08); color: #fff; }
.gm-popup__why { padding: 10px 12px; border-radius: 10px; background: var(--cc-card-inner); }
.gm-popup__why h3 { margin: 0 0 6px; font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--color-sky); }
.gm-popup__why p { margin: 0; font-size: 0.8125rem; color: var(--night-100); }
.gm-popup__why ul { display: grid; gap: 4px; margin: 0; padding: 0; list-style: none; font-size: 0.8125rem; }
.gm-popup__why li { display: flex; justify-content: space-between; gap: 8px; }
.gm-popup__why b { font-variant-numeric: tabular-nums; color: var(--color-lime); }
.gm-popup__facts { display: grid; gap: 6px; margin: 0; font-size: 0.8125rem; }
.gm-popup__facts div { display: flex; justify-content: space-between; gap: 12px; }
.gm-popup__facts dt { color: var(--night-100); }
.gm-popup__facts dd { margin: 0; text-align: right; font-weight: 600; font-variant-numeric: tabular-nums; }
.gm-popup__actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.gm-popup__actions:has(a:only-child) { grid-template-columns: 1fr; }

.gm-btn-lime, .gm-btn-outline { display: inline-grid; place-items: center; min-height: 40px; padding: 0 16px; border-radius: 10px; font: inherit; font-size: 0.875rem; font-weight: 700; text-decoration: none; cursor: pointer; transition: filter 0.2s, background 0.2s; }
.gm-btn-lime { border: 0; background: var(--color-lime); color: var(--night-600); }
.gm-btn-lime:hover:not(:disabled) { filter: brightness(1.06); }
.gm-btn-outline { border: 1.5px solid rgba(255, 255, 255, 0.85); background: transparent; color: #fff; }
.gm-btn-outline:hover { background: rgba(255, 255, 255, 0.08); }
.gm-btn-lime:disabled { opacity: 0.5; cursor: not-allowed; }
.gm-page a.gm-btn-lime { color: var(--night-600); }
.gm-page a.gm-btn-outline { color: #fff; }
.gm-btn-lime:focus-visible, .gm-btn-outline:focus-visible { outline: 2px solid var(--color-sky); outline-offset: 2px; }

/* Leyenda */
.gm-legend { left: 12px; bottom: 12px; width: min(300px, calc(100% - 100px)); display: grid; gap: 8px; }
.gm-legend h2 { font-size: 0.6875rem; letter-spacing: 0.06em; text-transform: uppercase; color: var(--color-sky); }
.gm-legend__bar { height: 10px; border-radius: 999px; }
.gm-legend__ends { display: flex; justify-content: space-between; font-size: 0.6875rem; color: var(--night-100); }
.gm-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.gm-chip { min-height: 28px; padding: 0 12px; border: 1px solid var(--cc-line); border-radius: 999px; background: rgba(255, 255, 255, 0.04); color: var(--night-100); font: inherit; font-size: 0.75rem; cursor: pointer; }
.gm-chip[aria-pressed='true'] { border-color: var(--color-lime); color: var(--color-lime); background: rgba(190, 242, 100, 0.08); font-weight: 700; }
.gm-chip:focus-visible { outline: 2px solid var(--color-sky); outline-offset: 2px; }

/* Marcadores */
.gm-pin, .gm-cluster, .gm-brigade, .gm-draft { position: absolute; left: 0; top: 0; z-index: 10; }
.gm-pin { width: 18px; height: 18px; margin: -9px 0 0 -9px; padding: 0; border: 2px solid #fff; border-radius: 50%; background: var(--pin); box-shadow: 0 0 0 3px rgba(11, 11, 46, 0.55); cursor: pointer; }
.gm-pin.is-critical { width: 22px; height: 22px; margin: -11px 0 0 -11px; }
.gm-pin:hover, .gm-pin:focus-visible { z-index: 14; outline: none; box-shadow: 0 0 0 4px rgba(133, 213, 246, 0.6); }
.gm-pin.is-selected { z-index: 13; box-shadow: 0 0 0 4px var(--color-sky), 0 0 0 9px rgba(133, 213, 246, 0.25); }
.gm-pin__label { position: absolute; left: 50%; bottom: calc(100% + 9px); transform: translateX(-50%); padding: 3px 8px; border-radius: 6px; background: #0b0b2e; border: 1px solid var(--cc-line); color: #fff; font-size: 0.6875rem; font-weight: 600; white-space: nowrap; pointer-events: none; opacity: 0; transition: opacity 0.15s; }
.gm-pin:hover .gm-pin__label, .gm-pin:focus-visible .gm-pin__label, .gm-pin.is-selected .gm-pin__label { opacity: 1; }
.gm-cluster { width: 38px; height: 38px; margin: -19px 0 0 -19px; padding: 0; border: 3px solid var(--pin); border-radius: 50%; background: rgba(11, 11, 46, 0.85); color: #fff; font: inherit; font-size: 0.8125rem; font-weight: 800; cursor: pointer; }
.gm-cluster:hover, .gm-cluster:focus-visible { background: var(--pin); color: var(--night-600); outline: none; }
.gm-brigade { width: 11px; height: 11px; margin: -5px 0 0 -5px; border: 1.5px solid #0b0b2e; z-index: 9; }
.gm[data-mode='measure'] .gm-pin, .gm[data-mode='measure'] .gm-cluster, .gm[data-mode='create'] .gm-pin, .gm[data-mode='create'] .gm-cluster { pointer-events: none; }
.gm-draft { width: 20px; height: 20px; margin: -10px 0 0 -10px; border: 3px solid var(--color-lime); border-radius: 50%; background: rgba(190, 242, 100, 0.25); animation: gm-pulse 1.4s ease-out infinite; pointer-events: none; }
@keyframes gm-pulse { 0% { box-shadow: 0 0 0 0 rgba(190, 242, 100, 0.6); } 100% { box-shadow: 0 0 0 16px rgba(190, 242, 100, 0); } }
.gm-measure { position: absolute; left: 0; top: 0; pointer-events: none; z-index: 12; }
.gm-measure polyline { fill: none; stroke: var(--color-sky); stroke-width: 2.5; stroke-dasharray: 6 5; }
.gm-measure circle { fill: #0b0b2e; stroke: var(--color-sky); stroke-width: 2.5; }
.gm-measure text { fill: #fff; font-size: 12px; font-weight: 700; paint-order: stroke; stroke: #0b0b2e; stroke-width: 4px; }

.gm-state { position: absolute; z-index: 22; left: 50%; top: 50%; transform: translate(-50%, -50%); max-width: min(420px, 80%); padding: 16px 20px; border: 1px solid var(--cc-line); border-radius: 14px; background: rgba(33, 33, 97, 0.96); text-align: center; }
.gm-state p { margin: 0; font-size: 0.9375rem; }

/* Diálogo de nueva zona */
.gm-backdrop { position: absolute; inset: 0; z-index: 40; background: rgba(5, 5, 30, 0.6); }
.gm-dialog { position: absolute; z-index: 41; top: 50%; left: 50%; display: grid; gap: 12px; width: min(440px, calc(100% - 32px)); max-height: calc(100% - 32px); overflow-x: hidden; overflow-y: auto; padding: 24px; border: 1px solid var(--cc-line); border-radius: 16px; background: var(--cc-card); transform: translate(-50%, -50%); }
.gm-dialog h2 { margin: 0; font-size: 1.125rem; }
.gm-field { display: grid; gap: 6px; font-size: 0.8125rem; font-weight: 500; }
.gm-field input { width: 100%; min-width: 0; height: 40px; padding: 0 12px; border: 1px solid var(--cc-line); border-radius: 10px; background: var(--cc-card-inner); color: #fff; font: inherit; }
.gm-field input:focus-visible { outline: 2px solid var(--color-sky); outline-offset: 1px; }
.gm-field-row, .gm-dialog__actions { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px; }
.gm-error { margin: 0; color: #ff9b9b; font-size: 0.875rem; }
.gm-field select { width: 100%; height: 40px; padding: 0 12px; border: 1px solid var(--cc-line); border-radius: 10px; background: var(--cc-card-inner); color: #fff; font: inherit; color-scheme: dark; }
.gm-field select:focus-visible { outline: 2px solid var(--color-sky); outline-offset: 1px; }
.gm-impact { margin: 0; padding: 0; border: 0; min-width: 0; }
.gm-impact legend { margin-bottom: 8px; padding: 0; font-size: 0.8125rem; font-weight: 600; }
.gm-impact__grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 10px 12px; }
.gm-link { justify-self: start; padding: 0; border: 0; background: transparent; color: var(--color-sky); font: inherit; font-size: 0.8125rem; font-weight: 600; text-decoration: underline; cursor: pointer; }
.gm-link:focus-visible { outline: 2px solid var(--color-sky); outline-offset: 2px; }

/* Pantallas medianas y pequeñas: los paneles se apilan en vez de taparse */
@media (max-width: 1280px) {
  .gm-top { right: 12px; left: 322px; }
  .gm-popup { top: auto; bottom: 12px; right: 64px; width: min(374px, calc(100% - 340px)); max-height: 60%; }
}
@media (max-width: 900px) {
  .gm-stage { height: clamp(520px, 80vh, 760px); }
  .gm-layers { width: calc(100% - 24px); }
  .gm-top { left: 12px; top: 64px; }
  .gm-popup { left: 12px; right: 12px; width: auto; bottom: 12px; }
  .gm-legend { display: none; }
}
@media (prefers-reduced-motion: reduce) { .gm-draft { animation: none; } }
`);

/* ════════════════════════ TEXTOS ════════════════════════ */
mergeJson(EM + 'presentation/i18n/es.json', { gisMap: {
  title: 'Mapa GIS multivariable',
  subtitle: '{{zones}} zonas con ubicación · {{critical}} críticas',
  noEmergency: 'No hay una emergencia activa.',
  loading: 'Cargando zonas…',
  loadError: 'No se pudieron cargar las zonas.',
  empty: 'Todavía no hay zonas con coordenadas en esta emergencia.',
  emptyHint: 'Usa «Nueva zona» y haz clic en el mapa para registrar la primera.',
  cluster: '{{count}} zonas agrupadas: acercar',
  brigade: 'Brigada {{name}}',
  map: { label: 'Mapa de calor de zonas por prioridad', zoomIn: 'Acercar', zoomOut: 'Alejar' },
  search: {
    placeholder: 'Buscar zona, lugar o coordenadas', label: 'Buscar en el mapa', zone: 'Zona', place: 'Lugar',
    coordinates: 'Ir a {{value}}', searching: 'Buscando…', noResults: 'Sin resultados.', hint: 'Pulsa Enter para buscar también lugares.',
    error: 'No se pudo buscar el lugar. Intenta de nuevo.',
  },
  tools: { label: 'Herramientas del mapa', move: 'Mover', measure: 'Medir', newZone: 'Nueva zona', clear: 'Borrar', recenter: 'Recentrar' },
  hints: {
    measureEmpty: 'Haz clic en el mapa para marcar puntos y medir distancias.',
    measure: 'Distancia total: {{distance}}',
    create: 'Haz clic donde está la zona afectada para registrarla.',
    created: 'Zona registrada: {{name}}.',
    updated: 'Población actualizada: {{name}}.',
  },
  layers: {
    title: 'Capas', heat: 'Mapa de calor de prioridad', zones: 'Zonas (marcadores)', brigades: 'Brigadas (base GPS)',
    opacity: 'Opacidad del calor', unavailable: 'Las zonas inundadas y la cobertura celular aún no las entrega el servicio.',
  },
  legend: { title: 'Leyenda', low: 'Demanda baja', critical: 'Crítica', needs: 'Necesidad', all: 'Todas' },
  popup: {
    reasons: 'Por qué esta prioridad', noScore: 'Sin puntaje de urgencia', noScoreHint: 'Aún no tiene puntaje: falta registrar la población o reportes de campo.',
    noReasons: 'No hay detalle disponible del puntaje.', manual: 'Prioridad manual', needs: 'Necesidades', damage: 'Daño', people: 'Personas afectadas',
    status: 'Estado', gps: 'GPS', assign: 'Asignar brigada', detail: 'Ver detalle', close: 'Cerrar', editImpact: 'Editar población afectada',
    level: { CRITICAL: 'Prioridad crítica', HIGH: 'Prioridad alta', MEDIUM: 'Prioridad media', LOW: 'Prioridad baja' },
  },
  dialog: {
    title: 'Nueva zona', intro: 'Se registra en la emergencia activa. Con la población afectada, el puntaje de urgencia se calcula al instante.',
    name: 'Nombre de la zona', namePlaceholder: 'Ej. Sector Santa Rosa', latitude: 'Latitud', longitude: 'Longitud',
    damage: 'Nivel de daño', damageNone: 'Sin especificar', cancel: 'Cancelar', create: 'Registrar zona', creating: 'Registrando…',
    impactTitle: 'Población afectada de {{name}}', impactIntro: 'Solo cambian los datos que escribas; el puntaje de urgencia se recalcula.', save: 'Guardar', saving: 'Guardando…',
  },
  impact: {
    title: 'Población afectada (opcional)', population: 'Población total', familiesAffected: 'Familias afectadas', peopleAffected: 'Personas afectadas',
    children: 'Niños', elderlyPeople: 'Adultos mayores', disabledPeople: 'Personas con discapacidad',
  },
  errors: {
    nameRequired: 'Escribe el nombre de la zona.', nameTooLong: 'El nombre puede tener hasta 150 caracteres.',
    latitudeInvalid: 'La latitud debe estar entre -90 y 90.', longitudeInvalid: 'La longitud debe estar entre -180 y 180.',
    countInvalid: 'Los datos de población deben ser números enteros iguales o mayores que 0.', impactEmpty: 'Escribe al menos un dato de población.', noEmergency: 'No hay una emergencia activa donde registrar la zona.',
    forbidden: 'Solo una autoridad puede registrar zonas.', generic: 'No se pudo registrar la zona.',
  },
} });
mergeJson(EM + 'presentation/i18n/en.json', { gisMap: {
  title: 'Multivariable GIS map',
  subtitle: '{{zones}} zones with a location · {{critical}} critical',
  noEmergency: 'There is no active emergency.',
  loading: 'Loading zones…',
  loadError: 'The zones could not be loaded.',
  empty: 'There are no zones with coordinates in this emergency yet.',
  emptyHint: 'Use "New zone" and click on the map to register the first one.',
  cluster: '{{count}} zones grouped: zoom in',
  brigade: 'Brigade {{name}}',
  map: { label: 'Zone priority heat map', zoomIn: 'Zoom in', zoomOut: 'Zoom out' },
  search: {
    placeholder: 'Search zone, place or coordinates', label: 'Search the map', zone: 'Zone', place: 'Place',
    coordinates: 'Go to {{value}}', searching: 'Searching…', noResults: 'No results.', hint: 'Press Enter to search places too.',
    error: 'The place could not be searched. Try again.',
  },
  tools: { label: 'Map tools', move: 'Move', measure: 'Measure', newZone: 'New zone', clear: 'Clear', recenter: 'Recenter' },
  hints: {
    measureEmpty: 'Click on the map to mark points and measure distances.',
    measure: 'Total distance: {{distance}}',
    create: 'Click where the affected zone is to register it.',
    created: 'Zone registered: {{name}}.',
    updated: 'Population updated: {{name}}.',
  },
  layers: {
    title: 'Layers', heat: 'Priority heat map', zones: 'Zones (markers)', brigades: 'Brigades (GPS base)',
    opacity: 'Heat opacity', unavailable: 'Flooded zones and cell coverage are not provided by the service yet.',
  },
  legend: { title: 'Legend', low: 'Low demand', critical: 'Critical', needs: 'Need', all: 'All' },
  popup: {
    reasons: 'Why this priority', noScore: 'No urgency score', noScoreHint: 'It has no score yet: the population or field reports are missing.',
    noReasons: 'No score detail is available.', manual: 'Manual priority', needs: 'Needs', damage: 'Damage', people: 'People affected',
    status: 'Status', gps: 'GPS', assign: 'Assign brigade', detail: 'View detail', close: 'Close', editImpact: 'Edit affected population',
    level: { CRITICAL: 'Critical priority', HIGH: 'High priority', MEDIUM: 'Medium priority', LOW: 'Low priority' },
  },
  dialog: {
    title: 'New zone', intro: 'It is registered in the active emergency. With the affected population, the urgency score is calculated right away.',
    name: 'Zone name', namePlaceholder: 'E.g. Santa Rosa sector', latitude: 'Latitude', longitude: 'Longitude',
    damage: 'Damage level', damageNone: 'Not specified', cancel: 'Cancel', create: 'Register zone', creating: 'Registering…',
    impactTitle: 'Affected population of {{name}}', impactIntro: 'Only the data you enter changes; the urgency score is recalculated.', save: 'Save', saving: 'Saving…',
  },
  impact: {
    title: 'Affected population (optional)', population: 'Total population', familiesAffected: 'Families affected', peopleAffected: 'People affected',
    children: 'Children', elderlyPeople: 'Elderly people', disabledPeople: 'People with disabilities',
  },
  errors: {
    nameRequired: 'Enter the zone name.', nameTooLong: 'The name can have up to 150 characters.',
    latitudeInvalid: 'Latitude must be between -90 and 90.', longitudeInvalid: 'Longitude must be between -180 and 180.',
    countInvalid: 'The population data must be whole numbers equal to or greater than 0.', impactEmpty: 'Enter at least one population figure.', noEmergency: 'There is no active emergency to register the zone in.',
    forbidden: 'Only an authority can register zones.', generic: 'The zone could not be registered.',
  },
} });

/* ════════════════════════ "ASIGNAR BRIGADA" DESDE EL MAPA (opcional) ════════════════════════ */
// La bandeja de priorización abre el panel de asignación cuando la URL trae ?view=assign.
softPatch(PR + 'pages/prioritizationPage.jsx', [
  [
    '          canManage={isAuthority}\n          onClose={() => select(null)}',
    "          canManage={isAuthority}\n          initialView={searchParams.get('view') === 'assign' ? 'assign' : 'detail'}\n          onClose={() => select(null)}",
  ],
  [
    "    const next = new URLSearchParams(searchParams);\n    if (id) next.set('zone', id);",
    "    const next = new URLSearchParams(searchParams);\n    next.delete('view');\n    if (id) next.set('zone', id);",
  ],
]);
softPatch(PR + 'components/scoreDrawer.jsx', [
  ['export default function ScoreDrawer({ zoneId, row, canManage, onClose }) {', "export default function ScoreDrawer({ zoneId, row, canManage, initialView = 'detail', onClose }) {"],
  ["const [view, setView] = useState('detail'); // 'detail' | 'assign'", "const [view, setView] = useState(initialView); // 'detail' | 'assign'"],
  ["    setOverriding(false);\n    setView('detail');\n", "    setOverriding(false);\n    setView(initialView);\n"],
]);

console.log('\nListo. Reinicia "npm run dev" y entra a Mapa GIS.');
console.log('Teselas: OpenStreetMap con estilo oscuro (CARTO). Para otro proveedor define VITE_MAP_TILES_URL en .env.');
