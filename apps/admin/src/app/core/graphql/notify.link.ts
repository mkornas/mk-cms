import { ApolloLink } from '@apollo/client';
import { tap } from 'rxjs';
import type { MkToastService } from '@mk-kit/ui';

/**
 * Mutations we never auto-toast: auth plumbing (handled by the refresh link /
 * login page) and operations that render their own result surface.
 */
const SKIP = new Set(['Login', 'Refresh', 'TestWebhook', 'ImportWordPress']);

/** A friendly success message derived from the mutation name, or null to stay
 *  silent for reads and unrecognised mutations. */
function successMessage(op: string): string | null {
  if (SKIP.has(op)) return null;
  if (/^Create/.test(op)) return 'Created';
  if (/^(Update|Set|Save)/.test(op)) return 'Saved';
  if (/^(Delete|Remove)/.test(op)) return 'Deleted';
  if (/^Unpublish/.test(op)) return 'Unpublished';
  if (/^Publish/.test(op)) return 'Published';
  if (/^Trash/.test(op)) return 'Moved to trash';
  if (/^Add/.test(op)) return 'Added';
  return null;
}

function isMutation(operation: { query: { definitions: readonly unknown[] } }): boolean {
  return operation.query.definitions.some(
    (d) =>
      (d as { kind?: string; operation?: string }).kind === 'OperationDefinition' &&
      (d as { operation?: string }).operation === 'mutation',
  );
}

/**
 * Surfaces every operation's outcome as a toast so success is no longer silent
 * and failures are always visible: a `success` toast for recognised mutations,
 * a `danger` toast for GraphQL/network errors. `UNAUTHENTICATED` is left alone —
 * the auth-refresh link (which sits above this one) retries it transparently, so
 * the user should never see it. Place this link *below* the refresh link so it
 * sees the retried result, not the transient 401.
 */
export function createNotifyLink(toast: MkToastService): ApolloLink {
  return new ApolloLink((operation, forward) => {
    const mutation = isMutation(operation);
    return forward(operation).pipe(
      tap({
        next: (result) => {
          const errors = result.errors ?? [];
          const shown = errors.find((e) => e?.extensions?.['code'] !== 'UNAUTHENTICATED');
          if (shown) {
            toast.danger(shown.message || 'Something went wrong.');
            return;
          }
          if (errors.length) return; // UNAUTHENTICATED only — refresh handles it.
          if (mutation && operation.operationName) {
            const msg = successMessage(operation.operationName);
            if (msg) toast.success(msg);
          }
        },
        error: (err: unknown) => {
          toast.danger(err instanceof Error ? err.message : 'Network error.');
        },
      }),
    );
  });
}
