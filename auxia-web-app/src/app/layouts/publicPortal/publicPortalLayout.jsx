import { Link, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '@shared/presentation/components/languageSwitcher.jsx';
import { routes } from '@app/router/routes.js';

export default function PublicPortalLayout() {
  const { t } = useTranslation();
  return (
    <>
      <header className="topbar">
        <Link to={routes.publicPortal} style={{ color: 'inherit', fontWeight: 700 }}>
          {t('appName')}
        </Link>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <LanguageSwitcher />
          <Link to={routes.signIn} style={{ color: 'inherit' }}>{t('actions.signIn')}</Link>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </>
  );
}
