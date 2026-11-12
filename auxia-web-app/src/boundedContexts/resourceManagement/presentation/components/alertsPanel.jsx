import { useTranslation } from 'react-i18next';
import { formatDateTime } from '@shared/utils/formatters.js';
import { quantity } from '../utils/stockFormat.js';

export default function AlertsPanel({ status, onStatus, alerts, resources, loading, error, canManage, onRestock, panelRef }) {
  const { t, i18n } = useTranslation('resourceManagement');
  const lng = i18n.resolvedLanguage;
  const byId = new Map(resources.map((resource) => [resource.id, resource]));

  return (
    <section className="iv-card-panel" aria-labelledby="iv-alerts-title" ref={panelRef} tabIndex={-1}>
      <header className="iv-panel__head">
        <h2 id="iv-alerts-title" className="iv-h2">{t('inventory.alerts.title')}</h2>
        <div className="iv-tabs" role="group" aria-label={t('inventory.alerts.filter')}>
          {['OPEN', 'RESOLVED'].map((value) => (
            <button key={value} type="button" className="iv-tab" aria-pressed={status === value} onClick={() => onStatus(value)}>
              {t('inventory.alerts.status.' + value)}
            </button>
          ))}
        </div>
      </header>

      {loading && <span className="iv-skel iv-skel--tall" />}
      {error && <p className="iv-error" role="alert">{error.detail ?? t('inventory.alerts.loadError')}</p>}
      {!loading && !error && alerts.length === 0 && <p className="iv-empty">{t('inventory.alerts.empty.' + status)}</p>}

      <ul className="iv-alerts">
        {alerts.map((alert) => {
          const resource = byId.get(alert.resourceId);
          const name = alert.resourceName ?? resource?.name ?? '—';
          const unit = resource?.unit ?? '';
          const available = alert.available ?? resource?.available;
          const minimum = alert.minimumStock ?? resource?.minimumStock;
          return (
            <li key={alert.id} className={'iv-alert' + (alert.isOpen ? '' : ' is-resolved')}>
              <strong>{name}</strong>
              {available !== null && available !== undefined && minimum !== null && minimum !== undefined && (
                <p className={alert.isOpen ? 'iv-alert__warn' : ''}>
                  {t('inventory.alerts.detail', { available: quantity(available, unit, lng), minimum: quantity(minimum, '', lng) })}
                </p>
              )}
              <small>
                {alert.isOpen
                  ? t('inventory.alerts.raised', { date: alert.raisedAt ? formatDateTime(alert.raisedAt, lng) : '—' })
                  : t('inventory.alerts.resolved', { date: alert.resolvedAt ? formatDateTime(alert.resolvedAt, lng) : '—' })}
              </small>
              {alert.isOpen && canManage && resource && (
                <button type="button" className="iv-btn-outline" onClick={() => onRestock(alert.resourceId)}>{t('inventory.alerts.restock')}</button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
