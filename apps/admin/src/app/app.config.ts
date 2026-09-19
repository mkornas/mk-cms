import {
  ApplicationConfig,
  provideZonelessChangeDetection,
  provideAppInitializer,
  inject,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors, withFetch } from '@angular/common/http';

import { MK_BLOCK_UPLOAD_HANDLER } from '@mk-kit/ui';

import { routes } from './app.routes';
import { provideGraphql } from './core/graphql/graphql.provider';
import { authInterceptor } from './core/graphql/auth.interceptor';
import { AuthService } from './core/auth/auth.service';
import { MediaUploadService } from './core/media/media.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    provideGraphql(),
    // Rehydrate identity + tenant list if a token survived a page reload.
    provideAppInitializer(() => inject(AuthService).bootstrap()),
    // Block-editor image blocks upload through the media library (real URLs,
    // responsive variants) instead of inlining data: URLs into the document.
    {
      provide: MK_BLOCK_UPLOAD_HANDLER,
      useFactory: (media: MediaUploadService) => media.uploadForUrl,
      deps: [MediaUploadService],
    },
  ],
};
