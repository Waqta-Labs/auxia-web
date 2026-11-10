export class FieldReportSummary {
  constructor({ total, relayed }) {
    this.total = total;     // reportes de campo activos
    this.relayed = relayed; // los que llegaron retransmitidos por Mesh (sin conexión)
    Object.freeze(this);
  }

  get relayedShare() {
    return this.total > 0 ? this.relayed / this.total : 0;
  }
}
