import { createBrowserRouter } from 'react-router-dom';
import ProtectedRoute from './protectedRoute.jsx';
import { routes, routeRoles } from './routes.js';
import CommandCenterLayout from '@app/layouts/commandCenter/commandCenterLayout.jsx';
import PublicPortalLayout from '@app/layouts/publicPortal/publicPortalLayout.jsx';
import AuthLayout from '@app/layouts/auth/authLayout.jsx';

// Carga perezosa de cada pantalla.
const page = (loader) => ({
  lazy: async () => ({ Component: (await loader()).default }),
});

const router = createBrowserRouter([
  {
    element: <AuthLayout />,
    children: [
      {
        path: routes.signIn,
        ...page(() => import('@bc/identityAccess/presentation/pages/signInPage.jsx')),
      },
      // Verificación pública: pantalla propia, sin el encabezado del portal.
      {
        path: routes.verifyDelivery,
        ...page(() => import('@bc/citizenTransparency/presentation/pages/verifyDeliveryPage.jsx')),
      },
    ],
  },
  {
    element: <PublicPortalLayout />,
    children: [
      {
        path: routes.publicPortal,
        ...page(() => import('@bc/citizenTransparency/presentation/pages/publicPortalPage.jsx')),
      },
      {
        path: routes.publicZone,
        ...page(() => import('@bc/citizenTransparency/presentation/pages/zoneStatusPage.jsx')),
      },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <CommandCenterLayout />,
        children: [
          {
            path: routes.dashboard,
            ...page(() => import('@app/pages/dashboard/dashboardPage.jsx')),
          },
          {
            path: routes.profile,
            ...page(() => import('@bc/identityAccess/presentation/pages/profilePage.jsx')),
          },
          {
            element: <ProtectedRoute allowedRoles={routeRoles.gisMap} />,
            children: [
              {
                path: routes.gisMap,
                ...page(() => import('@bc/emergencyManagement/presentation/pages/gisMapPage.jsx')),
              },
            ],
          },
          {
            element: <ProtectedRoute allowedRoles={routeRoles.prioritization} />,
            children: [
              {
                path: routes.prioritization,
                ...page(() => import('@bc/emergencyManagement/presentation/pages/prioritizationPage.jsx')),
              },
            ],
          },
          {
            element: <ProtectedRoute allowedRoles={routeRoles.inventory} />,
            children: [
              {
                path: routes.inventory,
                ...page(() => import('@bc/resourceManagement/presentation/pages/inventoryPage.jsx')),
              },
              {
                path: routes.inventoryAlerts,
                ...page(() => import('@bc/resourceManagement/presentation/pages/inventoryAlertsPage.jsx')),
              },
              {
                path: routes.inventoryResources,
                ...page(() => import('@bc/resourceManagement/presentation/pages/inventoryResourcesPage.jsx')),
              },
            ],
          },
          {
            element: <ProtectedRoute allowedRoles={routeRoles.logistics} />,
            children: [
              {
                path: routes.logistics,
                ...page(() => import('@bc/resourceManagement/presentation/pages/fieldLogisticsPage.jsx')),
              },
            ],
          },
          {
            element: <ProtectedRoute allowedRoles={routeRoles.audit} />,
            children: [
              {
                path: routes.audit,
                ...page(() => import('@bc/traceability/presentation/pages/auditLedgerPage.jsx')),
              },
            ],
          },
        ],
      },
    ],
  },
  {
    path: '*',
    ...page(() => import('@app/pages/notFound/notFoundPage.jsx')),
  },
]);

export default router;
