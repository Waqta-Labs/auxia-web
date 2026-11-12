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
