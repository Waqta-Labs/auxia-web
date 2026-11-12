// Crea zonas de prueba en el backend REAL para ver el mapa de calor.
// Uso:  node seedZones.mjs --email TU_CORREO --password TU_CLAVE [--emergency ID] [--lat -11.94 --lng -76.69] [--dry]
// (también lee AUXIA_EMAIL / AUXIA_PASSWORD del entorno, para no dejar la clave en el historial de la terminal).
// Requiere Node 18+. Entra con una cuenta AUTHORITY, elige la emergencia activa y registra 12 zonas alrededor del centro.
const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, arg, i, all) => {
  if (arg.startsWith('--')) pairs.push([arg.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]);
  return pairs;
}, []));

const API = (args.api || 'https://auxia-backend.azurewebsites.net/api/v1').replace(/\/$/, '');
const email = args.email || process.env.AUXIA_EMAIL;
const password = args.password || process.env.AUXIA_PASSWORD;
const centerLat = Number(args.lat ?? -11.94);
const centerLng = Number(args.lng ?? -76.69);
if (!email || !password) {
  console.error('Faltan credenciales: usa --email y --password (o AUXIA_EMAIL / AUXIA_PASSWORD).');
  process.exit(1);
}

// Nombre, desplazamiento en grados (lat, lng) y población total: de menos a más afectadas, para ver todos los colores.
const ZONES = [
  ['Sector Santa Rosa', 0.004, -0.011, 3200],
  ['Villa Esperanza', -0.006, 0.006, 2100],
  ['Quebrada Carossio', 0.011, 0.001, 5400],
  ['Las Terrazas', -0.01, -0.018, 1800],
  ['Huaycán Bajo', -0.015, 0.0, 2600],
  ['Cerro Candela', 0.019, -0.015, 950],
  ['Pedregal Alto', 0.0, 0.02, 600],
  ['Los Cedros', 0.014, 0.016, 300],
  ['Ñaña Alto', 0.022, 0.002, 750],
  ['Carapongo', -0.022, 0.014, 480],
  ['Chaclacayo Norte', 0.006, -0.026, 400],
  ['Santa Eulalia', 0.028, 0.03, 250],
];

const call = async (method, path, { token, body } = {}) => {
  const response = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { ok: response.ok, status: response.status, data };
};
const list = (data) => (Array.isArray(data) ? data : data?.content ?? data?.items ?? data?.emergencies ?? data?.zones ?? []);

console.log('Entrando como ' + email + ' …');
const login = await call('POST', '/auth/sign-in', { body: { email, password } });
if (!login.ok) { console.error('No se pudo iniciar sesión (' + login.status + '):', JSON.stringify(login.data)); process.exit(1); }
const token = login.data.token;
console.log('Rol: ' + login.data.role);
if (login.data.role !== 'AUTHORITY') console.log('! Solo una cuenta AUTHORITY puede registrar zonas; es probable que el backend responda 403.');

const emergencies = list((await call('GET', '/emergencies', { token })).data);
const emergency = args.emergency ? emergencies.find((e) => e.id === args.emergency) ?? { id: args.emergency } : emergencies.find((e) => e.status === 'ACTIVE') ?? emergencies[0];
if (!emergency) { console.error('No hay emergencias activas. Registra una primero (POST /emergencies).'); process.exit(1); }
console.log('Emergencia: ' + (emergency.name ?? '') + ' (' + emergency.id + ')');

const existing = list((await call('GET', '/emergencies/' + emergency.id + '/zones', { token })).data).map((z) => String(z.name).toLowerCase());
let created = 0;
for (const [name, dLat, dLng, population] of ZONES) {
  if (existing.includes(name.toLowerCase())) { console.log('= ya existe: ' + name); continue; }
  // Impacto derivado de la población: personas afectadas ~40%, familias de 4, y reparto de vulnerables.
  const peopleAffected = Math.round(population * 0.4);
  const body = {
    name,
    geolocation: { latitude: Number((centerLat + dLat).toFixed(6)), longitude: Number((centerLng + dLng).toFixed(6)) },
    populationImpact: {
      population,
      familiesAffected: Math.round(peopleAffected / 4),
      peopleAffected,
      children: Math.round(peopleAffected * 0.25),
      elderlyPeople: Math.round(peopleAffected * 0.12),
      disabledPeople: Math.round(peopleAffected * 0.04),
    },
    damageLevel: population > 4000 ? 'CRITICAL' : population > 2000 ? 'SEVERE' : population > 800 ? 'MODERATE' : 'LOW',
  };
  if (args.dry) { console.log('POST /emergencies/' + emergency.id + '/zones ' + JSON.stringify(body)); continue; }
  const result = await call('POST', '/emergencies/' + emergency.id + '/zones', { token, body });
  if (!result.ok) {
    console.error('\nx ' + name + ' -> ' + result.status + '\n  ' + JSON.stringify(result.data) + '\n  cuerpo enviado: ' + JSON.stringify(body));
    console.error('\nSi es un 400, pega aquí el cuerpo de la respuesta y el esquema de POST /emergencies/{emergencyId}/zones del Swagger.');
    process.exit(1);
  }
  created += 1;
  console.log('+ ' + name + ' (' + result.status + ')');
}

if (!args.dry) {
  console.log('\nRegistradas ' + created + ' zonas. Ranking actual:');
  for (const zone of list((await call('GET', '/emergencies/' + emergency.id + '/zones', { token })).data)) {
    console.log('  ' + String(zone.score ?? '—').padStart(3) + '  ' + (zone.priorityLevel ?? 'sin puntaje').padEnd(11) + zone.name);
  }
  console.log('\nSi las zonas salen "sin puntaje", el backend aún no tiene datos para calcularlo: se completa con el impacto de población o con reportes de campo.');
}
