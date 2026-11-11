export class RemoveBrigadeMember {
  constructor(brigadeRepository) {
    this.brigadeRepository = brigadeRepository;
  }

  execute({ brigadeId, memberId }) {
    return this.brigadeRepository.removeMember(brigadeId, memberId);
  }
}
