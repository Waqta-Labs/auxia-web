import { PlanStatus } from '../enums/planStatus.js';

// De todos los planes de una zona, el que importa ahora: uno propuesto (por decidir),
// luego uno aprobado (por entregar) y, si no hay, el más reciente (rechazado o ejecutado).
export function pickCurrentPlan(plans) {
  if (!plans.length) return null;
  const recentFirst = [...plans].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  return (
    recentFirst.find((plan) => plan.status === PlanStatus.PROPOSED) ??
    recentFirst.find((plan) => plan.status === PlanStatus.APPROVED) ??
    recentFirst[0]
  );
}
