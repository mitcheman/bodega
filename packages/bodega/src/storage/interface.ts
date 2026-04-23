// Storage interface for Bodega. Implementations wrap concrete providers
// (Vercel Blob in Phase 1; Postgres/Neon later). Everything downstream
// depends on this interface, not on any particular provider.

import type { Product, Order, Cart } from '../types.js';

export interface CommerceStorage {
  // ─── Products ───────────────────────────────────────────────

  /** List all published products, ordered most-recent-first. */
  listProducts(options?: { includeUnpublished?: boolean }): Promise<Product[]>;

  /** Fetch a single product by its slug. Returns null if not found. */
  getProductBySlug(slug: string): Promise<Product | null>;

  /** Fetch a single product by its id. */
  getProductById(id: string): Promise<Product | null>;

  /** Create or update a product. Generates id + slug if missing. */
  upsertProduct(product: Partial<Product> & Pick<Product, 'title' | 'price_cents'>): Promise<Product>;

  /** Delete a product. Soft-delete (sets published=false) is preferred for orders history. */
  deleteProduct(id: string): Promise<void>;

  // ─── Orders ─────────────────────────────────────────────────

  /** List orders, optionally filtered by status. Most-recent-first. */
  listOrders(options?: { status?: Order['status'] }): Promise<Order[]>;

  /** Fetch a single order. */
  getOrderById(id: string): Promise<Order | null>;

  /** Fetch an order by its Stripe PaymentIntent id (used in webhook handler). */
  getOrderByPaymentIntent(pi_id: string): Promise<Order | null>;

  /** Create or update an order. */
  upsertOrder(order: Partial<Order> & Pick<Order, 'stripe_payment_intent_id'>): Promise<Order>;

  // ─── Carts ──────────────────────────────────────────────────

  /** Get a cart by its id (cookie-held). Returns null if stale or missing. */
  getCart(id: string): Promise<Cart | null>;

  /** Create a new empty cart. Returns its id. */
  createCart(): Promise<Cart>;

  /** Update a cart. */
  updateCart(cart: Cart): Promise<Cart>;

  /** Delete old/abandoned carts. Returns count removed. */
  purgeStaleCarts(olderThanDays: number): Promise<number>;
}
