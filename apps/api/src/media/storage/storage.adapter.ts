/** DI token for the pluggable storage backend (local FS by default). */
export const STORAGE_ADAPTER = Symbol('STORAGE_ADAPTER');

/**
 * Where binaries live. The local adapter ships; an S3/MinIO adapter can be
 * dropped in behind this interface (config-selected) without touching callers.
 * Keys are site-namespaced by the caller, so the adapter treats them opaquely.
 */
export interface StorageAdapter {
  /** Persist bytes under `key`; returns the same key. */
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  /** Read bytes back (used by the local file-serving controller). */
  get(key: string): Promise<Buffer>;
  /** Remove an object; missing keys are a no-op. */
  delete(key: string): Promise<void>;
  /** Public URL for `key`. */
  url(key: string): string;
}
