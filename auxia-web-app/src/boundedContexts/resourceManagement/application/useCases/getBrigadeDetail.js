export class GetBrigadeDetail {
  constructor(brigadeRepository) {
    this.brigadeRepository = brigadeRepository;
  }

  execute(brigadeId) {
    return this.brigadeRepository.findById(brigadeId);
  }
}
