import { EXPLORER_TX_URL } from './Delivery.js';

// Una entrega con sus recursos, evidencias (por hash) y estado del anclaje (GET /deliveries/{id}).
// items = [{ name, planned, quantity, unit }] · evidences = [{ hash, type }]
export class DeliveryDetail {
  constructor({
    id, zoneId, zoneName = null, status, deliveredAt = null, openedAt = null,
    recordHash = null, transactionHash = null, anchoredAt = null, items = [], evidences = [],
  }) {
    this.id = id;
    this.zoneId = zoneId;
    this.zoneName = zoneName;
    this.status = status;
    this.deliveredAt = deliveredAt;       // epoch ms
    this.openedAt = openedAt;             // epoch ms; cuándo se abrió la misión, si el backend lo informa
    this.recordHash = recordHash;         // SHA-256 del registro canónico de la entrega
    this.transactionHash = transactionHash;
    this.anchoredAt = anchoredAt;         // epoch ms
    this.items = items;
    this.evidences = evidences;
    Object.freeze(this);
  }

  get explorerUrl() {
    return this.transactionHash ? EXPLORER_TX_URL + this.transactionHash : null;
  }
}
