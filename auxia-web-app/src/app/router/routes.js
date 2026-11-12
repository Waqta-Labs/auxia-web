import { Role } from '@bc/identityAccess/domain/enums/role.js';

export const routes = Object.freeze({
  signIn: '/sign-in',
  dashboard: '/',
  profile: '/profile',
  gisMap: '/map',
  prioritization: '/prioritization',
  inventory: '/inventory',
  inventoryAlerts: '/inventory/alerts',
  inventoryResources: '/inventory/resources',
  logistics: '/logistics',
  audit: '/audit',
  publicPortal: '/public',
  publicZone: '/public/zones/:zoneId',
  verifyDelivery: '/public/verify/:deliveryId',
});

// Roles con acceso a cada pantalla del centro de mando (ajustables).
export const routeRoles = Object.freeze({
  gisMap: [Role.AUTHORITY, Role.AUDITOR],
  prioritization: [Role.AUTHORITY, Role.AUDITOR],
  inventory: [Role.ORGANIZATION_ADMIN, Role.AUTHORITY],
  logistics: [Role.ORGANIZATION_ADMIN, Role.AUTHORITY],
  audit: [Role.AUTHORITY, Role.AUDITOR],
});
