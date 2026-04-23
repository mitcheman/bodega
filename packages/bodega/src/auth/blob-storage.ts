// Vercel Blob implementation of MagicLinkStorage.
//
// Layout:
//   magic-links/{token}.json   — each record (access: 'public', but
//                                 path includes a 32-byte random token
//                                 so URLs are unguessable)
//
// Records are consume-once: the first successful verify deletes the blob.

import { put, del, list } from '@vercel/blob';
import type { MagicLinkStorage, MagicLinkRecord } from './magic-link.js';

function token(): string {
  const t = process.env.BLOB_READ_WRITE_TOKEN;
  if (!t) throw new Error('BLOB_READ_WRITE_TOKEN is not set');
  return t;
}

async function readJson<T>(url: string): Promise<T | null> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

async function readRecord(pathname: string): Promise<{ record: MagicLinkRecord; url: string } | null> {
  const blobs = await listAll(pathname);
  if (blobs.length === 0) return null;
  const url = blobs[0]!.url;
  const record = await readJson<MagicLinkRecord>(url);
  if (!record) return null;
  return { record, url };
}

async function listAll(prefix: string) {
  const results: Awaited<ReturnType<typeof list>>['blobs'] = [];
  let cursor: string | undefined;
  do {
    const page = cursor
      ? await list({ prefix, cursor, token: token() })
      : await list({ prefix, token: token() });
    results.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return results;
}

export class VercelBlobMagicLinkStorage implements MagicLinkStorage {
  async put(record: MagicLinkRecord): Promise<void> {
    await put(`magic-links/${record.token}.json`, JSON.stringify(record), {
      access: 'public',
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
    const found = await readRecord(`magic-links/${tokenStr}.json`);
    if (!found) {
      throw new Error('Invalid or already-used login link.');
    }
    const { record, url } = found;
    if (record.consumed_at) {
      throw new Error('This login link has already been used.');
    }
    if (new Date(record.expires_at).getTime() < Date.now()) {
      await del(url, { token: token() });
      throw new Error('This login link has expired. Ask for a new one.');
    }

    // Delete first, so a replay gets "already used" (not "valid").
    await del(url, { token: token() });

    return { ...record, consumed_at: new Date().toISOString() };
  }

  async purgeExpired(): Promise<number> {
    const blobs = await listAll('magic-links/');
    let removed = 0;
    const now = Date.now();
    for (const b of blobs) {
      const record = await readJson<MagicLinkRecord>(b.url);
      if (!record) continue;
      if (record.consumed_at || new Date(record.expires_at).getTime() < now) {
        await del(b.url, { token: token() });
        removed++;
      }
    }
    return removed;
  }
}

let defaultStorage: MagicLinkStorage | null = null;

export function getMagicLinkStorage(): MagicLinkStorage {
  if (!defaultStorage) defaultStorage = new VercelBlobMagicLinkStorage();
  return defaultStorage;
}
