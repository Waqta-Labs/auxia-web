import { useTranslation } from 'react-i18next';
import { truncateHash } from '@shared/utils/formatters.js';

export default function DeliveriesTable({ deliveries = [], loading = false }) {
  const { t } = useTranslation('traceability');

  return (
    <section className="panel">
      <header className="panel__head">
        <h2 className="panel__title">{t('ledger.title')}</h2>
        <span className="panel__note">{t('ledger.subtitle')}</span>
      </header>

      <div className="ledger-wrap">
        <table className="ledger">
          <thead>
            <tr>
              <th scope="col">{t('ledger.columns.hash')}</th>
              <th scope="col">{t('ledger.columns.origin')}</th>
              <th scope="col">{t('ledger.columns.destination')}</th>
              <th scope="col">{t('ledger.columns.status')}</th>
            </tr>
          </thead>
          <tbody>
            {loading && [0, 1, 2].map((i) => (
              <tr key={i}>
                <td colSpan={4}><span className="skeleton" style={{ height: 20 }} /></td>
              </tr>
            ))}

            {!loading && deliveries.length === 0 && (
              <tr><td colSpan={4} className="muted">{t('ledger.empty')}</td></tr>
            )}

            {!loading && deliveries.map((d) => (
              <tr key={d.id}>
                <td>
                  {d.explorerUrl ? (
                    <a className="ledger__hash" href={d.explorerUrl} target="_blank" rel="noreferrer" title={d.transactionHash}>
                      {truncateHash(d.transactionHash)}
                    </a>
                  ) : '—'}
                </td>
                <td>{d.originName ?? '—'}</td>
                <td>{d.destinationName ?? '—'}</td>
                <td>
                  <span className={'status status--' + d.status}>{t('ledger.status.' + d.status)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
