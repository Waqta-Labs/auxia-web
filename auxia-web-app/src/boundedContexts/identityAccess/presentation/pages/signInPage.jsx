import { useRef, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth.js';
import { routes } from '@app/router/routes.js';
import LanguageSwitcher from '@shared/presentation/components/languageSwitcher.jsx';
import logoNight from '@assets/logos/14.svg';
import logoLight from '@assets/logos/4.svg';
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
          <img className="si-logo" src={logoNight} alt="AuxIA" />
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
          <div className="si-panel__brand-mobile"><img className="si-logo si-logo--mobile" src={logoLight} alt="AuxIA" /></div>
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
