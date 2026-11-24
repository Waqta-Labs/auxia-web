import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { toBrigade } from '@bc/resourceManagement/infrastructure/mappers/brigadeMapper.js';
import { brigadeOfPlan } from '@bc/resourceManagement/domain/services/brigadeAvailability.js';

// Respuesta de GET /brigades (BrigadeResource del Backend API).
const dto = (overrides = {}) => ({
  id: 'b1',
  organizationId: 'org',
  name: 'Brigada Alfa',
  code: 'BRG-ALFA-07',
  baseLocation: { latitude: -11.94, longitude: -76.7 },
  status: 'ASSIGNED',
  hasLeader: true,
  members: [],
  currentAssignment: { distributionPlanId: 'plan-1', zoneId: 'zone-1', assignedAt: '2026-11-20T10:15:00' },
  ...overrides,
});

describe('Brigada del listado', () => {
  it('lee si tiene líder y el plan que está entregando', () => {
    const brigade = toBrigade(dto());

    assert.equal(brigade.hasLeader, true);
    assert.equal(brigade.assignedPlanId, 'plan-1');
  });

  it('una brigada sin asignación no tiene plan, y sin el dato de líder no se supone nada', () => {
    const brigade = toBrigade(dto({ status: 'AVAILABLE', currentAssignment: null, hasLeader: undefined }));

    assert.equal(brigade.assignedPlanId, null);
    assert.equal(brigade.hasLeader, null);
  });

  it('encuentra la brigada de un plan', () => {
    const brigades = [toBrigade(dto()), toBrigade(dto({ id: 'b2', currentAssignment: null }))];

    assert.equal(brigadeOfPlan(brigades, 'plan-1').id, 'b1');
    assert.equal(brigadeOfPlan(brigades, 'plan-9'), null);
  });
});
