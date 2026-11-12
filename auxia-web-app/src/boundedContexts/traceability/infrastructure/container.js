import { DeliveryMockRepository } from './mock/deliveryMockRepository.js';
import { DeliveryHttpRepository } from './http/deliveryHttpRepository.js';
import { GetDeliveryOverview } from '../application/useCases/getDeliveryOverview.js';
import { GetDeliveryLedger } from '../application/useCases/getDeliveryLedger.js';
import { GetDeliveryDetail } from '../application/useCases/getDeliveryDetail.js';
import { VerifyDelivery } from '../application/useCases/verifyDelivery.js';
import { DownloadDeliveryReport } from '../application/useCases/downloadDeliveryReport.js';
import { ExportDeliveryReport } from '../application/useCases/exportDeliveryReport.js';
import { createXlsxBlob } from '@shared/infrastructure/files/xlsxWriter.js';
import { env } from '@shared/infrastructure/config/env.js';

const deliveryRepository = env.useMocks ? new DeliveryMockRepository() : new DeliveryHttpRepository();

export const getDeliveryOverviewUseCase = new GetDeliveryOverview(deliveryRepository);
export const getDeliveryLedgerUseCase = new GetDeliveryLedger(deliveryRepository);
export const getDeliveryDetailUseCase = new GetDeliveryDetail(deliveryRepository);
export const verifyDeliveryUseCase = new VerifyDelivery(deliveryRepository);
export const downloadDeliveryReportUseCase = new DownloadDeliveryReport(deliveryRepository);
export const exportDeliveryReportUseCase = new ExportDeliveryReport({ deliveryRepository, workbookWriter: createXlsxBlob });
