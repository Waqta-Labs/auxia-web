import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDateTime, formatNumber, humanize } from '@shared/utils/formatters.js';
import { levelOf } from '../../domain/enums/priorityLevel.js';
import { useZonePriorityDetail } from '../hooks/useZonePriorityDetail.js';
import { useRemoveManualPriority } from '../hooks/useRemoveManualPriority.js';
import { featureLabel, formatContribution } from '../utils/featureLabel.js';
import OverrideScoreForm from './overrideScoreForm.jsx';
import AssignBrigadePanel from './assignBrigadePanel.jsx';

export default function ScoreDrawer({ zoneId, row, canManage, initialView = 'detail', onClose }) {
  const { t, i18n } = useTranslation('emergencyManagement');
  const lng = i18n.resolvedLanguage;
  const detail = useZonePriorityDetail(zoneId);
  const removeManual = useRemoveManualPriority();
  const [overriding, setOverriding] = useState(false);
  const [view, setView] = useState(initialView); // 'detail' | 'assign'
  const closeRef = useRef(null);

  // Al abrir (o cambiar de zona) el foco va al botón de cerrar y se descarta cualquier formulario abierto.
  useEffect(() => {
    closeRef.current?.focus();
    setOverriding(false);
    setView(initialView);
  }, [zoneId]);

  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const zone = detail.data?.zone ?? null;
  const explanation = detail.data?.explanation ?? null;
  const features = explanation?.features ?? [];
  const manual = zone?.manualPriority ?? null;

  const name = zone?.name ?? row?.name ?? '';
  const score = zone?.urgencyScore ?? row?.urgencyScore ?? null;
  const level = zone ? levelOf(zone.priorityLevel) : row?.level ?? 'unscored';
  const needKeys = row?.needs ?? zone?.needs ?? [];
  const needs = needKeys.map((need) => t('needs.' + need, { defaultValue: humanize(need) }));
  const damage = zone?.damageLevel ?? row?.damageLevel;
  const subtitle = [needs.join(', '), damage ? t('damage.' + damage) : null].filter(Boolean).join(' · ');

  const number = (value) => (value === null || value === undefined ? '—' : formatNumber(value, lng));
  const facts = zone && [
    ['status', zone.status ? t('zoneStatus.' + zone.status) : '—'],
    ['damage', zone.damageLevel ? t('damage.' + zone.damageLevel) : '—'],
    ['needs', needs.length > 0 ? <span className="pz-needs">{needKeys.map((need, index) => <span key={need} className="pz-tag">{needs[index]}</span>)}</span> : t('drawer.noNeeds')],
    ['location', zone.hasPosition ? zone.latitude.toFixed(4) + ', ' + zone.longitude.toFixed(4) : t('drawer.noLocation')],
    ['population', number(zone.population)],
    ['families', number(zone.familiesAffected)],
    ['people', number(zone.peopleAffected)],
    ['children', number(zone.children)],
    ['elderly', number(zone.elderlyPeople)],
    ['disabled', number(zone.disabledPeople)],
    ['lastAid', zone.lastAidAt ? formatDateTime(zone.lastAidAt, lng) : t('drawer.noAid')],
  ];

  const summaryScore = explanation?.score ?? score;

  return (
    <>
      <div className="pz-backdrop" onClick={onClose} aria-hidden="true" />
      <aside className="pz-drawer" role="dialog" aria-modal="true" aria-labelledby="pz-drawer-title">
        <header className="pz-drawer__head">
          <div className="pz-drawer__title">
            <h2 id="pz-drawer-title">{name}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <span className={'pz-score pz-score--' + level}>{score !== null ? Math.round(score) : '—'}</span>
          <button ref={closeRef} type="button" className="pz-icon-btn" onClick={onClose} aria-label={t('drawer.close')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </header>

        <div className="pz-drawer__body">
          {view === 'assign' ? (
            <AssignBrigadePanel zoneId={zoneId} zone={zone} onBack={() => setView('detail')} />
          ) : (
          <>
          {detail.isLoading && (
            <>
              <span className="pz-skel pz-skel--block" />
              <span className="pz-skel pz-skel--block" />
            </>
          )}

          {detail.isError && (
            <p className="pz-error" role="alert">{detail.error?.detail ?? t('drawer.loadError')}</p>
          )}

          {zone && (
            <>
              {manual && (
                <section className="pz-box pz-box--manual">
                  <span className="pz-label">{t('drawer.manualTitle')}</span>
                  <p>{manual.reason}</p>
                  <p className="pz-note">{t('drawer.manualSince', { date: formatDateTime(manual.setAt, lng) })}</p>
                  {canManage && (
                    <button
                      type="button" className="pz-link-btn"
                      onClick={() => removeManual.mutate(zoneId)} disabled={removeManual.isPending}
                    >
                      {t('drawer.removeManual')}
                    </button>
                  )}
                  {removeManual.error && (
                    <p className="pz-error" role="alert">{removeManual.error.detail ?? t('override.errors.generic')}</p>
                  )}
                </section>
              )}

              <section className="pz-box">
                <span className="pz-label">{t('drawer.explain')}</span>
                {explanation === null && <p>{t('drawer.explainError')}</p>}
                {explanation && !explanation.available && (
                  <p>
                    {t('drawer.unavailable')}{' '}
                    {explanation.missingVariables.length > 0 &&
                      t('drawer.missing', { variables: explanation.missingVariables.map((v) => featureLabel(t, v)).join(', ') })}
                  </p>
                )}
                {explanation && explanation.available && (
                  <p className="pz-explain-line">
                    {t('drawer.summary', {
                      features: features.map((f) => featureLabel(t, f.key)).join(' · '),
                      score: summaryScore !== null ? Math.round(summaryScore) : '—',
                    })}
                  </p>
                )}
              </section>

              {features.length > 0 && (
                <section>
                  <h3 className="pz-h3">{t('drawer.breakdown')}</h3>
                  <ul className="pz-bars">
                    {features.map((feature, index) => {
                      const max = explanation.maxContribution;
                      const width = max > 0 ? Math.round((Math.abs(feature.contribution ?? 0) / max) * 100) : 0;
                      return (
                        <li key={feature.key}>
                          <div className="pz-bar__row">
                            <span>{featureLabel(t, feature.key)}</span>
                            <strong>{formatContribution(feature.contribution)}</strong>
                          </div>
                          <div className="pz-bar" aria-hidden="true">
                            <span className={'pz-bar__fill' + (index === 0 ? ' pz-bar__fill--lead' : '')} style={{ width: width + '%' }} />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  <p className="pz-note">
                    {t('drawer.topOnly')}
                    {explanation.modelVersion ? ' ' + t('drawer.model', { version: explanation.modelVersion }) : ''}
                  </p>
                </section>
              )}

              <section className="pz-box">
                <span className="pz-label">{t('drawer.data')}</span>
                <dl className="pz-facts">
                  {facts.map(([key, value]) => (
                    <div key={key}>
                      <dt>{t('drawer.fields.' + key)}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            </>
          )}
          </>
          )}
        </div>

        <footer className="pz-drawer__foot" hidden={view === 'assign'}>
          {!canManage && <p className="pz-note">{t('drawer.readOnly')}</p>}
          {canManage && overriding && (
            <OverrideScoreForm zoneId={zoneId} onDone={() => setOverriding(false)} onCancel={() => setOverriding(false)} />
          )}
          {canManage && !overriding && (
            <div className="pz-actions">
              <button type="button" className="pz-btn-lime" onClick={() => setView('assign')}>
                {t('drawer.assign')}
              </button>
              <button type="button" className="pz-btn-outline" onClick={() => setOverriding(true)} disabled={!zone}>
                {t('drawer.override')}
              </button>
            </div>
          )}
        </footer>
      </aside>
    </>
  );
}
