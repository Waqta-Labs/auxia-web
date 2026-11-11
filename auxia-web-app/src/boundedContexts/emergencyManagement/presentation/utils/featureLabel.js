import { humanize } from '@shared/utils/formatters.js';

// Nombre legible de una variable del modelo. Si no hay traducción, se muestra la variable tal cual
// viene del servicio de IA ("damageLevel" -> "Damage level").
export const featureLabel = (t, key) => t('features.' + key, { defaultValue: humanize(key) });

export const formatContribution = (value) =>
  typeof value === 'number' ? (value >= 0 ? '+' : '') + value.toFixed(1) : '—';
