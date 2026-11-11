export class BrigadeMember {
  constructor({ id, name, role, phone = null, userId = null }) {
    this.id = id;
    this.name = name;
    this.phone = phone;
    this.role = role;     // LEADER | DRIVER | MEDIC | VOLUNTEER
    this.userId = userId; // cuenta FIELD_BRIGADE con la que entra a la App de Campo, si tiene
    Object.freeze(this);
  }

  get isLeader() { return this.role === 'LEADER'; }
}
