import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOverrideZoneScore } from '../hooks/useOverrideZoneScore.js';

export default function OverrideScoreForm({ zoneId, onDone, onCancel }) {
  const { t } = useTranslation('emergencyManagement');
  const [reason, setReason] = useState('');
  const mutation = useOverrideZoneScore();

  const handleSubmit = (event) => {
    event.preventDefault();
    mutation.mutate({ zoneId, reason }, { onSuccess: onDone });
  };

  const error = mutation.error;
  const message = !error
    ? null
    : error.message === 'reasonRequired'
      ? t('override.errors.reasonRequired')
      : error.detail ?? (error.status === 403 ? t('override.errors.forbidden') : t('override.errors.generic'));

  return (
    <form className="pz-override" onSubmit={handleSubmit} noValidate>
      <h3 className="pz-h3">{t('override.title')}</h3>
      <p className="pz-note">{t('override.hint')}</p>
      <label className="pz-field">
        <span>{t('override.label')}</span>
        <textarea
          rows="3" value={reason} autoFocus
          placeholder={t('override.placeholder')}
          onChange={(e) => setReason(e.target.value)}
        />
      </label>
      {message && <p className="pz-error" role="alert">{message}</p>}
      <div className="pz-actions">
        <button type="submit" className="pz-btn-lime" disabled={mutation.isPending}>
          {mutation.isPending ? t('override.saving') : t('override.confirm')}
        </button>
        <button type="button" className="pz-btn-outline" onClick={onCancel} disabled={mutation.isPending}>
          {t('override.cancel')}
        </button>
      </div>
    </form>
  );
}
