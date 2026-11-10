import { EmergencyRepository } from '../../domain/repositories/emergencyRepository.js';
import { toEmergency } from '../mappers/emergencyMapper.js';
import { delay } from '@shared/infrastructure/mock/delay.js';
import { emergencyDtos } from './fixtures.js';

export class EmergencyMockRepository extends EmergencyRepository {
  async findActive() {
    await delay();
    return emergencyDtos.map(toEmergency);
  }
}
