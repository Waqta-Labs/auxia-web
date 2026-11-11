import { useTranslation } from 'react-i18next';
import { BrigadeTab } from '../../domain/services/filterBrigades.js';
import { statusLabel } from '../utils/brigadeFormat.js';

const TABS = [BrigadeTab.ALL, BrigadeTab.ASSIGNED, BrigadeTab.AVAILABLE, BrigadeTab.OFF_DUTY];

export default function BrigadeList({ brigades, counts, tab, onTab, search, onSearch, selectedId, onSelect, loading }) {
  const { t } = useTranslation('resourceManagement');

  return (
    <section className="fl-card" aria-labelledby="fl-list-title">
      <h2 id="fl-list-title" className="fl-h2">{t('brigades.list.title')}</h2>

      <label className="fl-search">
        <span className="fl-sr">{t('brigades.list.search')}</span>
        <input
          type="search" value={search} placeholder={t('brigades.list.search')}
          onChange={(event) => onSearch(event.target.value)}
        />
      </label>

      <div className="fl-tabs" role="group" aria-label={t('brigades.list.filters')}>
        {TABS.map((key) => (
          <button
            key={key} type="button" className="fl-tab" aria-pressed={tab === key} onClick={() => onTab(key)}
          >
            {t('brigades.tabs.' + key)} <span className="fl-tab__count">{counts[key] ?? 0}</span>
          </button>
        ))}
      </div>

      <ul className="fl-list">
        {loading && [0, 1, 2, 3].map((n) => <li key={n}><span className="fl-skel" /></li>)}
        {!loading && brigades.length === 0 && <li className="fl-empty">{t('brigades.list.empty')}</li>}
        {!loading && brigades.map((brigade) => (
          <li key={brigade.id}>
            <button
              type="button" className={'fl-brigade' + (brigade.id === selectedId ? ' is-selected' : '')}
              aria-pressed={brigade.id === selectedId} onClick={() => onSelect(brigade.id)}
            >
              <span className="fl-brigade__top">
                <strong>{brigade.name}</strong>
                <span className={'fl-chip fl-chip--' + brigade.status.toLowerCase()}>{statusLabel(t, brigade.status)}</span>
              </span>
              <span className="fl-brigade__meta">
                {[brigade.code, brigade.memberCount !== null ? t('brigades.list.members', { count: brigade.memberCount }) : null]
                  .filter(Boolean).join(' · ')}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
