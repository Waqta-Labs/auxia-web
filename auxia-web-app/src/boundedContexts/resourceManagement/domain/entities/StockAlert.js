// Alerta de stock bajo: OPEN mientras el recurso siga bajo su mínimo; RESOLVED cuando se repone.
export class StockAlert {
  constructor({ id, resourceId, resourceName = null, status, available = null, minimumStock = null, raisedAt = null, resolvedAt = null }) {
    this.id = id;
    this.resourceId = resourceId;
    this.resourceName = resourceName;
    this.status = status;
    this.available = available;
    this.minimumStock = minimumStock;
    this.raisedAt = raisedAt;       // epoch ms
    this.resolvedAt = resolvedAt;   // epoch ms
    Object.freeze(this);
  }

  get isOpen() {
    return this.status === 'OPEN';
  }
}
