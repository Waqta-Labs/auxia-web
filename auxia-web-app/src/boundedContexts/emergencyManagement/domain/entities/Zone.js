import { levelOf } from '../enums/priorityLevel.js';
import { ACCESS_CONDITIONS, AccessCondition } from '../enums/accessCondition.js';

export class Zone {
  constructor({
    id, emergencyId = null, name, latitude = null, longitude = null,
    urgencyScore = null, priorityLevel = null, damageLevel = null, status = null,
    peopleAffected = null, needs = [], reasons = [], manualPriority = false, accessConditions = {},
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
    this.accessConditions = accessConditions; // { ROAD_BLOCKED: 2, ... }: cuántos SOS de la zona marcaron cada condición
    Object.freeze(this);
  }

  get isCritical() { return this.priorityLevel === 'CRITICAL'; }
  get hasPosition() { return this.latitude !== null && this.longitude !== null; }
  get level() { return levelOf(this.priorityLevel); }
  get blockedRoadReports() { return this.accessConditions[AccessCondition.ROAD_BLOCKED] ?? 0; }

  // Condiciones reportadas, en el orden del SOS, con cuántos reportes las mencionan.
  get reportedAccessConditions() {
    return ACCESS_CONDITIONS
      .filter((condition) => (this.accessConditions[condition] ?? 0) > 0)
      .map((condition) => ({ condition, reports: this.accessConditions[condition] }));
  }

  withReasons(reasons) {
    return new Zone({ ...this, reasons });
  }
}
