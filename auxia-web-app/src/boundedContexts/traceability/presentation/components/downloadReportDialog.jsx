import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useExportDeliveryReport } from '../hooks/useExportDeliveryReport.js';
import { buildExportLabels, exportErrorMessage } from '../utils/exportLabels.js';

// Modal de descarga. scope 'table': informe de todas las entregas (rango de fechas opcional).
// scope 'delivery': informe de una sola entrega (sin rango).
export default function DownloadReportDialog({ scope, deliveries = [], detail = null, zoneName = null, onClose }) {
  const { t } = useTranslation('traceability');
  const [format, setFormat] = useState('pdf');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const mutation = useExportDeliveryReport();
  const firstRef = useRef(null);
  const isTable = scope === 'table';

  useEffect(() => {
    firstRef.current?.focus();
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = (event) => {
    event.preventDefault();
    mutation.mutate({
      scope, format, from: from || null, to: to || null, deliveries, detail, zoneName,
      labels: buildExportLabels(t), verifyBaseUrl: window.location.origin + '/public/verify/',
    }, { onSuccess: onClose });
  };

  const message = exportErrorMessage(t, mutation.error);
  const formats = [
    { value: 'pdf', title: t('export.formats.pdf'), hint: t(isTable ? 'export.formats.pdfHint' : 'export.formats.pdfDeliveryHint') },
    { value: 'xlsx', title: t('export.formats.xlsx'), hint: t(isTable ? 'export.formats.xlsxHint' : 'export.formats.xlsxDeliveryHint') },
  ];

  return (
    <>
      <div className="tl-backdrop" onClick={onClose} aria-hidden="true" />
      <form className="tl-dialog" role="dialog" aria-modal="true" aria-labelledby="tl-export-title" onSubmit={submit} noValidate>
        <h2 id="tl-export-title" className="tl-h2">{t(isTable ? 'export.titleTable' : 'export.titleDelivery')}</h2>
        {!isTable && zoneName && <p className="tl-sub">{zoneName}</p>}

        <fieldset className="tl-formats">
          <legend className="tl-label">{t('export.format')}</legend>
          {formats.map((option, index) => (
            <label key={option.value} className={'tl-format' + (format === option.value ? ' is-selected' : '')}>
              <input
                ref={index === 0 ? firstRef : null} type="radio" name="format" value={option.value}
                checked={format === option.value} onChange={() => setFormat(option.value)}
              />
              <span><strong>{option.title}</strong><small>{option.hint}</small></span>
            </label>
          ))}
        </fieldset>

        {isTable && (
          <fieldset className="tl-range">
            <legend className="tl-label">{t('export.range')}</legend>
            <div className="tl-range__row">
              <label className="tl-field"><span>{t('export.from')}</span><input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} /></label>
              <label className="tl-field"><span>{t('export.to')}</span><input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} /></label>
            </div>
            <p className="tl-note">{t('export.rangeHint')}</p>
          </fieldset>
        )}

        {message && <p className="tl-error" role="alert">{message}</p>}
        <div className="tl-dialog__actions">
          <button type="submit" className="tl-btn-lime" disabled={mutation.isPending}>
            {mutation.isPending ? t('export.generating') : t('export.download')}
          </button>
          <button type="button" className="tl-btn-outline" onClick={onClose} disabled={mutation.isPending}>{t('export.cancel')}</button>
        </div>
      </form>
    </>
  );
}
