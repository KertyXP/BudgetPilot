import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpBackend, HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, finalize, firstValueFrom, map, shareReplay, tap, throwError } from 'rxjs';

interface AuthConfigResponse {
  clientId: string;
}

interface AuthTokenResponse {
  access_token: string;
  expires_in: number;
  token_type?: string;
  scope?: string;
  has_refresh_token?: boolean;
}

interface GoogleCodeClient {
  requestCode: () => void;
}

interface GoogleCodeResponse {
  code?: string;
  error?: string;
  error_description?: string;
}

interface GoogleAccountsOAuth2 {
  initCodeClient: (config: {
    client_id: string;
    scope: string;
    ux_mode: 'popup' | 'redirect';
    select_account?: boolean;
    callback: (response: GoogleCodeResponse) => void;
    error_callback?: (error: { type: string; message?: string }) => void;
  }) => GoogleCodeClient;
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: GoogleAccountsOAuth2;
      };
    };
  }
}

const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

@Injectable({ providedIn: 'root' })
export class AuthService {
  /**
   * Utilise HttpBackend directement pour éviter toute boucle infinie avec authInterceptor
   * lors des appels /api/auth/*.
   */
  private readonly rawHttp = new HttpClient(inject(HttpBackend));

  private readonly _accessToken = signal<string | null>(null);
  private readonly _isInitializing = signal<boolean>(true);
  private readonly _isLoggingIn = signal<boolean>(false);
  private readonly _authError = signal<string | null>(null);
  private readonly _tokenExpiresAt = signal<number | null>(null);

  readonly accessToken = this._accessToken.asReadonly();
  readonly isAuthenticated = computed(() => this._accessToken() !== null);
  readonly isInitializing = this._isInitializing.asReadonly();
  readonly isLoggingIn = this._isLoggingIn.asReadonly();
  readonly authError = this._authError.asReadonly();
  readonly tokenExpiresAt = this._tokenExpiresAt.asReadonly();

  private cachedClientId: string | null = null;
  private refreshInFlight$: Observable<string> | null = null;

  /**
   * Tente de restaurer silencieusement une session via le cookie HttpOnly refresh_token.
   */
  async initializeSession(): Promise<boolean> {
    this._isInitializing.set(true);
    this._authError.set(null);
    try {
      await firstValueFrom(this.refreshToken());
      return true;
    } catch {
      this._accessToken.set(null);
      return false;
    } finally {
      this._isInitializing.set(false);
    }
  }

  /**
   * Lance le flux OAuth 2.0 Authorization Code via Google Identity Services (popup)
   * puis échange le code côté serveur via POST /api/auth/login.
   */
  async loginWithGoogle(): Promise<boolean> {
    this._isLoggingIn.set(true);
    this._authError.set(null);

    try {
      const clientId = await this.fetchClientId();
      await this.waitForGoogleIdentityScript();

      const code = await this.requestAuthorizationCode(clientId);
      const tokenRes = await firstValueFrom(
        this.rawHttp.post<AuthTokenResponse>(
          '/api/auth/login',
          { code },
          { withCredentials: true },
        ),
      );

      this.applyToken(tokenRes);
      return true;
    } catch (err) {
      const message = this.extractErrorMessage(err);
      this._authError.set(message);
      return false;
    } finally {
      this._isLoggingIn.set(false);
    }
  }

  /**
   * Demande un nouveau access_token à POST /api/auth/refresh.
   * Mutualise les appels concurrents : si plusieurs requêtes Google Drive échouent
   * simultanément en 401, un seul appel réseau est déclenché et toutes reçoivent le nouveau token.
   */
  refreshToken(): Observable<string> {
    if (this.refreshInFlight$) {
      return this.refreshInFlight$;
    }

    this.refreshInFlight$ = this.rawHttp
      .post<AuthTokenResponse>('/api/auth/refresh', {}, { withCredentials: true })
      .pipe(
        tap((res) => this.applyToken(res)),
        map((res) => res.access_token),
        catchError((err: unknown) => {
          this.clearLocalSession();
          return throwError(() => err);
        }),
        finalize(() => {
          this.refreshInFlight$ = null;
        }),
        shareReplay(1),
      );

    return this.refreshInFlight$;
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(
        this.rawHttp.post<{ success: boolean }>('/api/auth/logout', {}, { withCredentials: true }),
      );
    } catch {
      // On nettoie tout de même la session locale
    } finally {
      this.clearLocalSession();
    }
  }

  clearLocalSession(): void {
    this._accessToken.set(null);
    this._tokenExpiresAt.set(null);
  }

  clearError(): void {
    this._authError.set(null);
  }

  private applyToken(res: AuthTokenResponse): void {
    this._accessToken.set(res.access_token);
    const expiresInMs = Math.max(60, res.expires_in ?? 3600) * 1000;
    this._tokenExpiresAt.set(Date.now() + expiresInMs);
    this._authError.set(null);
  }

  private async fetchClientId(): Promise<string> {
    if (this.cachedClientId) {
      return this.cachedClientId;
    }
    const res = await firstValueFrom(this.rawHttp.get<AuthConfigResponse>('/api/auth/config'));
    if (!res.clientId) {
      throw new Error('GOOGLE_CLIENT_ID manquant dans la configuration du serveur.');
    }
    this.cachedClientId = res.clientId;
    return res.clientId;
  }

  private waitForGoogleIdentityScript(timeoutMs = 8000): Promise<void> {
    if (window.google?.accounts?.oauth2?.initCodeClient) {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const startedAt = Date.now();
      const timer = window.setInterval(() => {
        if (window.google?.accounts?.oauth2?.initCodeClient) {
          window.clearInterval(timer);
          resolve();
        } else if (Date.now() - startedAt > timeoutMs) {
          window.clearInterval(timer);
          reject(
            new Error(
              'Le script Google Identity Services n’a pas pu se charger. Vérifiez votre connexion ou un éventuel bloqueur de contenu.',
            ),
          );
        }
      }, 100);
    });
  }

  private requestAuthorizationCode(clientId: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const oauth2 = window.google?.accounts?.oauth2;
      if (!oauth2) {
        reject(new Error('Google Identity Services indisponible.'));
        return;
      }

      const client = oauth2.initCodeClient({
        client_id: clientId,
        scope: DRIVE_FILE_SCOPE,
        ux_mode: 'popup',
        select_account: true,
        callback: (response: GoogleCodeResponse) => {
          if (response.error) {
            reject(
              new Error(
                response.error_description || `Autorisation Google refusée (${response.error}).`,
              ),
            );
            return;
          }
          if (!response.code) {
            reject(new Error('Aucun code d’autorisation reçu de Google.'));
            return;
          }
          resolve(response.code);
        },
        error_callback: (error) => {
          if (error.type === 'popup_closed') {
            reject(new Error('Fenêtre de connexion Google fermée avant validation.'));
          } else {
            reject(
              new Error(error.message || 'Impossible d’ouvrir la fenêtre de connexion Google.'),
            );
          }
        },
      });

      client.requestCode();
    });
  }

  private extractErrorMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const body = err.error as { message?: string; error?: string; text?: string } | string | null;
      if (typeof body === 'object' && body !== null && 'message' in body && body.message) {
        return body.message;
      }
      const rawText =
        typeof body === 'string'
          ? body
          : typeof body === 'object' && body !== null && 'text' in body && typeof body.text === 'string'
            ? body.text
            : '';
      if (err.status === 0) {
        return 'Serveur /api inaccessible. En local, lancez l’application via « vercel dev ».';
      }
      if (err.status === 404 || rawText.trimStart().toLowerCase().startsWith('<!doctype')) {
        return 'Les fonctions serveur /api/auth ne répondent pas (réponse HTML ou 404). En local, lancez « vercel dev » (et non « npm run start » / « ng serve ») afin d’exécuter le backend OAuth.';
      }
      return `Erreur serveur (${err.status}) lors de l’authentification.`;
    }
    if (err instanceof Error) {
      if (err.message.includes('<!doctype')) {
        return 'Les fonctions serveur /api/auth ne sont pas actives. En local, utilisez « vercel dev » au lieu de « npm run start ».';
      }
      return err.message;
    }
    return 'Erreur inattendue lors de la connexion Google.';
  }
}
