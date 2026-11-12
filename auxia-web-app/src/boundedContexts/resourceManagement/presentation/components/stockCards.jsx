import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { categoryLabel, levelLabel, quantity } from '../utils/stockFormat.js';

// Una tarjeta por recurso: disponible de lo que hay en almacén, nivel y mínimo seguro.
// Con "limit" muestra solo esas (las más urgentes) y, al final, una tarjeta corta "Ver todos" hacia "moreTo".
export default function StockCards({ resources, loading, limit = null, moreTo = null }) {
  const { t, i18n } = useTranslation('resourceManagement');
  const lng = i18n.resolvedLanguage;
  const shown = limit ? resources.slice(0, limit) : resources;
  const hidden = limit ? Math.max(0, resources.length - limit) : 0;
  const rowClass = limit ? ' iv-cards--row' : '';

  if (loading) {
    return <div className={'iv-cards' + rowClass}>{Array.from({ length: limit ?? 4 }, (_, i) => <span key={i} className="iv-skel iv-skel--card" />)}</div>;
  }
  return (
    <ul className={'iv-cards' + rowClass + (hidden > 0 && moreTo ? ' iv-cards--more' : '')} aria-label={t('inventory.cards.label')}>
      {shown.map((resource) => (
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
      {hidden > 0 && moreTo && (
        <li className="iv-more">
          <Link to={moreTo} aria-label={t('inventory.cards.moreLabel', { count: hidden })}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" /><path d="M14 17.5h7m-3.5-3.5l3.5 3.5-3.5 3.5" />
            </svg>
            <span>{t('inventory.cards.more')}</span>
            <small>+{hidden}</small>
          </Link>
        </li>
      )}
    </ul>
  );
}
