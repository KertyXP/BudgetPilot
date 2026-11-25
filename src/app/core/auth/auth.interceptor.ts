import {
  HttpContextToken,
  HttpErrorResponse,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';

const IS_RETRY_REQUEST = new HttpContextToken<boolean>(() => false);
const GOOGLE_API_PREFIX = 'https://www.googleapis.com/';

function withBearerToken(req: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`,
    },
  });
}

/**
 * Intercepteur fonctionnel :
 * - Injecte automatiquement le Bearer access_token sur les appels Google Drive API.
 * - Sur réponse 401, déclenche un rafraîchissement mutualisé (/api/auth/refresh)
 *   puis rejoue la requête initiale de manière transparente.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(GOOGLE_API_PREFIX)) {
    return next(req);
  }

  const authService = inject(AuthService);
  const currentToken = authService.accessToken();
  const authedReq = currentToken ? withBearerToken(req, currentToken) : req;

  return next(authedReq).pipe(
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        !req.context.get(IS_RETRY_REQUEST)
      ) {
        return authService.refreshToken().pipe(
          switchMap((newToken) => {
            const retriedReq = withBearerToken(req, newToken).clone({
              context: req.context.set(IS_RETRY_REQUEST, true),
            });
            return next(retriedReq);
          }),
          catchError((refreshErr: unknown) => throwError(() => refreshErr)),
        );
      }

      return throwError(() => error);
    }),
  );
};
