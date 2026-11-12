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
