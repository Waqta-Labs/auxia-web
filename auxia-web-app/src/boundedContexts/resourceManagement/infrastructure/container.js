import { BrigadeMockRepository } from './mock/brigadeMockRepository.js';
import { GetBrigadeOverview } from '../application/useCases/getBrigadeOverview.js';

const brigadeRepository = new BrigadeMockRepository();

export const getBrigadeOverviewUseCase = new GetBrigadeOverview(brigadeRepository);
