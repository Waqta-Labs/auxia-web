import { useMutation } from '@tanstack/react-query';
import { downloadDeliveryReportUseCase } from '../../infrastructure/container.js';
import { saveBlob } from '@shared/presentation/utils/saveBlob.js';

// mutate({ zoneId?, from?, to? }): pide el PDF de auditoría y lo descarga.
export function useDownloadDeliveryReport() {
  return useMutation({
    mutationFn: async (filters) => {
      const { blob, filename } = await downloadDeliveryReportUseCase.execute(filters);
      saveBlob(blob, filename);
    },
  });
}
