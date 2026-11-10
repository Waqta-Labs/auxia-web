import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '@shared/presentation/components/languageSwitcher.jsx';

export default function Topbar() {
  const { t } = useTranslation();

  return (
    <header className="cc-top">
      <label className="cc-search">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
          strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
        </svg>
        <input type="search" placeholder={t('topbar.searchPlaceholder')} aria-label={t('topbar.searchPlaceholder')} />
      </label>

      <span className="cc-top__spacer" />
      <span className="cc-realtime">{t('topbar.realtime')}</span>
      <LanguageSwitcher variant="pill" />
      {/* Pendiente: conectar con el protocolo de alarma general del backend. */}
      <button type="button" className="cc-alarm">{t('topbar.generalAlarm')}</button>
    </header>
  );
}
