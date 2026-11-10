import { Emergency } from '../../domain/entities/Emergency.js';
import { Zone } from '../../domain/entities/Zone.js';
import { FieldReportSummary } from '../../domain/entities/FieldReportSummary.js';

// Único lugar a ajustar cuando se conecte el backend real: DTO -> entidad.

export function toEmergency(dto) {
  return new Emergency({
    id: dto.id,
    name: dto.name,
    type: dto.type,
    status: dto.status,
    district: dto.district ?? null,
    startedAt: dto.startDate ? new Date(dto.startDate).getTime() : null,
  });
}

export function toZone(dto) {
  return new Zone({
    id: dto.id,
    emergencyId: dto.emergencyId,
    name: dto.name,
    latitude: dto.latitude ?? null,
    longitude: dto.longitude ?? null,
    urgencyScore: dto.urgencyScore ?? null,
    needs: dto.needs ?? [],
    // topFeatures del AI Service: cada variable que sumó puntos -> motivo legible en la UI.
    reasons: (dto.topFeatures ?? []).map((f) => ({ key: f.feature, value: f.value })),
    manualPriority: Boolean(dto.manualPriority),
  });
}

export function toFieldReportSummary(reports) {
  return new FieldReportSummary({
    total: reports.length,
    relayed: reports.filter((r) => r.relay && r.relay.hops > 0).length,
  });
}
