import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  GOOGLE_REVOKE_URL,
  REFRESH_COOKIE_NAME,
  clearRefreshTokenCookie,
  parseCookies,
  setNoStoreHeaders,
} from './_utils';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  setNoStoreHeaders(res);

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const refreshToken = parseCookies(req)[REFRESH_COOKIE_NAME];
  clearRefreshTokenCookie(res);

  // Révocation best-effort auprès de Google (sans bloquer la déconnexion si elle échoue)
  if (refreshToken) {
    try {
      await fetch(`${GOOGLE_REVOKE_URL}?token=${encodeURIComponent(refreshToken)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
    } catch {
      // Ignoré volontairement : le cookie local est déjà supprimé
    }
  }

  res.status(200).json({ success: true });
}
