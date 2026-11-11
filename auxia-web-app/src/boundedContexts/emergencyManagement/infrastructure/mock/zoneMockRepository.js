import { ZoneRepository } from '../../domain/repositories/zoneRepository.js';
import { toZone, toZoneDetail, toScoreExplanation } from '../mappers/emergencyMapper.js';
import { delay } from '@shared/infrastructure/mock/delay.js';
import { zoneDtos, scoreDtos } from './fixtures.js';

const notFound = () => Object.assign(new Error('Zona no encontrada'), { status: 404, detail: 'Zona no encontrada' });

const impactOf = (zone) => {
  const people = zone.peopleAffected;
  return {
    population: zone.score === null ? null : people * 4,
    familiesAffected: Math.round(people / 4),
    peopleAffected: people,
    children: Math.round(people * 0.22),
    elderlyPeople: Math.round(people * 0.12),
    disabledPeople: Math.round(people * 0.04),
  };
};

export class ZoneMockRepository extends ZoneRepository {
  constructor() {
    super();
    this.manualPriorities = new Map(); // zoneId -> { reason, setBy, setAt }; vive mientras no se recargue la página
  }

  // eslint-disable-next-line no-unused-vars
  async findRanking(emergencyId, options) {
    await delay(500);
    return zoneDtos.map((dto) =>
      toZone({ ...dto, manualPriority: this.manualPriorities.get(dto.id) ?? null }, dto, emergencyId),
    );
  }

  async findDetail(zoneId) {
    await delay(350);
    const dto = zoneDtos.find((zone) => zone.id === zoneId);
    if (!dto) throw notFound();
    return toZoneDetail({
      ...dto,
      emergencyId: 'em-0001',
      populationImpact: impactOf(dto),
      manualPriority: this.manualPriorities.get(zoneId) ?? null,
    });
  }

  async findScoreExplanation(zoneId) {
    await delay(250);
    if (!scoreDtos[zoneId]) throw notFound();
    return toScoreExplanation(scoreDtos[zoneId]);
  }

  async setManualPriority(zoneId, reason) {
    await delay(400);
    if (!zoneDtos.some((zone) => zone.id === zoneId)) throw notFound();
    this.manualPriorities.set(zoneId, {
      reason,
      setBy: 'mock-user',
      setAt: new Date().toISOString().slice(0, 19),
    });
  }

  async clearManualPriority(zoneId) {
    await delay(300);
    this.manualPriorities.delete(zoneId);
  }
}
