// Login del juego con las cuentas del hub, usando el paquete reutilizable
// @asotomayor86/hub-client. createHubAuth apunta al proxy de auth del hub.
import { createHubAuth } from '@asotomayor86/hub-client/browser';

// URL base del hub. Aceptamos VITE_HUB_URL o derivamos de VITE_NEON_AUTH_URL
// (quitando el sufijo /api/auth que usaba la versión anterior).
export const HUB_URL =
  import.meta.env.VITE_HUB_URL ||
  (import.meta.env.VITE_NEON_AUTH_URL || 'https://one-page-to-rule-them-all.vercel.app/api/auth').replace(
    /\/api\/auth\/?$/,
    '',
  );

const hub = createHubAuth({ hubUrl: HUB_URL });

/** Inicia sesión con email+contraseña del hub. Devuelve { id, name } o lanza error. */
export function loginConHub(email, password) {
  return hub.login(email, password);
}

/** Cierra la sesión de Neon Auth (mejor esfuerzo). */
export function logoutNeon() {
  return hub.logout();
}
