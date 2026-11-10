import { ZoneRepository } from '../../domain/repositories/zoneRepository.js';
import { toZone } from '../mappers/emergencyMapper.js';
import { delay } from '@shared/infrastructure/mock/delay.js';
import { zoneDtos } from './fixtures.js';

export class ZoneMockRepository extends ZoneRepository {
  async findRanking(emergencyId) {
    await delay(500);
    return zoneDtos.filter((dto) => dto.emergencyId === emergencyId).map(toZone);
  }
}
