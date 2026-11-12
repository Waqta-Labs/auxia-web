import { useTranslation } from 'react-i18next';
import { formatNumber, humanize } from '@shared/utils/formatters.js';

const MAX_NEEDS = 2;
const SKELETON_ROWS = 8;

export default function ZoneTable({ zones = [], loading = false, selectedId, onSelect }) {
  const { t, i18n } = useTranslation('emergencyManagement');
  const lng = i18n.resolvedLanguage;
  const needLabel = (need) => t('needs.' + need, { defaultValue: humanize(need) });

  return (
    <div className="pz-table-wrap">
      <table className="pz-table">
        <thead>
          <tr>
            <th scope="col">{t('prioritization.columns.score')}</th>
            <th scope="col">{t('prioritization.columns.zone')}</th>
            <th scope="col">{t('prioritization.columns.needs')}</th>
            <th scope="col">{t('prioritization.columns.damage')}</th>
            <th scope="col" className="pz-num">{t('prioritization.columns.people')}</th>
            <th scope="col">{t('prioritization.columns.status')}</th>
          </tr>
        </thead>
        <tbody>
          {loading && Array.from({ length: SKELETON_ROWS }, (_, i) => (
            <tr key={i}><td colSpan={8}><span className="pz-skel" /></td></tr>
          ))}

          {!loading && zones.length === 0 && (
            <tr><td colSpan={8} className="pz-empty">{t('prioritization.empty')}</td></tr>
          )}

          {!loading && zones.map((zone) => {
            const selected = zone.id === selectedId;
            return (
              <tr key={zone.id} className={selected ? 'is-selected' : undefined} onClick={() => onSelect(zone.id)}>
                <td>
                  <span className={'pz-score pz-score--' + zone.level}>
                    {zone.urgencyScore !== null ? Math.round(zone.urgencyScore) : '—'}
                  </span>
                </td>
                <td>
                  <button type="button" className="pz-zone-btn" aria-current={selected ? 'true' : undefined}>
                    {zone.name}
                  </button>
                  {zone.manualPriority && <span className="pz-manual">{t('prioritization.manual')}</span>}
                </td>
                <td>
                  <span className="pz-needs">
                    {zone.needs.slice(0, MAX_NEEDS).map((need) => (
                      <span key={need} className="pz-tag">{needLabel(need)}</span>
                    ))}
                    {zone.needs.length > MAX_NEEDS && <span className="pz-tag">+{zone.needs.length - MAX_NEEDS}</span>}
                    {zone.needs.length === 0 && '—'}
                  </span>
                </td>
                <td>
                  {zone.damageLevel
                    ? <span className={'pz-pill pz-damage--' + zone.damageLevel}>{t('damage.' + zone.damageLevel)}</span>
                    : '—'}
                </td>
                <td className="pz-num">
                  {zone.peopleAffected !== null ? formatNumber(zone.peopleAffected, lng) : '—'}
                </td>
                <td>
                  {zone.status
                    ? <span className={'pz-pill pz-status--' + zone.status}>{t('zoneStatus.' + zone.status)}</span>
                    : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
