// Por qué una zona tiene su Urgency Score (GET /zones/{id}/score).
export class ScoreExplanation {
  constructor({ available, score = null, features = [], modelVersion = null, missingVariables = [] }) {
    this.available = available;                 // false: la zona no tiene variables suficientes
    this.score = score;
    this.features = features;                   // [{ key, contribution }] las que más puntos sumaron
    this.modelVersion = modelVersion;
    this.missingVariables = missingVariables;   // qué falta registrar para poder calcularlo
    Object.freeze(this);
  }

  get maxContribution() {
    return this.features.reduce((max, f) => Math.max(max, Math.abs(f.contribution ?? 0)), 0);
  }
}
