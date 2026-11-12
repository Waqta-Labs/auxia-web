import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { routes } from '@app/router/routes.js';
import { formatNumber, humanize } from '@shared/utils/formatters.js';
import { useZonePriorityDetail } from '../hooks/useZonePriorityDetail.js';
import { featureLabel, formatContribution } from '../utils/featureLabel.js';
import { LEVEL_COLORS } from '../utils/gisColors.js';

// Tarjeta de la zona elegida en el mapa: por qué está priorizada y salto al detalle / asignación.
export default function ZonePopup({ zone, canManage, onEditImpact, onClose }) {
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
