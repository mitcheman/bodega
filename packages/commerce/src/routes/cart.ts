// Next.js route handlers for the cart API.
//
// Mount at app/api/bodega/cart/route.ts:
//
//   export { GET } from '@bodega/commerce/routes/cart';
//
// And app/api/bodega/cart/items/route.ts + [product_id]/route.ts:
//
//   export { POST } from '@bodega/commerce/routes/cart-items';
//   export { PATCH, DELETE } from '@bodega/commerce/routes/cart-items';
//
// These are scaffolded automatically by the bodega:deploy skill.

import { NextResponse, type NextRequest } from 'next/server';
import { getOrCreateCart } from './cart-session.js';

/** GET /api/bodega/cart — current cart (creates one if absent). */
export async function GET(_req: NextRequest) {
  const cart = await getOrCreateCart();
  return NextResponse.json(cart);
}
