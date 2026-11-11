import { BrigadeStatus } from '../enums/brigadeStatus.js';

export class Brigade {
  constructor({ id, name, code = null, status, latitude = null, longitude = null, memberCount = null }) {
    this.id = id;
    this.name = name;
    this.code = code;
    this.status = status;
    this.latitude = latitude; // base / última posición GPS
    this.longitude = longitude;
    this.memberCount = memberCount; // null si el listado no lo trae
    Object.freeze(this);
  }

  get isDeployed() { return this.status === BrigadeStatus.ASSIGNED; }
  get isAvailable() { return this.status === BrigadeStatus.AVAILABLE; }
  get isOffDuty() { return this.status === BrigadeStatus.OFF_DUTY; }
  get hasPosition() { return this.latitude !== null && this.longitude !== null; }
}
