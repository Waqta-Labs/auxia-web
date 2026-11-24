import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Brigade } from '@bc/resourceManagement/domain/entities/Brigade.js';
import { DistributionPlan } from '@bc/emergencyManagement/domain/entities/DistributionPlan.js';
import { plansAwaitingBrigade } from '@bc/emergencyManagement/domain/services/plansAwaitingBrigade.js';
import { noBrigadeReason } from '@bc/emergencyManagement/presentation/utils/planFormat.js';
import { availabilitySummary } from '@bc/resourceManagement/domain/services/brigadeAvailability.js';
import { fakeT } from '../setup/translate.js';

const plan = (id, status) => new DistributionPlan({ id, zoneId: 'zone-' + id, status });
const brigade = (id, status, { hasLeader = true, assignedPlanId = null } = {}) =>
  new Brigade({ id, name: 'Brigada ' + id, status, hasLeader, assignedPlanId });

describe('Planes aprobados que esperan brigada (US-12)', () => {
  it('cuenta solo los planes aprobados que ninguna brigada está entregando', () => {
    const plans = [plan('p1', 'APPROVED'), plan('p2', 'APPROVED'), plan('p3', 'PROPOSED'), plan('p4', 'EXECUTED')];
    const brigades = [brigade('alfa', 'ASSIGNED', { assignedPlanId: 'p1' }), brigade('bravo', 'AVAILABLE')];

    assert.deepEqual(plansAwaitingBrigade(plans, brigades).map((p) => p.id), ['p2']);
  });

  it('sin brigadas, todo plan aprobado espera una', () => {
    assert.deepEqual(plansAwaitingBrigade([plan('p1', 'APPROVED')], []).map((p) => p.id), ['p1']);
  });
});

describe('Motivo de un plan aprobado sin brigada', () => {
  it('dice cuántas brigadas están en misión, fuera de servicio o sin líder', () => {
    const brigades = [
      brigade('alfa', 'ASSIGNED'),
      brigade('bravo', 'ASSIGNED'),
      brigade('charlie', 'OFF_DUTY'),
      brigade('delta', 'AVAILABLE', { hasLeader: false }),
    ];

    assert.equal(
      noBrigadeReason(fakeT, availabilitySummary(brigades)),
      'plan.noBrigade.reasons.busy(onMission=2,offDuty=1,withoutLeader=1)',
    );
  });

  it('invita a pedir la asignación cuando una brigada con líder ya quedó libre', () => {
    const brigades = [brigade('alfa', 'AVAILABLE'), brigade('bravo', 'ASSIGNED')];

    assert.equal(noBrigadeReason(fakeT, availabilitySummary(brigades)), 'plan.noBrigade.reasons.ready(count=1)');
  });

  it('avisa cuando la organización todavía no tiene brigadas', () => {
    assert.equal(noBrigadeReason(fakeT, availabilitySummary([])), 'plan.noBrigade.reasons.none');
  });
});
