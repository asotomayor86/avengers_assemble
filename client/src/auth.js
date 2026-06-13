import { createAuthClient } from '@neondatabase/auth';

// Cliente de Neon Auth del juego: apunta al PROXY de auth del HUB, así se usan las
// MISMAS cuentas (email+contraseña) que en el hub. El login verifica la contraseña
// real contra Neon Auth; con el userId resultante, el juego fija su propia sesión
// (cookie aa_user en su dominio) llamando a /api/access.
//
// Configura VITE_NEON_AUTH_URL en el juego (build) = https://<hub>/api/auth
const NEON_AUTH_URL =
  import.meta.env.VITE_NEON_AUTH_URL ||
  'https://one-page-to-rule-them-all.vercel.app/api/auth';

export const authClient = createAuthClient(NEON_AUTH_URL);

/** Inicia sesión con email+contraseña del hub. Devuelve { id, name } o lanza error. */
export async function loginConHub(email, password) {
  const res = await authClient.signIn.email({ email, password });
  const error = res?.error;
  if (error) {
    throw new Error(error.message || 'Email o contraseña incorrectos.');
  }
  // La forma del resultado puede ser { data: { user } } o { user }.
  const user = res?.data?.user ?? res?.user;
  if (!user?.id) throw new Error('No se pudo iniciar sesión.');
  return { id: user.id, name: user.name || user.email || '' };
}

/** Cierra la sesión de Neon Auth (mejor esfuerzo). */
export async function logoutNeon() {
  try {
    await authClient.signOut();
  } catch {
    /* la cookie del juego se limpia aparte en /api/access */
  }
}
