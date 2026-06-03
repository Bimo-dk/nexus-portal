import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../environments/environment';

export const nexusAuthInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.registryUrl)) {
    return next(req);
  }
  const authed = req.clone({
    setHeaders: { 'X-Nexus-Token': environment.nexusToken },
  });
  return next(authed);
};
