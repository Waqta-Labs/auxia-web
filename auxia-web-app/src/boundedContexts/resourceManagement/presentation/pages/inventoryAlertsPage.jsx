import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { routes } from '@app/router/routes.js';
import { usePermissions } from '@bc/identityAccess/presentation/hooks/usePermissions.js';
import Breadcrumb from '@shared/presentation/components/breadcrumb.jsx';
import { formatDateTime } from '@shared/utils/formatters.js';
import { sortAlertsByUrgency } from '../../domain/services/stockSummary.js';
import { useInventory } from '../hooks/useInventory.js';
import { useStockAlerts } from '../hooks/useStockAlerts.js';
import StockDialog from '../components/stockDialog.jsx';
import { categoryLabel, elapsed, levelLabel, quantity } from '../utils/stockFormat.js';
import '../styles/inventory.css';

// Pantalla de Alertas de desabastecimiento: cada alerta con sus cantidades, lo que falta y desde cuándo.
export default function InventoryAlertsPage() {
  const { t, i18n } = useTranslation('resourceManagement');
  const lng = i18n.resolvedLanguage;
  const { isAdmin } = usePermissions();
  const inventoryQuery = useInventory();
  const inventory = inventoryQuery.data ?? null;
  const open = useStockAlerts(inventory?.id, 'OPEN');
  const resolved = useStockAlerts(inventory?.id, 'RESOLVED');
  const [status, setStatus] = useState('OPEN');
  const [restockId, setRestockId] = useState(null);

  const resources = useMemo(() => inventory?.resources ?? [], [inventory]);
  const byId = useMemo(() => new Map(resources.map((resource) => [resource.id, resource])), [resources]);
  const openList = useMemo(() => sortAlertsByUrgency(open.data ?? [], resources), [open.data, resources]);
  const resolvedList = resolved.data ?? [];
  const list = status === 'OPEN' ? openList : resolvedList;
  const query = status === 'OPEN' ? open : resolved;
  const criticalCount = openList.filter((alert) => byId.get(alert.resourceId)?.level === 'CRITICAL').length;

  return (
    <div className="iv">
      <Breadcrumb
        label={t('inventory.breadcrumb.label')}
        items={[{ label: t('inventory.title'), to: routes.inventory }, { label: t('inventory.alertsPage.title') }]}
      />
      <header className="iv-head">
        <div>
          <h1>{t('inventory.alertsPage.title')}</h1>
          <p>{t('inventory.alertsPage.subtitle')}</p>
        </div>
      </header>

      <ul className="iv-stats" aria-label={t('inventory.alertsPage.summary')}>
        <li><span>{openList.length}</span><small>{t('inventory.alertsPage.open')}</small></li>
        <li className="is-critical"><span>{criticalCount}</span><small>{t('inventory.alertsPage.critical')}</small></li>
        <li><span>{resolvedList.length}</span><small>{t('inventory.alertsPage.resolved')}</small></li>
      </ul>

      <div className="iv-tabs" role="group" aria-label={t('inventory.alerts.filter')}>
        {['OPEN', 'RESOLVED'].map((value) => (
          <button key={value} type="button" className="iv-tab" aria-pressed={status === value} onClick={() => setStatus(value)}>
            {t('inventory.alerts.status.' + value)} <span className="iv-tab__count">{value === 'OPEN' ? openList.length : resolvedList.length}</span>
          </button>
        ))}
      </div>

      {(inventoryQuery.isLoading || query.isLoading) && <div className="iv-alert-cards"><span className="iv-skel iv-skel--card" /><span className="iv-skel iv-skel--card" /></div>}
      {(inventoryQuery.isError || query.isError) && (
        <p className="iv-alert-banner" role="alert">{(inventoryQuery.error ?? query.error)?.detail ?? t('inventory.alerts.loadError')}</p>
      )}
      {!query.isLoading && !query.isError && list.length === 0 && <p className="iv-empty">{t('inventory.alerts.empty.' + status)}</p>}

      <ul className="iv-alert-cards">
        {list.map((alert) => {
          const resource = byId.get(alert.resourceId);
          const isOpen = alert.isOpen;
          const unit = resource?.unit ?? '';
          // Abierta: se muestran las cantidades de hoy; resuelta: las del momento de la alerta.
          const available = (isOpen ? resource?.available : alert.available) ?? alert.available ?? resource?.available ?? 0;
          const minimum = (isOpen ? resource?.minimumStock : alert.minimumStock) ?? alert.minimumStock ?? resource?.minimumStock ?? 0;
          const missing = Math.max(0, minimum - available);
          const ratio = minimum > 0 ? Math.min(1, Math.max(0, available / minimum)) : 1;
          const level = resource?.level ?? 'LOW';
          return (
            <li key={alert.id} className={'iv-alert-card' + (isOpen ? ' iv-alert-card--' + level.toLowerCase() : ' is-resolved')}>
              <header>
                <div>
                  <h2>{alert.resourceName ?? resource?.name ?? '—'}</h2>
                  <span className="iv-card__cat">{categoryLabel(t, resource?.category)}</span>
                </div>
                {isOpen
                  ? <span className={'iv-chip iv-chip--' + level.toLowerCase()}>{levelLabel(t, level)}</span>
                  : <span className="iv-chip iv-chip--ok">{t('inventory.alerts.status.RESOLVED')}</span>}
              </header>

              <div className="iv-bar" role="img" aria-label={Math.round(ratio * 100) + '%'}><span style={{ width: Math.round(ratio * 100) + '%' }} /></div>
              <dl className="iv-alert-card__facts">
                <div><dt>{t('inventory.table.available')}</dt><dd>{quantity(available, unit, lng)}</dd></div>
                <div><dt>{t('inventory.table.minimum')}</dt><dd>{quantity(minimum, unit, lng)}</dd></div>
                <div><dt>{t(isOpen ? 'inventory.alertsPage.missing' : 'inventory.table.reserved')}</dt><dd>{isOpen ? quantity(missing, unit, lng) : quantity(resource?.reserved ?? 0, unit, lng)}</dd></div>
              </dl>

              <footer>
                <p>
                  {t('inventory.alertsPage.raisedOn', { date: alert.raisedAt ? formatDateTime(alert.raisedAt, lng) : '—' })}
                  {isOpen && alert.raisedAt && <strong> · {elapsed(alert.raisedAt, lng)}</strong>}
                </p>
                {!isOpen && alert.resolvedAt && <p>{t('inventory.alerts.resolved', { date: formatDateTime(alert.resolvedAt, lng) })}</p>}
                {isOpen && isAdmin && resource && (
                  <button type="button" className="iv-btn-lime iv-btn-sm" onClick={() => setRestockId(resource.id)}>{t('inventory.alerts.restock')}</button>
                )}
              </footer>
            </li>
          );
        })}
      </ul>

      {restockId && inventory && <StockDialog mode="in" inventoryId={inventory.id} resources={resources} resourceId={restockId} onClose={() => setRestockId(null)} />}
    </div>
  );
}
