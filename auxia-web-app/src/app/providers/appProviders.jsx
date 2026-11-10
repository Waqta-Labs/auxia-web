import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@bc/identityAccess/presentation/context/authContext.jsx';
import { tokenStorage } from '@bc/identityAccess/infrastructure/storage/tokenStorage.js';
import { configureHttpClient } from '@shared/infrastructure/http/httpClient.js';

// Conecta el cliente HTTP (shared) con la sesión (identityAccess).
configureHttpClient({
  getToken: () => tokenStorage.load()?.token ?? null,
  onUnauthorized: () => window.dispatchEvent(new Event('auxia:unauthorized')),
});

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

export default function AppProviders({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}
