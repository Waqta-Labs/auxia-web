import { useTranslation } from 'react-i18next';
import { NeedCategory } from '../../domain/enums/needCategory.js';
import { EMPTY_ZONE_FILTERS } from '../../domain/services/filterZones.js';
import { humanize } from '@shared/utils/formatters.js';

const SearchIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" aria-hidden="true">
    <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
  </svg>
);

export default function PrioritizationToolbar({ filters, onChange }) {
  const { t } = useTranslation('emergencyManagement');
  const set = (patch) => onChange({ ...filters, ...patch });
  const isDirty = Object.keys(EMPTY_ZONE_FILTERS).some((key) => filters[key] !== EMPTY_ZONE_FILTERS[key]);

  return (
    <div className="pz-toolbar" role="search">
      <label className="pz-search">
        <SearchIcon />
        <span className="pz-sr">{t('prioritization.toolbar.search')}</span>
        <input
          type="search"
          value={filters.query}
          placeholder={t('prioritization.toolbar.search')}
          onChange={(e) => set({ query: e.target.value })}
        />
      </label>

      <fieldset className="pz-range">
        <legend>{t('prioritization.toolbar.scoreRange')}</legend>
        <input
          type="number" min="0" max="100" inputMode="numeric"
          aria-label={t('prioritization.toolbar.min')} placeholder={t('prioritization.toolbar.min')}
          value={filters.minScore} onChange={(e) => set({ minScore: e.target.value })}
        />
        <span aria-hidden="true">–</span>
        <input
          type="number" min="0" max="100" inputMode="numeric"
          aria-label={t('prioritization.toolbar.max')} placeholder={t('prioritization.toolbar.max')}
          value={filters.maxScore} onChange={(e) => set({ maxScore: e.target.value })}
        />
      </fieldset>

      <label className="pz-select">
        <span className="pz-sr">{t('prioritization.toolbar.need')}</span>
        <select value={filters.need} onChange={(e) => set({ need: e.target.value })}>
          <option value="">{t('prioritization.toolbar.allNeeds')}</option>
          {Object.values(NeedCategory).map((need) => (
            <option key={need} value={need}>{t('needs.' + need, { defaultValue: humanize(need) })}</option>
          ))}
        </select>
      </label>

      {isDirty && (
        <button type="button" className="pz-link-btn" onClick={() => onChange({ ...EMPTY_ZONE_FILTERS })}>
          {t('prioritization.toolbar.clear')}
        </button>
      )}
    </div>
  );
}
