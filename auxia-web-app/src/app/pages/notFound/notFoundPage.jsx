import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { routes } from '@app/router/routes.js';

export default function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <section className="page">
      <h1>{t('notFound.title')}</h1>
      <Link to={routes.dashboard}>{t('notFound.back')}</Link>
    </section>
  );
}
