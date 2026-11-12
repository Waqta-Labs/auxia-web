import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { describe, normalizeText, parseCoordinates, searchRegions } from '@shared/presentation/components/geoMap/boundaries.js';

// Busca al escribir entre las zonas, los departamentos / provincias / distritos del Perú y coordenadas. Todo es local.
export default function MapSearch({ zones, boundaries, onPickZone, onPickRegion, onPickPoint }) {
  const { t } = useTranslation('emergencyManagement');
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const query = text.trim();
  const coordinates = useMemo(() => parseCoordinates(query), [query]);
  const zoneResults = useMemo(() => {
    const q = normalizeText(query);
    if (q.length < 2) return [];
    return zones.filter((zone) => normalizeText(zone.name).includes(q)).slice(0, 4);
  }, [query, zones]);
  const regionResults = useMemo(() => searchRegions(boundaries, query, 6), [boundaries, query]);
  const loadingPlaces = query.length >= 2 && !boundaries.districts;

  useEffect(() => {
    const onDown = (event) => { if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false); };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, []);

  const pickZone = (zone) => { setOpen(false); setText(zone.name); onPickZone(zone); };
  const pickRegion = (feature) => { setOpen(false); setText(describe(feature)); onPickRegion(feature); };
  const pickPoint = () => { setOpen(false); onPickPoint(coordinates); };

  const submit = (event) => {
    event.preventDefault();
    if (coordinates) pickPoint();
    else if (zoneResults[0]) pickZone(zoneResults[0]);
    else if (regionResults[0]) pickRegion(regionResults[0]);
  };

  const empty = query.length >= 2 && !coordinates && zoneResults.length === 0 && regionResults.length === 0;
  const showList = open && (coordinates || zoneResults.length > 0 || regionResults.length > 0 || loadingPlaces || empty);
  return (
    <form className="gm-search" role="search" ref={rootRef} onSubmit={submit} data-map-ui>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
      <input
        type="search"
        value={text}
        placeholder={t('gisMap.search.placeholder')}
        aria-label={t('gisMap.search.label')}
        onChange={(event) => { setText(event.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
      />
      {showList && (
        <ul className="gm-search__list" role="listbox" aria-label={t('gisMap.search.label')}>
          {coordinates && (
            <li>
              <button type="button" role="option" onClick={pickPoint}>
                <small>GPS</small>{t('gisMap.search.coordinates', { value: coordinates.lat + ', ' + coordinates.lng })}
              </button>
            </li>
          )}
          {zoneResults.map((zone) => (
            <li key={zone.id}>
              <button type="button" role="option" onClick={() => pickZone(zone)}>
                <small>{t('gisMap.search.zone')}</small>{zone.name}
              </button>
            </li>
          ))}
          {regionResults.map((feature) => (
            <li key={feature.key}>
              <button type="button" role="option" onClick={() => pickRegion(feature)}>
                <small>{t('gisMap.search.' + feature.kind)}</small>{describe(feature)}
              </button>
            </li>
          ))}
          {loadingPlaces && <li className="gm-search__note">{t('gisMap.search.loadingPlaces')}</li>}
          {empty && !loadingPlaces && <li className="gm-search__note">{t('gisMap.search.noResults')}</li>}
        </ul>
      )}
    </form>
  );
}
