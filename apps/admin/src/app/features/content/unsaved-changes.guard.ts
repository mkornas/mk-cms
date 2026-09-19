import { CanDeactivateFn } from '@angular/router';

/** Implemented by components that want to block navigation on unsaved edits. */
export interface CanComponentDeactivate {
  canDeactivate(): boolean | Promise<boolean>;
}

/** Route guard: defers to the component's `canDeactivate()` (allow if absent). */
export const unsavedChangesGuard: CanDeactivateFn<CanComponentDeactivate> = (component) =>
  component.canDeactivate ? component.canDeactivate() : true;
