// Estado de un plan de distribución. Un plan nace PROPOSED; al aprobarse se le asigna brigada;
// al registrarse su entrega pasa a EXECUTED.
export const PlanStatus = Object.freeze({
  PROPOSED: 'PROPOSED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  EXECUTED: 'EXECUTED',
});
