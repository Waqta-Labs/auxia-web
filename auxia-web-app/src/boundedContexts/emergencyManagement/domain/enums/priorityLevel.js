export const PriorityLevel = Object.freeze({
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
});

const LEVELS = { CRITICAL: 'critical', HIGH: 'high', MEDIUM: 'moderate', LOW: 'low' };

// Clave visual del nivel (la usan los estilos): critical | high | moderate | low | unscored.
export const levelOf = (priorityLevel) => LEVELS[priorityLevel] ?? 'unscored';
