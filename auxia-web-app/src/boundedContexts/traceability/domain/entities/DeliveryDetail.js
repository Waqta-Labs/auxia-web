import { EXPLORER_TX_URL } from './Delivery.js';

// Una entrega con sus recursos, evidencias (por hash) y estado del anclaje (GET /deliveries/{id}).
// items = [{ resourceId, name, quantity }] · evidences = [{ id, type, hash, capturedAt, location: { latitude, longitude } | null }]
export class DeliveryDetail {
  constructor({
    id, zoneId, planId = null, status, deliveredAt = null, receivedAt = null,
    recordHash = null, transactionHash = null, anchoredAt = null, attempts = null, items = [], evidences = [],
  }) {
    this.id = id;
    this.zoneId = zoneId;
    this.planId = planId;
    this.status = status;
    this.deliveredAt = deliveredAt;       // epoch ms: cuándo la brigada entregó
    this.receivedAt = receivedAt;         // epoch ms: cuándo el sistema la registró y calculó el hash
    this.recordHash = recordHash;         // SHA-256 del registro canónico de la entrega
    this.transactionHash = transactionHash;
    this.anchoredAt = anchoredAt;         // epoch ms
    this.attempts = attempts;             // intentos de anclaje
    this.items = items;
    this.evidences = evidences;
    Object.freeze(this);
  }

  get explorerUrl() {
    return this.transactionHash ? EXPLORER_TX_URL + this.transactionHash : null;
  }

  // Ubicación GPS de la entrega: la de la primera evidencia que la trae.
  get location() {
    return this.evidences.find((evidence) => evidence.location)?.location ?? null;
  }
}
