import { ZoneRepository } from '../../domain/repositories/zoneRepository.js';
import { toZone, toZoneDetail, toScoreExplanation } from '../mappers/emergencyMapper.js';
import { delay } from '@shared/infrastructure/mock/delay.js';
import { zoneDtos, scoreDtos } from './fixtures.js';

const notFound = () => Object.assign(new Error('Zona no encontrada'), { status: 404, detail: 'Zona no encontrada' });

const priorityOf = (score) => {
  if (score === null) return null;
  if (score > 85) return 'CRITICAL';
  if (score >= 60) return 'HIGH';
  if (score >= 40) return 'MEDIUM';
  return 'LOW';
};

const DAMAGE_POINTS = { LOW: 10, MODERATE: 30, SEVERE: 50, CRITICAL: 68 };
const damageOf = (score) => (score === null || score <= 40 ? 'LOW' : score <= 60 ? 'MODERATE' : score > 85 ? 'CRITICAL' : 'SEVERE');

// Puntaje de prueba (el real lo calcula el servicio de IA del backend).
const estimateScore = (damageLevel, impact) => {
  if (impact.population === undefined && impact.peopleAffected === undefined) return null;
  const people = impact.peopleAffected ?? Math.round((impact.population ?? 0) * 0.4);
  const children = impact.children ?? 0;
  return Math.min(98, Math.round((DAMAGE_POINTS[damageLevel] ?? 25) + Math.min(30, people / 20) + Math.min(10, children / 20)));
};

const impactFrom = (dto) => dto.impact ?? {
  population: dto.score === null ? null : dto.peopleAffected * 4,
  familiesAffected: Math.round(dto.peopleAffected / 4),
  peopleAffected: dto.peopleAffected,
  children: Math.round(dto.peopleAffected * 0.22),
  elderlyPeople: Math.round(dto.peopleAffected * 0.12),
  disabledPeople: Math.round(dto.peopleAffected * 0.04),
};

export class ZoneMockRepository extends ZoneRepository {
  constructor() {
    super();
    this.items = zoneDtos.map((dto) => ({ ...dto })); // las zonas registradas o editadas viven mientras no se recargue la página
    this.synthetic = new Set(); // zonas cuya explicación de puntaje se calcula aquí
    this.manualPriorities = new Map(); // zoneId -> { reason, setBy, setAt }
  }

  // eslint-disable-next-line no-unused-vars
  async findRanking(emergencyId, options) {
    await delay(500);
    return this.items.map((dto) => toZone({ ...dto, manualPriority: this.manualPriorities.get(dto.id) ?? null }, dto, emergencyId));
  }

  async findDetail(zoneId) {
    await delay(350);
    const dto = this.items.find((zone) => zone.id === zoneId);
    if (!dto) throw notFound();
    return toZoneDetail({
      ...dto,
      emergencyId: 'em-0001',
      populationImpact: impactFrom(dto),
      manualPriority: this.manualPriorities.get(zoneId) ?? null,
    });
  }

  async findScoreExplanation(zoneId) {
    await delay(250);
    const dto = this.items.find((zone) => zone.id === zoneId);
    if (!dto) throw notFound();
    if (!this.synthetic.has(zoneId) && scoreDtos[zoneId]) return toScoreExplanation(scoreDtos[zoneId]);
    if (dto.score === null) {
      return toScoreExplanation({ available: false, score: null, topFeatures: [], modelVersion: null, missingVariables: ['population'] });
    }
    return toScoreExplanation({
      available: true,
      score: dto.score,
      topFeatures: [
        { feature: 'peopleAffected', contribution: Math.round(dto.score * 0.55 * 10) / 10 },
        { feature: 'damageLevel', contribution: Math.round(dto.score * 0.45 * 10) / 10 },
      ],
      modelVersion: 'urgency-1.3.0',
      missingVariables: [],
    });
  }

  async setManualPriority(zoneId, reason) {
    await delay(400);
    if (!this.items.some((zone) => zone.id === zoneId)) throw notFound();
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

  async register(emergencyId, { name, latitude, longitude, damageLevel, impact }) {
    await delay(500);
    const score = estimateScore(damageLevel, impact);
    const id = 'zn-new-' + (this.items.length + 1);
    this.items.push({
      id,
      name,
      status: score === null ? 'REGISTERED' : 'PRIORITIZED',
      damageLevel: damageLevel ?? (score === null ? 'LOW' : damageOf(score)),
      peopleAffected: impact.peopleAffected ?? Math.round((impact.population ?? 0) * 0.4),
      score,
      priorityLevel: priorityOf(score),
      needs: [],
      manualPriority: null,
      geolocation: { latitude, longitude },
      lastAidReceivedAt: null,
      impact: { population: null, familiesAffected: null, peopleAffected: null, children: null, elderlyPeople: null, disabledPeople: null, ...impact },
    });
    this.synthetic.add(id);
    return { id, name };
  }

  async updatePopulationImpact(zoneId, impact) {
    await delay(500);
    const dto = this.items.find((zone) => zone.id === zoneId);
    if (!dto) throw notFound();
    dto.impact = { ...impactFrom(dto), ...impact };
    dto.peopleAffected = dto.impact.peopleAffected ?? dto.peopleAffected;
    dto.score = estimateScore(dto.damageLevel, dto.impact);
    dto.priorityLevel = priorityOf(dto.score);
    if (dto.score !== null && dto.status === 'REGISTERED') dto.status = 'PRIORITIZED';
    this.synthetic.add(zoneId);
  }
}
