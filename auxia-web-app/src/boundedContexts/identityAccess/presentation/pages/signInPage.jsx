import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth.js';
import { routes } from '@app/router/routes.js';

export default function SignInPage() {
  const { t } = useTranslation('identityAccess');
  const { isAuthenticated, signIn } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

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
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="card" onSubmit={handleSubmit} noValidate>
      <h1>{t('signIn.title')}</h1>
      <p className="muted">{t('signIn.subtitle')}</p>
      <div className="field">
        <label htmlFor="email">{t('signIn.email')}</label>
        <input id="email" type="email" autoComplete="username" value={email}
          onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="password">{t('signIn.password')}</label>
        <input id="password" type="password" autoComplete="current-password" value={password}
          onChange={(e) => setPassword(e.target.value)} />
      </div>
      {error && <p className="error" role="alert">{t('signIn.errors.' + error)}</p>}
      <button className="btn" type="submit" disabled={loading}>
        {loading ? t('signIn.loading') : t('signIn.submit')}
      </button>
    </form>
  );
}
