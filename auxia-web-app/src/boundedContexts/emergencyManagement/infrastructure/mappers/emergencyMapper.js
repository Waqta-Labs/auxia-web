import { Emergency } from '../../domain/entities/Emergency.js';
import { Zone } from '../../domain/entities/Zone.js';
import { ZoneDetail } from '../../domain/entities/ZoneDetail.js';
import { ScoreExplanation } from '../../domain/entities/ScoreExplanation.js';
import { FieldReportSummary } from '../../domain/entities/FieldReportSummary.js';
import { parseUtc } from '@shared/utils/formatters.js';

// Único lugar donde cambia la forma del backend: DTO -> entidad.

// GET /emergencies -> { id, name, type, description, location:{department,province,district}, status, startDate }
export function toEmergency(dto) {
  return new Emergency({
    id: dto.id,
    name: dto.name,
    type: dto.type,
    status: dto.status,
    district: dto.location?.district ?? null,
    startedAt: parseUtc(dto.startDate),
  });
}

// item = ZoneRankingItem { id, name, status, damageLevel, peopleAffected, score, priorityLevel, needs, manualPriority }
// detail = ZoneResource (GET /zones/{id}) o null: aporta "geolocation", que el ranking no trae.
export function toZone(item, detail, emergencyId) {
  return new Zone({
    id: item.id,
    emergencyId: detail?.emergencyId ?? emergencyId,
    name: item.name,
    latitude: detail?.geolocation?.latitude ?? null,
    longitude: detail?.geolocation?.longitude ?? null,
    urgencyScore: item.score ?? null,
    priorityLevel: item.priorityLevel ?? null,
    damageLevel: item.damageLevel ?? null,
    status: item.status ?? null,
    peopleAffected: item.peopleAffected ?? null,
    needs: item.needs ?? [],
    manualPriority: Boolean(item.manualPriority),
  });
}

// GET /zones/{id} -> ZoneResource
export function toZoneDetail(dto) {
  const impact = dto.populationImpact ?? {};
  const manual = dto.manualPriority;
  return new ZoneDetail({
    id: dto.id,
    emergencyId: dto.emergencyId ?? null,
    name: dto.name,
    latitude: dto.geolocation?.latitude ?? null,
    longitude: dto.geolocation?.longitude ?? null,
    population: impact.population ?? null,
    familiesAffected: impact.familiesAffected ?? null,
    peopleAffected: impact.peopleAffected ?? null,
    children: impact.children ?? null,
    elderlyPeople: impact.elderlyPeople ?? null,
    disabledPeople: impact.disabledPeople ?? null,
    damageLevel: dto.damageLevel ?? null,
    status: dto.status ?? null,
    urgencyScore: dto.score ?? null,
    priorityLevel: dto.priorityLevel ?? null,
    lastAidAt: parseUtc(dto.lastAidReceivedAt),
    manualPriority: manual ? { reason: manual.reason ?? '', setAt: parseUtc(manual.setAt) } : null,
  });
}

// GET /zones/{id}/score -> { available, score, topFeatures: [{ feature, contribution }], modelVersion, missingVariables }
export function toScoreExplanation(dto) {
  return new ScoreExplanation({
    available: dto?.available !== false,
    score: dto?.score ?? null,
    features: (dto?.topFeatures ?? []).map((f) => ({
      key: f.feature,
      contribution: typeof f.contribution === 'number' ? f.contribution : null,
    })),
    modelVersion: dto?.modelVersion ?? null,
    missingVariables: dto?.missingVariables ?? [],
  });
}

// GET /emergencies/{id}/field-reports -> [{ pendingZoneAssignment, ... }]
export function toFieldReportSummary(reports) {
  return new FieldReportSummary({
    total: reports.length,
    pendingZone: reports.filter((r) => r.pendingZoneAssignment).length,
  });
}
