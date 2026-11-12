// Contrato. Backend: GET /api/v1/users/me  y  GET /api/v1/me/missions (solo FIELD_BRIGADE)
export class UserRepository {
  // -> { name, email, status, lastLoginAt } (cualquiera puede ser null)
  async getMe() { throw new Error('No implementado'); }
  // -> { name, assigned, completed } de la brigada de la cuenta
  async getMyBrigade() { throw new Error('No implementado'); }
}
