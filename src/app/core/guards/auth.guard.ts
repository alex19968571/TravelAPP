import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.user()) return true;
  // 記住原本想進入的頁面（例如 /join/:code），登入完成後導回
  sessionStorage.setItem('pending_return_url', state.url);
  return router.createUrlTree(['/login']);
};
