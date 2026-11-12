// Perfil / ajustes del usuario (/profile): datos de la cuenta (GET /users/me), preferencias (idioma, zona horaria) y cerrar sesión.
// Se abre desde el usuario de la barra lateral. Requiere haber corrido buildSelectMenu.mjs.
// Uso (raíz del proyecto): node buildProfile.mjs   (se puede repetir)
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

const IA = 'src/boundedContexts/identityAccess/';
if (!existsSync(IA + 'infrastructure/container.js')) throw new Error('Estate en la raíz del proyecto (donde está package.json).');
if (!existsSync('src/shared/presentation/components/selectMenu.jsx')) throw new Error('Primero corre buildSelectMenu.mjs (menú desplegable) y luego este script.');

const readLf = (path) => { const raw = readFileSync(path, 'utf8'); return { text: raw.replace(/\r\n/g, '\n'), crlf: raw.includes('\r\n') }; };
const writeLf = (path, text, crlf) => writeFileSync(path, crlf ? text.replace(/\n/g, '\r\n') : text);
const write = (path, content) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, content.replace(/^\n/, '')); console.log('+ ' + path); };
const patch = (path, pairs) => {
  let { text, crlf } = readLf(path);
  for (const [from, to] of pairs) {
    if (text.includes(to)) continue;
    if (!text.includes(from)) throw new Error('No encontré el fragmento esperado en ' + path + ':\n' + from);
    text = text.replace(from, () => to);
  }
  writeLf(path, text, crlf);
  console.log('~ ' + path);
};
const appendOnce = (path, marker, text) => {
  const { text: current, crlf } = readLf(path);
  if (current.includes(marker)) return;
  writeLf(path, current.replace(/\s*$/, '\n') + '\n' + marker + '\n' + text, crlf);
  console.log('~ ' + path);
};
const deepMerge = (a, b) => { const out = { ...a }; for (const [k, v] of Object.entries(b)) out[k] = v && typeof v === 'object' && !Array.isArray(v) ? deepMerge(a?.[k] ?? {}, v) : v; return out; };
const mergeJson = (path, object) => { writeFileSync(path, JSON.stringify(deepMerge(JSON.parse(readFileSync(path, 'utf8')), object), null, 2) + '\n'); console.log('~ ' + path); };

/* ── Dominio / infraestructura: GET /users/me (el backend no tiene endpoint para editar el perfil) ── */
write(IA + 'domain/repositories/userRepository.js', String.raw`
// Contrato. Backend: GET /api/v1/users/me  y  GET /api/v1/me/missions (solo FIELD_BRIGADE)
export class UserRepository {
  // -> { name, email, status, lastLoginAt } (cualquiera puede ser null)
  async getMe() { throw new Error('No implementado'); }
  // -> { name, assigned, completed } de la brigada de la cuenta
  async getMyBrigade() { throw new Error('No implementado'); }
}
`);
write(IA + 'infrastructure/http/userHttpRepository.js', String.raw`
import { UserRepository } from '../../domain/repositories/userRepository.js';
import { httpClient } from '@shared/infrastructure/http/httpClient.js';
import { parseUtc } from '@shared/utils/formatters.js';

export class UserHttpRepository extends UserRepository {
  // GET /users/me -> { id, organizationId, email, firstName, lastName, role, status, lastLoginAt }
  async getMe() {
    const { data } = await httpClient.get('/users/me');
    return {
      name: [data.firstName, data.lastName].filter(Boolean).join(' ') || null,
      email: data.email ?? null,
      status: data.status ?? null,
      lastLoginAt: parseUtc(data.lastLoginAt),
    };
  }

  // GET /me/missions -> { brigadeId, brigadeName, missions: [{ status: ASSIGNED | COMPLETED, ... }] }
  async getMyBrigade() {
    const { data } = await httpClient.get('/me/missions');
    const missions = data.missions ?? [];
    return {
      name: data.brigadeName ?? null,
      assigned: missions.filter((mission) => mission.status === 'ASSIGNED').length,
      completed: missions.filter((mission) => mission.status === 'COMPLETED').length,
    };
  }
}
`);
appendOnce(IA + 'infrastructure/container.js', '// user-profile', "import { UserHttpRepository } from './http/userHttpRepository.js';\n\nexport const userRepository = new UserHttpRepository();\n");

write(IA + 'presentation/hooks/useUserProfile.js', String.raw`
import { useQuery } from '@tanstack/react-query';
import { env } from '@shared/infrastructure/config/env.js';
import { Role } from '../../domain/enums/role.js';
import { userRepository } from '../../infrastructure/container.js';
import { useAuth } from './useAuth.js';

// Datos del usuario: lo que dice la sesión, completado con GET /users/me cuando se usa el backend real.
export function useUserProfile() {
  const { session } = useAuth();
  const query = useQuery({
    queryKey: ['userProfile', session.token],
    queryFn: () => userRepository.getMe(),
    enabled: !env.useMocks,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
  // Solo la cuenta de una brigada de campo tiene brigada y misiones.
  const brigadeQuery = useQuery({
    queryKey: ['myBrigade', session.token],
    queryFn: () => userRepository.getMyBrigade(),
    enabled: !env.useMocks && session.role === Role.FIELD_BRIGADE,
    retry: false,
    staleTime: 60 * 1000,
  });
  const remote = query.data ?? {};
  return {
    name: remote.name ?? session.displayName ?? null,
    email: remote.email ?? null,
    status: remote.status ?? null,
    lastLoginAt: remote.lastLoginAt ?? null,
    role: session.role,
    expiresAt: session.expiresAt,
    brigade: brigadeQuery.data ?? null,
    isLoading: query.isLoading,
  };
}
`);

/* ── Pantalla ── */
write(IA + 'presentation/pages/profilePage.jsx', String.raw`
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
`);

write(IA + 'presentation/styles/profile.css', String.raw`
.pf { display: grid; align-content: start; gap: var(--space-3); }
.pf-head h1 { margin: 0 0 4px; font-size: 1.75rem; font-weight: 700; letter-spacing: -0.02em; }
.pf-head p { margin: 0; color: var(--night-100); }

.pf-card { border: 1px solid var(--cc-line); border-radius: 16px; background: var(--cc-card); }
.pf-hero { overflow: hidden; }
.pf-banner { height: 112px; background: radial-gradient(520px 170px at 88% 0%, rgba(133, 213, 246, 0.42), transparent 70%), radial-gradient(460px 190px at 6% 130%, rgba(188, 251, 137, 0.2), transparent 70%), linear-gradient(110deg, #3138b8, var(--color-royal) 45%, #2b3196); }
.pf-who { display: flex; align-items: flex-start; gap: 22px; padding: 0 28px 26px; }
.pf-avatar { display: grid; place-items: center; flex: none; width: 92px; height: 92px; margin-top: -46px; border: 4px solid var(--cc-card); border-radius: 50%; background: linear-gradient(135deg, var(--color-royal), #7a83f5); box-shadow: 0 10px 26px rgba(0, 0, 0, 0.35); font-size: 1.875rem; font-weight: 700; }
.pf-who > div { min-width: 0; padding-top: 16px; }
.pf-who h2 { margin: 0 0 10px; font-size: 1.5rem; font-weight: 700; letter-spacing: -0.01em; }
.pf-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font-size: 0.8125rem; }
.pf-role, .pf-status, .pf-mail { display: inline-flex; align-items: center; gap: 6px; min-height: 26px; padding: 0 12px; border-radius: 999px; font-weight: 600; }
.pf-role { background: rgba(188, 251, 137, 0.16); color: var(--color-lime); font-weight: 700; }
.pf-status { background: rgba(255, 255, 255, 0.08); color: var(--night-50, #d4d6ee); }
.pf-status::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: var(--color-coral); }
.pf-status.is-active::before { background: var(--color-emerald); }
.pf-mail { background: rgba(255, 255, 255, 0.08); color: var(--night-50, #d4d6ee); font-weight: 500; }
.pf-mail svg { color: var(--color-sky); }

.pf-grid { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(280px, 1fr); gap: var(--space-3); align-items: start; }
.pf-stack { display: grid; gap: var(--space-3); min-width: 0; }
.pf-grid .pf-card:not(.pf-hero) { padding: 24px; }
.pf-h2 { margin: 0 0 18px; font-size: 1.125rem; font-weight: 700; }
.pf-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.pf-fields--one { grid-template-columns: minmax(0, 1fr); }
.pf-field { display: grid; align-content: start; gap: 6px; min-width: 0; }
.pf-label { font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--color-sky); }
.pf-value { display: flex; align-items: center; min-height: 44px; margin: 0; padding: 0 14px; border-radius: 10px; background: var(--cc-card-inner); overflow-wrap: anywhere; }
.pf-note { margin: 16px 0 0; font-size: 0.8125rem; color: var(--night-100); }
.pf-signout { margin-top: 22px; width: 100%; min-height: 44px; border: 1.5px solid rgba(255, 255, 255, 0.85); border-radius: 10px; background: transparent; color: #fff; font: inherit; font-weight: 700; cursor: pointer; transition: background 0.2s; }
.pf-signout:hover { background: rgba(255, 255, 255, 0.08); }
.pf-signout:focus-visible { outline: 2px solid var(--color-sky); outline-offset: 2px; }

@media (max-width: 900px) {
  .pf-grid { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 560px) {
  .pf-fields { grid-template-columns: minmax(0, 1fr); }
  .pf-who { flex-direction: column; align-items: flex-start; }
}
`);

mergeJson(IA + 'presentation/i18n/es.json', { profile: {
  title: 'Mi perfil', subtitle: 'Tu cuenta y tus preferencias',
  account: 'Datos de la cuenta', fullName: 'Nombre completo', email: 'Correo electrónico', role: 'Rol', organization: 'Organización',
  status: 'Estado', statuses: { ACTIVE: 'Activo', LOCKED: 'Bloqueado', DISABLED: 'Deshabilitado' },
  managedNote: 'Estos datos los administra tu organización; para cambiarlos, habla con el administrador.',
  brigade: 'Mi brigada', brigadeName: 'Brigada', missions: 'Misiones', missionsValue: '{{assigned}} asignadas · {{completed}} completadas',
  preferences: 'Preferencias', language: 'Idioma', timeZone: 'Zona horaria', lastLogin: 'Último acceso', sessionExpires: 'La sesión vence', signOut: 'Cerrar sesión',
} });
mergeJson(IA + 'presentation/i18n/en.json', { profile: {
  title: 'My profile', subtitle: 'Your account and preferences',
  account: 'Account details', fullName: 'Full name', email: 'Email', role: 'Role', organization: 'Organization',
  status: 'Status', statuses: { ACTIVE: 'Active', LOCKED: 'Locked', DISABLED: 'Disabled' },
  managedNote: 'Your organization manages these details; to change them, talk to the administrator.',
  brigade: 'My brigade', brigadeName: 'Brigade', missions: 'Missions', missionsValue: '{{assigned}} assigned · {{completed}} completed',
  preferences: 'Preferences', language: 'Language', timeZone: 'Time zone', lastLogin: 'Last sign-in', sessionExpires: 'Session expires', signOut: 'Sign out',
} });

/* ── La caché de datos se vacía al entrar y al salir: así el perfil (y todo lo demás) nunca es el de la sesión anterior ── */
patch(IA + 'presentation/context/authContext.jsx', [
  ["import { createContext, useCallback, useEffect, useMemo, useState } from 'react';\n", "import { createContext, useCallback, useEffect, useMemo, useState } from 'react';\nimport { useQueryClient } from '@tanstack/react-query';\n"],
  ["  const [session, setSession] = useState(() => tokenStorage.load());\n", "  const queryClient = useQueryClient();\n  const [session, setSession] = useState(() => tokenStorage.load());\n"],
  ["    tokenStorage.save(newSession);\n    setSession(newSession);\n    return newSession;\n  }, []);", "    queryClient.clear();\n    tokenStorage.save(newSession);\n    setSession(newSession);\n    return newSession;\n  }, [queryClient]);"],
  ["    tokenStorage.clear();\n    setSession(null);\n  }, []);", "    queryClient.clear();\n    tokenStorage.clear();\n    setSession(null);\n  }, [queryClient]);"],
]);

/* ── Ruta y acceso desde la barra lateral ── */
patch('src/app/router/routes.js', [["  dashboard: '/',\n", "  dashboard: '/',\n  profile: '/profile',\n"]]);
patch('src/app/router/index.jsx', [[
  "            ...page(() => import('@app/pages/dashboard/dashboardPage.jsx')),\n          },\n",
  "            ...page(() => import('@app/pages/dashboard/dashboardPage.jsx')),\n          },\n          {\n            path: routes.profile,\n            ...page(() => import('@bc/identityAccess/presentation/pages/profilePage.jsx')),\n          },\n",
]]);
patch('src/app/layouts/commandCenter/sidebar.jsx', [[
  `        <span className="cc-user__avatar" aria-hidden="true">{initials(userName)}</span>
        <div className="cc-user__info">
          <strong>{userName}</strong>
          <span>{session.organizationName ?? t('roles.' + session.role)}</span>
        </div>
`,
  `        <NavLink to={routes.profile} className="cc-user__link" aria-label={t('sidebar.profile')} title={t('sidebar.profile')}>
          <span className="cc-user__avatar" aria-hidden="true">{initials(userName)}</span>
          <div className="cc-user__info">
            <strong>{userName}</strong>
            <span>{session.organizationName ?? t('roles.' + session.role)}</span>
          </div>
        </NavLink>
`,
]]);
appendOnce('src/app/layouts/commandCenter/commandCenter.css', '/* user-profile-link */', ".cc-user__link { display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0; padding: 4px; margin: -4px; border-radius: 10px; color: #fff; text-decoration: none; }\n.cc-user__link:hover { background: rgba(255, 255, 255, 0.05); }\n.cc-user__link.active { box-shadow: inset 0 0 0 1.5px var(--color-royal); }\n.cc-user__link:focus-visible { outline: 2px solid var(--color-sky); outline-offset: 2px; }\n");
// ".cc a" pinta de celeste todos los enlaces; el usuario de la barra debe seguir en blanco (mayor especificidad).
appendOnce('src/app/layouts/commandCenter/commandCenter.css', '/* user-profile-link-2 */', '.cc .cc-user__link { color: #fff; }\n.cc .cc-user__link:hover { color: #fff; }\n');
mergeJson('src/i18n/locales/es/common.json', { sidebar: { profile: 'Mi perfil' } });
mergeJson('src/i18n/locales/en/common.json', { sidebar: { profile: 'My profile' } });

console.log('\nListo. Reinicia "npm run dev" y haz clic en tu usuario (abajo en la barra lateral).');
