// Vercel Blob implementation of MagicLinkStorage.
//
// Layout:
//   magic-links/{token}.json   — each record (private)
//
// Records are consume-once: the first successful verify wipes the blob.

import { put, get, del, list } from '@vercel/blob';
import type { MagicLinkStorage, MagicLinkRecord } from './magic-link.js';

function token(): string {
  const t = process.env.BLOB_READ_WRITE_TOKEN;
  if (!t) throw new Error('BLOB_READ_WRITE_TOKEN is not set');
  return t;
}

async function readPrivate(pathname: string): Promise<MagicLinkRecord | null> {
  const result = await get(pathname, { access: 'private', token: token() });
  if (!result || result.statusCode !== 200) return null;
  const chunks: Uint8Array[] = [];
  const reader = result.stream.getReader();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let i = 0;
  for (const c of chunks) {
    out.set(c, i);
    i += c.length;
  }
  return JSON.parse(new TextDecoder().decode(out)) as MagicLinkRecord;
}

export class VercelBlobMagicLinkStorage implements MagicLinkStorage {
  async put(record: MagicLinkRecord): Promise<void> {
    await put(`magic-links/${record.token}.json`, JSON.stringify(record), {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json',
      token: token(),
    });
  }

  /**
   * Atomic consume-or-fail: reads the record, verifies it's unused and
   * unexpired, then deletes it before returning. Replay protection relies
   * on the delete succeeding before the caller acts on the record — if
   * two requests race, the second finds the record already gone.
   */
  async consume(tokenStr: string): Promise<MagicLinkRecord> {
    const record = await readPrivate(`magic-links/${tokenStr}.json`);
    if (!record) {
      throw new Error('Invalid or already-used login link.');
    }
    if (record.consumed_at) {
      throw new Error('This login link has already been used.');
    }
    if (new Date(record.expires_at).getTime() < Date.now()) {
      // Clean up expired record.
      await this.deleteByToken(tokenStr);
      throw new Error('This login link has expired. Ask for a new one.');
    }

    // Delete first, so a replay gets "already used" (not "valid").
    await this.deleteByToken(tokenStr);

    return { ...record, consumed_at: new Date().toISOString() };
  }

  async purgeExpired(): Promise<number> {
    const blobs: Array<{ pathname: string; url: string }> = [];
    let cursor: string | undefined;
    do {
      const page = await list({
        prefix: 'magic-links/',
        cursor,
        token: token(),
      });
      blobs.push(...page.blobs);
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);

    let removed = 0;
    const now = Date.now();
    for (const b of blobs) {
      const tokenFromPath = b.pathname.replace(/^magic-links\//, '').replace(/\.json$/, '');
      const record = await readPrivate(b.pathname);
      if (!record) continue;
      if (record.consumed_at || new Date(record.expires_at).getTime() < now) {
        await this.deleteByToken(tokenFromPath);
        removed++;
      }
    }
    return removed;
  }

  private async deleteByToken(tokenStr: string): Promise<void> {
    // del() accepts pathname directly in current API.
    await del(`magic-links/${tokenStr}.json`, { token: token() });
  }
}

let defaultStorage: MagicLinkStorage | null = null;

export function getMagicLinkStorage(): MagicLinkStorage {
  if (!defaultStorage) defaultStorage = new VercelBlobMagicLinkStorage();
  return defaultStorage;
}
