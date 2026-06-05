import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { SettingsService } from '../features/services/settings.service';

export const nexusAuthInterceptor: HttpInterceptorFn = (req, next) => {
  const settings = inject(SettingsService);
  if (!req.url.startsWith(settings.registryUrl())) {
    return next(req);
  }
  return next(req.clone({ setHeaders: { 'X-Nexus-Token': settings.nexusToken() } }));
};
