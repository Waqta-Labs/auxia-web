// Mapa GIS multivariable (W_02) con motor de mapa PROPIO. Uso (en la raíz del proyecto): node buildGisMap.mjs   (se puede repetir)
// No usa Leaflet, iframes ni servicios externos: proyección Web Mercator, mapa base dibujado con los límites públicos del Perú
// (departamentos, provincias y distritos, guardados en el proyecto) y una capa de calor en canvas con el color de la prioridad. Backend: GET /emergencies/{id}/zones, GET /zones/{id},
// POST /emergencies/{id}/zones (registrar zona).
import { mkdirSync, writeFileSync, readFileSync, existsSync, unlinkSync } from 'node:fs';
import { dirname } from 'node:path';
import { gunzipSync } from 'node:zlib';

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

/* ════════════════════════ CONFIGURACIÓN DEL MAPA (sin servicios externos) ════════════════════════ */
{
  const envPath = 'src/shared/infrastructure/config/env.js';
  const block =
    "  // Mapa propio: los límites del Perú vienen dentro del proyecto. Teselas externas SOLO si defines VITE_MAP_TILES_URL\n" +
    "  // (plantilla con {z}/{x}/{y}; {s} = a|b|c y {r} = @2x); en ese caso ajusta también VITE_MAP_ATTRIBUTION.\n" +
    "  mapTilesUrl: import.meta.env.VITE_MAP_TILES_URL || '',\n" +
    "  mapAttribution: import.meta.env.VITE_MAP_ATTRIBUTION || 'Límites: peru-geojson (MPL-2.0)',\n";
  const { text, crlf } = readLf(envPath);
  if (!text.includes(block)) {
    const old = /  \/\/ Teselas del mapa propio[^\n]*\n(?:  \/\/[^\n]*\n)*  mapTilesUrl:[^\n]*\n  mapAttribution:[^\n]*\n/;
    let next;
    if (old.test(text)) next = text.replace(old, () => block);
    else if (text.includes('\n});')) next = text.replace('\n});', () => '\n' + block + '});');
    else throw new Error('No encontré el cierre de ' + envPath);
    writeLf(envPath, next, crlf);
    console.log('~ ' + envPath);
  }
}

/* ════════════════════════ MOTOR DE MAPA (shared) ════════════════════════ */
const GM = 'src/shared/presentation/components/geoMap/';

write(GM + 'mercator.js', String.raw`
// Matemática del mapa: proyección Web Mercator (la misma de OpenStreetMap), teselas de 256 px.
export const TILE = 256;
export const MIN_ZOOM = 3;
export const MAX_ZOOM = 17;
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

// Mapa propio: arrastrar, rueda, pellizco, doble clic y teclado. Las teselas son opcionales (env.mapTilesUrl); sin ellas
// el mapa base lo dibuja BaseLayer con los límites del Perú.
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
  if (ready && env.mapTilesUrl) {
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
        {env.mapAttribution && <p className="gm__attr">{env.mapAttribution}</p>}
      </div>
    </div>
  );
}
`);

write(GM + 'geoMap.css', String.raw`
.gm {
  position: relative; width: 100%; height: 100%; overflow: hidden; touch-action: none; user-select: none; outline: none;
  background-color: #0b0b2e;
  cursor: grab;
}
.gm:active { cursor: grabbing; }
.gm[data-mode='measure'], .gm[data-mode='create'] { cursor: crosshair; }
.gm:focus-visible { box-shadow: inset 0 0 0 2px var(--color-sky); }
.gm__tiles { position: absolute; inset: 0; overflow: hidden; }
.gm__tile { position: absolute; left: 0; top: 0; max-width: none; pointer-events: none; filter: saturate(0.85) brightness(0.95); }
.gm__tiles::after { content: ''; position: absolute; inset: 0; background: rgba(16, 16, 58, 0.28); pointer-events: none; }
.gm__base { position: absolute; left: 0; top: 0; pointer-events: none; }
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

/* ════════════════════════ LÍMITES DEL PERÚ (datos propios del proyecto) ════════════════════════ */
// Departamentos, provincias y distritos simplificados (dataset público juaneladio/peru-geojson, licencia MPL-2.0), comprimidos aquí.
const GEO = {
  departments: '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',
  provinces: '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',
  districts: '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',
};
for (const [level, encoded] of Object.entries(GEO)) {
  write(GM + 'data/' + level + '.json', gunzipSync(Buffer.from(encoded, 'base64')).toString('utf8'));
}
// Reemplaza la búsqueda externa (Nominatim) de versiones anteriores del script.
if (existsSync('src/shared/infrastructure/geocoding/placeSearch.js')) { unlinkSync('src/shared/infrastructure/geocoding/placeSearch.js'); console.log('- src/shared/infrastructure/geocoding/placeSearch.js (ya no se usa)'); }

write(GM + 'boundaries.js', String.raw`
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
`);

write(GM + 'baseLayer.jsx', String.raw`
import { useEffect, useRef } from 'react';
import { project } from './mercator.js';

const clamp01 = (value) => Math.min(1, Math.max(0, value));

function trace(g, feature, scale, ox, oy) {
  for (const rings of feature.polys) {
    for (const ring of rings) {
      let lastX = 0;
      let lastY = 0;
      for (let i = 0; i < ring.length; i += 2) {
        const x = ring[i] * scale + ox;
        const y = ring[i + 1] * scale + oy;
        if (i === 0) g.moveTo(x, y);
        else if (Math.abs(x - lastX) + Math.abs(y - lastY) >= 0.7 || i >= ring.length - 2) g.lineTo(x, y);
        else continue;
        lastX = x;
        lastY = y;
      }
      g.closePath();
    }
  }
}

// Mapa base propio: dibuja los límites del Perú en un canvas (relleno, líneas por nivel y nombres).
export default function BaseLayer({ boundaries, view, size, highlight = null, lines = true, fill = true }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.w === 0 || size.h === 0) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(size.w * dpr);
    canvas.height = Math.round(size.h * dpr);
    const g = canvas.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, size.w, size.h);

    const zoom = view.zoom;
    const scale = 2 ** zoom;
    const c = project(view.lat, view.lng, 0);
    const ox = size.w / 2 - c.x * scale;
    const oy = size.h / 2 - c.y * scale;
    const visible = (features) =>
      (features ?? []).filter((f) => f.bbox[2] * scale + ox >= -20 && f.bbox[0] * scale + ox <= size.w + 20 && f.bbox[3] * scale + oy >= -20 && f.bbox[1] * scale + oy <= size.h + 20);
    g.lineJoin = 'round';

    const departments = visible(boundaries.departments);
    if (fill && departments.length > 0) {
      g.beginPath();
      for (const f of departments) trace(g, f, scale, ox, oy);
      g.fillStyle = '#16164a';
      g.fill('evenodd');
    }

    if (lines) {
      const stroke = (features, color, width) => {
        if (features.length === 0) return;
        g.beginPath();
        for (const f of features) trace(g, f, scale, ox, oy);
        g.strokeStyle = color;
        g.lineWidth = width;
        g.stroke();
      };
      const districtAlpha = clamp01((zoom - 8.4) / 1.2);
      if (districtAlpha > 0) stroke(visible(boundaries.districts), 'rgba(255,255,255,' + 0.17 * districtAlpha + ')', 0.8);
      const provinceAlpha = clamp01((zoom - 5.8) / 1.2);
      if (provinceAlpha > 0) stroke(visible(boundaries.provinces), 'rgba(133,213,246,' + 0.42 * provinceAlpha + ')', 1);
      stroke(departments, 'rgba(133,213,246,0.7)', 1.4);
    }

    if (highlight) {
      g.beginPath();
      trace(g, highlight, scale, ox, oy);
      g.fillStyle = 'rgba(188,251,137,0.1)';
      g.fill('evenodd');
      g.strokeStyle = '#bcfb89';
      g.lineWidth = 2;
      g.stroke();
    }

    // Nombres: un solo nivel a la vez y sin que se pisen.
    if (lines) {
      const level = zoom < 6.6 ? 'departments' : zoom < 9.4 ? 'provinces' : 'districts';
      const family = getComputedStyle(canvas).fontFamily || 'sans-serif';
      g.font = '600 ' + (level === 'departments' ? 12 : 11.5) + 'px ' + family;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineWidth = 3;
      g.strokeStyle = 'rgba(11,11,46,0.9)';
      g.fillStyle = 'rgba(255,255,255,0.74)';
      const placed = [];
      const candidates = visible(boundaries[level]).sort((a, b) => (b.bbox[2] - b.bbox[0]) * (b.bbox[3] - b.bbox[1]) - (a.bbox[2] - a.bbox[0]) * (a.bbox[3] - a.bbox[1]));
      for (const f of candidates) {
        const x = f.center.x * scale + ox;
        const y = f.center.y * scale + oy;
        if (x < 10 || y < 10 || x > size.w - 10 || y > size.h - 10) continue;
        const text = level === 'departments' ? f.name.toUpperCase() : f.name;
        const width = g.measureText(text).width;
        if (level !== 'departments' && (f.bbox[2] - f.bbox[0]) * scale < width * 0.7) continue;
        const rect = [x - width / 2 - 4, y - 9, x + width / 2 + 4, y + 9];
        if (placed.some((p) => rect[0] < p[2] && rect[2] > p[0] && rect[1] < p[3] && rect[3] > p[1])) continue;
        placed.push(rect);
        g.strokeText(text, x, y);
        g.fillText(text, x, y);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boundaries, highlight, lines, fill, view.lat, view.lng, view.zoom, size.w, size.h]);

  return <canvas ref={canvasRef} className="gm__base" style={{ width: size.w, height: size.h }} aria-hidden="true" />;
}
`);

write('src/shared/presentation/hooks/useBoundaries.js', String.raw`
import { useEffect, useState } from 'react';
import { LEVELS, loadBoundaries } from '@shared/presentation/components/geoMap/boundaries.js';

// Carga los límites del Perú por niveles (departamentos primero, distritos al final) sin bloquear la pantalla.
export function useBoundaries() {
  const [state, setState] = useState({ departments: null, provinces: null, districts: null });
  useEffect(() => {
    let alive = true;
    (async () => {
      for (const level of LEVELS) {
        try {
          const features = await loadBoundaries(level);
          if (!alive) return;
          setState((current) => ({ ...current, [level]: features }));
        } catch {
          /* sin esos datos el mapa sigue funcionando */
        }
      }
    })();
    return () => { alive = false; };
  }, []);
  return state;
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
import { describe, normalizeText, parseCoordinates, searchRegions } from '@shared/presentation/components/geoMap/boundaries.js';

// Busca al escribir entre las zonas, los departamentos / provincias / distritos del Perú y coordenadas. Todo es local.
export default function MapSearch({ zones, boundaries, onPickZone, onPickRegion, onPickPoint }) {
  const { t } = useTranslation('emergencyManagement');
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const query = text.trim();
  const coordinates = useMemo(() => parseCoordinates(query), [query]);
  const zoneResults = useMemo(() => {
    const q = normalizeText(query);
    if (q.length < 2) return [];
    return zones.filter((zone) => normalizeText(zone.name).includes(q)).slice(0, 4);
  }, [query, zones]);
  const regionResults = useMemo(() => searchRegions(boundaries, query, 6), [boundaries, query]);
  const loadingPlaces = query.length >= 2 && !boundaries.districts;

  useEffect(() => {
    const onDown = (event) => { if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false); };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, []);

  const pickZone = (zone) => { setOpen(false); setText(zone.name); onPickZone(zone); };
  const pickRegion = (feature) => { setOpen(false); setText(describe(feature)); onPickRegion(feature); };
  const pickPoint = () => { setOpen(false); onPickPoint(coordinates); };

  const submit = (event) => {
    event.preventDefault();
    if (coordinates) pickPoint();
    else if (zoneResults[0]) pickZone(zoneResults[0]);
    else if (regionResults[0]) pickRegion(regionResults[0]);
  };

  const empty = query.length >= 2 && !coordinates && zoneResults.length === 0 && regionResults.length === 0;
  const showList = open && (coordinates || zoneResults.length > 0 || regionResults.length > 0 || loadingPlaces || empty);
  return (
    <form className="gm-search" role="search" ref={rootRef} onSubmit={submit} data-map-ui>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
      <input
        type="search"
        value={text}
        placeholder={t('gisMap.search.placeholder')}
        aria-label={t('gisMap.search.label')}
        onChange={(event) => { setText(event.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
      />
      {showList && (
        <ul className="gm-search__list" role="listbox" aria-label={t('gisMap.search.label')}>
          {coordinates && (
            <li>
              <button type="button" role="option" onClick={pickPoint}>
                <small>GPS</small>{t('gisMap.search.coordinates', { value: coordinates.lat + ', ' + coordinates.lng })}
              </button>
            </li>
          )}
          {zoneResults.map((zone) => (
            <li key={zone.id}>
              <button type="button" role="option" onClick={() => pickZone(zone)}>
                <small>{t('gisMap.search.zone')}</small>{zone.name}
              </button>
            </li>
          ))}
          {regionResults.map((feature) => (
            <li key={feature.key}>
              <button type="button" role="option" onClick={() => pickRegion(feature)}>
                <small>{t('gisMap.search.' + feature.kind)}</small>{describe(feature)}
              </button>
            </li>
          ))}
          {loadingPlaces && <li className="gm-search__note">{t('gisMap.search.loadingPlaces')}</li>}
          {empty && !loadingPlaces && <li className="gm-search__note">{t('gisMap.search.noResults')}</li>}
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

const DOTS = { heat: HEAT_RAMP[3][1], zones: '#ffffff', brigades: '#85d5f6', boundaries: '#8c8cc9' };

// Capas del mapa: interruptores y opacidad del calor.
export default function LayersPanel({ layers, onToggle, opacity, onOpacity, hasBrigades }) {
  const { t } = useTranslation('emergencyManagement');
  const [open, setOpen] = useState(() => (typeof window === 'undefined' ? true : window.innerWidth >= 1000));
  const rows = [
    ['heat', t('gisMap.layers.heat')],
    ['zones', t('gisMap.layers.zones')],
    ['brigades', t('gisMap.layers.brigades')],
    ['boundaries', t('gisMap.layers.boundaries')],
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
export default function ZonePopup({ zone, placeLabel, canManage, onEditImpact, onClose }) {
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
    ...(placeLabel ? [[t('gisMap.popup.place'), placeLabel]] : []),
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
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { describe, locate } from '@shared/presentation/components/geoMap/boundaries.js';
import { DAMAGE_LEVELS } from '../../domain/enums/damageLevel.js';
import { useRegisterZone } from '../hooks/useRegisterZone.js';
import ImpactFields from './impactFields.jsx';

const EMPTY_IMPACT = { population: '', familiesAffected: '', peopleAffected: '', children: '', elderlyPeople: '', disabledPeople: '' };

// Registra una zona en el punto marcado en el mapa. La ubicación se puede ajustar a mano.
export default function NewZoneDialog({ emergencyId, point, boundaries, onClose, onCreated }) {
  const { t } = useTranslation('emergencyManagement');
  const register = useRegisterZone();
  const [name, setName] = useState('');
  const [latitude, setLatitude] = useState(point.lat.toFixed(6));
  const [longitude, setLongitude] = useState(point.lng.toFixed(6));
  const [damageLevel, setDamageLevel] = useState('');
  const [impact, setImpact] = useState(EMPTY_IMPACT);
  const [error, setError] = useState(null);
  const nameRef = useRef(null);

  // En qué distrito cae la ubicación escrita (aviso si queda fuera del Perú; no bloquea el registro).
  const place = useMemo(() => {
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!boundaries.departments || latitude.trim() === '' || longitude.trim() === '' || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const feature = locate(boundaries, lat, lng);
    return feature ? { name: describe(feature) } : { outside: true };
  }, [boundaries, latitude, longitude]);

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
        {place && <p className={'gm-note' + (place.outside ? ' is-warn' : '')}>{place.outside ? t('gisMap.dialog.outside') : t('gisMap.dialog.place', { name: place.name })}</p>}
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
import BaseLayer from '@shared/presentation/components/geoMap/baseLayer.jsx';
import { describe, featureBounds, locate } from '@shared/presentation/components/geoMap/boundaries.js';
import { useBoundaries } from '@shared/presentation/hooks/useBoundaries.js';
import { env } from '@shared/infrastructure/config/env.js';
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

// Sin zonas con ubicación se ve todo el Perú; con zonas, el mapa se encuadra solo sobre ellas.
const PERU_BOUNDS = [{ lat: -0.04, lng: -81.4 }, { lat: -18.4, lng: -68.6 }];
const DEFAULT_VIEW = { lat: -9.2, lng: -75.0, zoom: 5.3 };
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
  const [layers, setLayers] = useState({ heat: true, zones: true, brigades: true, boundaries: true });
  const boundaries = useBoundaries();
  const [place, setPlace] = useState(null); // { feature, lat, lng } | { outside: true, lat, lng }
  const stageRef = useRef(null);
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
  const selectedPlace = useMemo(() => {
    const feature = selected ? locate(boundaries, selected.latitude, selected.longitude) : null;
    return feature ? describe(feature) : null;
  }, [selected, boundaries]);
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
    else {
      setSelectedId(null);
      const feature = locate(boundaries, lat, lon);
      if (feature) setPlace({ feature, lat, lng: lon });
      else setPlace(boundaries.departments ? { outside: true, lat, lng: lon } : null);
    }
  };

  const fitBounds = (points, options) => {
    const stage = stageRef.current;
    const next = boundsView(points, stage?.clientWidth || 900, stage?.clientHeight || 600, options);
    if (next) flyTo(next);
  };
  const flyToRegion = (feature) => { setSelectedId(null); setPlace({ feature }); fitBounds(featureBounds(feature), { padding: 60, maxZoom: 14 }); };
  const flyToPoint = ({ lat, lng: lon }) => {
    const feature = locate(boundaries, lat, lon);
    setPlace(feature ? { feature, lat, lng: lon } : { outside: true, lat, lng: lon });
    flyTo({ lat, lng: lon, zoom: 13 });
  };
  const showPeru = () => { setPlace(null); fitBounds(PERU_BOUNDS, { padding: 40, maxZoom: 8 }); };

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

      <div className="gm-stage" ref={stageRef}>
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
              <BaseLayer boundaries={boundaries} view={ctx.view} size={ctx.size} highlight={place?.feature ?? null} lines={layers.boundaries} fill={!env.mapTilesUrl} />
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
            boundaries={boundaries}
            onPickZone={(zone) => selectZone(zone.id)}
            onPickRegion={flyToRegion}
            onPickPoint={flyToPoint}
          />
          <div className="gm-tools" role="toolbar" aria-label={t('gisMap.tools.label')} data-map-ui>
            <button type="button" aria-pressed={mode === 'move'} onClick={() => changeMode('move')}>{t('gisMap.tools.move')}</button>
            <button type="button" onClick={showPeru}>{t('gisMap.tools.peru')}</button>
            <button type="button" aria-pressed={mode === 'measure'} onClick={() => changeMode('measure')}>{t('gisMap.tools.measure')}</button>
            {isAuthority && <button type="button" aria-pressed={mode === 'create'} onClick={() => changeMode('create')}>{t('gisMap.tools.newZone')}</button>}
            {measure.length > 0 && <button type="button" onClick={() => setMeasure([])}>{t('gisMap.tools.clear')}</button>}
          </div>
          {hint && <p className="gm-hint" role="status" data-map-ui>{hint}</p>}
          {place && mode === 'move' && (
            <p className="gm-hint gm-place" data-map-ui>
              <span>{place.feature ? t('gisMap.search.' + place.feature.kind) + ': ' + describe(place.feature) : t('gisMap.place.outside')}</span>
              <button type="button" onClick={() => setPlace(null)} aria-label={t('gisMap.place.clear')}>×</button>
            </p>
          )}
        </div>

        <LayersPanel layers={layers} onToggle={(key) => setLayers((current) => ({ ...current, [key]: !current[key] }))} opacity={opacity} onOpacity={setOpacity} hasBrigades={brigades.length > 0} />
        {selected && <ZonePopup key={selected.id} zone={selected} placeLabel={selectedPlace} canManage={isAuthority} onEditImpact={setImpactZone} onClose={() => setSelectedId(null)} />}
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
            boundaries={boundaries}
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
.gm-place { display: flex; align-items: center; gap: 8px; }
.gm-place button { display: grid; place-items: center; width: 20px; height: 20px; padding: 0; border: 0; border-radius: 50%; background: rgba(255, 255, 255, 0.1); color: #fff; font: inherit; line-height: 1; cursor: pointer; }
.gm-place button:hover { background: rgba(255, 255, 255, 0.2); }
.gm-note.is-warn { color: #ffb020; }
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
    placeholder: 'Buscar zona, distrito, provincia o coordenadas', label: 'Buscar en el mapa', zone: 'Zona',
    department: 'Departamento', province: 'Provincia', district: 'Distrito', coordinates: 'Ir a {{value}}',
    noResults: 'Sin resultados.', loadingPlaces: 'Cargando lugares…',
  },
  place: { outside: 'Fuera de los límites del Perú', clear: 'Quitar' },
  tools: { label: 'Herramientas del mapa', move: 'Mover', measure: 'Medir', newZone: 'Nueva zona', clear: 'Borrar', recenter: 'Recentrar', peru: 'Todo el Perú' },
  hints: {
    measureEmpty: 'Haz clic en el mapa para marcar puntos y medir distancias.',
    measure: 'Distancia total: {{distance}}',
    create: 'Haz clic donde está la zona afectada para registrarla.',
    created: 'Zona registrada: {{name}}.',
    updated: 'Población actualizada: {{name}}.',
  },
  layers: {
    title: 'Capas', heat: 'Mapa de calor de prioridad', zones: 'Zonas (marcadores)', brigades: 'Brigadas (base GPS)', boundaries: 'Límites administrativos',
    opacity: 'Opacidad del calor', unavailable: 'Las zonas inundadas y la cobertura celular aún no las entrega el servicio.',
  },
  legend: { title: 'Leyenda', low: 'Demanda baja', critical: 'Crítica', needs: 'Necesidad', all: 'Todas' },
  popup: {
    reasons: 'Por qué esta prioridad', noScore: 'Sin puntaje de urgencia', noScoreHint: 'Aún no tiene puntaje: falta registrar la población o reportes de campo.',
    noReasons: 'No hay detalle disponible del puntaje.', manual: 'Prioridad manual', needs: 'Necesidades', damage: 'Daño', people: 'Personas afectadas',
    status: 'Estado', place: 'Ubicación', gps: 'GPS', assign: 'Asignar brigada', detail: 'Ver detalle', close: 'Cerrar', editImpact: 'Editar población afectada',
    level: { CRITICAL: 'Prioridad crítica', HIGH: 'Prioridad alta', MEDIUM: 'Prioridad media', LOW: 'Prioridad baja' },
  },
  dialog: {
    title: 'Nueva zona', intro: 'Se registra en la emergencia activa. Con la población afectada, el puntaje de urgencia se calcula al instante.',
    place: 'Ubicación: {{name}}', outside: 'Estas coordenadas están fuera de los límites del Perú.',
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
    placeholder: 'Search zone, district, province or coordinates', label: 'Search the map', zone: 'Zone',
    department: 'Department', province: 'Province', district: 'District', coordinates: 'Go to {{value}}',
    noResults: 'No results.', loadingPlaces: 'Loading places…',
  },
  place: { outside: 'Outside Peru\'s borders', clear: 'Clear' },
  tools: { label: 'Map tools', move: 'Move', measure: 'Measure', newZone: 'New zone', clear: 'Clear', recenter: 'Recenter', peru: 'All of Peru' },
  hints: {
    measureEmpty: 'Click on the map to mark points and measure distances.',
    measure: 'Total distance: {{distance}}',
    create: 'Click where the affected zone is to register it.',
    created: 'Zone registered: {{name}}.',
    updated: 'Population updated: {{name}}.',
  },
  layers: {
    title: 'Layers', heat: 'Priority heat map', zones: 'Zones (markers)', brigades: 'Brigades (GPS base)', boundaries: 'Administrative boundaries',
    opacity: 'Heat opacity', unavailable: 'Flooded zones and cell coverage are not provided by the service yet.',
  },
  legend: { title: 'Legend', low: 'Low demand', critical: 'Critical', needs: 'Need', all: 'All' },
  popup: {
    reasons: 'Why this priority', noScore: 'No urgency score', noScoreHint: 'It has no score yet: the population or field reports are missing.',
    noReasons: 'No score detail is available.', manual: 'Manual priority', needs: 'Needs', damage: 'Damage', people: 'People affected',
    status: 'Status', place: 'Location', gps: 'GPS', assign: 'Assign brigade', detail: 'View detail', close: 'Close', editImpact: 'Edit affected population',
    level: { CRITICAL: 'Critical priority', HIGH: 'High priority', MEDIUM: 'Medium priority', LOW: 'Low priority' },
  },
  dialog: {
    title: 'New zone', intro: 'It is registered in the active emergency. With the affected population, the urgency score is calculated right away.',
    place: 'Location: {{name}}', outside: 'These coordinates are outside Peru\'s borders.',
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
console.log('Mapa base propio: límites del Perú dentro del proyecto, sin teselas ni claves externas. (Opcional: VITE_MAP_TILES_URL para usar teselas de un proveedor.)');
