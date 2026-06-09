import { siteToken, setAuthCookie, COOKIE_SITE } from './_lib/auth.js';

// POST /api/access { code } → valida el código de la web y deja una cookie httpOnly.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido.' });
  const code = (req.body?.code ?? '').toString();
  if (code !== (process.env.SITE_ACCESS_CODE || '')) {
    return res.status(401).json({ error: 'Código de acceso incorrecto.' });
  }
  setAuthCookie(res, COOKIE_SITE, siteToken());
  res.status(200).json({ ok: true });
}
