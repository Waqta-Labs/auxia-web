import { DistributionPlanRepository } from '../../domain/repositories/distributionPlanRepository.js';
import { toDistributionPlan } from '../mappers/distributionPlanMapper.js';
import { httpClient } from '@shared/infrastructure/http/httpClient.js';
import { asList } from '@shared/infrastructure/http/asList.js';
import { toApiError } from '@shared/infrastructure/http/toApiError.js';

const call = async (request) => {
  try {
    return await request();
  } catch (error) {
    throw toApiError(error);
  }
};

export class DistributionPlanHttpRepository extends DistributionPlanRepository {
  async findByZone(zoneId) {
    const { data } = await call(() => httpClient.get('/zones/' + zoneId + '/distribution-plans'));
    return asList(data).map(toDistributionPlan);
  }

  async findById(planId) {
    const { data } = await call(() => httpClient.get('/distribution-plans/' + planId));
    return toDistributionPlan(data);
  }

  // Un solo reparto cubre toda la emergencia: se crea un plan PROPOSED por cada zona que recibe algo.
  async recommend(emergencyId) {
    await call(() => httpClient.post('/emergencies/' + emergencyId + '/distribution-plans'));
  }

  async approve(planId) {
    await call(() => httpClient.post('/distribution-plans/' + planId + '/approve'));
  }

  async reject(planId, reason) {
    await call(() => httpClient.post('/distribution-plans/' + planId + '/reject', { reason }));
  }

  async assignBrigade(planId) {
    await call(() => httpClient.post('/distribution-plans/' + planId + '/brigade-assignment'));
  }
}
