import { BrigadeMockRepository } from './mock/brigadeMockRepository.js';
import { BrigadeHttpRepository } from './http/brigadeHttpRepository.js';
import { GetBrigadeOverview } from '../application/useCases/getBrigadeOverview.js';
import { GetBrigadeList } from '../application/useCases/getBrigadeList.js';
import { GetBrigadeDetail } from '../application/useCases/getBrigadeDetail.js';
import { CreateBrigade } from '../application/useCases/createBrigade.js';
import { AddBrigadeMember } from '../application/useCases/addBrigadeMember.js';
import { RemoveBrigadeMember } from '../application/useCases/removeBrigadeMember.js';
import { SetBrigadeAvailability } from '../application/useCases/setBrigadeAvailability.js';
import { env } from '@shared/infrastructure/config/env.js';

const brigadeRepository = env.useMocks ? new BrigadeMockRepository() : new BrigadeHttpRepository();

export const getBrigadeOverviewUseCase = new GetBrigadeOverview(brigadeRepository);
export const getBrigadeListUseCase = new GetBrigadeList(brigadeRepository);
export const getBrigadeDetailUseCase = new GetBrigadeDetail(brigadeRepository);
export const createBrigadeUseCase = new CreateBrigade(brigadeRepository);
export const addBrigadeMemberUseCase = new AddBrigadeMember(brigadeRepository);
export const removeBrigadeMemberUseCase = new RemoveBrigadeMember(brigadeRepository);
export const setBrigadeAvailabilityUseCase = new SetBrigadeAvailability(brigadeRepository);
