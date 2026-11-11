import { PlanStatus } from '../enums/planStatus.js';

// Plan de distribución de una zona: qué recursos se le entregan y qué brigada los lleva.
export class DistributionPlan {
  constructor({
    id, zoneId = null, status, coverage = null, justification = null,
    items = [], brigade = null, createdAt = null,
  }) {
    this.id = id;
    this.zoneId = zoneId;
    this.status = status;
    this.coverage = coverage;           // número (0–1 o 0–100) o texto (FULL, PARTIAL, NONE), según venga del backend
    this.justification = justification; // explicación de la IA
    this.items = items;                 // [{ resourceId, name, unit, recommended, quantity }]
    this.brigade = brigade;             // { id, name } | null
    this.createdAt = createdAt;         // epoch ms | null
    Object.freeze(this);
  }

  get isProposed() { return this.status === PlanStatus.PROPOSED; }
  get isApproved() { return this.status === PlanStatus.APPROVED; }
  get hasBrigade() { return this.brigade !== null; }
  // Aprobado pero sin brigada: faltó una brigada libre con líder al aprobar.
  get needsBrigade() { return this.isApproved && !this.hasBrigade; }
}
