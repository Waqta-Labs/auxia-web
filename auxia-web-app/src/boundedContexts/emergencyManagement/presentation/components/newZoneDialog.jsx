import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { describe, locate } from '@shared/presentation/components/geoMap/boundaries.js';
import { DAMAGE_LEVELS } from '../../domain/enums/damageLevel.js';
import { useRegisterZone } from '../hooks/useRegisterZone.js';
import ImpactFields from './impactFields.jsx';

const EMPTY_IMPACT = { population: '', familiesAffected: '', peopleAffected: '', children: '', elderlyPeople: '', disabledPeople: '' };

// Registra una zona en el punto marcado en el mapa. La ubicación se puede ajustar a mano.
export default function NewZoneDialog({ emergencyId, point, boundaries, onClose, onCreated }) {
  const { t } = useTranslation('emergencyManagement');
  const register = useRegisterZone();
  const [name, setName] = useState('');
  const [latitude, setLatitude] = useState(point.lat.toFixed(6));
  const [longitude, setLongitude] = useState(point.lng.toFixed(6));
  const [damageLevel, setDamageLevel] = useState('');
  const [impact, setImpact] = useState(EMPTY_IMPACT);
  const [error, setError] = useState(null);
  const nameRef = useRef(null);

  // En qué distrito cae la ubicación escrita (aviso si queda fuera del Perú; no bloquea el registro).
  const place = useMemo(() => {
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!boundaries.departments || latitude.trim() === '' || longitude.trim() === '' || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const feature = locate(boundaries, lat, lng);
    return feature ? { name: describe(feature) } : { outside: true };
  }, [boundaries, latitude, longitude]);

  useEffect(() => { nameRef.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = (event) => {
    event.preventDefault();
    setError(null);
    register.mutate(
      { emergencyId, name, latitude, longitude, damageLevel, impact },
      {
        onSuccess: (zone) => onCreated(zone),
        onError: (failure) => setError(t('gisMap.errors.' + failure.message, { defaultValue: failure.detail ?? t('gisMap.errors.generic') })),
      },
    );
  };

  return (
    <>
      <div className="gm-backdrop" onClick={onClose} />
      <form className="gm-dialog" role="dialog" aria-modal="true" aria-labelledby="gm-new-zone" onSubmit={submit} noValidate>
        <h2 id="gm-new-zone">{t('gisMap.dialog.title')}</h2>
        <p className="gm-note">{t('gisMap.dialog.intro')}</p>
        <label className="gm-field">{t('gisMap.dialog.name')}
          <input ref={nameRef} value={name} maxLength={150} placeholder={t('gisMap.dialog.namePlaceholder')} onChange={(event) => setName(event.target.value)} />
        </label>
        <div className="gm-field-row">
          <label className="gm-field">{t('gisMap.dialog.latitude')}
            <input inputMode="decimal" value={latitude} onChange={(event) => setLatitude(event.target.value)} />
          </label>
          <label className="gm-field">{t('gisMap.dialog.longitude')}
            <input inputMode="decimal" value={longitude} onChange={(event) => setLongitude(event.target.value)} />
          </label>
        </div>
        {place && <p className={'gm-note' + (place.outside ? ' is-warn' : '')}>{place.outside ? t('gisMap.dialog.outside') : t('gisMap.dialog.place', { name: place.name })}</p>}
        <label className="gm-field">{t('gisMap.dialog.damage')}
          <select value={damageLevel} onChange={(event) => setDamageLevel(event.target.value)}>
            <option value="">{t('gisMap.dialog.damageNone')}</option>
            {DAMAGE_LEVELS.map((level) => <option key={level} value={level}>{t('damage.' + level)}</option>)}
          </select>
        </label>
        <ImpactFields values={impact} onChange={setImpact} />
        {error && <p className="gm-error" role="alert">{error}</p>}
        <div className="gm-dialog__actions">
          <button type="button" className="gm-btn-outline" onClick={onClose}>{t('gisMap.dialog.cancel')}</button>
          <button type="submit" className="gm-btn-lime" disabled={register.isPending}>{register.isPending ? t('gisMap.dialog.creating') : t('gisMap.dialog.create')}</button>
        </div>
      </form>
    </>
  );
}
