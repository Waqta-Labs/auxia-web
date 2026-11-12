import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { formatDateTime } from '@shared/utils/formatters.js';
import { quantity } from '../utils/stockFormat.js';

// Vista previa de las alertas abiertas (las más urgentes). El detalle completo está en la pantalla de Alertas.
export default function AlertsPanel({ alerts, total, resources, loading, error, canManage, onRestock, viewAllTo, limit = 3 }) {
  const { t, i18n } = useTranslation('resourceManagement');
  const lng = i18n.resolvedLanguage;
  const byId = new Map(resources.map((resource) => [resource.id, resource]));
  const shown = alerts.slice(0, limit);

  return (
    <section className="iv-card-panel" aria-labelledby="iv-alerts-title">
      <header className="iv-panel__head">
        <h2 id="iv-alerts-title" className="iv-h2">{t('inventory.alerts.title')}</h2>
        {total > 0 && <span className="iv-count">{total}</span>}
      </header>

      {loading && <span className="iv-skel iv-skel--tall" />}
      {error && <p className="iv-error" role="alert">{error.detail ?? t('inventory.alerts.loadError')}</p>}
      {!loading && !error && shown.length === 0 && <p className="iv-empty">{t('inventory.alerts.empty.OPEN')}</p>}

      <ul className="iv-alerts">
        {shown.map((alert) => {
          const resource = byId.get(alert.resourceId);
          const name = alert.resourceName ?? resource?.name ?? '—';
          const unit = resource?.unit ?? '';
          const available = resource?.available ?? alert.available;
          const minimum = resource?.minimumStock ?? alert.minimumStock;
          return (
            <li key={alert.id} className="iv-alert">
              <div className="iv-alert__row">
                <strong>{name}</strong>
                {canManage && resource && (
                  <button type="button" className="iv-btn-outline iv-btn-sm" onClick={() => onRestock(alert.resourceId)}>{t('inventory.alerts.restock')}</button>
                )}
              </div>
              {available !== null && available !== undefined && minimum !== null && minimum !== undefined && (
                <p className="iv-alert__warn">{t('inventory.alerts.detail', { available: quantity(available, unit, lng), minimum: quantity(minimum, '', lng) })}</p>
              )}
              <small>{t('inventory.alerts.raised', { date: alert.raisedAt ? formatDateTime(alert.raisedAt, lng) : '—' })}</small>
            </li>
          );
        })}
      </ul>

      <Link to={viewAllTo} className="iv-viewall">
        {total > shown.length ? t('inventory.alerts.viewAll', { count: total }) : t('inventory.alerts.viewDetail')} <span aria-hidden="true">→</span>
      </Link>
    </section>
  );
}
