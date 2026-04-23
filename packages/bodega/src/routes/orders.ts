// Studio order actions.
//
// Mount:
//   app/api/bodega/orders/[id]/ship/route.ts → export { POST } from '@mitcheman/bodega/routes/orders';

import { NextResponse, type NextRequest } from 'next/server';
import { getStorage } from '../index.js';
import { requireOwner } from '../auth/require-session.js';

type RouteContext = { params: Promise<{ id: string }> };

// ─── POST /api/bodega/orders/[id]/ship — mark shipped + tracking ──────

export async function POST(req: NextRequest, ctx: RouteContext) {
  const auth = await requireOwner();
  if (auth instanceof NextResponse) return auth;

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as {
    carrier?: string;
    number?: string;
    label_url?: string;
  } | null;

  if (!body?.carrier || !body?.number) {
    return NextResponse.json(
      { message: 'Carrier and tracking number are required.' },
      { status: 400 },
    );
  }

  const storage = getStorage();
  const order = await storage.getOrderById(id);
  if (!order) {
    return NextResponse.json({ message: 'Order not found.' }, { status: 404 });
  }

  const updated = await storage.upsertOrder({
    stripe_payment_intent_id: order.stripe_payment_intent_id,
    status: 'shipped',
    tracking: {
      carrier: body.carrier,
      number: body.number,
      label_url: body.label_url,
    },
  });

  // TODO: send shipping-notification email to customer.
  return NextResponse.json(updated);
}
