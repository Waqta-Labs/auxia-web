import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { stockCategories } from '../../domain/enums/stockCategory.js';
import { useRegisterResource } from '../hooks/useRegisterResource.js';
import { categoryLabel, inventoryErrorMessage } from '../utils/stockFormat.js';

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
        <label className="iv-field"><span>{t('inventory.new.name')}</span><input ref={nameRef} value={values.name} onChange={change('name')} /></label>
        <label className="iv-field">
          <span>{t('inventory.new.category')}</span>
          <select value={values.category} onChange={change('category')}>
            <option value="">{t('inventory.new.categoryPlaceholder')}</option>
            {stockCategories.map((category) => <option key={category} value={category}>{categoryLabel(t, category)}</option>)}
          </select>
        </label>
        <div className="iv-field-row">
          <label className="iv-field"><span>{t('inventory.new.unit')}</span><input value={values.unit} onChange={change('unit')} placeholder={t('inventory.new.unitPlaceholder')} /></label>
          <label className="iv-field"><span>{t('inventory.new.minimum')}</span><input value={values.minimumStock} onChange={change('minimumStock')} inputMode="decimal" placeholder="0" /></label>
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
