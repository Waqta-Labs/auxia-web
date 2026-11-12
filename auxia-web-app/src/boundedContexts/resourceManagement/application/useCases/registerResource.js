export class RegisterResource {
  constructor(inventoryRepository) {
    this.inventoryRepository = inventoryRepository;
  }

  // Errores de validación: nameRequired, nameTooLong, categoryRequired, unitRequired, minimumInvalid.
  async execute({ inventoryId, name, category, unit, minimumStock }) {
    const cleanName = (name ?? '').trim();
    if (!cleanName) throw new Error('nameRequired');
    if (cleanName.length > 150) throw new Error('nameTooLong');
    if (!category) throw new Error('categoryRequired');
    if (!unit) throw new Error('unitRequired');
    // minimumStock es un entero (int32) igual o mayor que 0; vacío = 0.
    const raw = String(minimumStock ?? '').trim();
    const minimum = raw === '' ? 0 : Number(raw);
    if (!Number.isInteger(minimum) || minimum < 0) throw new Error('minimumInvalid');
    return this.inventoryRepository.registerResource(inventoryId, { name: cleanName, category, unit, minimumStock: minimum });
  }
}
