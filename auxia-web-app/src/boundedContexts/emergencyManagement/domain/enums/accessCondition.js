// Condiciones de acceso que el ciudadano marca en el detalle del SOS (aplicación móvil, A_04).
// El ranking de zonas trae cuántos SOS de la zona marcaron cada una.
export const AccessCondition = Object.freeze({
  ROAD_BLOCKED: 'ROAD_BLOCKED',
  NO_DRINKING_WATER: 'NO_DRINKING_WATER',
  NO_CELL_SIGNAL: 'NO_CELL_SIGNAL',
  DAMAGED_BUILDING: 'DAMAGED_BUILDING',
});

export const ACCESS_CONDITIONS = Object.values(AccessCondition);
