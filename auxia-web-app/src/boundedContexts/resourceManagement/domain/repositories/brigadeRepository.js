// Contrato. Backend (Resource Management), brigadas de la organización del usuario:
//   GET    /brigades?status=                         por nombre; AVAILABLE | ASSIGNED | OFF_DUTY
//   GET    /brigades/{id}                            con miembros y asignación en curso
//   POST   /brigades                                 crea (ORGANIZATION_ADMIN); nace AVAILABLE
//   POST   /brigades/{id}/members                    agrega un miembro (LEADER, DRIVER, MEDIC, VOLUNTEER)
//   DELETE /brigades/{id}/members/{memberId}         quita un miembro
//   PATCH  /brigades/{id}/availability               AVAILABLE u OFF_DUTY (ASSIGNED nunca se pone a mano)
export class BrigadeRepository {
  async findAll() { throw new Error('BrigadeRepository.findAll no implementado'); }
  async findById() { throw new Error('BrigadeRepository.findById no implementado'); }
  async create() { throw new Error('BrigadeRepository.create no implementado'); }
  async addMember() { throw new Error('BrigadeRepository.addMember no implementado'); }
  async removeMember() { throw new Error('BrigadeRepository.removeMember no implementado'); }
  async setAvailability() { throw new Error('BrigadeRepository.setAvailability no implementado'); }
}
