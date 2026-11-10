import { EmergencyMockRepository } from './mock/emergencyMockRepository.js';
import { ZoneMockRepository } from './mock/zoneMockRepository.js';
import { FieldReportMockRepository } from './mock/fieldReportMockRepository.js';
import { GetActiveEmergency } from '../application/useCases/getActiveEmergency.js';
import { GetZoneRanking } from '../application/useCases/getZoneRanking.js';
import { GetFieldReportSummary } from '../application/useCases/getFieldReportSummary.js';

// Composición. Para usar el backend real, cambiar los repositorios mock por sus versiones HTTP.
const emergencyRepository = new EmergencyMockRepository();
const zoneRepository = new ZoneMockRepository();
const fieldReportRepository = new FieldReportMockRepository();

export const getActiveEmergencyUseCase = new GetActiveEmergency(emergencyRepository);
export const getZoneRankingUseCase = new GetZoneRanking(zoneRepository);
export const getFieldReportSummaryUseCase = new GetFieldReportSummary(fieldReportRepository);
