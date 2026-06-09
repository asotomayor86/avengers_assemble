import { siteToken, setAuthCookie, clearAuthCookie, COOKIE_SITE } from './_lib/auth.js';

// POST /api/access { code } → valida el código de la web y deja una cookie httpOnly.
// DELETE /api/access → cierra sesión (caduca la cookie). Se hace aquí para no gastar
// otra función serverless (el plan Hobby limita a 12).
export default async function handler(req, res) {
  if (req.method === 'DELETE') {
    clearAuthCookie(res, COOKIE_SITE);
    return res.status(200).json({ ok: true });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido.' });
  const code = (req.body?.code ?? '').toString();
  if (code !== (process.env.SITE_ACCESS_CODE || '')) {
    return res.status(401).json({ error: 'Código de acceso incorrecto.' });
  }
  setAuthCookie(res, COOKIE_SITE, siteToken());
  res.status(200).json({ ok: true });
}
