import { Injectable, Logger } from '@nestjs/common';
import type { FieldType } from './field-type.interface';

/**
 * Central registry of available field types. Core types are registered at boot;
 * plugins register their own during activation. Lookups are by id. This is a
 * singleton — the set of field types is instance-wide, not per-tenant.
 */
@Injectable()
export class FieldTypeRegistry {
  private readonly logger = new Logger(FieldTypeRegistry.name);
  private readonly types = new Map<string, FieldType>();

  register(fieldType: FieldType): void {
    if (this.types.has(fieldType.id)) {
      throw new Error(`Field type "${fieldType.id}" is already registered.`);
    }
    this.types.set(fieldType.id, fieldType);
    this.logger.debug(`Registered field type "${fieldType.id}"`);
  }

  /** Remove a registered field type (used when a plugin deactivates). Core
   * field types stay put; only plugin-registered kinds are ever removed. */
  unregister(id: string): void {
    if (this.types.delete(id)) {
      this.logger.debug(`Unregistered field type "${id}"`);
    }
  }

  has(id: string): boolean {
    return this.types.has(id);
  }

  get(id: string): FieldType | undefined {
    return this.types.get(id);
  }

  /** Throws if the id is unknown — used when validating field definitions. */
  require(id: string): FieldType {
    const type = this.types.get(id);
    if (!type) {
      throw new Error(`Unknown field type "${id}".`);
    }
    return type;
  }

  list(): FieldType[] {
    return [...this.types.values()];
  }

  ids(): string[] {
    return [...this.types.keys()];
  }
}
