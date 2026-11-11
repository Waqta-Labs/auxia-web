export class GetBrigadeList {
  constructor(brigadeRepository) {
    this.brigadeRepository = brigadeRepository;
  }

  async execute() {
    const brigades = await this.brigadeRepository.findAll();
    return [...brigades].sort((a, b) => a.name.localeCompare(b.name));
  }
}
