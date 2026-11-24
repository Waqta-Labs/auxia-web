import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { toZone } from '@bc/emergencyManagement/infrastructure/mappers/emergencyMapper.js';

// Un elemento de GET /emergencies/{emergencyId}/zones (ZoneRankingItemResource del Backend API).
const item = (accessConditions) => ({
  id: 'z1',
  name: 'Sector Alto Perú',
  status: 'PRIORITIZED',
  damageLevel: 'SEVERE',
  peopleAffected: 120,
  score: 48,
  priorityLevel: 'MEDIUM',
  needs: ['WATER'],
  manualPriority: null,
  accessConditions,
});
const detail = { emergencyId: 'e1', geolocation: { latitude: -11.9436, longitude: -76.7078 } };

describe('Condiciones de acceso de una zona', () => {
  it('lista las condiciones reportadas en el orden del SOS, con cuántos reportes las mencionan', () => {
    const zone = toZone(item({ DAMAGED_BUILDING: 1, ROAD_BLOCKED: 3 }), detail, 'e1');

    assert.deepEqual(zone.reportedAccessConditions, [
      { condition: 'ROAD_BLOCKED', reports: 3 },
      { condition: 'DAMAGED_BUILDING', reports: 1 },
    ]);
    assert.equal(zone.blockedRoadReports, 3);
  });

  it('una zona sin reportes de acceso no tiene vía bloqueada', () => {
    const zone = toZone(item(undefined), detail, 'e1');

    assert.deepEqual(zone.reportedAccessConditions, []);
    assert.equal(zone.blockedRoadReports, 0);
  });
});
