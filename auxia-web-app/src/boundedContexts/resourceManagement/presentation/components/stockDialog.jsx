import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRestockResource } from '../hooks/useRestockResource.js';
import { useWithdrawStock } from '../hooks/useWithdrawStock.js';
import { inventoryErrorMessage, quantity } from '../utils/stockFormat.js';

// mode 'in': registrar entrada (ingreso). mode 'out': registrar salida (ajuste negativo con motivo).
export default function StockDialog({ mode, inventoryId, resources, resourceId, onClose }) {
  const { t, i18n } = useTranslation('resourceManagement');
  const lng = i18n.resolvedLanguage;
  const isOut = mode === 'out';
  const [selected, setSelected] = useState(resourceId ?? resources[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const restock = useRestockResource();
  const withdraw = useWithdrawStock();
  const mutation = isOut ? withdraw : restock;
  const firstRef = useRef(null);
  const resource = resources.find((item) => item.id === selected) ?? null;

  useEffect(() => {
    firstRef.current?.focus();
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = (event) => {
    event.preventDefault();
    if (isOut) withdraw.mutate({ inventoryId, resource, quantity: amount, reason }, { onSuccess: onClose });
    else restock.mutate({ inventoryId, resourceId: selected, quantity: amount }, { onSuccess: onClose });
  };
  const message = inventoryErrorMessage(t, mutation.error);

  return (
    <>
      <div className="iv-backdrop" onClick={onClose} aria-hidden="true" />
      <form className="iv-dialog" role="dialog" aria-modal="true" aria-labelledby="iv-dialog-title" onSubmit={submit} noValidate>
        <h2 id="iv-dialog-title" className="iv-h2">{t(isOut ? 'inventory.out.title' : 'inventory.in.title')}</h2>
        <p className="iv-note">{t(isOut ? 'inventory.out.hint' : 'inventory.in.hint')}</p>

        <label className="iv-field">
          <span>{t('inventory.form.resource')}</span>
          <select ref={firstRef} value={selected} onChange={(event) => setSelected(event.target.value)}>
            {resources.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        {resource && (
          <p className="iv-note">
            {t('inventory.form.current', { onHand: quantity(resource.onHand, resource.unit, lng), available: quantity(resource.available, resource.unit, lng) })}
          </p>
        )}
        <label className="iv-field">
          <span>{t('inventory.form.quantity')}{resource?.unit ? ' (' + resource.unit + ')' : ''}</span>
          <input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="0" />
        </label>
        {isOut && (
          <label className="iv-field">
            <span>{t('inventory.form.reason')}</span>
            <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder={t('inventory.form.reasonPlaceholder')} />
          </label>
        )}

        {message && <p className="iv-error" role="alert">{message}</p>}
        <div className="iv-dialog__actions">
          <button type="submit" className="iv-btn-lime" disabled={mutation.isPending}>
            {mutation.isPending ? t('inventory.form.saving') : t(isOut ? 'inventory.out.submit' : 'inventory.in.submit')}
          </button>
          <button type="button" className="iv-btn-outline" onClick={onClose} disabled={mutation.isPending}>{t('inventory.form.cancel')}</button>
        </div>
      </form>
    </>
  );
}
