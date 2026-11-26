import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  GOOGLE_TOKEN_URL,
  GoogleTokenResponse,
  REFRESH_COOKIE_NAME,
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

  const { clientId, clientSecret, redirectUri } = getEnvConfig();
  if (!clientId || !clientSecret) {
    res.status(500).json({
      error: 'SERVER_MISCONFIGURED',
      message:
        'GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET doivent être configurés dans les variables d’environnement.',
    });
    return;
  }

  const body =
    typeof req.body === 'string'
      ? (JSON.parse(req.body || '{}') as { code?: unknown })
      : ((req.body ?? {}) as { code?: unknown });

  const code = typeof body.code === 'string' ? body.code.trim() : '';
  if (!code) {
    res.status(400).json({ error: 'MISSING_CODE', message: 'Code d’autorisation manquant.' });
    return;
  }

  try {
    const params = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });

    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const data = (await tokenRes.json()) as GoogleTokenResponse;

    if (!tokenRes.ok || !data.access_token) {
      res.status(401).json({
        error: data.error ?? 'TOKEN_EXCHANGE_FAILED',
        message: data.error_description ?? 'Échec de l’échange du code OAuth auprès de Google.',
      });
      return;
    }

    const grantedScopes = (data.scope ?? '').split(/\s+/);
    if (!grantedScopes.includes('https://www.googleapis.com/auth/drive.file')) {
      res.status(403).json({
        error: 'MISSING_DRIVE_SCOPE',
        message:
          'Accès Google Drive non accordé. Reconnectez-vous et cochez la case autorisant BudgetPilot à gérer ses fichiers Google Drive.',
      });
      return;
    }

    const existingRefresh = parseCookies(req)[REFRESH_COOKIE_NAME];
    const refreshTokenToStore = data.refresh_token || existingRefresh;

    if (refreshTokenToStore) {
      setRefreshTokenCookie(res, refreshTokenToStore);
    }

    res.status(200).json({
      access_token: data.access_token,
      expires_in: data.expires_in ?? 3600,
      token_type: data.token_type ?? 'Bearer',
      scope: data.scope ?? '',
      has_refresh_token: Boolean(refreshTokenToStore),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne';
    res.status(500).json({ error: 'INTERNAL_ERROR', message });
  }
}
