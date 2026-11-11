export class CreateBrigade {
  constructor(brigadeRepository) {
    this.brigadeRepository = brigadeRepository;
  }

  // Errores de validación: nameRequired, locationInvalid.
  async execute({ name, code, latitude, longitude }) {
    const cleanName = (name ?? '').trim();
    if (!cleanName) throw new Error('nameRequired');
    const lat = Number(latitude);
    const lng = Number(longitude);
    const valid = String(latitude ?? '').trim() !== '' && String(longitude ?? '').trim() !== '' &&
      Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
    if (!valid) throw new Error('locationInvalid');
    return this.brigadeRepository.create({
      name: cleanName,
      code: (code ?? '').trim() || null,
      latitude: lat,
      longitude: lng,
    });
  }
}
