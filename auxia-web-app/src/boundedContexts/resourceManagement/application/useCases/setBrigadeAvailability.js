import { BrigadeStatus } from '../../domain/enums/brigadeStatus.js';

export class SetBrigadeAvailability {
  constructor(brigadeRepository) {
    this.brigadeRepository = brigadeRepository;
  }

  // Solo AVAILABLE u OFF_DUTY: ASSIGNED lo pone el sistema al aprobar un plan.
  async execute({ brigadeId, status }) {
    if (status !== BrigadeStatus.AVAILABLE && status !== BrigadeStatus.OFF_DUTY) throw new Error('statusInvalid');
    return this.brigadeRepository.setAvailability(brigadeId, status);
  }
}
