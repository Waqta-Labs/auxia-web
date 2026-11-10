// Actualiza: jsconfig (sin baseUrl), paleta/tipografía completas y un login nuevo con animación.
// Uso (en la raíz del proyecto): node updateLogin.mjs
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

const write = (path, content) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content.replace(/^\n/, ''));
  console.log('~ ' + path);
};

/* ───────────── jsconfig (sin baseUrl: deprecado en TS 6/7) ───────────── */
write('jsconfig.json', JSON.stringify({
  compilerOptions: {
    jsx: 'react-jsx',
    paths: {
      '@app/*': ['./src/app/*'],
      '@bc/*': ['./src/boundedContexts/*'],
      '@shared/*': ['./src/shared/*'],
      '@i18n/*': ['./src/i18n/*'],
      '@assets/*': ['./src/assets/*'],
    },
  },
  include: ['src'],
}, null, 2) + '\n');

/* ───────────── Guidelines: paleta completa + tipografía ───────────── */
write('src/shared/presentation/styles/palette.css', String.raw`
/* Guidelines de estilo AuxIA (capítulo 6): paleta de apoyo completa y tipografía.
   Cada escala va de claro (50) a oscuro (900). Los colores base están en tokens.css. */
:root {
  /* Base */
  --color-coral: #ff4d4d;
  --color-black: #000000;

  /* Verde lima */
  --lime-50: #bcfb89;  --lime-100: #93d359; --lime-200: #75a946; --lime-300: #598133;
  --lime-400: #3d5b22; --lime-500: #243812; --lime-600: #0d1805;
  /* Verde esmeralda */
  --emerald-50: #c0ffd7; --emerald-100: #08ee90; --emerald-200: #05c274; --emerald-300: #039759;
  --emerald-400: #016f40; --emerald-500: #014928; --emerald-600: #002613;
  /* Verde oscuro / turquesa */
  --teal-50: #b5fef9; --teal-100: #35e5dd; --teal-200: #29bab3; --teal-300: #1e918b;
  --teal-400: #136a65; --teal-500: #094542; --teal-600: #032321;
  /* Celeste */
  --sky-50: #e3f3fc; --sky-100: #85d5f6; --sky-200: #4cafd1; --sky-300: #3987a2;
  --sky-400: #276276; --sky-500: #163e4c; --sky-600: #071e26;
  /* Azul real */
  --royal-50: #eff0fc; --royal-100: #cfd0f7; --royal-200: #a3a5f0; --royal-300: #767be9;
  --royal-400: #4750dd; --royal-500: #252fa7; --royal-600: #111760;
  /* Azul noche */
  --night-50: #dcdcf2; --night-100: #b2b2e2; --night-200: #8989d3; --night-300: #6161bf;
  --night-400: #3c3ca0; --night-500: #212161; --night-600: #0c0c30;
  /* Grises */
  --gray-50: #e6eae4; --gray-100: #bec2bc; --gray-200: #989b96; --gray-300: #747672;
  --gray-400: #515350; --gray-500: #313231; --gray-600: #141514;

  /* Tipografía: Inter (light 300 / regular 400 / bold 700) */
  --font-sans: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
  --fw-light: 300;
  --fw-regular: 400;
  --fw-medium: 500;
  --fw-bold: 700;

  /* Gradiente de marca */
  --gradient-brand: linear-gradient(135deg, var(--color-royal) 0%, var(--royal-300) 55%, var(--color-sky) 100%);
}
`);

/* Asegura el import de palette.css en main.jsx */
if (existsSync('src/main.jsx')) {
  let main = readFileSync('src/main.jsx', 'utf8');
  if (!main.includes('palette.css')) {
    main = main.replace(
      /(import ['"]@shared\/presentation\/styles\/tokens\.css['"];?)/,
      "$1\nimport '@shared/presentation/styles/palette.css';"
    );
    writeFileSync('src/main.jsx', main);
    console.log('~ src/main.jsx (import palette.css)');
  }
}

/* ───────────── Logo (aproximación en SVG; puedes reemplazarlo por tu archivo oficial) ───────────── */
write('src/shared/presentation/components/auxiaLogo.jsx', String.raw`
// Aproximación vectorial del isotipo AuxIA. Para usar el logo oficial, guarda el SVG en
// src/assets/logos/ e impórtalo en lugar de este componente.
export default function AuxiaLogo({
  withWordmark = true,
  primary = '#ffffff',
  background = '#212161',
  accent = '#85d5f6',
  wordAux = '#85d5f6',
  wordIa = '#ffffff',
  height = 44,
  title = 'AuxIA',
}) {
  const width = withWordmark ? height * 3.1 : height;
  return (
    <svg
      role="img"
      aria-label={title}
      height={height}
      width={width}
      viewBox={withWordmark ? '0 0 200 64' : '0 0 64 64'}
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="30" cy="30" r="28" fill={primary} />
      <line x1="16" y1="16" x2="34" y2="34" stroke={background} strokeWidth="3" strokeLinecap="round" />
      <circle cx="15" cy="15" r="5.5" fill={background} />
      <circle cx="43" cy="43" r="19" fill={primary} />
      <circle cx="43" cy="43" r="16" fill={background} />
      <circle cx="37" cy="39" r="3" fill={primary} />
      <circle cx="49" cy="35" r="2.5" fill={primary} />
      <circle cx="50" cy="51" r="6" fill={accent} />
      {withWordmark && (
        <text x="68" y="50" fontFamily="Inter, system-ui, sans-serif" fontSize="42" letterSpacing="-1">
          <tspan fill={wordAux} fontWeight="400">aux</tspan>
          <tspan fill={wordIa} fontWeight="800">ia</tspan>
        </text>
      )}
    </svg>
  );
}
`);

/* ───────────── Selector de idioma (variante pill con globo) ───────────── */
write('src/shared/presentation/components/languageSwitcher.jsx', String.raw`
import { useTranslation } from 'react-i18next';

const languages = ['es', 'en'];

function GlobeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" />
    </svg>
  );
}

export default function LanguageSwitcher({ variant = 'default' }) {
  const { i18n, t } = useTranslation();
  const current = i18n.resolvedLanguage;

  if (variant === 'pill') {
    return (
      <div className="lang-pill" role="group" aria-label={t('language')}>
        <GlobeIcon />
        {languages.map((lng) => (
          <button
            key={lng}
            type="button"
            className="lang-pill__btn"
            aria-pressed={current === lng}
            onClick={() => i18n.changeLanguage(lng)}
          >
            {lng.toUpperCase()}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="lang-switcher" role="group" aria-label={t('language')}>
      {languages.map((lng) => (
        <button
          key={lng}
          type="button"
          className="btn btn--ghost"
          aria-pressed={current === lng}
          onClick={() => i18n.changeLanguage(lng)}
        >
          {lng.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
`);

/* ───────────── Animación temática: red de ayuda priorizada ───────────── */
write('src/boundedContexts/identityAccess/presentation/components/aidNetworkAnimation.jsx', String.raw`
import { useMemo } from 'react';

// Zonas afectadas alrededor del centro de mando. "priority" = zonas críticas del ranking.
const HUB = { x: 300, y: 300 };
const ZONES = [
  { id: 'Z-01', x: 105, y: 135, kind: 'priority', score: 94 },
  { id: 'Z-02', x: 300, y: 62, kind: 'normal', score: 61 },
  { id: 'Z-03', x: 492, y: 128, kind: 'normal', score: 58 },
  { id: 'Z-04', x: 540, y: 322, kind: 'priority', score: 87 },
  { id: 'Z-05', x: 438, y: 505, kind: 'normal', score: 49 },
  { id: 'Z-06', x: 205, y: 520, kind: 'priority', score: 82 },
  { id: 'Z-07', x: 62, y: 360, kind: 'normal', score: 44 },
];

function routePath(zone, index) {
  const mx = (HUB.x + zone.x) / 2;
  const my = (HUB.y + zone.y) / 2;
  const dx = zone.x - HUB.x;
  const dy = zone.y - HUB.y;
  const bend = (index % 2 === 0 ? 1 : -1) * 0.16;
  const cx = mx - dy * bend;
  const cy = my + dx * bend;
  return 'M' + HUB.x + ' ' + HUB.y + ' Q' + cx.toFixed(1) + ' ' + cy.toFixed(1) + ' ' + zone.x + ' ' + zone.y;
}

export default function AidNetworkAnimation() {
  const reduceMotion = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    []
  );

  return (
    <svg className="aid-net" viewBox="0 0 600 600" role="presentation" aria-hidden="true">
      <defs>
        <radialGradient id="aidHubGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#85d5f6" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#85d5f6" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="aidSweep" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#85d5f6" stopOpacity="0" />
          <stop offset="100%" stopColor="#85d5f6" stopOpacity="0.38" />
        </linearGradient>
      </defs>

      {/* Anillos de radar */}
      <g className="aid-net__rings">
        <circle cx={HUB.x} cy={HUB.y} r="90" />
        <circle cx={HUB.x} cy={HUB.y} r="170" />
        <circle cx={HUB.x} cy={HUB.y} r="250" />
      </g>
      <circle className="aid-net__orbit" cx={HUB.x} cy={HUB.y} r="210" />

      {/* Barrido del radar */}
      <path
        className="aid-net__sweep"
        d={'M' + HUB.x + ' ' + HUB.y + ' L' + (HUB.x + 255) + ' ' + HUB.y + ' A255 255 0 0 0 ' + (HUB.x + 255 * Math.cos(-0.7)).toFixed(1) + ' ' + (HUB.y + 255 * Math.sin(-0.7)).toFixed(1) + ' Z'}
        fill="url(#aidSweep)"
      />

      {/* Rutas de distribución */}
      {ZONES.map((zone, i) => (
        <path
          key={zone.id + '-route'}
          id={'aidRoute' + i}
          className={'aid-net__route aid-net__route--' + zone.kind}
          d={routePath(zone, i)}
          fill="none"
        />
      ))}

      {/* Paquetes de ayuda viajando hacia las zonas */}
      {!reduceMotion &&
        ZONES.map((zone, i) => (
          <circle key={zone.id + '-packet'} r={zone.kind === 'priority' ? 5 : 3.5}
            className={'aid-net__packet aid-net__packet--' + zone.kind}>
            <animateMotion
              dur={(zone.kind === 'priority' ? 2.6 : 3.8) + 's'}
              begin={(i * 0.55).toFixed(2) + 's'}
              repeatCount="indefinite"
              keyPoints="0;1"
              keyTimes="0;1"
              calcMode="linear"
            >
              <mpath href={'#aidRoute' + i} />
            </animateMotion>
          </circle>
        ))}

      {/* Zonas */}
      {ZONES.map((zone, i) => (
        <g key={zone.id} className={'aid-net__zone aid-net__zone--' + zone.kind}
          style={{ animationDelay: (i * 0.35) + 's' }}>
          {zone.kind === 'priority' && (
            <>
              <circle className="aid-net__pulse" cx={zone.x} cy={zone.y} r="14" style={{ animationDelay: (i * 0.4) + 's' }} />
              <circle className="aid-net__pulse aid-net__pulse--late" cx={zone.x} cy={zone.y} r="14" style={{ animationDelay: (i * 0.4 + 1.1) + 's' }} />
            </>
          )}
          <circle className="aid-net__dot" cx={zone.x} cy={zone.y} r={zone.kind === 'priority' ? 11 : 8} />
          <text className="aid-net__label" x={zone.x} y={zone.y - 20} textAnchor="middle">
            {zone.id + ' · ' + zone.score}
          </text>
        </g>
      ))}

      {/* Centro de mando */}
      <circle cx={HUB.x} cy={HUB.y} r="70" fill="url(#aidHubGlow)" />
      <g className="aid-net__hub">
        <circle cx={HUB.x} cy={HUB.y} r="26" className="aid-net__hub-core" />
        <circle cx={HUB.x} cy={HUB.y} r="38" className="aid-net__hub-ring" />
        <circle cx={HUB.x - 7} cy={HUB.y - 5} r="3.2" fill="#ffffff" />
        <circle cx={HUB.x + 8} cy={HUB.y - 8} r="2.6" fill="#ffffff" />
        <circle cx={HUB.x + 8} cy={HUB.y + 9} r="6" fill="#85d5f6" />
      </g>
    </svg>
  );
}
`);

/* ───────────── Página de login ───────────── */
write('src/boundedContexts/identityAccess/presentation/pages/signInPage.jsx', String.raw`
import { useRef, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth.js';
import { routes } from '@app/router/routes.js';
import AuxiaLogo from '@shared/presentation/components/auxiaLogo.jsx';
import LanguageSwitcher from '@shared/presentation/components/languageSwitcher.jsx';
import AidNetworkAnimation from '../components/aidNetworkAnimation.jsx';
import '../styles/signIn.css';

const iconProps = {
  width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
};
const MailIcon = () => (
  <svg {...iconProps}><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m4 7 8 6 8-6" /></svg>
);
const LockIcon = () => (
  <svg {...iconProps}><rect x="4" y="11" width="16" height="9" rx="3" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
);
const EyeIcon = ({ off }) => (
  <svg {...iconProps}>
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" />
    {off && <path d="M4 4l16 16" />}
  </svg>
);
const ArrowIcon = () => (
  <svg {...iconProps}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);
const ShieldIcon = () => (
  <svg {...iconProps} width="14" height="14"><path d="M12 3 5 6v5c0 4.5 2.9 8.2 7 10 4.1-1.8 7-5.5 7-10V6l-7-3z" /><path d="m9 12 2 2 4-4" /></svg>
);

export default function SignInPage() {
  const { t } = useTranslation('identityAccess');
  const { isAuthenticated, signIn } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [attempts, setAttempts] = useState(0);
  const [loading, setLoading] = useState(false);
  const emailRef = useRef(null);

  const redirectTo = location.state?.from?.pathname || routes.dashboard;
  if (isAuthenticated) return <Navigate to={redirectTo} replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signIn({ email, password });
    } catch (err) {
      setError(err.message);
      setAttempts((n) => n + 1);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="si">
      {/* Panel de marca con animación */}
      <aside className="si-hero">
        <div className="si-hero__glow si-hero__glow--a" />
        <div className="si-hero__glow si-hero__glow--b" />
        <div className="si-hero__grid" />

        <header className="si-hero__brand">
          <AuxiaLogo height={44} />
        </header>

        <div className="si-hero__stage">
          <AidNetworkAnimation />
        </div>

        <div className="si-hero__copy">
          <span className="si-eyebrow">{t('hero.eyebrow')}</span>
          <h2>{t('hero.title')}</h2>
          <p>{t('hero.subtitle')}</p>
          <ul className="si-pills">
            <li><i className="si-dot si-dot--coral" />{t('hero.pills.priority')}</li>
            <li><i className="si-dot si-dot--lime" />{t('hero.pills.distribution')}</li>
            <li><i className="si-dot si-dot--sky" />{t('hero.pills.traceability')}</li>
          </ul>
        </div>
      </aside>

      {/* Formulario */}
      <main className="si-panel">
        <div className="si-panel__top">
          <div className="si-panel__brand-mobile"><AuxiaLogo height={36} primary="#212161" background="#ffffff" accent="#4750dd" wordAux="#4750dd" wordIa="#141514" /></div>
          <LanguageSwitcher variant="pill" />
        </div>

        <form className="si-form" onSubmit={handleSubmit} noValidate>
          <h1>{t('signIn.title')}</h1>
          <p className="si-form__subtitle">{t('signIn.subtitle')}</p>

          <label className="si-field" htmlFor="email">
            <span>{t('signIn.email')}</span>
            <div className="si-input">
              <MailIcon />
              <input
                id="email" ref={emailRef} type="email" inputMode="email" autoComplete="username"
                autoFocus required placeholder={t('signIn.emailPlaceholder')}
                value={email} onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </label>

          <label className="si-field" htmlFor="password">
            <span>{t('signIn.password')}</span>
            <div className="si-input">
              <LockIcon />
              <input
                id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password"
                required placeholder="••••••••"
                value={password} onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button" className="si-input__toggle"
                aria-label={showPassword ? t('signIn.hidePassword') : t('signIn.showPassword')}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((v) => !v)}
              >
                <EyeIcon off={showPassword} />
              </button>
            </div>
          </label>

          {error && (
            <p key={attempts} className="si-error" role="alert">
              {t('signIn.errors.' + error)}
            </p>
          )}

          <button className="si-submit" type="submit" disabled={loading}>
            {loading ? (<><span className="si-spinner" aria-hidden="true" />{t('signIn.loading')}</>)
              : (<>{t('signIn.submit')}<ArrowIcon /></>)}
          </button>

          <p className="si-hint"><ShieldIcon />{t('signIn.lockHint')}</p>
        </form>

        <footer className="si-panel__footer">{t('footer')}</footer>
      </main>
    </div>
  );
}
`);

write('src/boundedContexts/identityAccess/presentation/styles/signIn.css', String.raw`
.si {
  --si-ease: cubic-bezier(0.22, 1, 0.36, 1);
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(420px, 0.85fr);
  min-height: 100vh;
  background: var(--color-white);
}

/* ── Panel de marca ── */
.si-hero {
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: var(--space-5) clamp(32px, 5vw, 64px);
  color: var(--color-white);
  background:
    radial-gradient(1200px 700px at 20% 0%, var(--night-400) 0%, transparent 60%),
    radial-gradient(900px 700px at 100% 100%, var(--royal-500) 0%, transparent 55%),
    var(--color-night);
}
.si-hero > * { position: relative; z-index: 1; }

.si-hero__grid {
  position: absolute !important;
  inset: 0;
  z-index: 0 !important;
  background-image:
    linear-gradient(rgba(133, 213, 246, 0.07) 1px, transparent 1px),
    linear-gradient(90deg, rgba(133, 213, 246, 0.07) 1px, transparent 1px);
  background-size: 48px 48px;
  mask-image: radial-gradient(ellipse at 50% 50%, #000 30%, transparent 75%);
}
.si-hero__glow {
  position: absolute !important;
  z-index: 0 !important;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.55;
  animation: si-float 14s ease-in-out infinite;
}
.si-hero__glow--a { width: 420px; height: 420px; left: -120px; top: 30%; background: var(--color-royal); }
.si-hero__glow--b { width: 360px; height: 360px; right: -80px; top: -60px; background: var(--teal-300); animation-delay: -6s; opacity: 0.35; }

.si-hero__stage { flex: 1; display: grid; place-items: center; min-height: 0; padding: var(--space-3) 0; }
.si-hero__copy { max-width: 520px; }
.si-eyebrow {
  display: inline-block;
  margin-bottom: var(--space-2);
  font-size: 0.75rem;
  font-weight: var(--fw-bold);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--color-lime);
}
.si-hero__copy h2 { margin: 0 0 var(--space-2); font-size: clamp(1.6rem, 2.6vw, 2.25rem); line-height: 1.15; font-weight: var(--fw-bold); letter-spacing: -0.02em; }
.si-hero__copy p { margin: 0 0 var(--space-3); color: var(--night-50); font-weight: var(--fw-light); line-height: 1.6; }

.si-pills { display: flex; flex-wrap: wrap; gap: var(--space-2); margin: 0; padding: 0; list-style: none; }
.si-pills li {
  display: inline-flex; align-items: center; gap: var(--space-2);
  padding: 6px 14px; border-radius: 999px;
  font-size: 0.8125rem; font-weight: var(--fw-medium);
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.14);
  backdrop-filter: blur(6px);
}
.si-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.si-dot--coral { background: var(--color-coral); box-shadow: 0 0 10px var(--color-coral); }
.si-dot--lime { background: var(--color-lime); box-shadow: 0 0 10px var(--color-lime); }
.si-dot--sky { background: var(--color-sky); box-shadow: 0 0 10px var(--color-sky); }

/* ── Animación SVG ── */
.aid-net { width: min(100%, 560px); max-height: 100%; height: auto; overflow: visible; }
.aid-net__rings circle { fill: none; stroke: rgba(133, 213, 246, 0.18); stroke-width: 1; }
.aid-net__orbit { fill: none; stroke: rgba(188, 251, 137, 0.35); stroke-width: 1; stroke-dasharray: 3 9; transform-origin: 300px 300px; animation: si-spin 60s linear infinite; }
.aid-net__sweep { transform-origin: 300px 300px; animation: si-spin 6s linear infinite; }
.aid-net__route { stroke-width: 1.5; stroke-dasharray: 5 7; animation: si-dash 1.4s linear infinite; }
.aid-net__route--normal { stroke: rgba(133, 213, 246, 0.5); }
.aid-net__route--priority { stroke: rgba(188, 251, 137, 0.75); stroke-width: 2; }
.aid-net__packet--normal { fill: var(--color-sky); }
.aid-net__packet--priority { fill: var(--color-lime); filter: drop-shadow(0 0 6px var(--color-lime)); }
.aid-net__zone { animation: si-pop 0.8s var(--si-ease) both; transform-box: fill-box; transform-origin: center; }
.aid-net__zone--normal .aid-net__dot { fill: var(--color-sky); }
.aid-net__zone--priority .aid-net__dot { fill: var(--color-coral); filter: drop-shadow(0 0 8px var(--color-coral)); }
.aid-net__label { font-size: 12px; font-weight: 600; fill: rgba(255, 255, 255, 0.85); letter-spacing: 0.02em; }
.aid-net__pulse { fill: none; stroke: var(--color-coral); stroke-width: 2; transform-box: fill-box; transform-origin: center; animation: si-pulse 2.4s ease-out infinite; }
.aid-net__hub { transform-box: fill-box; transform-origin: center; animation: si-breathe 3.2s ease-in-out infinite; }
.aid-net__hub-core { fill: var(--color-white); }
.aid-net__hub-ring { fill: none; stroke: var(--color-sky); stroke-width: 1.5; stroke-dasharray: 4 6; }
.aid-net__hub-core + .aid-net__hub-ring { transform-box: fill-box; transform-origin: center; animation: si-spin 18s linear infinite reverse; }

/* ── Panel del formulario ── */
.si-panel {
  display: flex; flex-direction: column; justify-content: space-between;
  padding: var(--space-4) clamp(24px, 5vw, 72px);
  background: var(--color-white);
}
.si-panel__top { display: flex; justify-content: space-between; align-items: center; min-height: 48px; }
.si-panel__brand-mobile { display: none; }
.si-form { width: 100%; max-width: 420px; margin: 0 auto; animation: si-rise 0.7s var(--si-ease) both; }
.si-form h1 { margin: 0 0 var(--space-1); font-size: 2rem; font-weight: var(--fw-bold); letter-spacing: -0.02em; color: var(--color-night); }
.si-form__subtitle { margin: 0 0 var(--space-5); color: var(--gray-300); }

.si-field { display: block; margin-bottom: var(--space-3); }
.si-field > span { display: block; margin-bottom: var(--space-1); font-size: 0.8125rem; font-weight: var(--fw-medium); color: var(--gray-500); }
.si-input {
  display: flex; align-items: center; gap: var(--space-2);
  min-height: var(--touch-min); padding: 0 var(--space-3);
  border: 1.5px solid var(--gray-50); border-radius: 12px;
  background: var(--royal-50);
  color: var(--gray-300);
  transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
}
.si-input:focus-within { border-color: var(--color-royal); background: var(--color-white); color: var(--color-royal); box-shadow: 0 0 0 4px rgba(71, 80, 221, 0.14); }
.si-input input { flex: 1; min-width: 0; height: 100%; min-height: calc(var(--touch-min) - 4px); border: 0; outline: 0; background: transparent; font: inherit; color: var(--color-gray-900); }
.si-input input::placeholder { color: var(--gray-200); }
.si-input__toggle { display: grid; place-items: center; width: 32px; height: 32px; margin-right: -8px; border: 0; border-radius: 8px; background: transparent; color: inherit; cursor: pointer; }
.si-input__toggle:hover { background: var(--royal-100); }
.si-input__toggle:focus-visible { outline: 2px solid var(--color-sky); }

.si-error {
  margin: 0 0 var(--space-3); padding: 12px var(--space-3);
  border-radius: 12px; border: 1px solid rgba(255, 77, 77, 0.35);
  background: rgba(255, 77, 77, 0.08); color: #c52f2f;
  font-size: 0.875rem; font-weight: var(--fw-medium);
  animation: si-shake 0.45s ease;
}

.si-submit {
  display: flex; align-items: center; justify-content: center; gap: var(--space-2);
  width: 100%; min-height: var(--touch-min);
  border: 0; border-radius: 12px;
  background: var(--gradient-brand); background-size: 160% 100%; background-position: 0% 0;
  color: var(--color-white); font: inherit; font-weight: var(--fw-bold); font-size: 1rem;
  cursor: pointer;
  box-shadow: 0 10px 24px -10px rgba(71, 80, 221, 0.75);
  transition: transform 0.2s var(--si-ease), box-shadow 0.2s, background-position 0.5s;
}
.si-submit:hover:not(:disabled) { transform: translateY(-1px); background-position: 100% 0; box-shadow: 0 14px 28px -10px rgba(71, 80, 221, 0.85); }
.si-submit:active:not(:disabled) { transform: translateY(0); }
.si-submit:disabled { opacity: 0.75; cursor: progress; }
.si-submit:focus-visible { outline: 3px solid var(--color-sky); outline-offset: 3px; }
.si-spinner { width: 18px; height: 18px; border: 2.5px solid rgba(255, 255, 255, 0.4); border-top-color: #fff; border-radius: 50%; animation: si-spin 0.7s linear infinite; }

.si-hint { display: flex; align-items: center; justify-content: center; gap: 6px; margin: var(--space-3) 0 0; font-size: 0.75rem; color: var(--gray-300); text-align: center; }
.si-panel__footer { text-align: center; font-size: 0.75rem; color: var(--gray-200); padding-top: var(--space-3); }

/* ── Selector de idioma (pill) ── */
.lang-pill { display: inline-flex; align-items: center; gap: 2px; margin-left: auto; padding: 4px 6px 4px 12px; border: 1.5px solid var(--gray-50); border-radius: 999px; color: var(--gray-300); background: var(--color-white); }
.lang-pill__btn { min-width: 36px; min-height: 32px; padding: 0 10px; border: 0; border-radius: 999px; background: transparent; color: inherit; font: inherit; font-size: 0.8125rem; font-weight: var(--fw-bold); cursor: pointer; transition: background 0.2s, color 0.2s; }
.lang-pill__btn:hover { background: var(--royal-50); }
.lang-pill__btn[aria-pressed='true'] { background: var(--color-night); color: var(--color-white); }
.lang-pill__btn:focus-visible { outline: 2px solid var(--color-sky); outline-offset: 1px; }

/* ── Keyframes ── */
@keyframes si-spin { to { transform: rotate(360deg); } }
@keyframes si-dash { to { stroke-dashoffset: -24; } }
@keyframes si-float { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(30px, -24px); } }
@keyframes si-pop { from { opacity: 0; transform: scale(0.4); } to { opacity: 1; transform: scale(1); } }
@keyframes si-pulse { 0% { opacity: 0.9; transform: scale(1); } 100% { opacity: 0; transform: scale(3.2); } }
@keyframes si-breathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.07); } }
@keyframes si-rise { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
@keyframes si-shake { 0%, 100% { transform: translateX(0); } 20% { transform: translateX(-6px); } 40% { transform: translateX(6px); } 60% { transform: translateX(-4px); } 80% { transform: translateX(4px); } }

/* ── Responsive ── */
@media (max-width: 960px) {
  .si { grid-template-columns: 1fr; }
  .si-hero { display: none; }
  .si-panel { min-height: 100vh; }
  .si-panel__brand-mobile { display: block; }
}

@media (prefers-reduced-motion: reduce) {
  .si *, .si *::before, .si *::after { animation: none !important; transition: none !important; }
}
`);

/* ───────────── Layout de autenticación ───────────── */
write('src/app/layouts/auth/authLayout.jsx', String.raw`
import { Outlet } from 'react-router-dom';

export default function AuthLayout() {
  return <Outlet />;
}
`);

/* ───────────── Repositorio: bloqueo de cuenta ───────────── */
write('src/boundedContexts/identityAccess/infrastructure/http/authHttpRepository.js', String.raw`
import { AuthRepository } from '../../domain/repositories/authRepository.js';
import { httpClient } from '@shared/infrastructure/http/httpClient.js';
import { toAuthSession } from '../mappers/authMapper.js';

export class AuthHttpRepository extends AuthRepository {
  async signIn({ email, password }) {
    try {
      const { data } = await httpClient.post('/auth/sign-in', { email, password });
      return toAuthSession(data);
    } catch (error) {
      const status = error.response?.status;
      // El backend responde 401 con el mismo mensaje ante cualquier fallo (no revela la causa).
      if (status === 423 || status === 429) throw new Error('accountLocked');
      if (status === 400 || status === 401 || status === 403) throw new Error('invalidCredentials');
      throw new Error('networkError');
    }
  }
}
`);

/* ───────────── Textos i18n ───────────── */
const es = {
  signIn: {
    title: 'Bienvenido de vuelta',
    subtitle: 'Ingresa al Centro de Mando AuxIA',
    email: 'Correo institucional',
    emailPlaceholder: 'nombre@institucion.gob.pe',
    password: 'Contraseña',
    showPassword: 'Mostrar contraseña',
    hidePassword: 'Ocultar contraseña',
    submit: 'Ingresar',
    loading: 'Verificando...',
    lockHint: 'Tras 5 intentos fallidos seguidos, la cuenta se bloquea.',
    errors: {
      credentialsRequired: 'Ingresa tu correo y contraseña.',
      invalidCredentials: 'Correo o contraseña incorrectos.',
      accountLocked: 'Cuenta bloqueada por intentos fallidos. Contacta a tu administrador.',
      networkError: 'No se pudo conectar con el servidor. Inténtalo nuevamente.',
    },
  },
  hero: {
    eyebrow: 'Centro de Mando',
    title: 'Ayuda humanitaria, priorizada y trazable.',
    subtitle: 'Decide dónde ayudar primero, coordina la distribución y verifica cada entrega en blockchain.',
    pills: { priority: 'Priorización', distribution: 'Distribución', traceability: 'Trazabilidad' },
  },
  footer: '© Waqta Labs · AuxIA',
};
const en = {
  signIn: {
    title: 'Welcome back',
    subtitle: 'Sign in to the AuxIA Command Center',
    email: 'Institutional email',
    emailPlaceholder: 'name@institution.gov',
    password: 'Password',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
    submit: 'Sign in',
    loading: 'Verifying...',
    lockHint: 'After 5 failed attempts in a row, the account is locked.',
    errors: {
      credentialsRequired: 'Enter your email and password.',
      invalidCredentials: 'Incorrect email or password.',
      accountLocked: 'Account locked after too many failed attempts. Contact your administrator.',
      networkError: 'Could not reach the server. Please try again.',
    },
  },
  hero: {
    eyebrow: 'Command Center',
    title: 'Humanitarian aid, prioritized and traceable.',
    subtitle: 'Decide where to help first, coordinate distribution and verify every delivery on the blockchain.',
    pills: { priority: 'Prioritization', distribution: 'Distribution', traceability: 'Traceability' },
  },
  footer: '© Waqta Labs · AuxIA',
};
write('src/boundedContexts/identityAccess/presentation/i18n/es.json', JSON.stringify(es, null, 2) + '\n');
write('src/boundedContexts/identityAccess/presentation/i18n/en.json', JSON.stringify(en, null, 2) + '\n');

/* La clave "language" (aria-label del selector) vive en common.json */
for (const [lng, label] of [['es', 'Idioma'], ['en', 'Language']]) {
  const p = 'src/i18n/locales/' + lng + '/common.json';
  if (existsSync(p)) {
    const json = JSON.parse(readFileSync(p, 'utf8'));
    if (!json.language) {
      json.language = label;
      writeFileSync(p, JSON.stringify(json, null, 2) + '\n');
      console.log('~ ' + p);
    }
  }
}

console.log('\nListo. Reinicia "npm run dev" si estaba corriendo.');
