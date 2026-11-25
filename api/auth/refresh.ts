import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  GOOGLE_TOKEN_URL,
  GoogleTokenResponse,
  REFRESH_COOKIE_NAME,
  clearRefreshTokenCookie,
  getEnvConfig,
  parseCookies,
  setNoStoreHeaders,
  setRefreshTokenCookie,
} from './_utils';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  setNoStoreHeaders(res);

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const { clientId, clientSecret } = getEnvConfig();
  if (!clientId || !clientSecret) {
    res.status(500).json({
      error: 'SERVER_MISCONFIGURED',
      message: 'Variables OAuth Google non configurées sur le serveur.',
    });
    return;
  }

  const cookies = parseCookies(req);
  const refreshToken = cookies[REFRESH_COOKIE_NAME];

  if (!refreshToken) {
    res.status(401).json({
      error: 'NO_REFRESH_TOKEN',
      message: 'Aucune session active trouvée.',
    });
    return;
  }

  try {
    const params = new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    });

    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const data = (await tokenRes.json()) as GoogleTokenResponse;

    if (!tokenRes.ok || !data.access_token) {
      clearRefreshTokenCookie(res);
      res.status(401).json({
        error: data.error ?? 'REFRESH_FAILED',
        message: data.error_description ?? 'Session expirée ou révoquée. Veuillez vous reconnecter.',
      });
      return;
    }

    // Si Google renvoie un refresh_token rotatif, on met à jour le cookie
    if (data.refresh_token) {
      setRefreshTokenCookie(res, data.refresh_token);
    }

    res.status(200).json({
      access_token: data.access_token,
      expires_in: data.expires_in ?? 3600,
      token_type: data.token_type ?? 'Bearer',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne';
    res.status(500).json({ error: 'INTERNAL_ERROR', message });
  }
}
