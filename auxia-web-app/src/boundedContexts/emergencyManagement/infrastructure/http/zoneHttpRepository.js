import { ZoneRepository } from '../../domain/repositories/zoneRepository.js';
import { toZone, toZoneDetail, toScoreExplanation } from '../mappers/emergencyMapper.js';
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

export class ZoneHttpRepository extends ZoneRepository {
  async findRanking(emergencyId, { withPosition = true } = {}) {
    const { data } = await call(() => httpClient.get('/emergencies/' + emergencyId + '/zones'));
    const items = asList(data);
    if (!withPosition) return items.map((item) => toZone(item, null, emergencyId));

    // El ranking no trae coordenadas: se piden una a una (si una falla, esa zona queda sin marcador).
    const details = await Promise.allSettled(items.map((item) => httpClient.get('/zones/' + item.id)));
    return items.map((item, i) =>
      toZone(item, details[i].status === 'fulfilled' ? details[i].value.data : null, emergencyId),
    );
  }

  async findDetail(zoneId) {
    const { data } = await call(() => httpClient.get('/zones/' + zoneId));
    return toZoneDetail(data);
  }

  async findScoreExplanation(zoneId) {
    const { data } = await call(() => httpClient.get('/zones/' + zoneId + '/score'));
    return toScoreExplanation(data);
  }

  async setManualPriority(zoneId, reason) {
    await call(() => httpClient.put('/zones/' + zoneId + '/manual-priority', { reason }));
  }

  async clearManualPriority(zoneId) {
    await call(() => httpClient.delete('/zones/' + zoneId + '/manual-priority'));
  }

  // POST /emergencies/{id}/zones
  // Cuerpo: { name, geolocation: { latitude, longitude }, populationImpact?: { population, familiesAffected, peopleAffected,
  // children, elderlyPeople, disabledPeople }, damageLevel? }. Con población el backend calcula el puntaje al instante.
  async register(emergencyId, { name, latitude, longitude, damageLevel, impact }) {
    const body = { name, geolocation: { latitude, longitude } };
    if (impact && Object.keys(impact).length > 0) body.populationImpact = impact;
    if (damageLevel) body.damageLevel = damageLevel;
    const { data } = await call(() => httpClient.post('/emergencies/' + emergencyId + '/zones', body));
    return { id: data?.id ?? null, name: data?.name ?? name };
  }

  // PATCH /zones/{id}/population-impact: solo cambian los conteos enviados y se recalcula el puntaje.
  async updatePopulationImpact(zoneId, impact) {
    await call(() => httpClient.patch('/zones/' + zoneId + '/population-impact', impact));
  }
}
