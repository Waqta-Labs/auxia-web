import { humanize } from '@shared/utils/formatters.js';

// Cobertura: el backend puede mandar un número (0–1 o 0–100) o una etiqueta (FULL, PARTIAL, NONE).
export function coverageLabel(t, coverage) {
  if (coverage === null || coverage === undefined || coverage === '') return null;
  if (typeof coverage === 'number') return Math.round(coverage <= 1 ? coverage * 100 : coverage) + '%';
  return t('plan.coverage.' + String(coverage).toUpperCase(), { defaultValue: humanize(coverage) });
}

export const statusLabel = (t, status) => t('plan.status.' + status, { defaultValue: humanize(status) });

// El backend responde application/problem+json: se muestra su "detail" tal cual; si no hay, un texto según el caso.
export function planErrorMessage(t, error) {
  if (!error) return null;
  if (error.message === 'reasonRequired') return t('plan.reject.reasonRequired');
  if (error.detail) return error.detail;
  if (error.status === 403) return t('plan.errors.forbidden');
  return t('plan.errors.generic');
}
