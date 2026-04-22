// Cart session management — cookie-based identity for the shopper's cart.
//
// The cookie is HTTP-only, same-site=lax, long-lived (90d) so a shopper
// can leave and return without losing their cart. No personal data in
// the cookie itself — it's just a UUID pointing into our storage.

import { cookies } from 'next/headers';
import { getStorage } from '../storage/blob.js';
import type { Cart } from '../types.js';

const COOKIE_NAME = 'bodega_cart_id';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 90; // 90 days

/**
 * Get the current cart. Creates one (and sets the cookie) if none exists
 * or if the stored cart has expired.
 */
export async function getOrCreateCart(): Promise<Cart> {
  const store = await cookies();
  const existing = store.get(COOKIE_NAME)?.value;
  const storage = getStorage();

  if (existing) {
    const cart = await storage.getCart(existing);
    if (cart) return cart;
  }

  const cart = await storage.createCart();
  store.set(COOKIE_NAME, cart.id, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: COOKIE_MAX_AGE,
  });
  return cart;
}

/** Read the current cart without creating one. Returns null if absent. */
export async function readCart(): Promise<Cart | null> {
  const store = await cookies();
  const existing = store.get(COOKIE_NAME)?.value;
  if (!existing) return null;
  return getStorage().getCart(existing);
}

/** Clear the cart cookie (e.g., after successful checkout). */
export async function clearCartCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
