import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDeliveryVerification } from '@bc/traceability/presentation/hooks/useDeliveryVerification.js';
import '../styles/verifyDelivery.css';

// Pantalla pública (sin sesión): cualquier persona con el código de una entrega puede comprobar que su
// registro no fue alterado. Compara el hash recalculado hoy con el que está anclado en la blockchain.
export default function VerifyDeliveryPage() {
  const { t } = useTranslation('citizenTransparency');
  const { deliveryId } = useParams();
  const query = useDeliveryVerification(deliveryId);
  const result = query.data;
  const error = query.error;

  const state = query.isLoading ? 'loading'
    : result ? (result.verified ? 'verified' : 'mismatch')
    : error?.status === 404 ? 'notFound'
    : error?.status === 503 ? 'unavailable'
    : 'error';

  return (
    <div className="vd">
      <h1 className="vd-title">{t('verifyDelivery.title')}</h1>
      <p className="vd-lead">{t('verifyDelivery.lead')}</p>

      <section className={'vd-card vd-card--' + state} aria-live="polite" aria-busy={state === 'loading'}>
        {state === 'loading' && (
          <>
            <span className="vd-skel vd-skel--title" />
            <span className="vd-skel" />
          </>
        )}

        {state !== 'loading' && (
          <div className="vd-banner">
            <span className="vd-icon" aria-hidden="true">{state === 'verified' ? '✓' : state === 'mismatch' ? '!' : '?'}</span>
            <div>
              <h2>{t('verifyDelivery.states.' + state + '.title')}</h2>
              <p>{t('verifyDelivery.states.' + state + '.text')}</p>
            </div>
          </div>
        )}

        {(state === 'unavailable' || state === 'error') && (
          <button type="button" className="vd-btn" onClick={() => query.refetch()} disabled={query.isFetching}>
            {query.isFetching ? t('verifyDelivery.checking') : t('verifyDelivery.retry')}
          </button>
        )}

        {result && (
          <dl className="vd-facts">
            <div><dt>{t('verifyDelivery.code')}</dt><dd>{result.deliveryId}</dd></div>
            <div><dt>{t('verifyDelivery.recomputed')}</dt><dd>{result.recordHash ?? '—'}</dd></div>
            <div><dt>{t('verifyDelivery.anchored')}</dt><dd>{result.anchoredHash ?? '—'}</dd></div>
            {result.explorerUrl && (
              <div>
                <dt>{t('verifyDelivery.transaction')}</dt>
                <dd><a href={result.explorerUrl} target="_blank" rel="noreferrer">{t('verifyDelivery.viewTx')} ↗</a></dd>
              </div>
            )}
          </dl>
        )}

        {state === 'notFound' && <p className="vd-code">{t('verifyDelivery.code')}: <code>{deliveryId}</code></p>}
      </section>

      <p className="vd-privacy">{t('verifyDelivery.privacy')}</p>
    </div>
  );
}
