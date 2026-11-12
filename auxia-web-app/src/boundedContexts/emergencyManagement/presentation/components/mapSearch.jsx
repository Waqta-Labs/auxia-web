import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { parseCoordinates, searchPlaces } from '@shared/infrastructure/geocoding/placeSearch.js';

const normalize = (text) => String(text).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Busca entre las zonas (al escribir) y, al pulsar Enter, entre lugares de OpenStreetMap o coordenadas.
export default function MapSearch({ zones, onPickZone, onPickPlace }) {
  const { t, i18n } = useTranslation('emergencyManagement');
  const [text, setText] = useState('');
  const [places, setPlaces] = useState([]);
  const [status, setStatus] = useState('idle'); // idle | loading | done | error
  const [open, setOpen] = useState(false);
  const abortRef = useRef(null);
  const rootRef = useRef(null);

  const zoneResults = useMemo(() => {
    const query = normalize(text.trim());
    if (query.length < 2) return [];
    return zones.filter((zone) => normalize(zone.name).includes(query)).slice(0, 5);
  }, [text, zones]);

  useEffect(() => {
    const onDown = (event) => { if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false); };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, []);
  useEffect(() => () => abortRef.current?.abort(), []);

  const submit = async (event) => {
    event.preventDefault();
    const query = text.trim();
    if (!query) return;
    setOpen(true);
    const coordinates = parseCoordinates(query);
    if (coordinates) {
      setPlaces([{ label: t('gisMap.search.coordinates', { value: coordinates.lat + ', ' + coordinates.lng }), ...coordinates }]);
      setStatus('done');
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus('loading');
    try {
      setPlaces(await searchPlaces(query, { language: i18n.resolvedLanguage, signal: controller.signal }));
      setStatus('done');
    } catch (error) {
      if (error.name !== 'AbortError') setStatus('error');
    }
  };

  const pickZone = (zone) => { setOpen(false); setText(zone.name); onPickZone(zone); };
  const pickPlace = (place) => { setOpen(false); onPickPlace(place); };

  const showList = open && (zoneResults.length > 0 || status !== 'idle');
  return (
    <form className="gm-search" role="search" ref={rootRef} onSubmit={submit} data-map-ui>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
      <input
        type="search"
        value={text}
        placeholder={t('gisMap.search.placeholder')}
        aria-label={t('gisMap.search.label')}
        onChange={(event) => { setText(event.target.value); setStatus('idle'); setPlaces([]); setOpen(true); }}
        onFocus={() => setOpen(true)}
      />
      {showList && (
        <ul className="gm-search__list" role="listbox" aria-label={t('gisMap.search.label')}>
          {zoneResults.map((zone) => (
            <li key={zone.id}>
              <button type="button" role="option" onClick={() => pickZone(zone)}>
                <small>{t('gisMap.search.zone')}</small>{zone.name}
              </button>
            </li>
          ))}
          {status === 'loading' && <li className="gm-search__note">{t('gisMap.search.searching')}</li>}
          {status === 'error' && <li className="gm-search__note is-error">{t('gisMap.search.error')}</li>}
          {status === 'done' && places.length === 0 && <li className="gm-search__note">{t('gisMap.search.noResults')}</li>}
          {places.map((place) => (
            <li key={place.label + place.lat}>
              <button type="button" role="option" onClick={() => pickPlace(place)}>
                <small>{t('gisMap.search.place')}</small>{place.label}
              </button>
            </li>
          ))}
          {status === 'idle' && zoneResults.length > 0 && <li className="gm-search__note">{t('gisMap.search.hint')}</li>}
        </ul>
      )}
    </form>
  );
}
