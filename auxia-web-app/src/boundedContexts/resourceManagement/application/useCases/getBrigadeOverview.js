export class GetBrigadeOverview {
  constructor(brigadeRepository) {
    this.brigadeRepository = brigadeRepository;
  }

  async execute() {
    const brigades = await this.brigadeRepository.findAll();
    return {
      brigades,
      total: brigades.length,
      deployed: brigades.filter((b) => b.isDeployed).length,
      available: brigades.filter((b) => b.isAvailable).length,
    };
  }
}
