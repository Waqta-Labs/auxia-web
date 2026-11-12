import { useMutation } from '@tanstack/react-query';
import { exportDeliveryReportUseCase } from '../../infrastructure/container.js';
import { saveBlob } from '@shared/presentation/utils/saveBlob.js';

// mutate({ scope, format, from?, to?, deliveries?, detail?, zoneName?, labels, verifyBaseUrl }): arma el informe y lo descarga.
export function useExportDeliveryReport() {
  return useMutation({
    mutationFn: async (request) => {
      const { blob, filename } = await exportDeliveryReportUseCase.execute(request);
      saveBlob(blob, filename);
    },
  });
}
