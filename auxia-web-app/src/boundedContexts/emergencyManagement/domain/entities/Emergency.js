import { EmergencyStatus } from '../enums/emergencyStatus.js';

export class Emergency {
  constructor({ id, name, type, status, district = null, startedAt = null }) {
    this.id = id;
    this.name = name;
    this.type = type;
    this.status = status;
    this.district = district;
    this.startedAt = startedAt; // epoch ms
    Object.freeze(this);
  }

  get isActive() {
    return this.status === EmergencyStatus.ACTIVE;
  }
}
