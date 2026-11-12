import { useState } from 'react';
import { useTranslation } from 'react-i18next';

// Una huella digital (hash) en un panel con botón de copiar.
export default function HashPanel({ label, value, tone }) {
  const { t } = useTranslation('citizenTransparency');
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className={'vd-hash' + (tone ? ' vd-hash--' + tone : '')}>
      <span className="vd-hash__label">{label}</span>
      <code className="vd-hash__value">{value ?? '—'}</code>
      {value && (
        <button type="button" className="vd-hash__copy" onClick={copy}>{copied ? t('verifyDelivery.copied') : t('verifyDelivery.copy')}</button>
      )}
    </div>
  );
}
