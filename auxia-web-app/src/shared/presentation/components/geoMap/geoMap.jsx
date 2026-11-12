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
