import { MemberRole } from '../../domain/enums/memberRole.js';

export class AddBrigadeMember {
  constructor(brigadeRepository) {
    this.brigadeRepository = brigadeRepository;
  }

  // Errores de validación: memberNameRequired, roleInvalid.
  async execute({ brigadeId, name, role, phone }) {
    const cleanName = (name ?? '').trim();
    if (!cleanName) throw new Error('memberNameRequired');
    if (!Object.values(MemberRole).includes(role)) throw new Error('roleInvalid');
    return this.brigadeRepository.addMember(brigadeId, { name: cleanName, role, phone: (phone ?? '').trim() || null });
  }
}
