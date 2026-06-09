import { getAuth } from './_lib/auth.js';

// GET /api/me → estado de autenticación actual (la cookie es httpOnly, el cliente
// no puede leerla; usa este endpoint para saber si ya tiene acceso al cargar).
export default async function handler(req, res) {
  const { isSite, isAdmin } = getAuth(req);
  res.status(200).json({ isSite, isAdmin });
}
