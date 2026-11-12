import { useTranslation } from 'react-i18next';
import { DeliveryTab, Period } from '../../domain/services/filterDeliveries.js';

const TABS = [DeliveryTab.ALL, DeliveryTab.IN_TRANSIT, DeliveryTab.ANCHORING, DeliveryTab.VERIFIED, DeliveryTab.RETRYING];

export default function LedgerToolbar({ search, onSearch, period, onPeriod, tab, onTab, counts }) {
  const { t } = useTranslation('traceability');

  return (
    <div className="tl-toolbar">
      <div className="tl-toolbar__row">
        <label className="tl-search">
          <span className="tl-sr">{t('toolbar.search')}</span>
          <input type="search" value={search} placeholder={t('toolbar.search')} onChange={(event) => onSearch(event.target.value)} />
        </label>
        <label className="tl-select">
          <span className="tl-sr">{t('toolbar.period')}</span>
          <select value={period} onChange={(event) => onPeriod(event.target.value)}>
            {Object.values(Period).map((value) => (
              <option key={value} value={value}>{t('toolbar.periods.' + value)}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="tl-tabs" role="group" aria-label={t('toolbar.statusFilter')}>
        {TABS.map((key) => (
          <button key={key} type="button" className="tl-tab" aria-pressed={tab === key} onClick={() => onTab(key)}>
            {t('toolbar.tabs.' + key)} <span className="tl-tab__count">{counts[key] ?? 0}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
