// Uso (desde la raíz de auxia-web-app):  node setup.mjs
// Crea la estructura de carpetas y instala las dependencias.
// Opciones:  --no-install  (solo crea carpetas)

import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const SRC = 'src';
const skipInstall = process.argv.includes('--no-install');

// ---------- Carpetas de cada bounded context ----------
const contexts = {
  emergencyManagement: {
    entities: ['entities', 'valueObjects', 'enums', 'repositories', 'services'],
    pages: true,
  },
  resourceManagement: {
    entities: ['entities', 'valueObjects', 'enums', 'repositories', 'services'],
    pages: true,
  },
  traceability: {
    entities: ['entities', 'valueObjects', 'enums', 'repositories', 'services'],
    pages: true,
  },
  identityAccess: {
    entities: ['entities', 'valueObjects', 'enums', 'repositories', 'services'],
    pages: true,
  },
  citizenTransparency: {
    entities: ['entities', 'valueObjects', 'enums', 'repositories'],
    pages: true,
  },
};

const dirs = [];

for (const [name, cfg] of Object.entries(contexts)) {
  const base = `${SRC}/boundedContexts/${name}`;
  // domain
  cfg.entities.forEach((d) => dirs.push(`${base}/domain/${d}`));
  // application
  dirs.push(`${base}/application/useCases`, `${base}/application/dtos`);
  // infrastructure
  dirs.push(
    `${base}/infrastructure/http`,
    `${base}/infrastructure/dtos`,
    `${base}/infrastructure/mappers`,
  );
  // presentation
  dirs.push(
    `${base}/presentation/pages`,
    `${base}/presentation/components`,
    `${base}/presentation/hooks`,
    `${base}/presentation/i18n`,
  );
}

// identityAccess necesita además contexto de sesión y almacenamiento del token
dirs.push(
  `${SRC}/boundedContexts/identityAccess/infrastructure/storage`,
  `${SRC}/boundedContexts/identityAccess/presentation/context`,
);

// ---------- app (router, layouts, providers, páginas transversales) ----------
dirs.push(
  `${SRC}/app/providers`,
  `${SRC}/app/router`,
  `${SRC}/app/layouts/commandCenter`,
  `${SRC}/app/layouts/publicPortal`,
  `${SRC}/app/layouts/auth`,
  `${SRC}/app/pages/dashboard`,
  `${SRC}/app/pages/notFound`,
);

// ---------- shared ----------
dirs.push(
  `${SRC}/shared/domain`,
  `${SRC}/shared/infrastructure/http`,
  `${SRC}/shared/infrastructure/config`,
  `${SRC}/shared/presentation/components`,
  `${SRC}/shared/presentation/hooks`,
  `${SRC}/shared/presentation/styles`,
  `${SRC}/shared/utils`,
);

// ---------- i18n global ----------
dirs.push(`${SRC}/i18n/locales/es`, `${SRC}/i18n/locales/en`);

// ---------- assets ----------
dirs.push(`${SRC}/assets/images`, `${SRC}/assets/icons`, `${SRC}/assets/logos`);

// ---------- Crear carpetas (con .gitkeep para que Git las versione) ----------
let created = 0;
for (const dir of dirs) {
  mkdirSync(dir, { recursive: true });
  const keep = join(dir, '.gitkeep');
  if (!existsSync(keep)) writeFileSync(keep, '');
  created++;
}
console.log(`✔ ${created} carpetas creadas/verificadas.`);

// ---------- Variables de entorno ----------
const envFiles = {
  '.env.development': [
    'VITE_API_URL=https://auxia-backend.azurewebsites.net/api/v1',
    'VITE_AI_URL=https://auxia-ai-service.azurewebsites.net',
    '',
  ].join('\n'),
  '.env.production': [
    'VITE_API_URL=https://auxia-backend.azurewebsites.net/api/v1',
    'VITE_AI_URL=https://auxia-ai-service.azurewebsites.net',
    '',
  ].join('\n'),
};
for (const [file, content] of Object.entries(envFiles)) {
  if (!existsSync(file)) {
    writeFileSync(file, content);
    console.log(`✔ ${file} creado.`);
  }
}

// ---------- Instalar dependencias ----------
if (skipInstall) {
  console.log('Instalación omitida (--no-install).');
} else {
  const deps = [
    'react-router-dom',
    'i18next',
    'react-i18next',
    'i18next-browser-languagedetector',
    'axios',
    '@tanstack/react-query',
    'leaflet',
    'react-leaflet',
  ];
  console.log(`\nInstalando: ${deps.join(', ')}\n`);
  execSync(`npm install ${deps.join(' ')}`, { stdio: 'inherit' });
  console.log('\n✔ Dependencias instaladas.');
}

console.log('\nListo. Siguiente paso: alias en vite.config.js/jsconfig.json, i18n, router y cliente HTTP.');
