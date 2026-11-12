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
