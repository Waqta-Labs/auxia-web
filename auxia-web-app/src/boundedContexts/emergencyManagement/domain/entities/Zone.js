// Umbrales del Urgency Score (0-100). El tablero marca "crítico" por encima de 85.
export const CRITICAL_SCORE = 85;
export const HIGH_SCORE = 60;
export const MODERATE_SCORE = 40;

export class Zone {
  constructor({
    id, emergencyId, name, latitude = null, longitude = null,
    urgencyScore = null, needs = [], reasons = [], manualPriority = false,
  }) {
    this.id = id;
    this.emergencyId = emergencyId;
    this.name = name;
    this.latitude = latitude;
    this.longitude = longitude;
    this.urgencyScore = urgencyScore; // null: la zona aún no tiene puntaje
    this.needs = needs;               // NeedCategory[]
    this.reasons = reasons;           // [{ key, value }] derivadas de topFeatures
    this.manualPriority = manualPriority;
    Object.freeze(this);
  }

  get isCritical() {
    return this.urgencyScore !== null && this.urgencyScore > CRITICAL_SCORE;
  }

  get hasPosition() {
    return this.latitude !== null && this.longitude !== null;
  }

  get level() {
    if (this.urgencyScore === null) return 'unscored';
    if (this.urgencyScore > CRITICAL_SCORE) return 'critical';
    if (this.urgencyScore >= HIGH_SCORE) return 'high';
    if (this.urgencyScore >= MODERATE_SCORE) return 'moderate';
    return 'low';
  }
}
