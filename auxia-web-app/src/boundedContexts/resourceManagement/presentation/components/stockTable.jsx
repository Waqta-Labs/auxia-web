import { useTranslation } from 'react-i18next';
import { categoryLabel, levelLabel, quantity } from '../utils/stockFormat.js';

// Entrada: bandeja con flecha hacia adentro. Salida: bandeja con flecha hacia afuera.
const ICONS = {
  in: <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />,
  out: <path d="M12 15V3m0 0L8 7m4-4l4 4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />,
};

function ActionIcon({ kind, label, onClick }) {
  return (
    <button type="button" className={'iv-icon-btn iv-icon-btn--' + kind} onClick={onClick} aria-label={label} title={label}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {ICONS[kind]}
      </svg>
    </button>
  );
}

export default function StockTable({ resources, loading, canManage, onRestock, onWithdraw }) {
  const { t, i18n } = useTranslation('resourceManagement');
  const lng = i18n.resolvedLanguage;

  if (loading) return <div className="iv-rows">{[0, 1, 2, 3].map((i) => <span key={i} className="iv-skel" />)}</div>;
  if (resources.length === 0) return <p className="iv-empty">{t('inventory.table.empty')}</p>;

  return (
    <div className="iv-table-wrap">
      <table className="iv-table">
        <thead>
          <tr>
            <th scope="col">{t('inventory.table.resource')}</th>
            <th scope="col">{t('inventory.table.category')}</th>
            <th scope="col" className="is-num">{t('inventory.table.onHand')}</th>
            <th scope="col" className="is-num">{t('inventory.table.reserved')}</th>
            <th scope="col" className="is-num">{t('inventory.table.available')}</th>
            <th scope="col" className="is-num">{t('inventory.table.minimum')}</th>
            <th scope="col">{t('inventory.table.status')}</th>
            {canManage && <th scope="col" className="is-actions">{t('inventory.table.actions')}</th>}
          </tr>
        </thead>
        <tbody>
          {resources.map((resource) => (
            <tr key={resource.id}>
              <th scope="row">{resource.name}</th>
              <td>{categoryLabel(t, resource.category)}</td>
              <td className="is-num">{quantity(resource.onHand, resource.unit, lng)}</td>
              <td className="is-num">{quantity(resource.reserved, '', lng)}</td>
              <td className="is-num"><strong>{quantity(resource.available, resource.unit, lng)}</strong></td>
              <td className="is-num">{quantity(resource.minimumStock, '', lng)}</td>
              <td><span className={'iv-chip iv-chip--' + resource.level.toLowerCase()}>{levelLabel(t, resource.level)}</span></td>
              {canManage && (
                <td className="is-actions">
                  <div className="iv-actions">
                    <ActionIcon kind="in" label={t('inventory.table.inFor', { name: resource.name })} onClick={() => onRestock(resource.id)} />
                    <ActionIcon kind="out" label={t('inventory.table.outFor', { name: resource.name })} onClick={() => onWithdraw(resource.id)} />
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
