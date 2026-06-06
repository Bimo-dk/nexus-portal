import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { routes } from './app.routes';
import { authErrorInterceptor } from './interceptors/auth-error.interceptor';
import { correlationIdInterceptor } from '@bimo-dk/nexus-runtime';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authErrorInterceptor, correlationIdInterceptor])),
    provideAnimationsAsync(),
  ],
};
