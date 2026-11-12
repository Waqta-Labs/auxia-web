import { useTranslation } from 'react-i18next';
import { categoryLabel, levelLabel, quantity } from '../utils/stockFormat.js';

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
            {canManage && <th scope="col"><span className="iv-sr">{t('inventory.table.actions')}</span></th>}
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
                <td className="iv-actions">
                  <button type="button" className="iv-link-btn" onClick={() => onRestock(resource.id)}>{t('inventory.table.in')}</button>
                  <button type="button" className="iv-link-btn" onClick={() => onWithdraw(resource.id)}>{t('inventory.table.out')}</button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
