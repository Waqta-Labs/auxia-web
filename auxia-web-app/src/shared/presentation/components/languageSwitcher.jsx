import { useTranslation } from 'react-i18next';

const languages = ['es', 'en'];

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  return (
    <div className="lang-switcher" role="group" aria-label="Language">
      {languages.map((lng) => (
        <button
          key={lng}
          type="button"
          className="btn btn--ghost"
          aria-pressed={i18n.resolvedLanguage === lng}
          onClick={() => i18n.changeLanguage(lng)}
        >
          {lng.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
