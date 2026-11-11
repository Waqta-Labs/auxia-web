export const EXPLORER_TX_URL = 'https://sepolia.etherscan.io/tx/';

export class Delivery {
  constructor({ id, zoneId, zoneName = null, status, transactionHash = null, deliveredAt = null }) {
    this.id = id;
    this.zoneId = zoneId;
    this.zoneName = zoneName;
    this.status = status;                   // INITIATED | REGISTERED | CERTIFIED | FAILED
    this.transactionHash = transactionHash; // null hasta que se envía el anclaje
    this.deliveredAt = deliveredAt;         // epoch ms; null mientras la brigada va en camino
    Object.freeze(this);
  }

  get explorerUrl() {
    return this.transactionHash ? EXPLORER_TX_URL + this.transactionHash : null;
  }

  withZoneName(zoneName) {
    return new Delivery({ ...this, zoneName });
  }
}
