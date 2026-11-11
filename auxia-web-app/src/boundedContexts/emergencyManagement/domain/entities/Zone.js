import { levelOf } from '../enums/priorityLevel.js';

export class Zone {
  constructor({
    id, emergencyId = null, name, latitude = null, longitude = null,
    urgencyScore = null, priorityLevel = null, damageLevel = null, status = null,
    peopleAffected = null, needs = [], reasons = [], manualPriority = false,
  }) {
    this.id = id;
    this.emergencyId = emergencyId;
    this.name = name;
    this.latitude = latitude;
    this.longitude = longitude;
    this.urgencyScore = urgencyScore;   // null: la zona aún no tiene puntaje
    this.priorityLevel = priorityLevel; // LOW | MEDIUM | HIGH | CRITICAL (lo decide el backend)
    this.damageLevel = damageLevel;
    this.status = status;               // REGISTERED | PRIORITIZED | SERVED
    this.peopleAffected = peopleAffected;
    this.needs = needs;                 // NeedCategory[]
    this.reasons = reasons;             // [{ key, contribution }] (explicación del score)
    this.manualPriority = manualPriority;
    Object.freeze(this);
  }

  get isCritical() { return this.priorityLevel === 'CRITICAL'; }
  get hasPosition() { return this.latitude !== null && this.longitude !== null; }
  get level() { return levelOf(this.priorityLevel); }

  withReasons(reasons) {
    return new Zone({ ...this, reasons });
  }
}
