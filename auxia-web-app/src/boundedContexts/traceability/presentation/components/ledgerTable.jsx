import { useTranslation } from 'react-i18next';
import { formatDateTime, truncateHash } from '@shared/utils/formatters.js';

export default function LedgerTable({ deliveries, loading, selectedId, onSelect }) {
  const { t, i18n } = useTranslation('traceability');
  const lng = i18n.resolvedLanguage;

  return (
    <div className="tl-table-wrap">
      <table className="tl-table">
        <thead>
          <tr>
            <th scope="col">{t('ledger.columns.hash')}</th>
            <th scope="col">{t('ledger.columns.zone')}</th>
            <th scope="col">{t('ledger.columns.delivered')}</th>
            <th scope="col">{t('ledger.columns.status')}</th>
          </tr>
        </thead>
        <tbody>
          {loading && [0, 1, 2, 3, 4].map((n) => (
            <tr key={n}><td colSpan={4}><span className="tl-skel" /></td></tr>
          ))}
          {!loading && deliveries.length === 0 && (
            <tr><td colSpan={4} className="tl-empty">{t('ledger.empty')}</td></tr>
          )}
          {!loading && deliveries.map((delivery) => (
            <tr
              key={delivery.id} className={delivery.id === selectedId ? 'is-selected' : ''}
              onClick={() => onSelect(delivery.id)}
            >
              <td>
                <button
                  type="button" className="tl-hash" aria-pressed={delivery.id === selectedId}
                  onClick={(event) => { event.stopPropagation(); onSelect(delivery.id); }}
                >
                  {delivery.transactionHash ? truncateHash(delivery.transactionHash) : delivery.status === 'INITIATED' ? '—' : t('ledger.noHash')}
                </button>
              </td>
              <td>{delivery.zoneName ?? '—'}</td>
              <td className="tl-muted">{delivery.deliveredAt ? formatDateTime(delivery.deliveredAt, lng) : '—'}</td>
              <td><span className={'tl-chip tl-chip--' + delivery.status.toLowerCase()}>{t('ledger.status.' + delivery.status)}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
