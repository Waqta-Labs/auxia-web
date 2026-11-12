import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IMPACT_FIELDS } from '../../domain/services/populationImpact.js';
import { useUpdatePopulationImpact } from '../hooks/useUpdatePopulationImpact.js';
import ImpactFields from './impactFields.jsx';

const textOf = (value) => (value === null || value === undefined ? '' : String(value));

// Edita la población afectada de una zona (p. ej. una registrada sin ella): solo cambian los datos que se escriban.
export default function ImpactDialog({ zone, onClose, onSaved }) {
  const { t } = useTranslation('emergencyManagement');
  const update = useUpdatePopulationImpact();
  const [impact, setImpact] = useState(() => Object.fromEntries(IMPACT_FIELDS.map((field) => [field, textOf(zone.values?.[field])])));
  const [error, setError] = useState(null);
  const closeRef = useRef(null);

  useEffect(() => { closeRef.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = (event) => {
    event.preventDefault();
    setError(null);
    update.mutate(
      { zoneId: zone.id, impact },
      {
        onSuccess: () => onSaved(zone),
        onError: (failure) => setError(t('gisMap.errors.' + failure.message, { defaultValue: failure.detail ?? t('gisMap.errors.generic') })),
      },
    );
  };

  return (
    <>
      <div className="gm-backdrop" onClick={onClose} />
      <form className="gm-dialog" role="dialog" aria-modal="true" aria-labelledby="gm-impact" onSubmit={submit} noValidate>
        <h2 id="gm-impact">{t('gisMap.dialog.impactTitle', { name: zone.name })}</h2>
        <p className="gm-note">{t('gisMap.dialog.impactIntro')}</p>
        <ImpactFields values={impact} onChange={setImpact} />
        {error && <p className="gm-error" role="alert">{error}</p>}
        <div className="gm-dialog__actions">
          <button type="button" ref={closeRef} className="gm-btn-outline" onClick={onClose}>{t('gisMap.dialog.cancel')}</button>
          <button type="submit" className="gm-btn-lime" disabled={update.isPending}>{update.isPending ? t('gisMap.dialog.saving') : t('gisMap.dialog.save')}</button>
        </div>
      </form>
    </>
  );
}
