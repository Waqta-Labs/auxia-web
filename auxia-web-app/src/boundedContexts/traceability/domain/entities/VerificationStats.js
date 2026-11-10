export class VerificationStats {
  constructor({ verified, total }) {
    this.verified = verified; // entregas validadas en blockchain
    this.total = total;       // entregas registradas
    Object.freeze(this);
  }

  // Porcentaje (0-100) con un decimal; null si aún no hay entregas.
  get percentage() {
    return this.total > 0 ? Math.round((this.verified / this.total) * 1000) / 10 : null;
  }
}
