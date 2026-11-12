import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { routes } from '@app/router/routes.js';
import Breadcrumb from '@shared/presentation/components/breadcrumb.jsx';
import { CategoryFilter, byUrgency, countByCategory, filterByCategory } from '../../domain/services/stockSummary.js';
import { useInventory } from '../hooks/useInventory.js';
import StockCards from '../components/stockCards.jsx';
import '../styles/inventory.css';

// Todos los recursos del inventario como tarjetas, con búsqueda y filtro por categoría.
export default function InventoryResourcesPage() {
  const { t } = useTranslation('resourceManagement');
  const inventoryQuery = useInventory();
  const [category, setCategory] = useState(CategoryFilter.ALL);
  const [search, setSearch] = useState('');

  const resources = useMemo(() => [...(inventoryQuery.data?.resources ?? [])].sort(byUrgency), [inventoryQuery.data]);
  const counts = useMemo(() => countByCategory(resources), [resources]);
  const visible = useMemo(() => {
    const text = search.trim().toLowerCase();
    return filterByCategory(resources, category).filter((resource) => !text || resource.name.toLowerCase().includes(text));
  }, [resources, category, search]);

  return (
    <div className="iv">
      <Breadcrumb
        label={t('inventory.breadcrumb.label')}
        items={[{ label: t('inventory.title'), to: routes.inventory }, { label: t('inventory.resourcesPage.title') }]}
      />
      <header className="iv-head">
        <div>
          <h1>{t('inventory.resourcesPage.title')}</h1>
          <p>{t('inventory.resourcesPage.subtitle', { count: resources.length })}</p>
        </div>
        <label className="iv-search">
          <span className="iv-sr">{t('inventory.resourcesPage.search')}</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('inventory.resourcesPage.search')} />
        </label>
      </header>

      <div className="iv-tabs" role="group" aria-label={t('inventory.table.filter')}>
        {Object.values(CategoryFilter).map((value) => (
          <button key={value} type="button" className="iv-tab" aria-pressed={category === value} onClick={() => setCategory(value)}>
            {t('inventory.categories.' + value)} <span className="iv-tab__count">{counts[value] ?? 0}</span>
          </button>
        ))}
      </div>

      {inventoryQuery.isError && <p className="iv-alert-banner" role="alert">{inventoryQuery.error?.detail ?? t('inventory.loadError')}</p>}
      <StockCards resources={visible} loading={inventoryQuery.isLoading} />
      {!inventoryQuery.isLoading && !inventoryQuery.isError && visible.length === 0 && <p className="iv-empty">{t('inventory.table.empty')}</p>}
    </div>
  );
}
