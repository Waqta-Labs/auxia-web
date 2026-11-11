import { useQuery } from '@tanstack/react-query';
import { getZoneRankingUseCase } from '../../infrastructure/container.js';

// El tablero explica el score de las zonas más prioritarias; la bandeja de priorización no lo necesita
// (lo pide al abrir el detalle) ni las coordenadas.
const EXPLAIN_TOP = 3;

export function useZoneRanking(emergencyId, { explainTop = EXPLAIN_TOP, withPosition = true } = {}) {
  return useQuery({
    queryKey: ['zones', 'ranking', emergencyId, explainTop, withPosition],
    queryFn: () => getZoneRankingUseCase.execute(emergencyId, { explainTop, withPosition }),
    enabled: Boolean(emergencyId),
  });
}
