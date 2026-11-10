import { useTranslation } from 'react-i18next';

export default function PagePlaceholder({ ns, titleKey }) {
  const { t } = useTranslation(ns);
  return (
    <section className="page">
      <h1>{t(titleKey)}</h1>
      <p className="muted">{t('placeholder', { ns: 'common' })}</p>
    </section>
  );
}
