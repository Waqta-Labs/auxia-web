import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDeliveryVerification } from '@bc/traceability/presentation/hooks/useDeliveryVerification.js';
import LanguageSwitcher from '@shared/presentation/components/languageSwitcher.jsx';
import { env } from '@shared/infrastructure/config/env.js';
import { routes } from '@app/router/routes.js';
import logo from '@assets/logos/14.svg';
import HashPanel from '../components/hashPanel.jsx';
import '../styles/verifyDelivery.css';

const ICONS = { verified: '✓', mismatch: '!', notFound: '?', unavailable: '…', error: '!' };

// Pantalla pública (sin sesión): cualquiera con el código de una entrega comprueba que su registro no fue
// alterado. Compara el hash recalculado hoy con el que está anclado en la blockchain.
export default function VerifyDeliveryPage() {
  const { t } = useTranslation('citizenTransparency');
  const { t: tc } = useTranslation('common');
  const { deliveryId } = useParams();
  const query = useDeliveryVerification(deliveryId);
  const result = query.data;
  const error = query.error;

  const state = query.isLoading ? 'loading'
    : result ? (result.verified ? 'verified' : 'mismatch')
    : error?.status === 404 ? 'notFound'
    : error?.status === 503 ? 'unavailable'
    : 'error';
  const canRetry = state === 'unavailable' || state === 'error';

  return (
    <div className={'vd vd--' + state}>
      <header className="vd-nav">
        <a className="vd-brand" href={env.landingUrl} aria-label={tc('appName')}>
          <img src={logo} alt={tc('appName')} />
        </a>
        <nav className="vd-nav__actions" aria-label={t('verifyDelivery.navLabel')}>
          <LanguageSwitcher variant="pill" />
          <a className="vd-pill vd-pill--outline" href={env.landingUrl}>{t('verifyDelivery.goToSite')} <span aria-hidden="true">↗</span></a>
          <Link className="vd-pill vd-pill--solid" to={routes.signIn}>{tc('actions.signIn')}</Link>
        </nav>
      </header>

      <main className="vd-main">
        <section className="vd-card" aria-live="polite" aria-busy={state === 'loading'} aria-labelledby="vd-title">
          <p className="vd-eyebrow">{t('verifyDelivery.title')}</p>

          {state === 'loading' ? (
            <div className="vd-loading">
              <span className="vd-spinner" aria-hidden="true" />
              <h1 id="vd-title">{t('verifyDelivery.checking')}</h1>
              <p>{t('verifyDelivery.checkingText')}</p>
            </div>
          ) : (
            <div className="vd-status">
              <span className="vd-icon" aria-hidden="true">{ICONS[state]}</span>
              <h1 id="vd-title">{t('verifyDelivery.states.' + state + '.title')}</h1>
              <p>{t('verifyDelivery.states.' + state + '.text')}</p>
            </div>
          )}

          {result && (
            <div className="vd-compare">
              <HashPanel label={t('verifyDelivery.recomputed')} value={result.recordHash} />
              <span className="vd-equal" role="img" aria-label={t(result.verified ? 'verifyDelivery.match' : 'verifyDelivery.noMatch')}>
                {result.verified ? '=' : '≠'}
              </span>
              <HashPanel label={t('verifyDelivery.anchored')} value={result.anchoredHash} tone={result.verified ? null : 'bad'} />
            </div>
          )}

          <div className="vd-info">
            <div><span>{t('verifyDelivery.code')}</span><code>{deliveryId}</code></div>
            {result?.explorerUrl && (
              <div>
                <span>{t('verifyDelivery.transaction')}</span>
                <a href={result.explorerUrl} target="_blank" rel="noreferrer">{t('verifyDelivery.viewTx')} ↗</a>
              </div>
            )}
          </div>

          {canRetry && (
            <button type="button" className="vd-btn" onClick={() => query.refetch()} disabled={query.isFetching}>
              {query.isFetching ? t('verifyDelivery.checking') : t('verifyDelivery.retry')}
            </button>
          )}
        </section>

        <p className="vd-privacy">{t('verifyDelivery.privacy')}</p>
      </main>

      <footer className="vd-foot">
        <a href={env.landingUrl}>{t('verifyDelivery.learnMore')}</a>
      </footer>
    </div>
  );
}
