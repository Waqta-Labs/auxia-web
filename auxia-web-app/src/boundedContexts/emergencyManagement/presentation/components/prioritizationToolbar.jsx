import { useTranslation } from 'react-i18next';
import { NeedCategory } from '../../domain/enums/needCategory.js';
import { EMPTY_ZONE_FILTERS } from '../../domain/services/filterZones.js';
import { humanize } from '@shared/utils/formatters.js';
import SelectMenu from '@shared/presentation/components/selectMenu.jsx';

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
  const needOptions = [
    { value: '', label: t('prioritization.toolbar.allNeeds') },
    ...Object.values(NeedCategory).map((need) => ({ value: need, label: t('needs.' + need, { defaultValue: humanize(need) }) })),
  ];
  const sortOptions = [
    { value: '', label: t('prioritization.toolbar.sort.priority') },
    { value: 'nameAsc', label: t('prioritization.toolbar.sort.nameAsc') },
    { value: 'nameDesc', label: t('prioritization.toolbar.sort.nameDesc') },
  ];

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
        <span className="pz-range__label" aria-hidden="true">{t('prioritization.toolbar.scoreLabel')}</span>
        <input
          type="number" min="0" max="100" inputMode="numeric"
          aria-label={t('prioritization.toolbar.scoreMin')} placeholder={t('prioritization.toolbar.min')}
          value={filters.minScore} onChange={(e) => set({ minScore: e.target.value })}
        />
        <span aria-hidden="true">–</span>
        <input
          type="number" min="0" max="100" inputMode="numeric"
          aria-label={t('prioritization.toolbar.scoreMax')} placeholder={t('prioritization.toolbar.max')}
          value={filters.maxScore} onChange={(e) => set({ maxScore: e.target.value })}
        />
      </fieldset>

      <SelectMenu className="pz-select" label={t('prioritization.toolbar.need')} value={filters.need} options={needOptions} onChange={(need) => set({ need })} />
      <SelectMenu className="pz-select" label={t('prioritization.toolbar.sort.label')} value={filters.sort} options={sortOptions} onChange={(sort) => set({ sort })} />

      {isDirty && (
        <button type="button" className="pz-link-btn" onClick={() => onChange({ ...EMPTY_ZONE_FILTERS })}>
          {t('prioritization.toolbar.clear')}
        </button>
      )}
    </div>
  );
}
