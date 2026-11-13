import { useTranslation } from 'react-i18next';
import { humanize } from '@shared/utils/formatters.js';
import { featureLabel, formatContribution } from '../utils/featureLabel.js';

function reasonText(t, reason) {
  const label = featureLabel(t, reason.key);
  return typeof reason.contribution === 'number' ? label + ' (' + formatContribution(reason.contribution) + ')' : label;
}

export default function PriorityList({ zones = [], loading = false, onAssign }) {
  const { t } = useTranslation('emergencyManagement');

  return (
    <section className="panel prio-panel">
      <header className="panel__head">
        <h2 className="panel__title">{t('priority.title')}</h2>
        <span className="panel__note">{t('priority.subtitle')}</span>
      </header>

      <div className="prio">
        {loading && [0, 1, 2].map((i) => (
          <div key={i} className="skeleton" style={{ height: 170, borderRadius: 12 }} />
        ))}

        {!loading && zones.length === 0 && <p className="muted">{t('priority.empty')}</p>}

        {!loading && zones.map((zone) => (
          <article key={zone.id} className="prio-card">
            <header className="prio-card__head">
              <span className={'score score--' + zone.level}>
                {zone.urgencyScore !== null ? Math.round(zone.urgencyScore) : '—'}
              </span>
              <h3 className="prio-card__name">{zone.name}</h3>
              {zone.needs[0] && (
                <span className="tag">{t('needs.' + zone.needs[0], { defaultValue: humanize(zone.needs[0]) })}</span>
              )}
            </header>
            <div className="prio-why">
              <span className="prio-why__label">{t('priority.why')}</span>
              <p>{zone.reasons.length > 0 ? zone.reasons.map((r) => reasonText(t, r)).join(', ') : '—'}</p>
            </div>
            {onAssign && (
              <button type="button" className="btn-lime" onClick={() => onAssign(zone)}>
                {t('priority.assign')}
              </button>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
