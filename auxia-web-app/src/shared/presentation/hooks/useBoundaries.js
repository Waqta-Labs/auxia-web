import { useEffect, useState } from 'react';
import { LEVELS, loadBoundaries } from '@shared/presentation/components/geoMap/boundaries.js';

// Carga los límites del Perú por niveles (departamentos primero, distritos al final) sin bloquear la pantalla.
export function useBoundaries() {
  const [state, setState] = useState({ departments: null, provinces: null, districts: null });
  useEffect(() => {
    let alive = true;
    (async () => {
      for (const level of LEVELS) {
        try {
          const features = await loadBoundaries(level);
          if (!alive) return;
          setState((current) => ({ ...current, [level]: features }));
        } catch {
          /* sin esos datos el mapa sigue funcionando */
        }
      }
    })();
    return () => { alive = false; };
  }, []);
  return state;
}
