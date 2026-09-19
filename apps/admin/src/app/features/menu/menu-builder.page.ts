import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, firstValueFrom } from 'rxjs';
import { Apollo, gql } from 'apollo-angular';
import { ConfirmService } from '../../core/ui/confirm.service';
import {
  MkButton,
  MkCard,
  MkFormField,
  MkInput,
  MkSelect,
  MkAlert,
  MkDialogService,
  MkSkeletonPreset,
} from '@mk-kit/ui';
import { slugify } from '../../core/util/slugify';
import { EntryPickerDialog, EntryRef, EntryPickerData } from '../content/entry-picker.dialog';
import {
  MENUS,
  CREATE_MENU,
  DELETE_MENU,
  ADD_MENU_ITEM,
  DELETE_MENU_ITEM,
  REORDER_MENU,
} from '../../core/graphql/operations';

/** Clone a menu with its full (nested) item tree; returns the new menu's slug. */
const DUPLICATE_MENU = gql`
  mutation DuplicateMenu($slug: String!) {
    duplicateMenu(slug: $slug) {
      id
      slug
      name
    }
  }
`;

interface MenuItem {
  id: string;
  parentId: string | null;
  label: string;
  type: string;
  url: string | null;
  entryId: string | null;
  target: string | null;
  sortOrder: number;
}
interface Menu {
  id: string;
  slug: string;
  name: string;
  items: MenuItem[];
}

/**
 * Menu builder: pick/create a menu, then add nested custom-link items, reorder
 * siblings (up/down → transactional `reorderMenu`), and delete items (the API
 * re-parents children so nothing is orphaned).
 */
@Component({
  selector: 'app-menu-builder',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MkButton, MkCard, MkFormField, MkInput, MkSelect, MkAlert, MkSkeletonPreset],
  templateUrl: './menu-builder.page.html',
  styles: `
    .page-head { margin-bottom: var(--mk-space-5); }
    .page-head h1 { margin: 0; }
    .layout { display: grid; gap: var(--mk-space-4); grid-template-columns: 1fr; }
    @media (min-width: 60rem) { .layout { grid-template-columns: 18rem 1fr; align-items: start; } }
    .menu-list { display: flex; flex-direction: column; gap: var(--mk-space-1); margin-bottom: var(--mk-space-4); }
    .menu-item {
      display: flex; align-items: center; justify-content: space-between; gap: var(--mk-space-2);
      padding: var(--mk-space-2) var(--mk-space-3); border-radius: var(--mk-radius-md); cursor: pointer;
    }
    .menu-item:hover { background: var(--mk-hover-overlay); }
    .menu-item[data-active='true'] { background: var(--mk-selected-bg); color: var(--mk-selected-text); }
    .menu-item small { color: var(--mk-text-muted); }
    .menu-actions { display: flex; align-items: center; gap: var(--mk-space-1); flex-shrink: 0; }
    .new-form, .add-item { display: grid; gap: var(--mk-space-3); }
    .add-item { grid-template-columns: 1fr 1fr auto; align-items: end; }
    .items { display: flex; flex-direction: column; gap: var(--mk-space-1); margin-bottom: var(--mk-space-5); }
    .item-row {
      display: flex; align-items: center; gap: var(--mk-space-2);
      padding: var(--mk-space-2) var(--mk-space-3); border-radius: var(--mk-radius-sm);
      border: var(--mk-border-width) solid var(--mk-border-subtle);
    }
    .item-row .label { font-weight: var(--mk-font-weight-medium); }
    .item-row .url { color: var(--mk-text-muted); font-size: var(--mk-font-size-sm); }
    .item-row .spacer { flex: 1; }
    .type-toggle { display: flex; gap: var(--mk-space-2); margin-bottom: var(--mk-space-3); }
    .picked { display: flex; align-items: center; justify-content: space-between; gap: var(--mk-space-2); }
    .picked small { color: var(--mk-text-muted); }
    h2 { margin: 0 0 var(--mk-space-3); font-size: var(--mk-font-size-lg); }
  `,
})
export class MenuBuilderPage {
  private readonly apollo = inject(Apollo);
  private readonly confirm = inject(ConfirmService);
  private readonly dialog = inject(MkDialogService);

  private readonly menusRef = this.apollo.watchQuery<{ menus: Menu[] }>({
    query: MENUS,
    fetchPolicy: 'cache-and-network',
  });
  protected readonly menus = toSignal(
    this.menusRef.valueChanges.pipe(map((r) => (r.data?.menus ?? []) as Menu[])),
    { initialValue: [] as Menu[] },
  );

  /** In-flight first load (cache-and-network: loading with nothing cached yet). */
  private readonly queryLoading = toSignal(
    this.menusRef.valueChanges.pipe(map((r) => r.loading && !r.data?.menus)),
    { initialValue: true },
  );
  protected readonly showSkeleton = computed(
    () => this.queryLoading() && this.menus().length === 0,
  );
  protected readonly creatingMenu = signal(false);
  protected readonly addingItem = signal(false);

  protected readonly activeSlug = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  protected readonly newMenuName = signal('');
  protected readonly itemLabel = signal('');
  protected readonly itemUrl = signal('');
  protected readonly itemParent = signal<string | null>(null);
  /** Add-item mode: a hand-typed URL or a link to a content entry. */
  protected readonly itemType = signal<'Custom' | 'Entry'>('Custom');
  protected readonly pickedEntry = signal<EntryRef | null>(null);

  protected readonly activeMenu = computed(() =>
    this.menus().find((m) => m.slug === this.activeSlug()) ?? null,
  );

  /** Items flattened depth-first, siblings by sortOrder, with indent depth. */
  protected readonly itemTree = computed<{ item: MenuItem; depth: number; canUp: boolean; canDown: boolean }[]>(() => {
    const items = this.activeMenu()?.items ?? [];
    const byParent = new Map<string | null, MenuItem[]>();
    for (const it of items) {
      const k = it.parentId;
      (byParent.get(k) ?? byParent.set(k, []).get(k)!).push(it);
    }
    for (const list of byParent.values()) list.sort((a, b) => a.sortOrder - b.sortOrder);
    const out: { item: MenuItem; depth: number; canUp: boolean; canDown: boolean }[] = [];
    const walk = (parent: string | null, depth: number): void => {
      const sibs = byParent.get(parent) ?? [];
      sibs.forEach((it, i) => {
        out.push({ item: it, depth, canUp: i > 0, canDown: i < sibs.length - 1 });
        walk(it.id, depth + 1);
      });
    };
    walk(null, 0);
    return out;
  });

  protected readonly parentOptions = computed(() => [
    { label: '— top level —', value: null },
    ...this.itemTree().map(({ item, depth }) => ({
      label: `${'  '.repeat(depth)}${item.label}`,
      value: item.id,
    })),
  ]);

  protected setInput(target: EventTarget | null, set: (v: string) => void): void {
    set((target as HTMLInputElement)?.value ?? '');
  }

  /** mk-select emits `unknown`; option values here are an item id or null. */
  protected asId(v: unknown): string | null {
    return v == null ? null : String(v);
  }

  protected selectMenu(slug: string): void {
    this.activeSlug.set(slug);
    this.itemParent.set(null);
    this.error.set(null);
  }

  protected async createMenu(): Promise<void> {
    const name = this.newMenuName().trim();
    if (!name || this.creatingMenu()) return;
    this.creatingMenu.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(
        this.apollo.mutate({
          mutation: CREATE_MENU,
          variables: { input: { name, slug: slugify(name) } },
        }),
      );
      this.newMenuName.set('');
      await this.menusRef.refetch();
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Create failed.');
    } finally {
      this.creatingMenu.set(false);
    }
  }

  protected async deleteMenu(slug: string, event: Event): Promise<void> {
    event.stopPropagation();
    if (!(await this.confirm.remove(`the “${slug}” menu`))) return;
    this.error.set(null);
    try {
      await firstValueFrom(
        this.apollo.mutate({ mutation: DELETE_MENU, variables: { slug } }),
      );
      if (this.activeSlug() === slug) this.activeSlug.set(null);
      await this.menusRef.refetch();
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Delete failed.');
    }
  }

  /** Clone a menu (with its whole item tree) and select the new copy. */
  protected async duplicateMenu(slug: string, event: Event): Promise<void> {
    event.stopPropagation();
    this.error.set(null);
    try {
      const res = await firstValueFrom(
        this.apollo.mutate<{ duplicateMenu: { slug: string } }>({
          mutation: DUPLICATE_MENU,
          variables: { slug },
        }),
      );
      await this.menusRef.refetch();
      const newSlug = res?.data?.duplicateMenu?.slug;
      if (newSlug) this.selectMenu(newSlug);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Duplicate failed.');
    }
  }

  protected setItemType(type: 'Custom' | 'Entry'): void {
    this.itemType.set(type);
  }

  /** Open the entry picker; default the label to the entry's title. */
  protected async chooseEntry(): Promise<void> {
    const ref = this.dialog.open<EntryPickerDialog, EntryRef, EntryPickerData>(
      EntryPickerDialog,
      { data: {}, ariaLabel: 'Entry picker', size: 'md' },
    );
    const entry = await ref.afterClosed;
    if (!entry) return;
    this.pickedEntry.set(entry);
    if (!this.itemLabel().trim()) this.itemLabel.set(entry.title);
  }

  protected async addItem(): Promise<void> {
    const slug = this.activeSlug();
    const label = this.itemLabel().trim();
    if (!slug || !label || this.addingItem()) return;
    const entry = this.pickedEntry();
    if (this.itemType() === 'Entry' && !entry) {
      this.error.set('Choose an entry to link, or switch to a custom URL.');
      return;
    }
    this.addingItem.set(true);
    this.error.set(null);
    try {
      const input =
        this.itemType() === 'Entry'
          ? { label, type: 'Entry', entryId: entry!.id, parentId: this.itemParent() }
          : { label, type: 'Custom', url: this.itemUrl().trim() || null, parentId: this.itemParent() };
      await firstValueFrom(
        this.apollo.mutate({ mutation: ADD_MENU_ITEM, variables: { menu: slug, input } }),
      );
      this.itemLabel.set('');
      this.itemUrl.set('');
      this.pickedEntry.set(null);
      await this.menusRef.refetch();
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Add item failed.');
    } finally {
      this.addingItem.set(false);
    }
  }

  protected async deleteItem(id: string): Promise<void> {
    if (!(await this.confirm.remove('this menu item'))) return;
    this.error.set(null);
    try {
      await firstValueFrom(
        this.apollo.mutate({ mutation: DELETE_MENU_ITEM, variables: { id } }),
      );
      await this.menusRef.refetch();
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Delete item failed.');
    }
  }

  /** Swap an item with its previous/next sibling and persist the whole order. */
  protected async move(id: string, dir: -1 | 1): Promise<void> {
    const menu = this.activeMenu();
    if (!menu) return;
    const item = menu.items.find((i) => i.id === id);
    if (!item) return;

    // Group every item by parent, ordered by current sortOrder.
    const byParent = new Map<string | null, MenuItem[]>();
    for (const it of menu.items) {
      (byParent.get(it.parentId) ?? byParent.set(it.parentId, []).get(it.parentId)!).push(it);
    }
    for (const list of byParent.values()) list.sort((a, b) => a.sortOrder - b.sortOrder);

    // Swap within the moved item's sibling group.
    const sibs = byParent.get(item.parentId)!;
    const idx = sibs.findIndex((i) => i.id === id);
    const target = idx + dir;
    if (target < 0 || target >= sibs.length) return;
    [sibs[idx], sibs[target]] = [sibs[target], sibs[idx]];

    // Normalize sortOrder (0..n) across every group and send the whole order.
    const payload: { id: string; parentId: string | null; sortOrder: number }[] = [];
    for (const [parentId, list] of byParent) {
      list.forEach((it, i) => payload.push({ id: it.id, parentId, sortOrder: i }));
    }

    this.error.set(null);
    try {
      await firstValueFrom(
        this.apollo.mutate({ mutation: REORDER_MENU, variables: { menu: menu.slug, items: payload } }),
      );
      await this.menusRef.refetch();
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Reorder failed.');
    }
  }
}
