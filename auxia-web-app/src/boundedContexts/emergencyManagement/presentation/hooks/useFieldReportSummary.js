import { useQuery } from '@tanstack/react-query';
import { getFieldReportSummaryUseCase } from '../../infrastructure/container.js';

export function useFieldReportSummary(emergencyId) {
  return useQuery({
    queryKey: ['fieldReports', 'summary', emergencyId],
    queryFn: () => getFieldReportSummaryUseCase.execute(emergencyId),
    enabled: Boolean(emergencyId),
  });
}
