import { EXPLORER_TX_URL } from './Delivery.js';

// Resultado de GET /deliveries/{id}/verify: ¿el hash recalculado hoy coincide con el de la blockchain?
export class VerificationResult {
  constructor({ deliveryId, verified, recordHash = null, anchoredHash = null, transactionHash = null }) {
    this.deliveryId = deliveryId;
    this.verified = verified;
    this.recordHash = recordHash;           // recalculado ahora
    this.anchoredHash = anchoredHash;       // el que está en la blockchain
    this.transactionHash = transactionHash;
    Object.freeze(this);
  }

  get explorerUrl() {
    return this.transactionHash ? EXPLORER_TX_URL + this.transactionHash : null;
  }
}
