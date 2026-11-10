import { DeliveryMockRepository } from './mock/deliveryMockRepository.js';
import { GetRecentDeliveries } from '../application/useCases/getRecentDeliveries.js';
import { GetVerificationStats } from '../application/useCases/getVerificationStats.js';

const deliveryRepository = new DeliveryMockRepository();

export const getRecentDeliveriesUseCase = new GetRecentDeliveries(deliveryRepository);
export const getVerificationStatsUseCase = new GetVerificationStats(deliveryRepository);
