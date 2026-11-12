import { useTranslation } from 'react-i18next';
import { categoryLabel, levelLabel, quantity } from '../utils/stockFormat.js';

// Una tarjeta por recurso: disponible de lo que hay en almacén, nivel y mínimo seguro.
export default function StockCards({ resources, loading }) {
  const { t, i18n } = useTranslation('resourceManagement');
  const lng = i18n.resolvedLanguage;

  if (loading) {
    return <div className="iv-cards">{[0, 1, 2, 3].map((i) => <span key={i} className="iv-skel iv-skel--card" />)}</div>;
  }
  return (
    <ul className="iv-cards" aria-label={t('inventory.cards.label')}>
      {resources.map((resource) => (
        <li key={resource.id} className={'iv-card iv-card--' + resource.level.toLowerCase()}>
          <div className="iv-card__top">
            <strong>{resource.name}</strong>
            <span className={'iv-chip iv-chip--' + resource.level.toLowerCase()}>{levelLabel(t, resource.level)}</span>
          </div>
          <p className="iv-card__qty">
            <span>{new Intl.NumberFormat(lng).format(resource.available)}</span>
            <small>{t('inventory.cards.of', { total: quantity(resource.onHand, resource.unit, lng) })}</small>
          </p>
          <div className="iv-bar" role="img" aria-label={Math.round(resource.availableRatio * 100) + '%'}>
            <span style={{ width: Math.round(resource.availableRatio * 100) + '%' }} />
          </div>
          <p className="iv-card__meta">
            {t('inventory.cards.available')} · {t('inventory.cards.minimum', { value: quantity(resource.minimumStock, resource.unit, lng) })}
            {resource.reserved > 0 && ' · ' + t('inventory.cards.reserved', { value: quantity(resource.reserved, '', lng) })}
          </p>
          <span className="iv-card__cat">{categoryLabel(t, resource.category)}</span>
        </li>
      ))}
    </ul>
  );
}
