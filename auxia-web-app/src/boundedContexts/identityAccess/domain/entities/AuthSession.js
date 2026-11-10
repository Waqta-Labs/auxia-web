export class AuthSession {
  constructor({ token, expiresAt = null, role, organizationId }) {
    this.token = token;
    this.expiresAt = expiresAt; // epoch en milisegundos, o null si el backend no lo informa
    this.role = role;
    this.organizationId = organizationId;
    Object.freeze(this);
  }

  isExpired(now = Date.now()) {
    return this.expiresAt !== null && now >= this.expiresAt;
  }
}
