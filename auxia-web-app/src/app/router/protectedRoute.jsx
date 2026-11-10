import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@bc/identityAccess/presentation/hooks/useAuth.js';
import { routes } from './routes.js';

export default function ProtectedRoute({ allowedRoles }) {
  const { isAuthenticated, session } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to={routes.signIn} replace state={{ from: location }} />;
  }
  if (allowedRoles && !allowedRoles.includes(session.role)) {
    return <Navigate to={routes.dashboard} replace />;
  }
  return <Outlet />;
}
