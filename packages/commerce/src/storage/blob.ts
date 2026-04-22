// Vercel Blob implementation of CommerceStorage. Phase 1 persistence.
//
// Storage layout:
//
//   products/{id}.json           — full Product records           (public)
//   products/_index.json         — slug/published index           (public)
//   orders/{id}.json             — full Order records             (private — PII)
//   orders/_by-pi/{pi}.json      — pointer: { id } by PaymentIntent (private)
//   carts/{id}.json              — Cart records (TTL: 90 days)    (private)
//
// Access rules:
//   - Public blobs: products + index. Served to shoppers on /shop via
//     predictable URLs. No sensitive data here.
//   - Private blobs: orders, carts, magic-links. Contain customer PII
//     or auth state. Reads go through get() with the server token.
//
// All paths use addRandomSuffix: false + allowOverwrite: true so we can
// update records in place using a deterministic pathname.
//
// API verified against @vercel/blob 2026 docs: put / list / head / del / get.

import { put, list, get, del } from '@vercel/blob';
import type { CommerceStorage } from './interface.js';
import type { Product, Order, Cart, CartItem } from '../types.js';

function token(): string {
  const t = process.env.BLOB_READ_WRITE_TOKEN;
  if (!t) throw new Error('BLOB_READ_WRITE_TOKEN is not set');
  return t;
}

// ─── Helpers ──────────────────────────────────────────────────────────

/**
 * Read JSON from a public blob URL via fetch. Works only for
 * access: 'public' blobs.
 */
async function readPublicJson<T>(url: string): Promise<T | null> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

/**
 * Read JSON from a private blob by pathname using the SDK's get(). The
 * returned stream is consumed into a string and parsed.
 */
async function readPrivateJson<T>(pathname: string): Promise<T | null> {
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
  const text = new TextDecoder().decode(concat(chunks));
  return JSON.parse(text) as T;
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let i = 0;
  for (const c of chunks) {
    out.set(c, i);
    i += c.length;
  }
  return out;
}

async function putPublicJson(pathname: string, value: unknown): Promise<string> {
  const { url } = await put(pathname, JSON.stringify(value, null, 2), {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
    token: token(),
  });
  return url;
}

async function putPrivateJson(pathname: string, value: unknown): Promise<void> {
  await put(pathname, JSON.stringify(value, null, 2), {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
    token: token(),
  });
}

/**
 * List all blobs with a given prefix, exhausting pagination. Prefer this
 * over a single list() call for anything that might have >100 entries.
 */
async function listAll(prefix: string) {
  const results: Awaited<ReturnType<typeof list>>['blobs'] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix, cursor, token: token() });
    results.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return results;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80);
}

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function now(): string {
  return new Date().toISOString();
}

// ─── Product index (slug → id) ────────────────────────────────────────

interface ProductIndex {
  entries: Array<{ id: string; slug: string; published: boolean; updated_at: string }>;
}

async function readIndex(): Promise<ProductIndex> {
  const blobs = await listAll('products/_index.json');
  if (blobs.length === 0) return { entries: [] };
  const index = await readPublicJson<ProductIndex>(blobs[0]!.url);
  return index ?? { entries: [] };
}

async function writeIndex(index: ProductIndex): Promise<void> {
  await putPublicJson('products/_index.json', index);
}

// ─── Vercel Blob storage ──────────────────────────────────────────────

export class VercelBlobStorage implements CommerceStorage {
  // Products

  async listProducts(options: { includeUnpublished?: boolean } = {}): Promise<Product[]> {
    const index = await readIndex();
    const entries = options.includeUnpublished
      ? index.entries
      : index.entries.filter((e) => e.published);

    entries.sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));

    const products: Product[] = [];
    for (const entry of entries) {
      const product = await this.getProductById(entry.id);
      if (product) products.push(product);
    }
    return products;
  }

  async getProductBySlug(slug: string): Promise<Product | null> {
    const index = await readIndex();
    const entry = index.entries.find((e) => e.slug === slug);
    if (!entry) return null;
    return this.getProductById(entry.id);
  }

  async getProductById(id: string): Promise<Product | null> {
    const blobs = await listAll(`products/${id}.json`);
    if (blobs.length === 0) return null;
    return readPublicJson<Product>(blobs[0]!.url);
  }

  async upsertProduct(
    partial: Partial<Product> & Pick<Product, 'title' | 'price_cents'>,
  ): Promise<Product> {
    const existing = partial.id ? await this.getProductById(partial.id) : null;

    const product: Product = {
      id: partial.id ?? uuid(),
      slug: partial.slug ?? slugify(partial.title),
      title: partial.title,
      description: partial.description ?? '',
      price_cents: partial.price_cents,
      currency: partial.currency ?? 'USD',
      images: partial.images ?? [],
      tags: partial.tags ?? [],
      kind: partial.kind ?? 'physical',
      inventory: partial.inventory ?? null,
      weight_grams: partial.weight_grams,
      published: partial.published ?? false,
      created_at: existing?.created_at ?? now(),
      updated_at: now(),
    };

    await putPublicJson(`products/${product.id}.json`, product);

    const index = await readIndex();
    const existingEntry = index.entries.find((e) => e.id === product.id);
    if (existingEntry) {
      existingEntry.slug = product.slug;
      existingEntry.published = product.published;
      existingEntry.updated_at = product.updated_at;
    } else {
      index.entries.push({
        id: product.id,
        slug: product.slug,
        published: product.published,
        updated_at: product.updated_at,
      });
    }
    await writeIndex(index);

    return product;
  }

  async deleteProduct(id: string): Promise<void> {
    // Soft-delete to preserve order history references.
    const existing = await this.getProductById(id);
    if (!existing) return;
    existing.published = false;
    existing.updated_at = now();
    await putPublicJson(`products/${id}.json`, existing);

    const index = await readIndex();
    const entry = index.entries.find((e) => e.id === id);
    if (entry) {
      entry.published = false;
      entry.updated_at = existing.updated_at;
      await writeIndex(index);
    }
  }

  // Orders (private blobs — reads via get())

  async listOrders(options: { status?: Order['status'] } = {}): Promise<Order[]> {
    const blobs = await listAll('orders/');
    const results: Order[] = [];
    for (const b of blobs) {
      if (b.pathname.includes('/_by-pi/')) continue;
      const order = await readPrivateJson<Order>(b.pathname);
      if (!order) continue;
      if (options.status && order.status !== options.status) continue;
      results.push(order);
    }
    results.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    return results;
  }

  async getOrderById(id: string): Promise<Order | null> {
    return readPrivateJson<Order>(`orders/${id}.json`);
  }

  async getOrderByPaymentIntent(pi_id: string): Promise<Order | null> {
    const pointer = await readPrivateJson<{ id: string }>(`orders/_by-pi/${pi_id}.json`);
    if (!pointer) return null;
    return this.getOrderById(pointer.id);
  }

  async upsertOrder(
    partial: Partial<Order> & Pick<Order, 'stripe_payment_intent_id'>,
  ): Promise<Order> {
    const existing = await this.getOrderByPaymentIntent(partial.stripe_payment_intent_id);

    const order: Order = {
      id: existing?.id ?? uuid(),
      stripe_payment_intent_id: partial.stripe_payment_intent_id,
      customer: partial.customer ?? { email: '' },
      shipping_address: partial.shipping_address ?? existing?.shipping_address,
      line_items: partial.line_items ?? existing?.line_items ?? [],
      subtotal_cents: partial.subtotal_cents ?? existing?.subtotal_cents ?? 0,
      shipping_cents: partial.shipping_cents ?? existing?.shipping_cents ?? 0,
      tax_cents: partial.tax_cents ?? existing?.tax_cents ?? 0,
      total_cents: partial.total_cents ?? existing?.total_cents ?? 0,
      currency: partial.currency ?? existing?.currency ?? 'USD',
      status: partial.status ?? existing?.status ?? 'pending',
      tracking: partial.tracking ?? existing?.tracking,
      created_at: existing?.created_at ?? now(),
      updated_at: now(),
    };

    await putPrivateJson(`orders/${order.id}.json`, order);
    await putPrivateJson(`orders/_by-pi/${order.stripe_payment_intent_id}.json`, {
      id: order.id,
    });

    return order;
  }

  // Carts (private)

  async getCart(id: string): Promise<Cart | null> {
    return readPrivateJson<Cart>(`carts/${id}.json`);
  }

  async createCart(): Promise<Cart> {
    const cart: Cart = {
      id: uuid(),
      items: [],
      subtotal_cents: 0,
      currency: 'USD',
      updated_at: now(),
    };
    await putPrivateJson(`carts/${cart.id}.json`, cart);
    return cart;
  }

  async updateCart(cart: Cart): Promise<Cart> {
    const updated: Cart = { ...cart, updated_at: now() };
    await putPrivateJson(`carts/${updated.id}.json`, updated);
    return updated;
  }

  async purgeStaleCarts(olderThanDays: number): Promise<number> {
    const blobs = await listAll('carts/');
    const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
    const stale = blobs.filter((b) => b.uploadedAt.getTime() < cutoff);
    if (stale.length === 0) return 0;
    await del(
      stale.map((b) => b.url),
      { token: token() },
    );
    return stale.length;
  }
}

// ─── Convenience factory ──────────────────────────────────────────────

let defaultStorage: CommerceStorage | null = null;

export function getStorage(): CommerceStorage {
  if (!defaultStorage) defaultStorage = new VercelBlobStorage();
  return defaultStorage;
}

/** Compute cart subtotal from items. Used by checkout + order flows. */
export function computeCartSubtotal(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.snapshot_price_cents * i.quantity, 0);
}
