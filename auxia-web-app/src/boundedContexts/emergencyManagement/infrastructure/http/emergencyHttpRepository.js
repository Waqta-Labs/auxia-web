import { EmergencyRepository } from '../../domain/repositories/emergencyRepository.js';
import { toEmergency } from '../mappers/emergencyMapper.js';
import { httpClient } from '@shared/infrastructure/http/httpClient.js';
import { asList } from '@shared/infrastructure/http/asList.js';

export class EmergencyHttpRepository extends EmergencyRepository {
  async findActive() {
    const { data } = await httpClient.get('/emergencies');
    return asList(data).map(toEmergency);
  }
}
