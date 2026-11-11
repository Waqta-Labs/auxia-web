export class RemoveManualPriority {
  constructor(zoneRepository) {
    this.zoneRepository = zoneRepository;
  }

  execute(zoneId) {
    return this.zoneRepository.clearManualPriority(zoneId);
  }
}
