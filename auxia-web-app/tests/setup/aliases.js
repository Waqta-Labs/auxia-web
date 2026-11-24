// Registra los alias de Vite (@bc, @shared, ...) para las pruebas con el runner de Node.
import { register } from 'node:module';

register('./aliasHooks.js', import.meta.url);
