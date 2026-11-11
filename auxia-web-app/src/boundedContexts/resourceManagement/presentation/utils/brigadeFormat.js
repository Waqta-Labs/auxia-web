import { humanize } from '@shared/utils/formatters.js';

export const statusLabel = (t, status) => t('brigades.status.' + status, { defaultValue: humanize(status) });
export const roleLabel = (t, role) => t('brigades.roles.' + role, { defaultValue: humanize(role) });

// "M. Quispe" -> "MQ"; "Brigada Alfa" -> "AL"
export function initials(name) {
  const words = String(name ?? '').replace(/^Brigada\s+/i, '').split(/\s+/).filter(Boolean);
  const value = words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? '').slice(0, 2);
  return value.toUpperCase() || '—';
}

const VALIDATION = ['nameRequired', 'locationInvalid', 'memberNameRequired', 'roleInvalid', 'statusInvalid'];

// El backend responde application/problem+json: se muestra su "detail" tal cual; si no hay, un texto según el caso.
export function brigadeErrorMessage(t, error) {
  if (!error) return null;
  if (VALIDATION.includes(error.message)) return t('brigades.errors.' + error.message);
  if (error.detail) return error.detail;
  if (error.status === 403) return t('brigades.errors.forbidden');
  return t('brigades.errors.generic');
}
