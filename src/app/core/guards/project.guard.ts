import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { BudgetStateService } from '../services/budget-state.service';

export const projectGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const state = inject(BudgetStateService);
  const router = inject(Router);

  if (auth.isInitializing()) {
    await auth.initializeSession();
  }

  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/']);
  }

  if (state.activeProject()) {
    return true;
  }

  const reopened = await state.tryAutoReopenLastProject();
  if (reopened) {
    return true;
  }

  return router.createUrlTree(['/']);
};
