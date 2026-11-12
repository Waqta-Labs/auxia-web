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
