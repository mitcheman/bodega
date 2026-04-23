// Next.js route handlers for cart item mutations.
//
// Mount:
//   app/api/bodega/cart/items/route.ts
//     export { POST } from '@mitcheman/bodega/routes/cart-items';
//
//   app/api/bodega/cart/items/[product_id]/route.ts
//     export { PATCH, DELETE } from '@mitcheman/bodega/routes/cart-items';

import { NextResponse, type NextRequest } from 'next/server';
import { getOrCreateCart } from './cart-session.js';
import { getStorage, computeCartSubtotal } from '../storage/blob.js';

type RouteContext = { params: Promise<{ product_id: string }> };

// ─── POST /api/bodega/cart/items — add or increment ────────────────────

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    product_id?: string;
    quantity?: number;
  } | null;

  if (!body?.product_id) {
    return NextResponse.json(
      { message: 'product_id is required' },
      { status: 400 },
    );
  }

  const qty = Math.max(1, Math.floor(body.quantity ?? 1));
  const storage = getStorage();
  const product = await storage.getProductById(body.product_id);

  if (!product || !product.published) {
    return NextResponse.json(
      { message: 'Product not found or unpublished' },
      { status: 404 },
    );
  }
  if (product.inventory !== null && product.inventory < qty) {
    return NextResponse.json(
      { message: 'Not enough in stock' },
      { status: 409 },
    );
  }

  const cart = await getOrCreateCart();
  const existing = cart.items.find((i) => i.product_id === product.id);
  if (existing) {
    existing.quantity += qty;
  } else {
    cart.items.push({
      product_id: product.id,
      quantity: qty,
      snapshot_price_cents: product.price_cents,
      snapshot_title: product.title,
    });
  }
  cart.subtotal_cents = computeCartSubtotal(cart.items);
  cart.currency = product.currency;

  const updated = await storage.updateCart(cart);
  return NextResponse.json(updated);
}

// ─── PATCH /api/bodega/cart/items/[product_id] — change quantity ───────

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const { product_id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as {
    quantity?: number;
  } | null;

  const qty = Math.max(0, Math.floor(body?.quantity ?? 0));
  const cart = await getOrCreateCart();
  const item = cart.items.find((i) => i.product_id === product_id);

  if (!item) {
    return NextResponse.json({ message: 'Item not in cart' }, { status: 404 });
  }

  if (qty === 0) {
    cart.items = cart.items.filter((i) => i.product_id !== product_id);
  } else {
    // Re-check inventory against the current product.
    const product = await getStorage().getProductById(product_id);
    if (product?.inventory !== null && product && product.inventory < qty) {
      return NextResponse.json(
        { message: 'Not enough in stock' },
        { status: 409 },
      );
    }
    item.quantity = qty;
  }

  cart.subtotal_cents = computeCartSubtotal(cart.items);
  const updated = await getStorage().updateCart(cart);
  return NextResponse.json(updated);
}

// ─── DELETE /api/bodega/cart/items/[product_id] — remove line ─────────

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const { product_id } = await ctx.params;
  const cart = await getOrCreateCart();
  cart.items = cart.items.filter((i) => i.product_id !== product_id);
  cart.subtotal_cents = computeCartSubtotal(cart.items);
  const updated = await getStorage().updateCart(cart);
  return NextResponse.json(updated);
}
