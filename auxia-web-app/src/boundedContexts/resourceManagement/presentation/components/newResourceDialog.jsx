import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { stockCategories, stockUnits } from '../../domain/enums/stockCategory.js';
import { useRegisterResource } from '../hooks/useRegisterResource.js';
import { categoryLabel, inventoryErrorMessage, unitLabel } from '../utils/stockFormat.js';

export default function NewResourceDialog({ inventoryId, onClose }) {
  const { t } = useTranslation('resourceManagement');
  const [values, setValues] = useState({ name: '', category: '', unit: '', minimumStock: '' });
  const mutation = useRegisterResource();
  const nameRef = useRef(null);

  useEffect(() => {
    nameRef.current?.focus();
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const change = (key) => (event) => setValues((current) => ({ ...current, [key]: event.target.value }));
  const submit = (event) => {
    event.preventDefault();
    mutation.mutate({ inventoryId, ...values }, { onSuccess: onClose });
  };
  const message = inventoryErrorMessage(t, mutation.error);

  return (
    <>
      <div className="iv-backdrop" onClick={onClose} aria-hidden="true" />
      <form className="iv-dialog" role="dialog" aria-modal="true" aria-labelledby="iv-new-title" onSubmit={submit} noValidate>
        <h2 id="iv-new-title" className="iv-h2">{t('inventory.new.title')}</h2>
        <p className="iv-note">{t('inventory.new.hint')}</p>
        <label className="iv-field"><span>{t('inventory.new.name')}</span><input ref={nameRef} value={values.name} onChange={change('name')} maxLength={150} /></label>
        <label className="iv-field">
          <span>{t('inventory.new.category')}</span>
          <select value={values.category} onChange={change('category')}>
            <option value="">{t('inventory.new.categoryPlaceholder')}</option>
            {stockCategories.map((category) => <option key={category} value={category}>{categoryLabel(t, category)}</option>)}
          </select>
        </label>
        <div className="iv-field-row">
          <label className="iv-field">
            <span>{t('inventory.new.unit')}</span>
            <select value={values.unit} onChange={change('unit')}>
              <option value="">{t('inventory.new.unitPlaceholder')}</option>
              {stockUnits.map((unit) => <option key={unit} value={unit}>{unitLabel(t, unit)}</option>)}
            </select>
          </label>
          <label className="iv-field"><span>{t('inventory.new.minimum')}</span><input value={values.minimumStock} onChange={change('minimumStock')} inputMode="numeric" placeholder="0" /></label>
        </div>
        {message && <p className="iv-error" role="alert">{message}</p>}
        <div className="iv-dialog__actions">
          <button type="submit" className="iv-btn-lime" disabled={mutation.isPending}>{mutation.isPending ? t('inventory.form.saving') : t('inventory.new.submit')}</button>
          <button type="button" className="iv-btn-outline" onClick={onClose} disabled={mutation.isPending}>{t('inventory.form.cancel')}</button>
        </div>
      </form>
    </>
  );
}
