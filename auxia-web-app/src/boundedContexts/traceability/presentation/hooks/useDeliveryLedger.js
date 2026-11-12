import { useQuery } from '@tanstack/react-query';
import { getDeliveryLedgerUseCase } from '../../infrastructure/container.js';

// zones: las zonas de la emergencia (undefined mientras se cargan).
export function useDeliveryLedger({ zones }) {
  return useQuery({
    queryKey: ['deliveries', 'ledger', zones?.map((zone) => zone.id).join(',')],
    queryFn: () => getDeliveryLedgerUseCase.execute({ zones }),
    enabled: Array.isArray(zones),
  });
}
