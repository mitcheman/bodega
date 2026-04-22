// Studio product CRUD routes.
//
// Mount:
//   app/api/bodega/products/route.ts                  → export { POST }
//   app/api/bodega/products/[id]/route.ts             → export { PATCH, DELETE }

import { NextResponse, type NextRequest } from 'next/server';
import { getStorage } from '@bodega/commerce';
import type { Product } from '@bodega/commerce/types';
import { requireOwner } from '../auth/require-session.js';

type RouteContext = { params: Promise<{ id: string }> };

// ─── POST /api/bodega/products — create ───────────────────────────────

export async function POST(req: NextRequest) {
  const auth = await requireOwner();
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json().catch(() => null)) as Partial<Product> | null;
  if (!body?.title || typeof body.price_cents !== 'number') {
    return NextResponse.json(
      { message: 'Product needs a title and price.' },
      { status: 400 },
    );
  }

  const storage = getStorage();
  const product = await storage.upsertProduct({
    title: body.title,
    price_cents: body.price_cents,
    description: body.description,
    images: body.images,
    tags: body.tags,
    kind: body.kind,
    inventory: body.inventory,
    weight_grams: body.weight_grams,
    published: body.published,
    currency: body.currency,
  });

  return NextResponse.json(product, { status: 201 });
}

// ─── PATCH /api/bodega/products/[id] — update ─────────────────────────

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const auth = await requireOwner();
  if (auth instanceof NextResponse) return auth;

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as Partial<Product> | null;
  if (!body) {
    return NextResponse.json({ message: 'Empty update.' }, { status: 400 });
  }

  const storage = getStorage();
  const existing = await storage.getProductById(id);
  if (!existing) {
    return NextResponse.json({ message: 'Product not found.' }, { status: 404 });
  }

  const product = await storage.upsertProduct({
    ...existing,
    ...body,
    id, // lock the id
  });

  return NextResponse.json(product);
}

// ─── DELETE /api/bodega/products/[id] — soft delete ───────────────────

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const auth = await requireOwner();
  if (auth instanceof NextResponse) return auth;

  const { id } = await ctx.params;
  const storage = getStorage();
  await storage.deleteProduct(id);

  return NextResponse.json({ deleted: true });
}
