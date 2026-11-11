import { useTranslation } from 'react-i18next';
import { formatNumber } from '@shared/utils/formatters.js';

// Centro de la pantalla: la misión en curso de la brigada seleccionada. Las misiones no se crean aquí:
// nacen al aprobar un plan de distribución (Priorización IA → zona → Asignar brigada).
// onOpenZone / onOpenPrioritization solo llegan si el rol puede entrar a Priorización IA (el administrador no).
export default function BrigadeMission({ detail, onOpenZone, onOpenPrioritization }) {
  const { t, i18n } = useTranslation('resourceManagement');
  const lng = i18n.resolvedLanguage;
  const brigade = detail.data;
  const assignment = brigade?.assignment ?? null;

  return (
    <section className="fl-card" aria-labelledby="fl-mission-title">
      <h2 id="fl-mission-title" className="fl-h2">{t('brigades.mission.title')}</h2>

      {detail.isLoading && <span className="fl-skel fl-skel--block" />}
      {detail.isError && <p className="fl-error" role="alert">{detail.error?.detail ?? t('brigades.loadError')}</p>}

      {brigade && assignment && (
        <div className="fl-mission">
          <div className="fl-mission__head">
            <div>
              <span className="fl-label">{t('brigades.mission.zone')}</span>
              <p className="fl-mission__zone">{assignment.zoneName ?? '—'}</p>
            </div>
            {assignment.score !== null && assignment.score !== undefined && (
              <span className="fl-score">{Math.round(assignment.score)}</span>
            )}
          </div>

          <dl className="fl-facts">
            {assignment.etaMinutes !== null && (
              <div><dt>{t('brigades.mission.eta')}</dt><dd>{t('brigades.mission.minutes', { count: assignment.etaMinutes })}</dd></div>
            )}
            {assignment.distanceKm !== null && (
              <div><dt>{t('brigades.mission.distance')}</dt><dd>{formatNumber(assignment.distanceKm, lng)} km</dd></div>
            )}
          </dl>

          {assignment.resources.length > 0 && (
            <div>
              <span className="fl-label">{t('brigades.mission.resources')}</span>
              <ul className="fl-resources">
                {assignment.resources.map((resource) => (
                  <li key={resource.name}>
                    <span>{resource.name}</span>
                    <strong>
                      {resource.quantity !== null ? formatNumber(resource.quantity, lng) : '—'}
                      {resource.unit ? ' ' + resource.unit : ''}
                    </strong>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {assignment.zoneId && onOpenZone && (
            <button type="button" className="fl-btn-outline" onClick={() => onOpenZone(assignment.zoneId)}>
              {t('brigades.mission.openZone')}
            </button>
          )}
        </div>
      )}

      {brigade && !assignment && (
        <div className="fl-mission fl-mission--empty">
          <p>{t('brigades.mission.none')}</p>
          <p className="fl-note">{t('brigades.mission.noneHint')}</p>
          {onOpenPrioritization && (
            <button type="button" className="fl-btn-lime" onClick={onOpenPrioritization}>
              {t('brigades.mission.goPrioritization')}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
