import { useTranslation } from 'react-i18next';
import { formatNumber } from '@shared/utils/formatters.js';
import { ZoneTab } from '../../domain/services/filterZones.js';

export default function ZoneTabs({ value, counts, onChange }) {
  const { t, i18n } = useTranslation('emergencyManagement');

  return (
    <div className="pz-tabs" role="group" aria-label={t('prioritization.title')}>
      {Object.values(ZoneTab).map((tab) => (
        <button
          key={tab}
          type="button"
          className="pz-tab"
          aria-pressed={value === tab}
          onClick={() => onChange(tab)}
        >
          {t('prioritization.tabs.' + tab)}
          <span className="pz-tab__count">{formatNumber(counts?.[tab] ?? 0, i18n.resolvedLanguage)}</span>
        </button>
      ))}
    </div>
  );
}
