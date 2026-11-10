import { useTranslation } from 'react-i18next';

const languages = ['es', 'en'];

function GlobeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" />
    </svg>
  );
}

export default function LanguageSwitcher({ variant = 'default' }) {
  const { i18n, t } = useTranslation();
  const current = i18n.resolvedLanguage;

  if (variant === 'pill') {
    return (
      <div className="lang-pill" role="group" aria-label={t('language')}>
        <GlobeIcon />
        {languages.map((lng) => (
          <button
            key={lng}
            type="button"
            className="lang-pill__btn"
            aria-pressed={current === lng}
            onClick={() => i18n.changeLanguage(lng)}
          >
            {lng.toUpperCase()}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="lang-switcher" role="group" aria-label={t('language')}>
      {languages.map((lng) => (
        <button
          key={lng}
          type="button"
          className="btn btn--ghost"
          aria-pressed={current === lng}
          onClick={() => i18n.changeLanguage(lng)}
        >
          {lng.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
