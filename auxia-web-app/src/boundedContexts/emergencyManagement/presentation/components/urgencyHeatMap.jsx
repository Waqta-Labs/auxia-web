import { useMemo, useState } from 'react';
import { MapContainer, TileLayer, Circle, CircleMarker, Pane, Tooltip } from 'react-leaflet';
import { useTranslation } from 'react-i18next';
import 'leaflet/dist/leaflet.css';

const LEVEL_COLORS = {
  critical: '#ff4d4d',
  high: '#ffb020',
  moderate: '#85d5f6',
  low: '#4750dd',
  unscored: '#989b96',
};
const DEFAULT_CENTER = [-11.94, -76.69];
const heatRadius = (zone) => 140 + (zone.urgencyScore ?? 30) * 3.5; // metros

export default function UrgencyHeatMap({ zones = [], brigades = [], loading = false }) {
  const { t } = useTranslation('emergencyManagement');
  const [layers, setLayers] = useState({ zones: true, coverage: true, brigades: true });
  const toggle = (key) => setLayers((current) => ({ ...current, [key]: !current[key] }));

  const placedZones = useMemo(() => zones.filter((z) => z.hasPosition), [zones]);
  const placedBrigades = useMemo(() => brigades.filter((b) => b.hasPosition), [brigades]);

  const center = useMemo(() => {
    if (placedZones.length === 0) return DEFAULT_CENTER;
    const lat = placedZones.reduce((sum, z) => sum + z.latitude, 0) / placedZones.length;
    const lng = placedZones.reduce((sum, z) => sum + z.longitude, 0) / placedZones.length;
    return [lat, lng];
  }, [placedZones]);

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
        <MapContainer className="heatmap" center={center} zoom={14} scrollWheelZoom={false}>
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution="&copy; OpenStreetMap contributors &copy; CARTO"
          />

          {layers.coverage &&
            placedBrigades.filter((b) => !b.isOffDuty).map((b) => (
              <Circle
                key={b.id + '-cover'}
                center={[b.latitude, b.longitude]}
                radius={450}
                pathOptions={{ color: '#05c274', weight: 1, dashArray: '4 6', fillColor: '#05c274', fillOpacity: 0.06 }}
              />
            ))}

          {layers.zones && (
            <Pane name="heat" style={{ zIndex: 410, filter: 'blur(14px)' }}>
              {placedZones.map((z) => (
                <Circle
                  key={z.id + '-heat'}
                  center={[z.latitude, z.longitude]}
                  radius={heatRadius(z)}
                  pathOptions={{ stroke: false, fillColor: LEVEL_COLORS[z.level], fillOpacity: 0.6 }}
                />
              ))}
            </Pane>
          )}

          {layers.zones && (
            <Pane name="zonePoints" style={{ zIndex: 450 }}>
              {placedZones.map((z) => (
                <CircleMarker
                  key={z.id + '-point'}
                  center={[z.latitude, z.longitude]}
                  radius={z.isCritical ? 7 : 5}
                  pathOptions={{ color: '#ffffff', weight: 1.5, fillColor: LEVEL_COLORS[z.level], fillOpacity: 1 }}
                >
                  <Tooltip>{z.name + ' · ' + (z.urgencyScore ?? '—')}</Tooltip>
                </CircleMarker>
              ))}
            </Pane>
          )}

          {layers.brigades && (
            <Pane name="brigadePoints" style={{ zIndex: 460 }}>
              {placedBrigades.map((b) => (
                <CircleMarker
                  key={b.id + '-gps'}
                  center={[b.latitude, b.longitude]}
                  radius={5}
                  pathOptions={{
                    color: '#10103a',
                    weight: 1.5,
                    fillColor: b.isAvailable ? '#bcfb89' : b.isDeployed ? '#85d5f6' : '#989b96',
                    fillOpacity: 1,
                  }}
                >
                  <Tooltip>{b.name}</Tooltip>
                </CircleMarker>
              ))}
            </Pane>
          )}
        </MapContainer>
      )}

      <div className="map-chips" role="group" aria-label={t('map.title')}>
        {chips.map((chip) => (
          <button
            key={chip.key}
            type="button"
            className="chip"
            aria-pressed={layers[chip.key]}
            onClick={() => toggle(chip.key)}
          >
            <i className="chip__dot" style={{ background: chip.color }} />
            {chip.label}
          </button>
        ))}
      </div>
      <p className="map-caption">{t('map.caption')}</p>
    </section>
  );
}
