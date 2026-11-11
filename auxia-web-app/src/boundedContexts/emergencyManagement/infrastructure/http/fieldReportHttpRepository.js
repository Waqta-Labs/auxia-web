import { FieldReportRepository } from '../../domain/repositories/fieldReportRepository.js';
import { toFieldReportSummary } from '../mappers/emergencyMapper.js';
import { httpClient } from '@shared/infrastructure/http/httpClient.js';
import { asList } from '@shared/infrastructure/http/asList.js';

export class FieldReportHttpRepository extends FieldReportRepository {
  async summarize(emergencyId) {
    const { data } = await httpClient.get('/emergencies/' + emergencyId + '/field-reports');
    return toFieldReportSummary(asList(data));
  }
}
