import { inject, Injectable } from '@angular/core';
import { SessionStore } from '../session/session.store';

export interface MediaVariant {
  key: string;
  url: string;
  width: number;
  height: number;
}

export interface MediaItem {
  id: string;
  filename: string;
  url: string;
  mime: string;
  size: number;
  width: number | null;
  height: number | null;
  alt: string | null;
  title: string | null;
  /** Normalized subject point (0..1) for smart cropping; null → center. */
  focalPoint?: { x: number; y: number } | null;
  variants: MediaVariant[];
  createdAt: string;
}

/**
 * Uploads binaries to the CMS `POST /media` endpoint. This is a raw multipart
 * request (not GraphQL), so it can't go through Apollo — we attach the JWT +
 * `x-site` headers by hand from the session, and use XHR for upload progress.
 * The returned `uploadFn` plugs straight into `mk-file-upload`.
 */
@Injectable({ providedIn: 'root' })
export class MediaUploadService {
  private readonly session = inject(SessionStore);

  /** `MkUploadFn`-compatible: streams one file and reports progress. */
  readonly uploadFn = (file: File, onProgress: (percent: number) => void): Promise<void> =>
    new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/media');
      const token = this.session.accessToken();
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      const site = this.session.activeSiteSlug();
      if (site) xhr.setRequestHeader('x-site', site);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`Upload failed (${xhr.status})`));
      };
      xhr.onerror = () => reject(new Error('Network error during upload'));

      const form = new FormData();
      form.append('file', file);
      xhr.send(form);
    });

  /**
   * Upload-and-resolve-URL variant for the block editor's image blocks
   * (`MK_BLOCK_UPLOAD_HANDLER`): same endpoint, but parses the created media
   * item and returns its public URL, so body images land in the media library
   * instead of being inlined as `data:` URLs.
   */
  readonly uploadForUrl = async (file: File): Promise<string> => {
    const headers: Record<string, string> = {};
    const token = this.session.accessToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const site = this.session.activeSiteSlug();
    if (site) headers['x-site'] = site;

    const body = new FormData();
    body.append('file', file);
    const res = await fetch('/media', { method: 'POST', headers, body });
    if (!res.ok) throw new Error(`Upload failed (${res.status})`);
    const item = (await res.json()) as MediaItem;
    if (!item?.url) throw new Error('Upload succeeded but returned no URL');
    return item.url;
  };
}
