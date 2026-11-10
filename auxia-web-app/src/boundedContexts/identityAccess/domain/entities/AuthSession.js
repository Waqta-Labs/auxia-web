export class AuthSession {
  constructor({ token, expiresAt = null, role, organizationId, displayName = null, organizationName = null }) {
    this.token = token;
    this.expiresAt = expiresAt; // epoch en milisegundos, o null si el backend no lo informa
    this.role = role;
    this.organizationId = organizationId;
    this.displayName = displayName;
    this.organizationName = organizationName;
    Object.freeze(this);
  }

  isExpired(now = Date.now()) {
    return this.expiresAt !== null && now >= this.expiresAt;
  }
}
