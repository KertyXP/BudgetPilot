import type { VercelRequest, VercelResponse } from '@vercel/node';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

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

function readLocalEnvFallback(): Record<string, string> {
  const result: Record<string, string> = {};
  const candidates = ['.env.local', '.env'];

  for (const file of candidates) {
    const fullPath = join(process.cwd(), file);
    if (!existsSync(fullPath)) continue;

    try {
      const content = readFileSync(fullPath, 'utf8');
      for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;
        const eqIdx = line.indexOf('=');
        if (eqIdx <= 0) continue;
        const key = line.slice(0, eqIdx).trim();
        let value = line.slice(eqIdx + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1).trim();
        }
        if (key && !(key in result)) {
          result[key] = value;
        }
      }
    } catch {
      // Ignore read errors in serverless runtime
    }
  }

  return result;
}

export function getEnvConfig(): {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
} {
  let clientId = process.env['GOOGLE_CLIENT_ID']?.trim() ?? '';
  let clientSecret = process.env['GOOGLE_CLIENT_SECRET']?.trim() ?? '';
  let redirectUri = process.env['GOOGLE_REDIRECT_URI']?.trim() ?? '';

  // Fallback local dev (si vercel dev n'a pas injecté .env.local dans le worker de fonction)
  if (!clientId || !clientSecret) {
    const localEnv = readLocalEnvFallback();
    if (!clientId) clientId = localEnv['GOOGLE_CLIENT_ID'] ?? '';
    if (!clientSecret) clientSecret = localEnv['GOOGLE_CLIENT_SECRET'] ?? '';
    if (!redirectUri) redirectUri = localEnv['GOOGLE_REDIRECT_URI'] ?? '';
  }

  return {
    clientId,
    clientSecret,
    redirectUri: redirectUri || 'postmessage',
  };
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
