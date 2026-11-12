// Nivel de existencias: CRITICAL (casi agotado), LOW (bajo el mínimo) u OK.
export const StockLevel = Object.freeze({ CRITICAL: 'CRITICAL', LOW: 'LOW', OK: 'OK' });

// Un recurso con sus cantidades: en almacén (onHand), reservada para planes (reserved) y disponible (available = onHand - reserved).
export class StockResource {
  constructor({ id, name, category = null, unit = '', onHand = 0, reserved = 0, available = null, minimumStock = 0, belowMinimum = null }) {
    this.id = id;
    this.name = name;
    this.category = category;
    this.unit = unit;
    this.onHand = onHand;
    this.reserved = reserved;
    this.available = available ?? onHand - reserved;
    this.minimumStock = minimumStock;
    this.belowMinimum = belowMinimum ?? this.available < minimumStock;
    Object.freeze(this);
  }

  // Parte del almacén que sigue disponible (0 a 1), para la barra de la tarjeta.
  get availableRatio() {
    return this.onHand > 0 ? Math.min(1, Math.max(0, this.available / this.onHand)) : 0;
  }

  get level() {
    if (this.available <= 0) return StockLevel.CRITICAL;
    if (!this.belowMinimum) return StockLevel.OK;
    return this.minimumStock > 0 && this.available < this.minimumStock / 2 ? StockLevel.CRITICAL : StockLevel.LOW;
  }
}
