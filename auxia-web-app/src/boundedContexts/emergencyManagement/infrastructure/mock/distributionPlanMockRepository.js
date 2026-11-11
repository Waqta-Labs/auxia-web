import { DistributionPlanRepository } from '../../domain/repositories/distributionPlanRepository.js';
import { toDistributionPlan } from '../mappers/distributionPlanMapper.js';
import { delay } from '@shared/infrastructure/mock/delay.js';
import { zoneDtos } from './fixtures.js';

const problem = (status, detail) => Object.assign(new Error(detail), { status, detail });

const RESOURCES = {
  WATER: { resourceName: 'Agua embotellada', unit: 'bidones', perPerson: 0.1 },
  FOOD: { resourceName: 'Kits de alimentos', unit: 'kits', perPerson: 0.25 },
  SHELTER: { resourceName: 'Carpas familiares', unit: 'unidades', perPerson: 0.2 },
  HYGIENE: { resourceName: 'Kits de higiene', unit: 'kits', perPerson: 0.25 },
  MEDICINE: { resourceName: 'Botiquines', unit: 'unidades', perPerson: 0.15 },
};

const BRIGADES = [{ id: 'br-01', name: 'Brigada Alfa' }, { id: 'br-02', name: 'Brigada Bravo' }];

// Zona sin brigada libre al aprobar (para probar el reintento); el primer reintento falla y el segundo funciona.
const NO_BRIGADE_ZONE = 'zn-05';

export class DistributionPlanMockRepository extends DistributionPlanRepository {
  constructor() {
    super();
    this.plans = new Map();   // planId -> dto
    this.retries = new Map(); // planId -> intentos de asignación
    this.sequence = 0;
  }

  async findByZone(zoneId) {
    await delay(350);
    return [...this.plans.values()].filter((plan) => plan.zoneId === zoneId).reverse().map(toDistributionPlan);
  }

  async findById(planId) {
    await delay(250);
    const plan = this.plans.get(planId);
    if (!plan) throw problem(404, 'Plan no encontrado');
    return toDistributionPlan(plan);
  }

  async recommend() {
    await delay(900);
    if ([...this.plans.values()].some((plan) => plan.status === 'PROPOSED')) {
      throw problem(409, 'Hay planes propuestos sin decidir. Apruébalos o recházalos antes de pedir una nueva recomendación.');
    }
    const candidates = zoneDtos.filter((zone) => zone.score !== null && zone.status !== 'SERVED');
    for (const zone of candidates) {
      const items = zone.needs.filter((need) => RESOURCES[need]).map((need) => {
        const resource = RESOURCES[need];
        const quantity = Math.max(1, Math.round(zone.peopleAffected * resource.perPerson));
        return { resourceId: 'rs-' + need, resourceName: resource.resourceName, unit: resource.unit, recommendedQuantity: quantity, quantity };
      });
      if (!items.length) continue;
      this.sequence += 1;
      const id = 'pl-' + String(this.sequence).padStart(4, '0');
      this.plans.set(id, {
        id, zoneId: zone.id, status: 'PROPOSED',
        coverage: zone.score > 60 ? 'FULL' : 'PARTIAL',
        justification: zone.name + ' tiene score ' + Math.round(zone.score) + ' y ' + zone.peopleAffected +
          ' personas afectadas; se reparte según sus necesidades y el stock disponible.',
        items, brigade: null, createdAt: new Date().toISOString().slice(0, 19),
      });
    }
  }

  async approve(planId) {
    await delay(600);
    const plan = this.plans.get(planId);
    if (!plan) throw problem(404, 'Plan no encontrado');
    if (plan.status !== 'PROPOSED') throw problem(409, 'El plan ya fue decidido.');
    plan.status = 'APPROVED';
    plan.brigade = plan.zoneId === NO_BRIGADE_ZONE ? null : BRIGADES[this.sequence % BRIGADES.length];
  }

  async reject(planId, reason) {
    await delay(450);
    const plan = this.plans.get(planId);
    if (!plan) throw problem(404, 'Plan no encontrado');
    if (!reason) throw problem(400, 'El motivo es obligatorio.');
    plan.status = 'REJECTED';
  }

  async assignBrigade(planId) {
    await delay(600);
    const plan = this.plans.get(planId);
    if (!plan) throw problem(404, 'Plan no encontrado');
    if (plan.brigade) throw problem(409, 'El plan ya tiene una brigada asignada.');
    const attempts = (this.retries.get(planId) ?? 0) + 1;
    this.retries.set(planId, attempts);
    if (attempts === 1) throw problem(422, 'No hay ninguna brigada libre con líder en este momento.');
    plan.brigade = BRIGADES[0];
  }
}
