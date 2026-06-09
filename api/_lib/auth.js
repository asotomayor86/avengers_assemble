import crypto from 'node:crypto';

// Autenticación sin estado para serverless: la cookie guarda un token = SHA-256 del
// código de acceso. Para verificar, se recalcula y se compara en tiempo constante.
// No hay tabla de sesiones (cada función es efímera); el "estado" es el propio hash.

export const COOKIE_SITE = 'aa_site';
export const COOKIE_ADMIN = 'aa_admin';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 días

function sha256(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

/** Token esperado para el acceso de jugador (derivado del código de la web). */
export function siteToken() {
  return sha256('site:' + (process.env.SITE_ACCESS_CODE || ''));
}

/** Token esperado para el acceso de administrador. */
export function adminToken() {
  return sha256('admin:' + (process.env.ADMIN_CODE || ''));
}

/** Comparación en tiempo constante de dos hex del mismo tamaño. */
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i === -1) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

/** Añade una cookie httpOnly al response (acumulando con otras Set-Cookie). */
export function setAuthCookie(res, name, value) {
  const cookie = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Secure',
    `Max-Age=${MAX_AGE}`,
  ].join('; ');
  const prev = res.getHeader('Set-Cookie');
  res.setHeader('Set-Cookie', prev ? [].concat(prev, cookie) : cookie);
}

/** Estado de autenticación de la petición. Admin implica también acceso de jugador. */
export function getAuth(req) {
  const c = parseCookies(req);
  const isAdmin = !!c[COOKIE_ADMIN] && safeEqual(c[COOKIE_ADMIN], adminToken());
  const isSite = isAdmin || (!!c[COOKIE_SITE] && safeEqual(c[COOKIE_SITE], siteToken()));
  return { isSite, isAdmin };
}

/** Exige acceso de jugador; si falta, responde 401 y devuelve null. */
export function requireSite(req, res) {
  const auth = getAuth(req);
  if (!auth.isSite) {
    res.status(401).json({ error: 'No autorizado. Introduce el código de acceso.' });
    return null;
  }
  return auth;
}

/** Exige acceso de administrador; si falta, responde 403 y devuelve null. */
export function requireAdmin(req, res) {
  const auth = getAuth(req);
  if (!auth.isAdmin) {
    res.status(403).json({ error: 'Acceso de administrador requerido.' });
    return null;
  }
  return auth;
}
