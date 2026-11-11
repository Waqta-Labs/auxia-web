// Datos de prueba con la MISMA forma que las respuestas del backend (ver OpenAPI).

export const emergencyDtos = [
  {
    id: 'em-0001',
    name: 'Inundación Sector Norte',
    type: 'FLOOD',
    description: 'Desborde del río Rímac',
    location: { department: 'Lima', province: 'Lima', district: 'Lurigancho-Chosica' },
    status: 'ACTIVE',
    startDate: '2026-11-08',
  },
];

const priorityOf = (score) => {
  if (score === null) return null;
  if (score > 85) return 'CRITICAL';
  if (score >= 60) return 'HIGH';
  if (score >= 40) return 'MEDIUM';
  return 'LOW';
};

const damageOf = (score) => {
  if (score === null || score <= 40) return 'LOW';
  if (score <= 60) return 'MODERATE';
  return score > 85 ? 'CRITICAL' : 'SEVERE';
};

// Cada elemento junta el item del ranking y la geolocalización de GET /zones/{id}.
const z = (id, name, latitude, longitude, score, needs, peopleAffected, extra = {}) => ({
  id,
  name,
  status: extra.status ?? (score === null ? 'REGISTERED' : 'PRIORITIZED'),
  damageLevel: damageOf(score),
  peopleAffected,
  score,
  priorityLevel: priorityOf(score),
  needs,
  manualPriority: null,
  geolocation: { latitude, longitude },
  lastAidReceivedAt: extra.lastAidReceivedAt ?? null,
});

export const zoneDtos = [
  z('zn-01', 'Sector Santa Rosa', -11.9367, -76.7012, 94, ['MEDICINE', 'WATER'], 320),
  z('zn-02', 'Villa Esperanza', -11.9455, -76.6838, 91, ['SHELTER'], 210),
  z('zn-03', 'Quebrada Carossio', -11.929, -76.689, 88, ['FOOD', 'SHELTER'], 540),
  z('zn-04', 'Las Terrazas', -11.95, -76.708, 72, ['MEDICINE'], 180),
  z('zn-05', 'Huaycán Bajo', -11.955, -76.69, 67, ['WATER'], 260),
  z('zn-06', 'Cerro Candela', -11.921, -76.705, 54, ['FOOD'], 95),
  z('zn-07', 'Pedregal Alto', -11.94, -76.67, 41, ['HYGIENE'], 60, { status: 'SERVED', lastAidReceivedAt: '2026-11-10T15:20:00' }),
  z('zn-08', 'Los Cedros', -11.926, -76.674, null, ['SHELTER'], 30),
  z('zn-09', 'Ñaña Alto', -11.918, -76.688, 38, ['WATER', 'FOOD'], 75),
  z('zn-10', 'Carapongo', -11.962, -76.676, 33, ['HYGIENE'], 48),
  z('zn-11', 'Chaclacayo Norte', -11.934, -76.716, 27, ['FOOD'], 40),
  z('zn-12', 'Santa Eulalia', -11.912, -76.66, 22, ['OTHER'], 25),
];

// Variables que más puntos sumaron en cada score (GET /zones/{id}/score -> topFeatures).
const featureSets = {
  'zn-01': [['damageLevel', 34.5], ['children', 26.1], ['peopleAffected', 18.4]],
  'zn-02': [['damageLevel', 31.2], ['elderlyPeople', 25.3], ['hoursWithoutAid', 19.1]],
  'zn-03': [['peopleAffected', 33.0], ['familiesAffected', 24.6], ['damageLevel', 17.9]],
  'zn-04': [['damageLevel', 28.4], ['peopleAffected', 21.0], ['disabledPeople', 12.7]],
  'zn-05': [['children', 27.5], ['peopleAffected', 20.2], ['hoursWithoutAid', 11.0]],
  'zn-06': [['familiesAffected', 22.1], ['peopleAffected', 14.8], ['damageLevel', 9.6]],
  'zn-07': [['damageLevel', 16.0], ['peopleAffected', 12.2], ['familiesAffected', 8.4]],
  'zn-09': [['peopleAffected', 15.5], ['familiesAffected', 11.3], ['children', 8.0]],
  'zn-10': [['peopleAffected', 13.1], ['familiesAffected', 10.4], ['elderlyPeople', 6.2]],
  'zn-11': [['familiesAffected', 12.6], ['peopleAffected', 9.1], ['damageLevel', 4.7]],
  'zn-12': [['peopleAffected', 9.8], ['familiesAffected', 7.2], ['damageLevel', 3.1]],
};

export const scoreDtos = Object.fromEntries(
  zoneDtos.map((zone) => [
    zone.id,
    zone.score === null
      ? { available: false, score: null, topFeatures: [], modelVersion: null, missingVariables: ['population'] }
      : {
          available: true,
          score: zone.score,
          topFeatures: (featureSets[zone.id] ?? []).map(([feature, contribution]) => ({ feature, contribution })),
          modelVersion: 'urgency-1.3.0',
          missingVariables: [],
        },
  ]),
);

export const fieldReportDtos = Array.from({ length: 1248 }, (_, i) => ({
  id: 'fr-' + i,
  pendingZoneAssignment: i % 34 === 0, // 37 reportes sin zona
}));
