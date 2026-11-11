import { levelOf } from '../enums/priorityLevel.js';

// Una zona completa (GET /zones/{id}): ubicación, población afectada y prioridad manual.
export class ZoneDetail {
  constructor({
    id, emergencyId = null, name, latitude = null, longitude = null,
    population = null, familiesAffected = null, peopleAffected = null,
    children = null, elderlyPeople = null, disabledPeople = null,
    damageLevel = null, status = null, urgencyScore = null, priorityLevel = null,
    lastAidAt = null, manualPriority = null,
  }) {
    this.id = id;
    this.emergencyId = emergencyId;
    this.name = name;
    this.latitude = latitude;
    this.longitude = longitude;
    this.population = population;
    this.familiesAffected = familiesAffected;
    this.peopleAffected = peopleAffected;
    this.children = children;
    this.elderlyPeople = elderlyPeople;
    this.disabledPeople = disabledPeople;
    this.damageLevel = damageLevel;
    this.status = status;
    this.urgencyScore = urgencyScore;
    this.priorityLevel = priorityLevel;
    this.lastAidAt = lastAidAt;           // epoch ms; null si aún no recibe ayuda
    this.manualPriority = manualPriority; // { reason, setAt } | null
    Object.freeze(this);
  }

  get hasPosition() { return this.latitude !== null && this.longitude !== null; }
  get level() { return levelOf(this.priorityLevel); }
}
