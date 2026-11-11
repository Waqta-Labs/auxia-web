import axios from 'axios';
import i18n from 'i18next';
import { env } from '../config/env.js';

let getToken = () => null;
let onUnauthorized = () => {};

// Lo invoca la app al arrancar para no acoplar shared con identityAccess.
export function configureHttpClient(config) {
  if (config.getToken) getToken = config.getToken;
  if (config.onUnauthorized) onUnauthorized = config.onUnauthorized;
}

export const httpClient = axios.create({
  baseURL: env.apiUrl,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

httpClient.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = 'Bearer ' + token;
  // El backend responde en español solo si se lo pedimos.
  config.headers['Accept-Language'] = i18n.resolvedLanguage || 'es';
  return config;
});

httpClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) onUnauthorized();
    return Promise.reject(error);
  },
);
