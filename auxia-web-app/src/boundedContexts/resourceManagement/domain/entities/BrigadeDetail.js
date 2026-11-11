import { BrigadeStatus } from '../enums/brigadeStatus.js';

// Una brigada con sus miembros y la misión (asignación) en curso:
// assignment = { planId, zoneId, zoneName, score, etaMinutes, distanceKm, resources: [{ name, quantity, unit }], startedAt } | null
export class BrigadeDetail {
  constructor({ id, name, code = null, status, latitude = null, longitude = null, members = [], assignment = null }) {
    this.id = id;
    this.name = name;
    this.code = code;
    this.status = status;
    this.latitude = latitude;
    this.longitude = longitude;
    this.members = members;
    this.assignment = assignment;
    Object.freeze(this);
  }

  get isDeployed() { return this.status === BrigadeStatus.ASSIGNED; }
  get isOffDuty() { return this.status === BrigadeStatus.OFF_DUTY; }
  get hasPosition() { return this.latitude !== null && this.longitude !== null; }
  // Sin líder no recibe misiones (el backend solo asigna brigadas disponibles con un líder).
  get hasLeader() { return this.members.some((member) => member.isLeader); }
}
