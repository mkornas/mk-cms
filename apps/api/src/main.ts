import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AppConfigService } from './config/app-config.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: false });

  app.enableShutdownHooks();
  // Security headers (HSTS, X-Content-Type-Options, frameguard, …). CSP is left
  // off here — it's applied at the SPA's host, and Apollo's landing page (dev)
  // needs inline scripts.
  app.use(helmet({ contentSecurityPolicy: false }));
  // CORS: tenant websites live on their own domains and call the public
  // surfaces (delivery GraphQL, form submits, search) from the browser. Auth is
  // header-token only (no cookies), so reflecting the caller's origin without
  // credentials adds no CSRF surface — a cross-origin page still can't read
  // another user's token. Per-site origin allowlists (from `site.domains`) are
  // a later hardening step; see docs/HOSTING.md.
  app.enableCors({ origin: true, credentials: false, maxAge: 86_400 });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );

  const config = app.get(AppConfigService);
  const { host, port, env, adminDir } = config.app;

  // Optionally serve the built admin SPA from the same origin: static files
  // first, then index.html for any other GET that wants HTML and is not an
  // API path — a middleware, so it runs before Nest's routes and 404.
  const admin = adminDir ? resolve(adminDir) : '';
  if (admin && existsSync(join(admin, 'index.html'))) {
    app.useStaticAssets(admin, { index: 'index.html', maxAge: '1h' });
    const index = join(admin, 'index.html');
    app.use((req: Request, res: Response, next: NextFunction) => {
      const spa =
        req.method === 'GET' &&
        !/^\/(graphql|media|health)(\/|$)/.test(req.path) &&
        !/\.[a-z0-9]+$/i.test(req.path) &&
        req.accepts(['html', 'json']) === 'html';
      if (!spa) return next();
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(index);
    });
  } else if (adminDir) {
    new Logger('Bootstrap').warn(`ADMIN_DIR=${adminDir} has no index.html — serving the API only`);
  }

  await app.listen(port, host);

  const logger = new Logger('Bootstrap');
  logger.log(`mk-cms API [${env}] listening on http://${host}:${port}`);
  logger.log(`Health: http://${host}:${port}/health`);
  if (admin) logger.log(`Admin: http://${host}:${port}/`);
}

void bootstrap();
