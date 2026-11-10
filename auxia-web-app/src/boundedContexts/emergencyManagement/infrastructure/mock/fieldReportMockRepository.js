import { FieldReportRepository } from '../../domain/repositories/fieldReportRepository.js';
import { toFieldReportSummary } from '../mappers/emergencyMapper.js';
import { delay } from '@shared/infrastructure/mock/delay.js';
import { fieldReportDtos } from './fixtures.js';

export class FieldReportMockRepository extends FieldReportRepository {
  // eslint-disable-next-line no-unused-vars
  async summarize(emergencyId) {
    await delay(450);
    return toFieldReportSummary(fieldReportDtos);
  }
}
