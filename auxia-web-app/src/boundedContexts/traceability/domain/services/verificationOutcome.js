import { DeliveryStatus } from '../enums/deliveryStatus.js';

// Qué le dice la ficha a la autoridad sobre una entrega, sin pedirle que compare hashes. Solo una
// entrega anclada (CERTIFIED) se puede comprobar contra la blockchain; antes se explica en qué paso va.
export function verificationOutcome(status, { result = null, error = null, checking = false } = {}) {
  if (status === DeliveryStatus.INITIATED) return 'onTheWay';
  if (status === DeliveryStatus.REGISTERED) return 'anchoring';
  if (status === DeliveryStatus.FAILED) return 'retrying';
  if (checking) return 'checking';
  if (error) return error.status === 503 ? 'unavailable' : 'error';
  if (result) return result.verified ? 'verified' : 'tampered';
  return 'checking';
}

// Tono del aviso: verde si se comprobó, rojo si no coincide o no se pudo comprobar, neutro si falta un paso.
export function outcomeTone(outcome) {
  if (outcome === 'verified') return 'ok';
  if (outcome === 'tampered' || outcome === 'error' || outcome === 'unavailable') return 'bad';
  return 'info';
}
