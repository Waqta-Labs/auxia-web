import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDateTime, formatNumber, humanize, truncateHash } from '@shared/utils/formatters.js';
import { useVerifyDelivery } from '../hooks/useVerifyDelivery.js';

// Pasos del ciclo de vida: entregada en campo → registrada y sellada con hash → anclada en la blockchain.
function buildSteps(detail, t, lng) {
  const status = detail.status;
  const registered = status !== 'INITIATED';
  const when = (value) => (value ? formatDateTime(value, lng) : null);
  return [
    {
      key: 'delivered', state: registered ? 'done' : 'current', title: t('card.steps.delivered'),
      note: registered ? when(detail.deliveredAt) : t('card.steps.onTheWay'),
    },
    { key: 'sealed', state: registered ? 'done' : 'pending', title: t('card.steps.sealed'), note: registered ? when(detail.receivedAt) : t('card.steps.pending') },
    {
      key: 'anchored',
      state: status === 'CERTIFIED' ? 'done' : status === 'INITIATED' ? 'pending' : status === 'FAILED' ? 'warn' : 'current',
      title: t('card.steps.anchored'),
      note: status === 'CERTIFIED' ? when(detail.anchoredAt) ?? t('card.steps.confirmed')
        : status === 'REGISTERED' ? t('card.steps.anchoring')
        : status === 'FAILED' ? t('card.steps.retrying', { count: detail.attempts ?? 0 })
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

export default function TraceabilityCard({ detail, zoneName, onClose, onDownload }) {
  const { t, i18n } = useTranslation('traceability');
  const lng = i18n.resolvedLanguage;
  const verify = useVerifyDelivery();
  const [copied, setCopied] = useState(false);

  const data = detail.data;
  const publicUrl = data ? window.location.origin + '/public/verify/' + data.id : null;
  const location = data?.location ?? null;
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
        <button type="button" className="tl-icon-btn" onClick={onClose} aria-label={t('card.close')}>×</button>
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
                {data.items.map((item, index) => (
                  <li key={(item.resourceId ?? '') + index}>
                    <span>{item.name ?? t('card.resource', { id: item.resourceId ? item.resourceId.slice(0, 8) : index + 1 })}</span>
                    <strong>{item.quantity !== null ? formatNumber(item.quantity, lng) : '—'}</strong>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <span className="tl-label">{t('card.integrity')}</span>
            <dl className="tl-facts">
              <div><dt>{t('card.recordHash')}</dt><dd title={data.recordHash ?? ''}>{data.recordHash ? truncateHash(data.recordHash, 8, 6) : '—'}</dd></div>
              <div><dt>{t('card.evidences')}</dt><dd>{data.evidences.length}</dd></div>
              {location && (
                <div>
                  <dt>{t('card.gps')}</dt>
                  <dd>
                    <a
                      href={'https://www.openstreetmap.org/?mlat=' + location.latitude + '&mlon=' + location.longitude + '#map=17/' + location.latitude + '/' + location.longitude}
                      target="_blank" rel="noreferrer"
                    >
                      {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)} ↗
                    </a>
                  </dd>
                </div>
              )}
            </dl>
            {data.evidences.length > 0 && (
              <ul className="tl-evidence">
                {data.evidences.map((evidence, index) => (
                  <li key={evidence.id ?? index} title={evidence.hash ?? ''}>
                    <span>{evidence.type ? t('card.evidenceTypes.' + evidence.type, { defaultValue: humanize(evidence.type) }) : t('card.evidence')}</span>
                    <span>{evidence.hash ? truncateHash(evidence.hash, 6, 6) : '—'}</span>
                    <span>{evidence.capturedAt ? formatDateTime(evidence.capturedAt, lng) : ''}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="tl-verify">
            <span className="tl-label">{t('card.verify.title')}</span>
            <button
              type="button" className="tl-btn-outline" disabled={verify.isPending || data.status === 'INITIATED'}
              onClick={() => verify.mutate(data.id)}
            >
              {verify.isPending ? t('card.verify.checking') : t('card.verify.action')}
            </button>
            {verify.data?.verified && <p className="tl-result tl-result--ok" role="status">{t('card.verify.ok')}</p>}
            {verify.data && !verify.data.verified && (
              <div className="tl-result tl-result--bad" role="alert">
                <p>{t('card.verify.mismatch')}</p>
                <small>{t('card.verify.recomputed')}: {truncateHash(verify.data.recordHash, 8, 6)}</small>
                <small>{t('card.verify.onChain')}: {truncateHash(verify.data.anchoredHash, 8, 6)}</small>
              </div>
            )}
            {verify.error && <p className="tl-error" role="alert">{verifyMessage(t, verify.error)}</p>}
            <div className="tl-link">
              <span className="tl-link__url" title={publicUrl}>{publicUrl}</span>
              <button type="button" className="tl-link-btn" onClick={copy}>{copied ? t('card.copied') : t('card.copy')}</button>
              <a className="tl-link-btn" href={publicUrl} target="_blank" rel="noreferrer">{t('card.open')} ↗</a>
            </div>
          </section>

          <button type="button" className="tl-btn-outline" onClick={onDownload}>{t('card.download')}</button>
        </>
      )}
    </aside>
  );
}
