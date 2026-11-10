import { AuthSession } from '../../domain/entities/AuthSession.js';

const KEY = 'auxia.session';

export const tokenStorage = {
  save(session) {
    try {
      localStorage.setItem(KEY, JSON.stringify(session));
    } catch { /* almacenamiento no disponible */ }
  },

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const session = new AuthSession(JSON.parse(raw));
      if (session.isExpired()) {
        localStorage.removeItem(KEY);
        return null;
      }
      return session;
    } catch {
      return null;
    }
  },

  clear() {
    try {
      localStorage.removeItem(KEY);
    } catch { /* noop */ }
  },
};
