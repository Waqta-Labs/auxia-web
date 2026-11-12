export class RegisterResource {
  constructor(inventoryRepository) {
    this.inventoryRepository = inventoryRepository;
  }

  // Errores de validación: nameRequired, categoryRequired, unitRequired, minimumInvalid.
  async execute({ inventoryId, name, category, unit, minimumStock }) {
    const cleanName = (name ?? '').trim();
    if (!cleanName) throw new Error('nameRequired');
    if (!category) throw new Error('categoryRequired');
    const cleanUnit = (unit ?? '').trim();
    if (!cleanUnit) throw new Error('unitRequired');
    const raw = String(minimumStock ?? '').trim();
    const minimum = raw === '' ? 0 : Number(raw.replace(',', '.'));
    if (!Number.isFinite(minimum) || minimum < 0) throw new Error('minimumInvalid');
    return this.inventoryRepository.registerResource(inventoryId, { name: cleanName, category, unit: cleanUnit, minimumStock: minimum });
  }
}
