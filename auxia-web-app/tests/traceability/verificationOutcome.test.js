import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { outcomeTone, verificationOutcome } from '@bc/traceability/domain/services/verificationOutcome.js';
import { VerificationResult } from '@bc/traceability/domain/entities/VerificationResult.js';

const result = (verified) => new VerificationResult({ deliveryId: 'd1', verified, recordHash: 'a', anchoredHash: verified ? 'a' : 'b' });

describe('Resultado de la verificación de una entrega (US-17)', () => {
  it('una entrega anclada cuyo registro coincide queda comprobada', () => {
    const outcome = verificationOutcome('CERTIFIED', { result: result(true) });

    assert.equal(outcome, 'verified');
    assert.equal(outcomeTone(outcome), 'ok');
  });

  it('si el registro cambió después de anclarse, lo dice como alerta', () => {
    const outcome = verificationOutcome('CERTIFIED', { result: result(false) });

    assert.equal(outcome, 'tampered');
    assert.equal(outcomeTone(outcome), 'bad');
  });

  it('antes del anclaje explica en qué paso va la entrega, sin compararla', () => {
    assert.equal(verificationOutcome('INITIATED', { result: result(true) }), 'onTheWay');
    assert.equal(verificationOutcome('REGISTERED'), 'anchoring');
    assert.equal(verificationOutcome('FAILED'), 'retrying');
    assert.equal(outcomeTone('anchoring'), 'info');
  });

  it('distingue la blockchain caída de otros errores, y muestra que está comprobando', () => {
    assert.equal(verificationOutcome('CERTIFIED', { error: { status: 503 } }), 'unavailable');
    assert.equal(verificationOutcome('CERTIFIED', { error: { status: 500 } }), 'error');
    assert.equal(verificationOutcome('CERTIFIED', { checking: true, result: result(true) }), 'checking');
  });
});
