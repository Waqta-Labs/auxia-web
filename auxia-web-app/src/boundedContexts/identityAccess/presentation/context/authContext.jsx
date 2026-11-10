import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { signInUseCase } from '../../infrastructure/container.js';
import { tokenStorage } from '../../infrastructure/storage/tokenStorage.js';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => tokenStorage.load());

  const signIn = useCallback(async (credentials) => {
    const newSession = await signInUseCase.execute(credentials);
    tokenStorage.save(newSession);
    setSession(newSession);
    return newSession;
  }, []);

  const signOut = useCallback(() => {
    tokenStorage.clear();
    setSession(null);
  }, []);

  // El cliente HTTP emite este evento ante un 401.
  useEffect(() => {
    window.addEventListener('auxia:unauthorized', signOut);
    return () => window.removeEventListener('auxia:unauthorized', signOut);
  }, [signOut]);

  const value = useMemo(
    () => ({ session, isAuthenticated: Boolean(session), signIn, signOut }),
    [session, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
