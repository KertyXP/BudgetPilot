import type { VercelRequest, VercelResponse } from '@vercel/node';

export const REFRESH_COOKIE_NAME = 'bp_refresh_token';
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';

export interface GoogleTokenResponse {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
}

export function getEnvConfig(): {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
} {
  const clientId = process.env['GOOGLE_CLIENT_ID']?.trim() ?? '';
  const clientSecret = process.env['GOOGLE_CLIENT_SECRET']?.trim() ?? '';
  const redirectUri = process.env['GOOGLE_REDIRECT_URI']?.trim() || 'postmessage';
  return { clientId, clientSecret, redirectUri };
}

export function parseCookies(req: VercelRequest): Record<string, string> {
  const header = req.headers.cookie;
  if (!header) {
    return {};
  }
  const cookies: Record<string, string> = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const rawValue = part.slice(idx + 1).trim();
    if (!key) continue;
    try {
      cookies[key] = decodeURIComponent(rawValue);
    } catch {
      cookies[key] = rawValue;
    }
  }
  return cookies;
}

export function setRefreshTokenCookie(res: VercelResponse, refreshToken: string): void {
  // 180 jours (Google peut révoquer avant si inutilisé, mais permet une session durable)
  const maxAgeSeconds = 60 * 60 * 24 * 180;
  const cookie = [
    `${REFRESH_COOKIE_NAME}=${encodeURIComponent(refreshToken)}`,
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    'Path=/api/auth',
    `Max-Age=${maxAgeSeconds}`,
  ].join('; ');
  res.setHeader('Set-Cookie', cookie);
}

export function clearRefreshTokenCookie(res: VercelResponse): void {
  const cookie = [
    `${REFRESH_COOKIE_NAME}=`,
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    'Path=/api/auth',
    'Max-Age=0',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
  ].join('; ');
  res.setHeader('Set-Cookie', cookie);
}

export function setNoStoreHeaders(res: VercelResponse): void {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
}
