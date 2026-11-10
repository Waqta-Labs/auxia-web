// Datos de prueba con la forma (aproximada) de las respuestas del backend.
// Cuando se conecte la API real se reemplaza este archivo por repositorios HTTP.

export const emergencyDtos = [
  {
    id: 'em-0001',
    name: 'Inundación Sector Norte',
    type: 'FLOOD',
    status: 'ACTIVE',
    district: 'Lurigancho-Chosica',
    startDate: '2026-11-08T06:30:00Z',
  },
];

const z = (id, name, latitude, longitude, urgencyScore, needs, topFeatures, manualPriority = false) => ({
  id, emergencyId: 'em-0001', name, latitude, longitude, urgencyScore, needs, topFeatures, manualPriority,
});

export const zoneDtos = [
  z('zn-01', 'Sector Santa Rosa', -11.9367, -76.7012, 94, ['MEDICAL', 'WATER'], [
    { feature: 'children', value: 3 }, { feature: 'noSignal', value: 4 }, { feature: 'accessCut', value: true },
  ]),
  z('zn-02', 'Villa Esperanza', -11.9455, -76.6838, 91, ['RESCUE'], [
    { feature: 'elderly', value: 1 }, { feature: 'isolatedZone', value: true }, { feature: 'noAid', value: 2 },
  ]),
  z('zn-03', 'Quebrada Carossio', -11.929, -76.689, 88, ['FOOD', 'SHELTER'], [
    { feature: 'families', value: 42 }, { feature: 'waterShortage', value: true }, { feature: 'accessCut', value: true },
  ]),
  z('zn-04', 'Las Terrazas', -11.95, -76.708, 72, ['MEDICAL'], [
    { feature: 'injured', value: 4 }, { feature: 'noSignal', value: 2 },
  ]),
  z('zn-05', 'Huaycán Bajo', -11.955, -76.69, 67, ['WATER'], [
    { feature: 'children', value: 6 }, { feature: 'noAid', value: 6 },
  ]),
  z('zn-06', 'Cerro Candela', -11.921, -76.705, 54, ['FOOD'], [{ feature: 'families', value: 15 }]),
  z('zn-07', 'Pedregal Alto', -11.94, -76.67, 41, ['WATER'], [{ feature: 'waterShortage', value: true }]),
  z('zn-08', 'Los Cedros', -11.926, -76.674, null, ['SHELTER'], []),
];

// Reportes de campo: la parte retransmitida por Mesh trae "relay.hops".
export const fieldReportDtos = Array.from({ length: 1248 }, (_, i) => ({
  id: 'fr-' + i,
  relay: i % 20 < 17 ? { hops: 1 + (i % 3) } : null,
}));
