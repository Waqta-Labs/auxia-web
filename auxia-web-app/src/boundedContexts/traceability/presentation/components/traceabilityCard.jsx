import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDateTime, formatNumber, truncateHash } from '@shared/utils/formatters.js';
import { useVerifyDelivery } from '../hooks/useVerifyDelivery.js';
import { useDownloadDeliveryReport } from '../hooks/useDownloadDeliveryReport.js';

// Pasos del ciclo de vida de una entrega: misión abierta → entrega registrada → anclada en la blockchain.
function buildSteps(detail, t, lng) {
  const status = detail.status;
  const registered = status !== 'INITIATED';
  const when = (value) => (value ? formatDateTime(value, lng) : null);
  return [
    { key: 'opened', state: 'done', title: t('card.steps.opened'), note: when(detail.openedAt) },
    {
      key: 'registered', state: registered ? 'done' : 'current', title: t('card.steps.registered'),
      note: registered ? when(detail.deliveredAt) : t('card.steps.onTheWay'),
    },
    {
      key: 'anchored',
      state: status === 'CERTIFIED' ? 'done' : status === 'INITIATED' ? 'pending' : status === 'FAILED' ? 'warn' : 'current',
      title: t('card.steps.anchored'),
      note: status === 'CERTIFIED' ? when(detail.anchoredAt) ?? t('card.steps.confirmed')
        : status === 'REGISTERED' ? t('card.steps.anchoring')
        : status === 'FAILED' ? t('card.steps.retrying')
        : t('card.steps.pending'),
    },
  ];
}

const verifyMessage = (t, error) => {
  if (error.detail) return error.detail;
  if (error.status === 404) return t('card.verify.notFound');
  if (error.status === 503) return t('card.verify.unavailable');
  return t('card.verify.error');
};

export default function TraceabilityCard({ detail, zoneName, onClose }) {
  const { t, i18n } = useTranslation('traceability');
  const lng = i18n.resolvedLanguage;
  const verify = useVerifyDelivery();
  const report = useDownloadDeliveryReport();
  const [copied, setCopied] = useState(false);

  const data = detail.data;
  const publicUrl = data ? window.location.origin + '/public/verify/' + data.id : null;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <aside className="tl-card" aria-labelledby="tl-card-title">
      <header className="tl-card__head">
        <div>
          <h2 id="tl-card-title" className="tl-h2">{t('card.title')}</h2>
          {data && <p className="tl-sub">{zoneName ?? '—'}</p>}
        </div>
        {data && <span className={'tl-chip tl-chip--' + data.status.toLowerCase()}>{t('ledger.status.' + data.status)}</span>}
        <button type="button" className="tl-icon-btn tl-close" onClick={onClose} aria-label={t('card.close')}>×</button>
      </header>

      {detail.isLoading && <span className="tl-skel tl-skel--block" />}
      {detail.isError && <p className="tl-error" role="alert">{detail.error?.detail ?? t('card.loadError')}</p>}

      {data && (
        <>
          <ol className="tl-steps">
            {buildSteps(data, t, lng).map((step, index) => (
              <li key={step.key} className={'tl-step tl-step--' + step.state}>
                <span className="tl-step__dot" aria-hidden="true">{step.state === 'done' ? '✓' : index + 1}</span>
                <div>
                  <strong>{step.title}</strong>
                  {step.note && <p>{step.note}</p>}
                  {step.key === 'anchored' && data.explorerUrl && (
                    <a href={data.explorerUrl} target="_blank" rel="noreferrer">{t('card.viewTx')} ↗ {truncateHash(data.transactionHash)}</a>
                  )}
                </div>
              </li>
            ))}
          </ol>

          {data.items.length > 0 && (
            <section>
              <span className="tl-label">{t('card.items')}</span>
              <ul className="tl-items">
                {data.items.map((item) => (
                  <li key={item.name}>
                    <span>{item.name}</span>
                    <strong>
                      {item.quantity !== null ? formatNumber(item.quantity, lng) : '—'}
                      {item.planned !== null ? ' / ' + formatNumber(item.planned, lng) : ''}
                      {item.unit ? ' ' + item.unit : ''}
                    </strong>
                  </li>
                ))}
              </ul>
              <p className="tl-note">{t('card.itemsHint')}</p>
            </section>
          )}

          <section>
            <span className="tl-label">{t('card.integrity')}</span>
            <dl className="tl-facts">
              <div><dt>{t('card.publicCode')}</dt><dd title={data.id}>{truncateHash(data.id, 8, 4)}</dd></div>
              <div><dt>{t('card.recordHash')}</dt><dd title={data.recordHash ?? ''}>{data.recordHash ? truncateHash(data.recordHash, 8, 6) : '—'}</dd></div>
              <div><dt>{t('card.evidences')}</dt><dd>{data.evidences.length}</dd></div>
            </dl>
            {data.evidences.length > 0 && (
              <ul className="tl-evidence">
                {data.evidences.map((evidence, index) => (
                  <li key={(evidence.hash ?? '') + index} title={evidence.hash ?? ''}>
                    {evidence.hash ? truncateHash(evidence.hash, 8, 6) : '—'}{evidence.type ? ' · ' + evidence.type : ''}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="tl-verify">
            <span className="tl-label">{t('card.verify.title')}</span>
            <p className="tl-note">{t('card.verify.hint')}</p>
            <button
              type="button" className="tl-btn-outline" disabled={verify.isPending || data.status === 'INITIATED'}
              onClick={() => verify.mutate(data.id)}
            >
              {verify.isPending ? t('card.verify.checking') : t('card.verify.action')}
            </button>
            {verify.data && verify.data.verified && <p className="tl-result tl-result--ok" role="status">{t('card.verify.ok')}</p>}
            {verify.data && !verify.data.verified && (
              <p className="tl-result tl-result--bad" role="alert">{t('card.verify.mismatch')}</p>
            )}
            {verify.error && <p className="tl-error" role="alert">{verifyMessage(t, verify.error)}</p>}

            <div className="tl-link">
              <span className="tl-link__url" title={publicUrl}>{publicUrl}</span>
              <button type="button" className="tl-link-btn" onClick={copy}>{copied ? t('card.copied') : t('card.copy')}</button>
            </div>
            <p className="tl-note">{t('card.publicHint')}</p>
          </section>

          <button
            type="button" className="tl-btn-outline" disabled={report.isPending}
            onClick={() => report.mutate({ zoneId: data.zoneId })}
          >
            {report.isPending ? t('card.downloading') : t('card.download')}
          </button>
          {report.error && <p className="tl-error" role="alert">{report.error.detail ?? t('card.downloadError')}</p>}
        </>
      )}
    </aside>
  );
}
