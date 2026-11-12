// Categoría de un recurso (RegisterResourceRequest del backend).
export const StockCategory = Object.freeze({
  WATER: 'WATER', FOOD: 'FOOD', SHELTER: 'SHELTER', HYGIENE: 'HYGIENE', MEDICINE: 'MEDICINE', OTHER: 'OTHER',
});
export const stockCategories = Object.values(StockCategory);

// Unidad de medida (backend): UNIT, KG, LITER o KIT.
export const StockUnit = Object.freeze({ UNIT: 'UNIT', KG: 'KG', LITER: 'LITER', KIT: 'KIT' });
export const stockUnits = Object.values(StockUnit);
