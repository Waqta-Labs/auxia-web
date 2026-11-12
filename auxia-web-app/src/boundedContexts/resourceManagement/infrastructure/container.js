import { BrigadeMockRepository } from './mock/brigadeMockRepository.js';
import { BrigadeHttpRepository } from './http/brigadeHttpRepository.js';
import { InventoryMockRepository } from './mock/inventoryMockRepository.js';
import { InventoryHttpRepository } from './http/inventoryHttpRepository.js';
import { GetBrigadeOverview } from '../application/useCases/getBrigadeOverview.js';
import { GetBrigadeList } from '../application/useCases/getBrigadeList.js';
import { GetBrigadeDetail } from '../application/useCases/getBrigadeDetail.js';
import { CreateBrigade } from '../application/useCases/createBrigade.js';
import { AddBrigadeMember } from '../application/useCases/addBrigadeMember.js';
import { RemoveBrigadeMember } from '../application/useCases/removeBrigadeMember.js';
import { SetBrigadeAvailability } from '../application/useCases/setBrigadeAvailability.js';
import { GetInventory } from '../application/useCases/getInventory.js';
import { GetStockAlerts } from '../application/useCases/getStockAlerts.js';
import { CreateInventory } from '../application/useCases/createInventory.js';
import { RegisterResource } from '../application/useCases/registerResource.js';
import { RestockResource } from '../application/useCases/restockResource.js';
import { WithdrawStock } from '../application/useCases/withdrawStock.js';
import { env } from '@shared/infrastructure/config/env.js';

const brigadeRepository = env.useMocks ? new BrigadeMockRepository() : new BrigadeHttpRepository();
const inventoryRepository = env.useMocks ? new InventoryMockRepository() : new InventoryHttpRepository();

export const getBrigadeOverviewUseCase = new GetBrigadeOverview(brigadeRepository);
export const getBrigadeListUseCase = new GetBrigadeList(brigadeRepository);
export const getBrigadeDetailUseCase = new GetBrigadeDetail(brigadeRepository);
export const createBrigadeUseCase = new CreateBrigade(brigadeRepository);
export const addBrigadeMemberUseCase = new AddBrigadeMember(brigadeRepository);
export const removeBrigadeMemberUseCase = new RemoveBrigadeMember(brigadeRepository);
export const setBrigadeAvailabilityUseCase = new SetBrigadeAvailability(brigadeRepository);

export const getInventoryUseCase = new GetInventory(inventoryRepository);
export const getStockAlertsUseCase = new GetStockAlerts(inventoryRepository);
export const createInventoryUseCase = new CreateInventory(inventoryRepository);
export const registerResourceUseCase = new RegisterResource(inventoryRepository);
export const restockResourceUseCase = new RestockResource(inventoryRepository);
export const withdrawStockUseCase = new WithdrawStock(inventoryRepository);
