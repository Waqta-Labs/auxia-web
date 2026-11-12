// Dashboard: reemplaza el mapa de Leaflet/OpenStreetMap por una vista previa de NUESTRO mapa (límites del Perú + calor + marcadores).
// Requiere haber corrido antes buildGisMap.mjs. Uso (raíz del proyecto): node buildDashboardMap.mjs   (se puede repetir)
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

const GM = 'src/shared/presentation/components/geoMap/';
const EM = 'src/boundedContexts/emergencyManagement/';
if (!existsSync(GM + 'baseLayer.jsx') || !existsSync(GM + 'geoMap.jsx')) throw new Error('Primero corre buildGisMap.mjs (mapa propio) y luego este script, desde la raíz del proyecto.');

const readLf = (path) => { const raw = readFileSync(path, 'utf8'); return { text: raw.replace(/\r\n/g, '\n'), crlf: raw.includes('\r\n') }; };
const writeLf = (path, text, crlf) => writeFileSync(path, crlf ? text.replace(/\n/g, '\r\n') : text);
const write = (path, content) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, content.replace(/^\n/, '')); console.log('+ ' + path); };
const patch = (path, pairs) => {
  let { text, crlf } = readLf(path);
  for (const [from, to] of pairs) {
    if (text.includes(to)) continue;
    if (!text.includes(from)) throw new Error('No encontré el fragmento esperado en ' + path + ':\n' + from);
    text = text.replace(from, () => to);
  }
  writeLf(path, text, crlf);
  console.log('~ ' + path);
};
const appendOnce = (path, marker, css) => {
  const { text, crlf } = readLf(path);
  if (text.includes(marker)) return;
  writeLf(path, text.replace(/\s*$/, '\n') + '\n' + marker + '\n' + css, crlf);
  console.log('~ ' + path);
};
const deepMerge = (a, b) => { const out = { ...a }; for (const [k, v] of Object.entries(b)) out[k] = v && typeof v === 'object' && !Array.isArray(v) ? deepMerge(a?.[k] ?? {}, v) : v; return out; };
const mergeJson = (path, object) => { writeFileSync(path, JSON.stringify(deepMerge(JSON.parse(readFileSync(path, 'utf8')), object), null, 2) + '\n'); console.log('~ ' + path); };

/* El motor admite una vista previa sin interacción (misma edición que incluye buildGisMap.mjs; si ya está, no hace nada). */
patch(GM + 'geoMap.jsx', [
  ["mode = 'move', onMapClick,", "mode = 'move', interactive = true, onMapClick,"],
  ["    el.addEventListener('wheel', onWheel, { passive: false });\n    return () => el.removeEventListener('wheel', onWheel);\n  }, [zoomAround]);", "    if (!interactive) return undefined;\n    el.addEventListener('wheel', onWheel, { passive: false });\n    return () => el.removeEventListener('wheel', onWheel);\n  }, [zoomAround, interactive]);"],
  ["      tabIndex={0}\n      onPointerDown={onPointerDown}\n      onPointerMove={onPointerMove}\n      onPointerUp={onPointerUp}\n      onPointerCancel={onPointerUp}\n      onDoubleClick={onDoubleClick}\n      onKeyDown={onKeyDown}\n    >", "      data-interactive={interactive ? 'true' : 'false'}\n      tabIndex={interactive ? 0 : -1}\n      onPointerDown={interactive ? onPointerDown : undefined}\n      onPointerMove={interactive ? onPointerMove : undefined}\n      onPointerUp={interactive ? onPointerUp : undefined}\n      onPointerCancel={interactive ? onPointerUp : undefined}\n      onDoubleClick={interactive ? onDoubleClick : undefined}\n      onKeyDown={interactive ? onKeyDown : undefined}\n    >"],
  ["boundsView(fit.points, sizeRef.current.w, sizeRef.current.h, { padding: fit.padding })", "boundsView(fit.points, sizeRef.current.w, sizeRef.current.h, { padding: fit.padding, maxZoom: fit.maxZoom })"],
]);
appendOnce(GM + 'geoMap.css', '/* geomap-preview */', ".gm[data-interactive='false'] { cursor: pointer; touch-action: auto; }\n.gm[data-interactive='false'] .gm__zoom, .gm[data-interactive='false'] .gm__recenter { display: none; }\n");

write(EM + 'presentation/components/urgencyHeatMap.jsx', String.raw`
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { routes } from '@app/router/routes.js';
import { env } from '@shared/infrastructure/config/env.js';
import GeoMap from '@shared/presentation/components/geoMap/geoMap.jsx';
import BaseLayer from '@shared/presentation/components/geoMap/baseLayer.jsx';
import HeatLayer from '@shared/presentation/components/geoMap/heatLayer.jsx';
import { useBoundaries } from '@shared/presentation/hooks/useBoundaries.js';
import { BRIGADE_COLORS, LEVEL_COLORS, heatPointOf } from '../utils/gisColors.js';

const PERU_BOUNDS = [{ lat: -0.04, lng: -81.4 }, { lat: -18.4, lng: -68.6 }];
const INITIAL_VIEW = { lat: -9.2, lng: -75.0, zoom: 4.6 };
const COVERAGE_METERS = 450;

// Vista previa del Mapa GIS en el dashboard: el mismo mapa propio (límites + calor + marcadores), sin interacción.
// Un clic en el mapa o en "Abrir mapa completo" lleva al Mapa GIS.
export default function UrgencyHeatMap({ zones = [], brigades = [], loading = false }) {
  const { t } = useTranslation('emergencyManagement');
  const navigate = useNavigate();
  const boundaries = useBoundaries();
  const [view, setView] = useState(INITIAL_VIEW);
  const [layers, setLayers] = useState({ zones: true, coverage: true, brigades: true });
  const toggle = (key) => setLayers((current) => ({ ...current, [key]: !current[key] }));
  const open = () => navigate(routes.gisMap);

  const placedZones = useMemo(() => zones.filter((zone) => zone.hasPosition), [zones]);
  const placedBrigades = useMemo(() => brigades.filter((brigade) => brigade.hasPosition), [brigades]);
  const heatPoints = useMemo(() => (layers.zones ? placedZones.map(heatPointOf).filter(Boolean) : []), [placedZones, layers.zones]);

  // Encuadra las zonas y brigadas; sin ninguna, se ve todo el Perú.
  const fit = useMemo(() => {
    const points = [...placedZones, ...placedBrigades].map((item) => ({ lat: item.latitude, lng: item.longitude }));
    return points.length > 0
      ? { key: 'data:' + placedZones.length + ':' + placedBrigades.length, points, padding: 70, maxZoom: 15 }
      : { key: 'peru', points: PERU_BOUNDS, padding: 30, maxZoom: 7 };
  }, [placedZones, placedBrigades]);

  const chips = [
    { key: 'zones', color: 'var(--color-coral)', label: t('map.layers.zones') },
    { key: 'coverage', color: 'var(--color-emerald)', label: t('map.layers.coverage') },
    { key: 'brigades', color: 'var(--color-lime)', label: t('map.layers.brigades') },
  ];

  return (
    <section className="panel map-panel" aria-label={t('map.title')}>
      {loading ? (
        <div className="skeleton heatmap" />
      ) : (
        <div className="heatmap" onClick={open}>
          <GeoMap view={view} onViewChange={setView} fit={fit} interactive={false} label={t('gisMap.map.label')}>
            {(ctx) => (
              <>
                <BaseLayer boundaries={boundaries} view={ctx.view} size={ctx.size} lines fill={!env.mapTilesUrl} />
                <HeatLayer points={heatPoints} view={ctx.view} size={ctx.size} toScreen={ctx.toScreen} metersPerPixel={ctx.metersPerPixel} opacity={0.8} />
                {layers.coverage && ctx.view.zoom >= 9 && placedBrigades.filter((brigade) => !brigade.isOffDuty).map((brigade) => {
                  const s = ctx.toScreen(brigade.latitude, brigade.longitude);
                  const size = (COVERAGE_METERS * 2) / ctx.metersPerPixel;
                  return <span key={brigade.id + '-cover'} className="dm-cover" style={{ width: size, height: size, transform: 'translate(' + (s.x - size / 2) + 'px,' + (s.y - size / 2) + 'px)' }} aria-hidden="true" />;
                })}
                {layers.zones && placedZones.map((zone) => {
                  const s = ctx.toScreen(zone.latitude, zone.longitude);
                  return <span key={zone.id + '-point'} className={'dm-pin' + (zone.isCritical ? ' is-critical' : '')} style={{ transform: 'translate(' + s.x + 'px,' + s.y + 'px)', background: LEVEL_COLORS[zone.level] }} title={zone.name + ' · ' + (zone.urgencyScore ?? '—')} />;
                })}
                {layers.brigades && placedBrigades.map((brigade) => {
                  const s = ctx.toScreen(brigade.latitude, brigade.longitude);
                  const color = brigade.isAvailable ? BRIGADE_COLORS.available : brigade.isDeployed ? BRIGADE_COLORS.deployed : BRIGADE_COLORS.offDuty;
                  return <span key={brigade.id + '-gps'} className="dm-brigade" style={{ transform: 'translate(' + s.x + 'px,' + s.y + 'px) rotate(45deg)', background: color }} title={brigade.name} />;
                })}
              </>
            )}
          </GeoMap>
        </div>
      )}

      <div className="map-chips" role="group" aria-label={t('map.title')}>
        {chips.map((chip) => (
          <button key={chip.key} type="button" className="chip" aria-pressed={layers[chip.key]} onClick={() => toggle(chip.key)}>
            <i className="chip__dot" style={{ background: chip.color }} />
            {chip.label}
          </button>
        ))}
      </div>
      <button type="button" className="dm-open" onClick={open}>{t('map.open')} →</button>
      <p className="map-caption">{t('map.caption')}</p>
    </section>
  );
}
`);

appendOnce('src/app/pages/dashboard/dashboard.css', '/* dashboard-map-preview */', String.raw`
.map-panel .gm { background-color: #0b0b2e; }
.dm-pin, .dm-brigade, .dm-cover { position: absolute; left: 0; top: 0; pointer-events: none; }
.dm-pin { width: 12px; height: 12px; margin: -6px 0 0 -6px; border: 1.5px solid #fff; border-radius: 50%; box-shadow: 0 0 0 1px rgba(11, 11, 46, 0.6); }
.dm-pin.is-critical { width: 16px; height: 16px; margin: -8px 0 0 -8px; }
.dm-brigade { width: 10px; height: 10px; margin: -5px 0 0 -5px; border: 1.5px solid #10103a; }
.dm-cover { border: 1px dashed #05c274; border-radius: 50%; background: rgba(5, 194, 116, 0.06); }
.dm-open { position: absolute; top: 16px; right: 16px; z-index: 1000; height: 32px; padding: 0 14px; border: 1px solid var(--cc-line); border-radius: 999px; background: rgba(16, 16, 58, 0.88); color: #fff; font: inherit; font-size: 0.8125rem; font-weight: 600; cursor: pointer; backdrop-filter: blur(6px); }
.dm-open:hover { background: rgba(33, 33, 97, 0.95); }
.dm-open:focus-visible { outline: 2px solid var(--color-sky); outline-offset: 2px; }
`);

mergeJson(EM + 'presentation/i18n/es.json', { map: { open: 'Abrir mapa completo' } });
mergeJson(EM + 'presentation/i18n/en.json', { map: { open: 'Open full map' } });

console.log('\nListo. Reinicia "npm run dev" y revisa el Dashboard.');
console.log('Ya no se usa Leaflet: puedes quitarlo con  npm uninstall leaflet react-leaflet  (solo lo usaba este mapa).');
