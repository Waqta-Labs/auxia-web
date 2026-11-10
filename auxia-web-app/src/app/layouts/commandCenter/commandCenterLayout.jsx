import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@bc/identityAccess/presentation/hooks/useAuth.js';
import LanguageSwitcher from '@shared/presentation/components/languageSwitcher.jsx';
import { routes, routeRoles } from '@app/router/routes.js';

const navItems = [
  { to: routes.dashboard, key: 'dashboard', end: true },
  { to: routes.gisMap, key: 'gisMap', roles: routeRoles.gisMap },
  { to: routes.prioritization, key: 'prioritization', roles: routeRoles.prioritization },
  { to: routes.inventory, key: 'inventory', roles: routeRoles.inventory },
  { to: routes.logistics, key: 'logistics', roles: routeRoles.logistics },
  { to: routes.audit, key: 'audit', roles: routeRoles.audit },
];

export default function CommandCenterLayout() {
  const { t } = useTranslation();
  const { session, signOut } = useAuth();
  const visibleItems = navItems.filter((item) => !item.roles || item.roles.includes(session.role));

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar__brand">{t('appName')}</div>
        <nav>
          {visibleItems.map((item) => (
            <NavLink key={item.key} to={item.to} end={item.end}>
              {t('nav.' + item.key)}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar__footer">
          <span>{session.role}</span>
          <LanguageSwitcher />
          <button type="button" className="btn btn--ghost" onClick={signOut}>
            {t('actions.signOut')}
          </button>
        </div>
      </aside>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
