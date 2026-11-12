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
