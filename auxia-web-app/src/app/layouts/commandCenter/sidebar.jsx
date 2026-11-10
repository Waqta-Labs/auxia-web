import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@bc/identityAccess/presentation/hooks/useAuth.js';
import { useActiveEmergency } from '@bc/emergencyManagement/presentation/hooks/useActiveEmergency.js';
import { routes, routeRoles } from '@app/router/routes.js';
import logo from '@assets/logos/12.svg';

const navItems = [
  { to: routes.dashboard, key: 'dashboard', end: true },
  { to: routes.gisMap, key: 'gisMap', roles: routeRoles.gisMap },
  { to: routes.prioritization, key: 'prioritization', roles: routeRoles.prioritization },
  { to: routes.inventory, key: 'inventory', roles: routeRoles.inventory },
  { to: routes.logistics, key: 'logistics', roles: routeRoles.logistics },
  { to: routes.audit, key: 'audit', roles: routeRoles.audit },
];

const icons = {
  dashboard: (<><rect x="3" y="3" width="7" height="9" rx="2" /><rect x="14" y="3" width="7" height="5" rx="2" /><rect x="14" y="12" width="7" height="9" rx="2" /><rect x="3" y="16" width="7" height="5" rx="2" /></>),
  gisMap: (<><path d="M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z" /><circle cx="12" cy="9" r="2.5" /></>),
  prioritization: (<path d="M5 20V11M12 20V4M19 20v-6" />),
  inventory: (<><path d="M3 7l9-4 9 4-9 4-9-4z" /><path d="M3 7v10l9 4 9-4V7M12 11v10" /></>),
  logistics: (<><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><circle cx="17.5" cy="9.5" r="2.4" /><path d="M17 14.2c2.5.2 4.5 2.2 4.5 4.8" /></>),
  audit: (<><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>),
};

const initials = (name) =>
  (name ?? '?').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

export default function Sidebar() {
  const { t } = useTranslation();
  const { session, signOut } = useAuth();
  const emergency = useActiveEmergency();
  const visibleItems = navItems.filter((item) => !item.roles || item.roles.includes(session.role));
  const userName = session.displayName ?? t('roles.' + session.role);

  return (
    <aside className="cc-side">
      <div className="cc-side__logo">
        <img src={logo} alt={t('appName')} />
      </div>

      <div className="cc-crisis">
        <span className="cc-crisis__label">{t('sidebar.activeCrisis')}</span>
        {emergency.isPending ? (
          <span className="skeleton" style={{ height: 18, width: '80%' }} />
        ) : emergency.data ? (
          <>
            <strong className="cc-crisis__name">{emergency.data.name}</strong>
            <span className="cc-live">{t('sidebar.live')}</span>
          </>
        ) : (
          <strong className="cc-crisis__name">{t('sidebar.noCrisis')}</strong>
        )}
      </div>

      <nav className="cc-nav" aria-label={t('sidebar.navLabel')}>
        {visibleItems.map((item) => (
          <NavLink key={item.key} to={item.to} end={item.end}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
              strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {icons[item.key]}
            </svg>
            {t('nav.' + item.key)}
          </NavLink>
        ))}
      </nav>

      <div className="cc-user">
        <span className="cc-user__avatar" aria-hidden="true">{initials(userName)}</span>
        <div className="cc-user__info">
          <strong>{userName}</strong>
          <span>{session.organizationName ?? t('roles.' + session.role)}</span>
        </div>
        <button type="button" className="cc-user__out" onClick={signOut} aria-label={t('actions.signOut')} title={t('actions.signOut')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3M16 8l4 4-4 4M20 12H9" />
          </svg>
        </button>
      </div>
    </aside>
  );
}
