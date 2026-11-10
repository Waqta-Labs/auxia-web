export class GetFieldReportSummary {
  constructor(fieldReportRepository) {
    this.fieldReportRepository = fieldReportRepository;
  }

  execute(emergencyId) {
    return this.fieldReportRepository.summarize(emergencyId);
  }
}
