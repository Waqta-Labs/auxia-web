import { parseImpact } from '../../domain/services/populationImpact.js';

const MAX_NAME = 150;

// Registra una zona en la emergencia. Los errores de validación son claves de i18n (gisMap.errors.*).
export class RegisterZone {
  constructor(zoneRepository) {
    this.zoneRepository = zoneRepository;
  }

  async execute({ emergencyId, name, latitude, longitude, damageLevel, impact }) {
    if (!emergencyId) throw new Error('noEmergency');
    const cleanName = String(name ?? '').trim();
    if (!cleanName) throw new Error('nameRequired');
    if (cleanName.length > MAX_NAME) throw new Error('nameTooLong');

    const lat = Number(latitude);
    const lng = Number(longitude);
    if (latitude === '' || latitude === null || !Number.isFinite(lat) || lat < -90 || lat > 90) throw new Error('latitudeInvalid');
    if (longitude === '' || longitude === null || !Number.isFinite(lng) || lng < -180 || lng > 180) throw new Error('longitudeInvalid');

    return this.zoneRepository.register(emergencyId, {
      name: cleanName,
      latitude: lat,
      longitude: lng,
      damageLevel: damageLevel || null,
      impact: parseImpact(impact),
    });
  }
}
