import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { UsersService } from '../users/users.service';
import { SitesService } from '../tenancy/sites.service';
import { RolesService } from '../rbac/roles.service';
import { MembershipsService } from '../rbac/memberships.service';
import { PasswordService } from '../auth/password.service';
import { OptionsService } from '../options/options.service';
import { ClsService } from 'nestjs-cls';
import type { AppClsStore } from '../tenancy/cls-store';
import { WpImporterService } from '../importer/wp-importer.service';
import { DEMO_WXR } from './demo-content';

/**
 * First-run bootstrap. Always keeps the global system roles in sync; on a truly
 * empty install (no users) it also provisions a default site + owner account so
 * the instance is immediately usable. Fully idempotent — safe on every boot.
 */
@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private readonly config: AppConfigService,
    private readonly users: UsersService,
    private readonly sites: SitesService,
    private readonly roles: RolesService,
    private readonly memberships: MembershipsService,
    private readonly passwords: PasswordService,
    private readonly options: OptionsService,
    private readonly cls: ClsService<AppClsStore>,
    private readonly importer: WpImporterService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.roles.ensureSystemRoles();

    if (!this.config.seed.enabled) return;
    if ((await this.users.count()) > 0) return;

    await this.provisionInitialInstall();
  }

  private async provisionInitialInstall(): Promise<void> {
    const seed = this.config.seed;

    const site =
      (await this.sites.findBySlug(seed.siteSlug)) ??
      (await this.sites.create({ slug: seed.siteSlug, name: seed.siteName }));

    const ownerRole = await this.roles.findSystemRole('owner');
    if (!ownerRole) {
      // ensureSystemRoles ran above, so this should never happen.
      throw new Error('Owner system role missing after seeding roles.');
    }

    const owner = await this.users.create({
      email: seed.ownerEmail,
      name: seed.ownerName,
      passwordHash: await this.passwords.hash(seed.ownerPassword),
    });

    await this.memberships.create(owner.id, site.id, ownerRole.id);
    await this.options.setGlobal('installed_at', new Date().toISOString());
    await this.options.setGlobal('schema_version', 1);

    this.logger.log(
      `Initial install complete: site "${site.slug}", owner <${owner.email}>.`,
    );
    if (seed.demo) await this.importDemo(site);
    if (seed.ownerPassword === 'changeme123') {
      this.logger.warn(
        'Owner is using the DEFAULT seed password ("changeme123"). ' +
          'Set SEED_OWNER_PASSWORD or change it after first login.',
      );
    }
  }

  /** The bundled demo site, imported inside the site's tenant scope (no request here). */
  private async importDemo(site: { id: string; slug: string }): Promise<void> {
    await this.cls.runWith({ site, siteId: site.id } as AppClsStore, async () => {
      const r = await this.importer.import(DEMO_WXR, { importMedia: false });
      this.logger.log(
        `Demo content: ${r.entriesImported} entries, ${r.termsCreated} terms` +
          (r.warnings.length ? `, ${r.warnings.length} warning(s): ${r.warnings.join('; ')}` : ''),
      );
    });
  }
}
