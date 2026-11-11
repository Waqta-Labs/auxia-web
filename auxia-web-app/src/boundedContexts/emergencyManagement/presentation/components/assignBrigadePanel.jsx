import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '@shared/utils/formatters.js';
import { useActiveEmergency } from '../hooks/useActiveEmergency.js';
import { useZoneDistributionPlan } from '../hooks/useZoneDistributionPlan.js';
import { useRecommendDistribution } from '../hooks/useRecommendDistribution.js';
import { useApproveDistributionPlan } from '../hooks/useApproveDistributionPlan.js';
import { useAssignBrigadeToPlan } from '../hooks/useAssignBrigadeToPlan.js';
import { coverageLabel, planErrorMessage, statusLabel } from '../utils/planFormat.js';
import RejectPlanForm from './rejectPlanForm.jsx';

// Vista "Asignar brigada" del drawer. El despacho no es un botón suelto: la IA propone un plan de
// distribución, la autoridad lo aprueba y el backend asigna la brigada libre más cercana.
export default function AssignBrigadePanel({ zoneId, zone, onBack }) {
  const { t, i18n } = useTranslation('emergencyManagement');
  const lng = i18n.resolvedLanguage;
  const emergency = useActiveEmergency();
  const planQuery = useZoneDistributionPlan(zoneId);
  const recommend = useRecommendDistribution();
  const approve = useApproveDistributionPlan();
  const assign = useAssignBrigadeToPlan();
  const [rejecting, setRejecting] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [failure, setFailure] = useState(null); // último error de recomendar / aprobar / asignar

  useEffect(() => {
    setRejecting(false);
    setGenerated(false);
    setFailure(null);
  }, [zoneId]);

  const plan = planQuery.data ?? null;
  const hasScore = zone?.urgencyScore !== null && zone?.urgencyScore !== undefined;
  const canGenerate = !plan || plan.status === 'REJECTED' || plan.status === 'EXECUTED';
  const coverage = plan ? coverageLabel(t, plan.coverage) : null;
  const number = (value) => (value === null || value === undefined ? '—' : formatNumber(value, lng));

  // Ejecuta una mutación mostrando solo el error de la última acción.
  const run = (mutation, argument, onSuccess) => {
    setFailure(null);
    mutation.mutate(argument, { onSuccess, onError: setFailure });
  };
  const generate = () => {
    setGenerated(false);
    run(recommend, emergency.data?.id, () => setGenerated(true));
  };

  const error = planErrorMessage(t, failure);
  const busy = recommend.isPending || approve.isPending || assign.isPending;

  return (
    <>
      <button type="button" className="pz-link-btn pz-back" onClick={onBack}>← {t('plan.back')}</button>
      <div>
        <h3 className="pz-h3">{t('plan.title')}</h3>
        <p className="pz-note">{t('plan.intro')}</p>
      </div>

      {planQuery.isLoading && (
        <>
          <span className="pz-skel pz-skel--block" />
          <span className="pz-skel pz-skel--block" />
        </>
      )}

      {planQuery.isError && <p className="pz-error" role="alert">{planQuery.error?.detail ?? t('plan.loadError')}</p>}

      {plan && (
        <section className="pz-box pz-plan">
          <div className="pz-plan__head">
            <span className={'pz-chip pz-chip--' + plan.status.toLowerCase()}>{statusLabel(t, plan.status)}</span>
            {coverage && <span className="pz-note">{t('plan.coverage.label')}: {coverage}</span>}
          </div>

          {plan.items.length > 0 && (
            <table className="pz-items">
              <thead>
                <tr>
                  <th scope="col">{t('plan.items.resource')}</th>
                  <th scope="col">{t('plan.items.recommended')}</th>
                  <th scope="col">{t('plan.items.quantity')}</th>
                </tr>
              </thead>
              <tbody>
                {plan.items.map((item) => (
                  <tr key={item.resourceId ?? item.name}>
                    <td>{item.name}</td>
                    <td>{number(item.recommended)}{item.unit ? ' ' + item.unit : ''}</td>
                    <td><strong>{number(item.quantity)}{item.unit ? ' ' + item.unit : ''}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {plan.justification && (
            <div>
              <span className="pz-label">{t('plan.justification')}</span>
              <p>{plan.justification}</p>
            </div>
          )}
        </section>
      )}

      {plan?.isProposed && !rejecting && (
        <div className="pz-stack">
          <p className="pz-note">{t('plan.approveHint')}</p>
          <div className="pz-actions">
            <button type="button" className="pz-btn-lime" disabled={busy} onClick={() => run(approve, plan.id)}>
              {approve.isPending ? t('plan.approving') : t('plan.approve')}
            </button>
            <button type="button" className="pz-btn-outline" disabled={busy} onClick={() => { setFailure(null); setRejecting(true); }}>
              {t('plan.rejectAction')}
            </button>
          </div>
        </div>
      )}

      {plan?.isProposed && rejecting && (
        <RejectPlanForm planId={plan.id} onDone={() => setRejecting(false)} onCancel={() => setRejecting(false)} />
      )}

      {plan?.needsBrigade && (
        <section className="pz-box pz-box--manual">
          <span className="pz-label">{t('plan.noBrigade.title')}</span>
          <p>{t('plan.noBrigade.text')}</p>
          <button type="button" className="pz-btn-lime pz-stack-gap" disabled={busy} onClick={() => run(assign, plan.id)}>
            {assign.isPending ? t('plan.noBrigade.assigning') : t('plan.noBrigade.retry')}
          </button>
        </section>
      )}

      {plan?.isApproved && plan.hasBrigade && (
        <section className="pz-box pz-box--ok">
          <span className="pz-label">{t('plan.assigned.title')}</span>
          <p className="pz-brigade">{plan.brigade.name ?? t('plan.assigned.unnamed')}</p>
          <p className="pz-note">{t('plan.assigned.text')}</p>
        </section>
      )}

      {plan?.status === 'EXECUTED' && <p className="pz-note">{t('plan.executed')}</p>}
      {plan?.status === 'REJECTED' && <p className="pz-note">{t('plan.rejectedNote')}</p>}

      {canGenerate && !planQuery.isLoading && (
        <div className="pz-stack">
          {!plan && <p>{t('plan.none')}</p>}
          <p className="pz-note">{t('plan.generateHint')}</p>
          {!hasScore && <p className="pz-note">{t('plan.noScore')}</p>}
          {generated && !plan?.isProposed && <p className="pz-note">{t('plan.noneAfter')}</p>}
          <button type="button" className="pz-btn-lime" disabled={busy || !hasScore || !emergency.data?.id} onClick={generate}>
            {recommend.isPending ? t('plan.generating') : t('plan.generate')}
          </button>
        </div>
      )}

      {error && <p className="pz-error" role="alert">{error}</p>}
    </>
  );
}
