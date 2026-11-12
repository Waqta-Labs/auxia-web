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
