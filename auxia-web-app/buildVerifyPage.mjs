// Rediseño de la página pública de verificación (/public/verify/:deliveryId): estilo oscuro tipo "glass",
// con la paleta y el logo de AuxIA, selector de idioma, acceso a la landing y a iniciar sesión.
// Uso (en la raíz, DESPUÉS de buildTraceabilityExports.mjs): node buildVerifyPage.mjs   (se puede repetir)
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

const write = (path, content) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content.replace(/^\n/, ''));
  console.log('+ ' + path);
};
const deepMerge = (a, b) => {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = v && typeof v === 'object' && !Array.isArray(v) ? deepMerge(a?.[k] ?? {}, v) : v;
  return out;
};
const mergeJson = (path, patch) => {
  const current = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
  writeFileSync(path, JSON.stringify(deepMerge(current, patch), null, 2) + '\n');
  console.log('~ ' + path);
};
// Lee con saltos de línea \n y respeta los \r\n de Windows al escribir de vuelta.
const readLf = (path) => {
  const raw = readFileSync(path, 'utf8');
  return { text: raw.replace(/\r\n/g, '\n'), crlf: raw.includes('\r\n') };
};
const writeLf = (path, text, crlf) => writeFileSync(path, crlf ? text.replace(/\n/g, '\r\n') : text);
const patch = (path, pairs) => {
  let { text, crlf } = readLf(path);
  for (const [from, to] of pairs) {
    if (text.includes(to) && to !== '') continue;
    if (!text.includes(from)) { if (to === '') continue; throw new Error('No encontré el fragmento esperado en ' + path + ':\n' + from); }
    text = text.replace(from, to);
  }
  writeLf(path, text, crlf);
  console.log('~ ' + path);
};

const CT = 'src/boundedContexts/citizenTransparency/';
if (!existsSync(CT + 'presentation/pages/verifyDeliveryPage.jsx')) throw new Error('Primero corre buildTraceabilityExports.mjs (en la raíz del proyecto).');

/* URL de la landing (se puede cambiar con VITE_LANDING_URL) */
patch('src/shared/infrastructure/config/env.js', [[
  "  useMocks: import.meta.env.VITE_USE_MOCKS !== 'false',\n",
  "  useMocks: import.meta.env.VITE_USE_MOCKS !== 'false',\n  // Página de presentación de AuxIA (enlace \"Ir al sitio\" de las pantallas públicas).\n  landingUrl: import.meta.env.VITE_LANDING_URL || 'https://site-two-mu-26.vercel.app',\n",
]]);

/* La verificación deja de usar el layout claro del portal público: lleva su propio encabezado oscuro. */
const routerPath = 'src/app/router/index.jsx';
const { text: routerText, crlf: routerCrlf } = readLf(routerPath);
if (!routerText.includes('// Verificación pública: pantalla propia')) {
  const verifyBlock = `      {
        path: routes.verifyDelivery,
        ...page(() => import('@bc/citizenTransparency/presentation/pages/verifyDeliveryPage.jsx')),
      },
`;
  if (!routerText.includes(verifyBlock)) throw new Error('No encontré la ruta verifyDelivery en ' + routerPath);
  const authAnchor = "        ...page(() => import('@bc/identityAccess/presentation/pages/signInPage.jsx')),\n      },\n";
  if (!routerText.includes(authAnchor)) throw new Error('No encontré la ruta signIn en ' + routerPath);
  writeLf(routerPath, routerText.replace(verifyBlock, '').replace(authAnchor, authAnchor +
    '      // Verificación pública: pantalla propia, sin el encabezado del portal.\n' + verifyBlock), routerCrlf);
  console.log('~ ' + routerPath);
}

write(CT + 'presentation/components/hashPanel.jsx', String.raw`
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

// Una huella digital (hash) en un panel con botón de copiar.
export default function HashPanel({ label, value, tone }) {
  const { t } = useTranslation('citizenTransparency');
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className={'vd-hash' + (tone ? ' vd-hash--' + tone : '')}>
      <span className="vd-hash__label">{label}</span>
      <code className="vd-hash__value">{value ?? '—'}</code>
      {value && (
        <button type="button" className="vd-hash__copy" onClick={copy}>{copied ? t('verifyDelivery.copied') : t('verifyDelivery.copy')}</button>
      )}
    </div>
  );
}
`);

write(CT + 'presentation/pages/verifyDeliveryPage.jsx', String.raw`
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
`);

write(CT + 'presentation/styles/verifyDelivery.css', String.raw`
/* Verificación pública: oscuro, "glass" y un resplandor de horizonte detrás de la tarjeta. */
.vd {
  --vd-accent: var(--color-sky);
  --vd-glow: rgba(71, 80, 221, 0.55);
  position: relative; display: flex; flex-direction: column; min-height: 100vh; overflow: hidden;
  background: radial-gradient(120% 70% at 50% 0%, var(--night-500) 0%, var(--night-600) 55%, #05051c 100%);
  color: var(--color-white); font-family: var(--font-sans);
}
.vd--verified { --vd-accent: var(--color-emerald); --vd-glow: rgba(5, 194, 116, 0.45); }
.vd--mismatch { --vd-accent: var(--color-danger); --vd-glow: rgba(255, 77, 77, 0.4); }
.vd--unavailable, .vd--error { --vd-accent: #ffb454; --vd-glow: rgba(255, 180, 84, 0.35); }
.vd::before { content: ''; position: absolute; left: 50%; bottom: -46vw; width: 120vw; height: 90vw; transform: translateX(-50%); border-radius: 50%;
  background: radial-gradient(closest-side, #05051c 88%, transparent 89%); box-shadow: 0 -2px 90px 8px var(--vd-glow), 0 -1px 2px 1px var(--color-sky); pointer-events: none; transition: box-shadow 0.6s; }
.vd::after { content: ''; position: absolute; inset: 0; pointer-events: none;
  background: radial-gradient(1.5px 1.5px at 12% 30%, #fff8, transparent), radial-gradient(1.5px 1.5px at 82% 22%, #fff8, transparent), radial-gradient(1px 1px at 68% 58%, #fff6, transparent), radial-gradient(1px 1px at 24% 64%, #fff6, transparent), radial-gradient(1px 1px at 92% 70%, #fff5, transparent); }
.vd > * { position: relative; z-index: 1; }

.vd-nav { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; width: min(1120px, calc(100% - 32px)); margin: 16px auto 0; padding: 10px 14px 10px 20px; border: 1px solid rgba(178, 178, 226, 0.18); border-radius: 999px; background: rgba(12, 12, 48, 0.55); backdrop-filter: blur(12px); }
.vd-brand img { display: block; height: 40px; width: auto; }
.vd-nav__actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.vd .lang-pill { margin-left: 0; border-color: rgba(178, 178, 226, 0.3); background: rgba(255, 255, 255, 0.04); color: var(--night-100); }
.vd .lang-pill__btn:hover { background: rgba(255, 255, 255, 0.1); }
.vd .lang-pill__btn[aria-pressed='true'] { background: var(--color-royal); color: #fff; }
.vd-pill { display: inline-flex; align-items: center; gap: 6px; min-height: 40px; padding: 0 18px; border-radius: 999px; font-size: 0.875rem; font-weight: 600; text-decoration: none; transition: background 0.2s, border-color 0.2s; }
.vd-pill--outline { border: 1px solid rgba(178, 178, 226, 0.35); color: #fff; }
.vd-pill--outline:hover { background: rgba(255, 255, 255, 0.08); }
.vd-pill--solid { background: var(--color-lime); color: var(--color-night); }
.vd-pill--solid:hover { background: var(--lime-50); }
.vd a:focus-visible, .vd button:focus-visible { outline: 3px solid var(--color-sky); outline-offset: 2px; }

.vd-main { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px; padding: 40px 16px 24px; }
.vd-card { display: grid; gap: 22px; width: min(560px, 100%); padding: 28px; border: 1px solid rgba(133, 213, 246, 0.25); border-radius: 24px;
  background: linear-gradient(160deg, rgba(71, 80, 221, 0.32), rgba(12, 12, 48, 0.7) 55%); backdrop-filter: blur(18px);
  box-shadow: 0 30px 80px rgba(0, 0, 20, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.08); }
.vd-eyebrow { margin: 0; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--color-sky); }
.vd-status, .vd-loading { display: grid; justify-items: center; gap: 10px; text-align: center; }
.vd-status h1, .vd-loading h1 { margin: 6px 0 0; font-size: clamp(1.5rem, 4vw, 1.875rem); letter-spacing: -0.02em; }
.vd-status p, .vd-loading p { margin: 0; max-width: 42ch; color: var(--night-100); line-height: 1.5; }
.vd-icon { display: grid; place-items: center; width: 72px; height: 72px; border-radius: 50%; font-size: 2rem; font-weight: 700; color: var(--vd-accent);
  background: color-mix(in srgb, var(--vd-accent) 16%, transparent); border: 1.5px solid var(--vd-accent); box-shadow: 0 0 36px var(--vd-glow); }
.vd-spinner { width: 56px; height: 56px; border-radius: 50%; border: 3px solid rgba(133, 213, 246, 0.2); border-top-color: var(--color-sky); animation: vd-spin 0.9s linear infinite; }
@keyframes vd-spin { to { transform: rotate(360deg); } }

.vd-compare { display: grid; gap: 0; justify-items: stretch; position: relative; }
.vd-hash { position: relative; display: grid; gap: 6px; padding: 14px 16px; border: 1px solid rgba(178, 178, 226, 0.18); border-radius: 16px; background: rgba(5, 5, 28, 0.55); }
.vd-compare .vd-hash:last-child { padding-top: 26px; }
.vd-hash--bad { border-color: rgba(255, 77, 77, 0.55); }
.vd-hash__label { padding-right: 76px; font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--night-100); }
.vd-hash__value { padding-right: 64px; font-family: ui-monospace, 'SFMono-Regular', Menlo, monospace; font-size: 0.8125rem; line-height: 1.45; overflow-wrap: anywhere; color: #fff; }
.vd-hash__copy { position: absolute; top: 10px; right: 10px; min-height: 28px; padding: 0 12px; border: 1px solid rgba(178, 178, 226, 0.3); border-radius: 999px; background: transparent; color: var(--color-sky); font: inherit; font-size: 0.75rem; font-weight: 600; cursor: pointer; }
.vd-hash__copy:hover { background: rgba(133, 213, 246, 0.12); }
.vd-equal { z-index: 2; justify-self: center; display: grid; place-items: center; width: 40px; height: 40px; margin: -8px 0 -22px; border-radius: 50%; background: var(--vd-accent); color: var(--night-600); font-size: 1.25rem; font-weight: 700; box-shadow: 0 0 0 5px rgba(12, 12, 48, 0.9), 0 0 24px var(--vd-glow); }

.vd-info { display: grid; gap: 10px; padding-top: 16px; border-top: 1px solid rgba(178, 178, 226, 0.16); font-size: 0.875rem; }
.vd-info div { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; }
.vd-info span { color: var(--night-100); }
.vd-info code { min-width: 0; overflow-wrap: anywhere; text-align: right; font-family: ui-monospace, 'SFMono-Regular', Menlo, monospace; }
.vd-info a { color: var(--color-sky); font-weight: 600; }

.vd-btn { min-height: 48px; border: 0; border-radius: 999px; background: linear-gradient(135deg, var(--color-royal), var(--royal-300)); color: #fff; font: inherit; font-weight: 700; cursor: pointer; box-shadow: 0 8px 28px rgba(71, 80, 221, 0.45); }
.vd-btn:disabled { opacity: 0.6; cursor: progress; }
.vd-privacy { margin: 0; max-width: 560px; text-align: center; font-size: 0.8125rem; line-height: 1.5; color: var(--night-100); }
.vd-foot { padding: 12px 16px 24px; text-align: center; font-size: 0.875rem; }
.vd-foot a { color: var(--color-sky); }

@media (max-width: 560px) {
  .vd-nav { border-radius: 24px; padding: 12px; justify-content: center; }
  .vd-card { padding: 20px; border-radius: 20px; }
  .vd-info div { flex-direction: column; gap: 2px; }
  .vd-info code { text-align: left; }
}
@media (prefers-reduced-motion: reduce) { .vd-spinner { animation-duration: 3s; } }
`);

mergeJson(CT + 'presentation/i18n/es.json', { verifyDelivery: {
  title: 'Verificación pública', navLabel: 'Navegación', goToSite: 'Ir al sitio', learnMore: 'Conoce más sobre AuxIA',
  checking: 'Verificando...', checkingText: 'Comparando el registro con la blockchain.',
  copy: 'Copiar', copied: 'Copiado', match: 'Coinciden', noMatch: 'No coinciden',
} });
mergeJson(CT + 'presentation/i18n/en.json', { verifyDelivery: {
  title: 'Public verification', navLabel: 'Navigation', goToSite: 'Go to site', learnMore: 'Learn more about AuxIA',
  checking: 'Verifying...', checkingText: 'Comparing the record with the blockchain.',
  copy: 'Copy', copied: 'Copied', match: 'Match', noMatch: 'Do not match',
} });

console.log('\nListo. Reinicia "npm run dev" y abre el enlace público de una entrega.');
