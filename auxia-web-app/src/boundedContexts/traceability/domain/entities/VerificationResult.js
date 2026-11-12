// Resultado de GET /deliveries/{id}/verify: ¿el hash de hoy coincide con el de la blockchain?
export class VerificationResult {
  constructor({ verified, recordHash = null, chainHash = null }) {
    this.verified = verified;
    this.recordHash = recordHash; // recalculado ahora
    this.chainHash = chainHash;   // el que está en la blockchain
    Object.freeze(this);
  }
}
