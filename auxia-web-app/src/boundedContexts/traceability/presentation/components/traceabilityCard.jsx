import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDateTime, formatNumber, humanize, truncateHash } from '@shared/utils/formatters.js';
import { useDeliveryVerification } from '../hooks/useDeliveryVerification.js';
import { outcomeTone, verificationOutcome } from '../../domain/services/verificationOutcome.js';

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

export default function TraceabilityCard({ detail, zoneName, onClose, onDownload }) {
  const { t, i18n } = useTranslation('traceability');
  const lng = i18n.resolvedLanguage;
  const [copied, setCopied] = useState(false);

  const data = detail.data;
  // Una entrega anclada se comprueba sola al abrir la ficha: el resultado se muestra en palabras.
  const verification = useDeliveryVerification(data?.status === 'CERTIFIED' ? data.id : null);
  const outcome = data
    ? verificationOutcome(data.status, { result: verification.data, error: verification.error, checking: verification.isFetching })
    : null;
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
          <div className={'tl-result tl-outcome tl-result--' + outcomeTone(outcome)} role="status">
            <strong>{t('card.outcome.' + outcome + '.title')}</strong>
            <span>{t('card.outcome.' + outcome + '.text')}</span>
          </div>

          <ol className="tl-steps">
            {buildSteps(data, t, lng).map((step, index) => (
              <li key={step.key} className={'tl-step tl-step--' + step.state}>
                <span className="tl-step__dot" aria-hidden="true">{step.state === 'done' ? '✓' : index + 1}</span>
                <div>
                  <strong>{step.title}</strong>
                  {step.note && <p>{step.note}</p>}
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

          <details className="tl-tech">
            <summary className="tl-label">{t('card.technical')}</summary>
            <p className="tl-note">{t('card.technicalHint')}</p>
            <dl className="tl-facts">
              <div><dt>{t('card.recordHash')}</dt><dd title={data.recordHash ?? ''}>{data.recordHash ? truncateHash(data.recordHash, 8, 6) : '—'}</dd></div>
              {data.explorerUrl && (
                <div>
                  <dt>{t('card.transaction')}</dt>
                  <dd><a href={data.explorerUrl} target="_blank" rel="noreferrer">{truncateHash(data.transactionHash)} ↗</a></dd>
                </div>
              )}
              {verification.data && !verification.data.verified && (
                <>
                  <div><dt>{t('card.verify.recomputed')}</dt><dd title={verification.data.recordHash ?? ''}>{truncateHash(verification.data.recordHash, 8, 6)}</dd></div>
                  <div><dt>{t('card.verify.onChain')}</dt><dd title={verification.data.anchoredHash ?? ''}>{truncateHash(verification.data.anchoredHash, 8, 6)}</dd></div>
                </>
              )}
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
          </details>

          <section className="tl-verify">
            <span className="tl-label">{t('card.verify.title')}</span>
            <button
              type="button" className="tl-btn-outline" disabled={verification.isFetching || data.status !== 'CERTIFIED'}
              onClick={() => verification.refetch()}
            >
              {verification.isFetching ? t('card.verify.checking') : t('card.verify.again')}
            </button>
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
