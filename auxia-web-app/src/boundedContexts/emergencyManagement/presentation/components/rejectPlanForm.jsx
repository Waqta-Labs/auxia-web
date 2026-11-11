import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRejectDistributionPlan } from '../hooks/useRejectDistributionPlan.js';
import { planErrorMessage } from '../utils/planFormat.js';

export default function RejectPlanForm({ planId, onDone, onCancel }) {
  const { t } = useTranslation('emergencyManagement');
  const [reason, setReason] = useState('');
  const mutation = useRejectDistributionPlan();

  const handleSubmit = (event) => {
    event.preventDefault();
    mutation.mutate({ planId, reason }, { onSuccess: onDone });
  };

  const message = planErrorMessage(t, mutation.error);

  return (
    <form className="pz-override" onSubmit={handleSubmit} noValidate>
      <h3 className="pz-h3">{t('plan.reject.title')}</h3>
      <p className="pz-note">{t('plan.reject.hint')}</p>
      <label className="pz-field">
        <span>{t('plan.reject.label')}</span>
        <textarea rows="3" value={reason} autoFocus onChange={(e) => setReason(e.target.value)} />
      </label>
      {message && <p className="pz-error" role="alert">{message}</p>}
      <div className="pz-actions">
        <button type="submit" className="pz-btn-lime" disabled={mutation.isPending}>
          {mutation.isPending ? t('plan.reject.saving') : t('plan.reject.confirm')}
        </button>
        <button type="button" className="pz-btn-outline" onClick={onCancel} disabled={mutation.isPending}>
          {t('plan.cancel')}
        </button>
      </div>
    </form>
  );
}
