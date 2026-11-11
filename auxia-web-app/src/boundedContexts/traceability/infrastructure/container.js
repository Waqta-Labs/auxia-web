import { DeliveryMockRepository } from './mock/deliveryMockRepository.js';
import { DeliveryHttpRepository } from './http/deliveryHttpRepository.js';
import { GetDeliveryOverview } from '../application/useCases/getDeliveryOverview.js';
import { env } from '@shared/infrastructure/config/env.js';

const deliveryRepository = env.useMocks ? new DeliveryMockRepository() : new DeliveryHttpRepository();

export const getDeliveryOverviewUseCase = new GetDeliveryOverview(deliveryRepository);
