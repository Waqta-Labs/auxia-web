import { useTranslation } from 'react-i18next';
import { formatDateTime, humanize } from '@shared/utils/formatters.js';
import SelectMenu from '@shared/presentation/components/selectMenu.jsx';
import { useAuth } from '../hooks/useAuth.js';
import { useUserProfile } from '../hooks/useUserProfile.js';
import '../styles/profile.css';

const initials = (name) => (name ?? '?').split(' ').filter(Boolean).slice(0, 2).map((word) => word[0].toUpperCase()).join('');
const timeZone = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return '—'; } };

function Field({ label, value }) {
  return (
    <div className="pf-field">
      <span className="pf-label">{label}</span>
      <p className="pf-value">{value || '—'}</p>
    </div>
  );
}

// Perfil y ajustes: datos de la cuenta (solo lectura: los administra la organización), preferencias y cerrar sesión.
export default function ProfilePage() {
  const { t, i18n } = useTranslation('identityAccess');
  const lng = i18n.resolvedLanguage;
  const { signOut } = useAuth();
  const profile = useUserProfile();
  const roleName = t('roles.' + profile.role, { ns: 'common', defaultValue: profile.role });
  const statusName = profile.status ? t('profile.statuses.' + profile.status, { defaultValue: humanize(profile.status.toLowerCase()) }) : null;
  const languages = [{ value: 'es', label: 'Español' }, { value: 'en', label: 'English' }];

  return (
    <div className="pf">
      <header className="pf-head">
        <h1>{t('profile.title')}</h1>
        <p>{t('profile.subtitle')}</p>
      </header>

      <section className="pf-card pf-hero" aria-label={t('profile.title')}>
        <div className="pf-banner" aria-hidden="true" />
        <div className="pf-who">
          <span className="pf-avatar" aria-hidden="true">{initials(profile.name)}</span>
          <div>
            <h2>{profile.name ?? roleName}</h2>
            <div className="pf-meta">
              <span className="pf-role">{roleName}</span>
              {statusName && <span className={'pf-status' + (profile.status === 'ACTIVE' ? ' is-active' : '')}>{statusName}</span>}
              {profile.email && (
                <span className="pf-mail">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="m4 7 8 6 8-6" /></svg>
                  {profile.email}
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="pf-grid">
        <div className="pf-stack">
          <section className="pf-card" aria-labelledby="pf-account">
            <h2 id="pf-account" className="pf-h2">{t('profile.account')}</h2>
            <div className="pf-fields">
              <Field label={t('profile.fullName')} value={profile.name} />
              <Field label={t('profile.email')} value={profile.email} />
              <Field label={t('profile.role')} value={roleName} />
              <Field label={t('profile.status')} value={statusName} />
            </div>
            <p className="pf-note">{t('profile.managedNote')}</p>
          </section>

          {profile.brigade && (
            <section className="pf-card" aria-labelledby="pf-brigade">
              <h2 id="pf-brigade" className="pf-h2">{t('profile.brigade')}</h2>
              <div className="pf-fields">
                <Field label={t('profile.brigadeName')} value={profile.brigade.name} />
                <Field label={t('profile.missions')} value={t('profile.missionsValue', { assigned: profile.brigade.assigned, completed: profile.brigade.completed })} />
              </div>
            </section>
          )}
        </div>

        <section className="pf-card" aria-labelledby="pf-prefs">
          <h2 id="pf-prefs" className="pf-h2">{t('profile.preferences')}</h2>
          <div className="pf-fields pf-fields--one">
            <div className="pf-field">
              <span className="pf-label">{t('profile.language')}</span>
              <SelectMenu label={t('profile.language')} value={lng} options={languages} onChange={(value) => i18n.changeLanguage(value)} />
            </div>
            <Field label={t('profile.timeZone')} value={timeZone()} />
            <Field label={t('profile.lastLogin')} value={profile.lastLoginAt ? formatDateTime(profile.lastLoginAt, lng) : null} />
            <Field label={t('profile.sessionExpires')} value={profile.expiresAt ? formatDateTime(profile.expiresAt, lng) : null} />
          </div>
          <button type="button" className="pf-signout" onClick={signOut}>{t('profile.signOut')}</button>
        </section>
      </div>
    </div>
  );
}
