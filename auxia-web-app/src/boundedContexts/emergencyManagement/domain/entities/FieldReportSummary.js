export class FieldReportSummary {
  constructor({ total, pendingZone }) {
    this.total = total;             // reportes de campo de la emergencia
    this.pendingZone = pendingZone; // los que aún esperan que una autoridad les asigne zona
    Object.freeze(this);
  }
}
