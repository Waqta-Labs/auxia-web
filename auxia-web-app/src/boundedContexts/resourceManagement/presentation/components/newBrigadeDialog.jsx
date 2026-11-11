import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCreateBrigade } from '../hooks/useCreateBrigade.js';
import { brigadeErrorMessage } from '../utils/brigadeFormat.js';

export default function NewBrigadeDialog({ onClose, onCreated }) {
  const { t } = useTranslation('resourceManagement');
  const [values, setValues] = useState({ name: '', code: '', latitude: '', longitude: '' });
  const mutation = useCreateBrigade();
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
    mutation.mutate(values, { onSuccess: (id) => onCreated(id) });
  };
  const message = brigadeErrorMessage(t, mutation.error);

  return (
    <>
      <div className="fl-backdrop" onClick={onClose} aria-hidden="true" />
      <form className="fl-dialog" role="dialog" aria-modal="true" aria-labelledby="fl-new-title" onSubmit={submit} noValidate>
        <h2 id="fl-new-title" className="fl-h2">{t('brigades.new.title')}</h2>
        <p className="fl-note">{t('brigades.new.hint')}</p>

        <label className="fl-field">
          <span>{t('brigades.new.name')}</span>
          <input ref={nameRef} value={values.name} onChange={change('name')} />
        </label>
        <label className="fl-field">
          <span>{t('brigades.new.code')}</span>
          <input value={values.code} onChange={change('code')} placeholder={t('brigades.new.codePlaceholder')} />
        </label>
        <div className="fl-field-row">
          <label className="fl-field">
            <span>{t('brigades.new.latitude')}</span>
            <input value={values.latitude} onChange={change('latitude')} inputMode="decimal" placeholder="-11.9367" />
          </label>
          <label className="fl-field">
            <span>{t('brigades.new.longitude')}</span>
            <input value={values.longitude} onChange={change('longitude')} inputMode="decimal" placeholder="-76.7012" />
          </label>
        </div>

        {message && <p className="fl-error" role="alert">{message}</p>}
        <div className="fl-actions">
          <button type="submit" className="fl-btn-lime" disabled={mutation.isPending}>
            {mutation.isPending ? t('brigades.new.saving') : t('brigades.new.create')}
          </button>
          <button type="button" className="fl-btn-outline" onClick={onClose} disabled={mutation.isPending}>
            {t('brigades.new.cancel')}
          </button>
        </div>
      </form>
    </>
  );
}
