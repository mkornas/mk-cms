import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Menu } from './entities/menu.entity';
import { MenuItem, MenuItemType } from './entities/menu-item.entity';
import { TenantContextService } from '../tenancy/tenant-context.service';
import { ContentEntriesService } from '../content/content-entries.service';
import { ContentTypesService } from '../content/content-types.service';
import { ContentStatus } from '../content/entities/content-entry.entity';

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface CreateMenuInput {
  slug: string;
  name: string;
}

export interface MenuItemInput {
  label: string;
  type?: MenuItemType;
  url?: string | null;
  entryId?: string | null;
  target?: string | null;
  parentId?: string | null;
  sortOrder?: number;
}

export interface ReorderItem {
  id: string;
  parentId: string | null;
  sortOrder: number;
}

/** A resolved, nested menu node for the delivery tree. */
export interface MenuNode {
  id: string;
  label: string;
  url: string | null;
  target: string | null;
  children: MenuNode[];
}

@Injectable()
export class MenusService {
  constructor(
    @InjectRepository(Menu) private readonly menus: Repository<Menu>,
    @InjectRepository(MenuItem) private readonly items: Repository<MenuItem>,
    private readonly tenant: TenantContextService,
    private readonly entries: ContentEntriesService,
    private readonly types: ContentTypesService,
    private readonly dataSource: DataSource,
  ) {}

  private siteId(): string {
    return this.tenant.requireSiteId();
  }

  // ── menus ──────────────────────────────────────────
  listMenus(): Promise<Menu[]> {
    return this.menus.find({
      where: { siteId: this.siteId() },
      order: { slug: 'ASC' },
    });
  }

  async getMenu(slug: string): Promise<Menu> {
    const menu = await this.menus.findOne({
      where: { siteId: this.siteId(), slug },
    });
    if (!menu) throw new NotFoundException(`Unknown menu "${slug}"`);
    return menu;
  }

  async createMenu(input: CreateMenuInput): Promise<Menu> {
    const siteId = this.siteId();
    if (!SLUG_RE.test(input.slug)) {
      throw new BadRequestException(
        'Menu slug must be lowercase words separated by hyphens.',
      );
    }
    if (await this.menus.findOne({ where: { siteId, slug: input.slug } })) {
      throw new ConflictException(`A menu "${input.slug}" already exists.`);
    }
    return this.menus.save(
      this.menus.create({ siteId, slug: input.slug, name: input.name }),
    );
  }

  async deleteMenu(slug: string): Promise<void> {
    const menu = await this.getMenu(slug);
    await this.items.delete({ menuId: menu.id });
    await this.menus.remove(menu);
  }

  /**
   * Clone a menu and its full (nested) item tree into a new menu for the same
   * site. The copy gets a unique slug (`<slug>-copy`, then `-copy-2`, `-copy-3`,
   * …) and a `"<name> (copy)"` name. Items are cloned in two passes inside one
   * transaction: pass 1 inserts every item (parentId left null) building an
   * oldId → newId map; pass 2 remaps each new item's parentId through that map,
   * so the tree is reproduced exactly with fresh ids (no orphans/misparents).
   */
  async duplicate(slug: string): Promise<Menu> {
    const siteId = this.siteId();
    const source = await this.getMenu(slug); // tenant-scoped
    const sourceItems = await this.items.find({
      where: { siteId, menuId: source.id },
      order: { sortOrder: 'ASC' },
    });

    const newSlug = await this.uniqueCopySlug(siteId, source.slug);
    const newName = `${source.name} (copy)`;

    return this.dataSource.transaction(async (mgr) => {
      const menu = await mgr.save(
        mgr.create(Menu, { siteId, slug: newSlug, name: newName }),
      );

      // Pass 1 — insert every item under the new menu (parentId null for now),
      // recording old id → new id.
      const idMap = new Map<string, string>();
      for (const src of sourceItems) {
        const copy = await mgr.save(
          mgr.create(MenuItem, {
            siteId,
            menuId: menu.id,
            parentId: null,
            label: src.label,
            type: src.type,
            url: src.url,
            entryId: src.entryId,
            target: src.target,
            sortOrder: src.sortOrder,
          }),
        );
        idMap.set(src.id, copy.id);
      }

      // Pass 2 — remap parentId from old ids to the freshly created ids.
      for (const src of sourceItems) {
        if (!src.parentId) continue;
        await mgr.update(
          MenuItem,
          { id: idMap.get(src.id)! },
          { parentId: idMap.get(src.parentId) ?? null },
        );
      }

      return menu;
    });
  }

  /** First free slug in the `<base>-copy`, `<base>-copy-2`, … series for a site. */
  private async uniqueCopySlug(
    siteId: string,
    baseSlug: string,
  ): Promise<string> {
    const base = `${baseSlug}-copy`;
    for (let n = 1; ; n++) {
      const candidate = n === 1 ? base : `${base}-${n}`;
      if (!(await this.menus.findOne({ where: { siteId, slug: candidate } }))) {
        return candidate;
      }
    }
  }

  // ── items ──────────────────────────────────────────
  async listItems(menuSlug: string): Promise<MenuItem[]> {
    const menu = await this.getMenu(menuSlug);
    return this.items.find({
      where: { siteId: this.siteId(), menuId: menu.id },
      order: { sortOrder: 'ASC' },
    });
  }

  async addItem(menuSlug: string, input: MenuItemInput): Promise<MenuItem> {
    const menu = await this.getMenu(menuSlug);
    await this.validateItemTarget(input);
    if (input.parentId) await this.assertItemInMenu(input.parentId, menu.id);
    return this.items.save(
      this.items.create({
        siteId: menu.siteId,
        menuId: menu.id,
        label: input.label,
        type: input.type ?? MenuItemType.Custom,
        url: input.url ?? null,
        entryId: input.entryId ?? null,
        target: input.target ?? null,
        parentId: input.parentId ?? null,
        sortOrder: input.sortOrder ?? 0,
      }),
    );
  }

  async updateItem(id: string, patch: MenuItemInput): Promise<MenuItem> {
    const item = await this.getItem(id);
    const next = { ...item, ...patch };
    await this.validateItemTarget(next);
    if (patch.parentId) {
      if (patch.parentId === id) {
        throw new BadRequestException('An item cannot be its own parent.');
      }
      await this.assertItemInMenu(patch.parentId, item.menuId);
    }
    Object.assign(item, {
      label: patch.label ?? item.label,
      type: patch.type ?? item.type,
      url: patch.url !== undefined ? patch.url : item.url,
      entryId: patch.entryId !== undefined ? patch.entryId : item.entryId,
      target: patch.target !== undefined ? patch.target : item.target,
      parentId: patch.parentId !== undefined ? patch.parentId : item.parentId,
      sortOrder: patch.sortOrder ?? item.sortOrder,
    });
    return this.items.save(item);
  }

  async deleteItem(id: string): Promise<void> {
    const item = await this.getItem(id);
    // Re-parent children to this item's parent so the subtree isn't orphaned.
    await this.items.update(
      { menuId: item.menuId, parentId: item.id },
      { parentId: item.parentId },
    );
    await this.items.remove(item);
  }

  /** Bulk-apply a new structure (parent + order) for a whole menu at once —
   * how the admin persists a drag-reordered tree. */
  async reorder(menuSlug: string, updates: ReorderItem[]): Promise<MenuItem[]> {
    const menu = await this.getMenu(menuSlug);
    const existing = await this.items.find({
      where: { siteId: this.siteId(), menuId: menu.id },
    });
    const byId = new Map(existing.map((i) => [i.id, i]));
    for (const u of updates) {
      if (!byId.has(u.id)) {
        throw new BadRequestException(`Item "${u.id}" is not in this menu.`);
      }
      if (u.parentId && !byId.has(u.parentId)) {
        throw new BadRequestException(
          `Parent "${u.parentId}" is not in this menu.`,
        );
      }
      if (u.parentId === u.id) {
        throw new BadRequestException('An item cannot be its own parent.');
      }
    }
    await this.dataSource.transaction(async (mgr) => {
      for (const u of updates) {
        await mgr.update(
          MenuItem,
          { id: u.id },
          { parentId: u.parentId, sortOrder: u.sortOrder },
        );
      }
    });
    return this.listItems(menuSlug);
  }

  // ── delivery tree ──────────────────────────────────
  /**
   * Build the nested tree for a menu. In delivery mode, `entry` items resolve
   * their URL from the linked entry's published slug (unpublished/missing links
   * yield a null URL).
   */
  async buildTree(
    menuSlug: string,
    opts: { publishedOnly?: boolean } = {},
  ): Promise<MenuNode[]> {
    const menu = await this.getMenu(menuSlug);
    const items = await this.items.find({
      where: { siteId: this.siteId(), menuId: menu.id },
      order: { sortOrder: 'ASC' },
    });

    const entryIds = items
      .filter((i) => i.type === MenuItemType.Entry && i.entryId)
      .map((i) => i.entryId as string);
    const entryUrls = await this.resolveEntryUrls(entryIds, opts.publishedOnly);

    const urlFor = (item: MenuItem): string | null => {
      if (item.type === MenuItemType.Entry) {
        return item.entryId ? (entryUrls.get(item.entryId) ?? null) : null;
      }
      return item.url;
    };

    // Group children by parent and recurse from the roots (cycle-guarded).
    const byParent = new Map<string | null, MenuItem[]>();
    for (const item of items) {
      const key = item.parentId;
      (byParent.get(key) ?? byParent.set(key, []).get(key)!).push(item);
    }
    const build = (parentId: string | null, seen: Set<string>): MenuNode[] =>
      (byParent.get(parentId) ?? [])
        .filter((item) => !seen.has(item.id))
        .map((item) => {
          seen.add(item.id);
          return {
            id: item.id,
            label: item.label,
            url: urlFor(item),
            target: item.target,
            children: build(item.id, seen),
          };
        });
    return build(null, new Set());
  }

  // ── helpers ────────────────────────────────────────
  private async resolveEntryUrls(
    entryIds: string[],
    publishedOnly?: boolean,
  ): Promise<Map<string, string | null>> {
    const out = new Map<string, string | null>();
    if (entryIds.length === 0) return out;
    const [entries, types] = await Promise.all([
      this.entries.findByIds([...new Set(entryIds)]),
      this.types.list(),
    ]);
    const patternByTypeId = new Map(
      types.map((t) => [t.id, t.config.seoUrlPattern ?? '/{slug}']),
    );
    for (const entry of entries) {
      if (publishedOnly && entry.status !== ContentStatus.Published) {
        out.set(entry.id, null);
        continue;
      }
      const pattern = patternByTypeId.get(entry.contentTypeId) ?? '/{slug}';
      out.set(
        entry.id,
        entry.slug && pattern ? pattern.replace('{slug}', entry.slug) : null,
      );
    }
    return out;
  }

  private async getItem(id: string): Promise<MenuItem> {
    const item = await this.items.findOne({
      where: { id, siteId: this.siteId() },
    });
    if (!item) throw new NotFoundException('Menu item not found.');
    return item;
  }

  private async assertItemInMenu(itemId: string, menuId: string): Promise<void> {
    const parent = await this.getItem(itemId);
    if (parent.menuId !== menuId) {
      throw new BadRequestException('Parent item belongs to a different menu.');
    }
  }

  private async validateItemTarget(input: MenuItemInput): Promise<void> {
    const type = input.type ?? MenuItemType.Custom;
    if (type === MenuItemType.Entry) {
      if (!input.entryId) {
        throw new BadRequestException('An entry item requires an entryId.');
      }
      await this.entries.getById(input.entryId); // tenant-scoped existence
    } else if (type === MenuItemType.Custom && input.url != null && input.url === '') {
      throw new BadRequestException('A custom item requires a url.');
    }
  }
}
