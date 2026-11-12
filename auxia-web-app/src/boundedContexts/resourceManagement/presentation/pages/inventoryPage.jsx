import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePermissions } from '@bc/identityAccess/presentation/hooks/usePermissions.js';
import { CategoryFilter, byUrgency, countByCategory, filterByCategory, mostUrgentAlert } from '../../domain/services/stockSummary.js';
import { useInventory } from '../hooks/useInventory.js';
import { useStockAlerts } from '../hooks/useStockAlerts.js';
import { useCreateInventory } from '../hooks/useCreateInventory.js';
import StockCards from '../components/stockCards.jsx';
import StockTable from '../components/stockTable.jsx';
import AlertsPanel from '../components/alertsPanel.jsx';
import StockDialog from '../components/stockDialog.jsx';
import NewResourceDialog from '../components/newResourceDialog.jsx';
import { inventoryErrorMessage, quantity } from '../utils/stockFormat.js';
import '../styles/inventory.css';

export default function InventoryPage() {
  const { t, i18n } = useTranslation('resourceManagement');
  const lng = i18n.resolvedLanguage;
  const { isAdmin } = usePermissions();            // solo el administrador de la organización modifica el stock

  const inventoryQuery = useInventory();
  const inventory = inventoryQuery.data ?? null;
  const [alertStatus, setAlertStatus] = useState('OPEN');
  const openAlerts = useStockAlerts(inventory?.id, 'OPEN');
  const shownAlerts = useStockAlerts(inventory?.id, alertStatus);
  const createInventory = useCreateInventory();

  const [category, setCategory] = useState(CategoryFilter.ALL);
  const [dialog, setDialog] = useState(null);      // { type: 'in' | 'out' | 'new', resourceId? }
  const alertsRef = useRef(null);

  const resources = useMemo(() => [...(inventory?.resources ?? [])].sort(byUrgency), [inventory]);
  const counts = useMemo(() => countByCategory(resources), [resources]);
  const visible = useMemo(() => filterByCategory(resources, category), [resources, category]);
  const urgent = useMemo(() => mostUrgentAlert(openAlerts.data ?? [], resources), [openAlerts.data, resources]);
  const urgentResource = urgent ? resources.find((resource) => resource.id === urgent.resourceId) : null;

  const loading = inventoryQuery.isLoading;
  const close = () => setDialog(null);
  const showAlerts = () => {
    setAlertStatus('OPEN');
    alertsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    alertsRef.current?.focus({ preventScroll: true });
  };
  const disabled = !inventory || resources.length === 0;

  return (
    <div className="iv">
      <header className="iv-head">
        <div>
          <h1>{t('inventory.title')}</h1>
          <p>{t('inventory.subtitle')}</p>
        </div>
        <div className="iv-head__actions">
          <span className="iv-warehouse" title={t('inventory.warehouse')}>{inventory?.name ?? t('inventory.warehouse')}</span>
          {isAdmin && (
            <>
              <button type="button" className="iv-btn-outline" disabled={disabled} onClick={() => setDialog({ type: 'out' })}>{t('inventory.actions.out')}</button>
              <button type="button" className="iv-btn-lime" disabled={disabled} onClick={() => setDialog({ type: 'in' })}>{t('inventory.actions.in')}</button>
            </>
          )}
        </div>
      </header>

      {inventoryQuery.isError && (
        <p className="iv-alert-banner" role="alert">
          {inventoryQuery.error?.detail ?? t('inventory.loadError')} <button type="button" className="iv-link-btn" onClick={() => inventoryQuery.refetch()}>{t('inventory.retry')}</button>
        </p>
      )}

      {urgent && (
        <p className="iv-banner" role="status">
          <span className="iv-dot" aria-hidden="true" />
          <span>
            {t('inventory.banner', {
              name: urgent.resourceName ?? urgentResource?.name ?? '—',
              available: quantity(urgent.available ?? urgentResource?.available ?? 0, urgentResource?.unit ?? '', lng),
              minimum: quantity(urgent.minimumStock ?? urgentResource?.minimumStock ?? 0, '', lng),
            })}
          </span>
          <button type="button" className="iv-link-btn" onClick={showAlerts}>{t('inventory.viewAlerts')}</button>
        </p>
      )}

      {!loading && !inventoryQuery.isError && !inventory && (
        <section className="iv-card-panel iv-setup">
          <h2 className="iv-h2">{t('inventory.setup.title')}</h2>
          <p className="iv-note">{t(isAdmin ? 'inventory.setup.admin' : 'inventory.setup.other')}</p>
          {isAdmin && (
            <>
              <button type="button" className="iv-btn-lime" disabled={createInventory.isPending} onClick={() => createInventory.mutate()}>
                {createInventory.isPending ? t('inventory.form.saving') : t('inventory.setup.create')}
              </button>
              {createInventory.error && <p className="iv-error" role="alert">{inventoryErrorMessage(t, createInventory.error)}</p>}
            </>
          )}
        </section>
      )}

      {(loading || inventory) && (
        <>
          <StockCards resources={resources.slice(0, 8)} loading={loading} />
          {!loading && resources.length === 0 && (
            <section className="iv-card-panel iv-setup">
              <h2 className="iv-h2">{t('inventory.noResources.title')}</h2>
              <p className="iv-note">{t(isAdmin ? 'inventory.noResources.admin' : 'inventory.noResources.other')}</p>
            </section>
          )}

          <div className="iv-grid">
            <section className="iv-card-panel" aria-labelledby="iv-stock-title">
              <header className="iv-panel__head">
                <h2 id="iv-stock-title" className="iv-h2">{t('inventory.table.title')}</h2>
                {isAdmin && inventory && (
                  <button type="button" className="iv-btn-outline iv-btn-sm" onClick={() => setDialog({ type: 'new' })}>{t('inventory.actions.newResource')}</button>
                )}
              </header>
              <div className="iv-tabs" role="group" aria-label={t('inventory.table.filter')}>
                {Object.values(CategoryFilter).map((value) => (
                  <button key={value} type="button" className="iv-tab" aria-pressed={category === value} onClick={() => setCategory(value)}>
                    {t('inventory.categories.' + value)} <span className="iv-tab__count">{counts[value] ?? 0}</span>
                  </button>
                ))}
              </div>
              <StockTable
                resources={visible} loading={loading} canManage={isAdmin}
                onRestock={(resourceId) => setDialog({ type: 'in', resourceId })}
                onWithdraw={(resourceId) => setDialog({ type: 'out', resourceId })}
              />
            </section>

            <AlertsPanel
              status={alertStatus} onStatus={setAlertStatus} alerts={shownAlerts.data ?? []} resources={resources}
              loading={shownAlerts.isLoading} error={shownAlerts.error} canManage={isAdmin}
              onRestock={(resourceId) => setDialog({ type: 'in', resourceId })} panelRef={alertsRef}
            />
          </div>
        </>
      )}

      {dialog && dialog.type !== 'new' && (
        <StockDialog mode={dialog.type} inventoryId={inventory.id} resources={resources} resourceId={dialog.resourceId} onClose={close} />
      )}
      {dialog?.type === 'new' && <NewResourceDialog inventoryId={inventory.id} onClose={close} />}
    </div>
  );
}
