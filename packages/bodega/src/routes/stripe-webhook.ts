// Next.js route handler for Stripe webhook events.
//
// Mount at app/api/stripe/webhook/route.ts:
//   export { POST } from '@mitcheman/bodega/routes/stripe-webhook';
//
// Events handled:
//   - payment_intent.succeeded  → create Order, decrement inventory,
//                                  clear cart cookie (on next request)
//   - charge.refunded           → mark Order refunded / partially_refunded
//   - payment_intent.payment_failed → no-op; cart remains, user retries
//
// Webhook signature verification uses STRIPE_WEBHOOK_SECRET (set by
// bodega:deploy after registering the endpoint with Stripe).

import { NextResponse, type NextRequest } from 'next/server';
import Stripe from 'stripe';
import { getStorage } from '../storage/blob.js';
import type { OrderLineItem } from '../types.js';

let stripeClient: Stripe | null = null;
function stripe(): Stripe {
  if (stripeClient) return stripeClient;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
  stripeClient = new Stripe(key);
  return stripeClient;
}

export async function POST(req: NextRequest) {
  const signature = req.headers.get('stripe-signature');
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !secret) {
    return NextResponse.json(
      { message: 'Webhook signature or secret missing' },
      { status: 400 },
    );
  }

  // Must read raw body for signature verification.
  const raw = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(raw, signature, secret);
  } catch (err) {
    return NextResponse.json(
      { message: 'Invalid signature' },
      { status: 400 },
    );
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;
      case 'charge.refunded':
        await handleChargeRefunded(event.data.object);
        break;
      case 'payment_intent.payment_failed':
        // No-op. Client already saw the error; cart is still valid.
        break;
      default:
        // Other events ignored in Phase 1.
        break;
    }
  } catch (err) {
    // Log but don't fail — Stripe will retry. Logging hook lands here
    // when we wire observability (Sentry or similar) in a later pass.
    console.error('[bodega webhook] handler error:', err);
    return NextResponse.json({ received: true, logged: true });
  }

  return NextResponse.json({ received: true });
}

// ─── Handlers ─────────────────────────────────────────────────────────

async function handlePaymentSucceeded(pi: Stripe.PaymentIntent) {
  const storage = getStorage();
  const cart_id = pi.metadata?.cart_id;

  if (!cart_id) {
    console.error('[bodega webhook] paid PI has no cart_id metadata:', pi.id);
    return;
  }

  const cart = await storage.getCart(cart_id);
  if (!cart) {
    console.error('[bodega webhook] cart not found for paid PI:', cart_id);
    return;
  }

  // Build order line items from the cart, snapshotting the current product
  // titles (prices already snapshotted at add-to-cart).
  const line_items: OrderLineItem[] = cart.items.map((item) => ({
    product_id: item.product_id,
    title: item.snapshot_title,
    quantity: item.quantity,
    unit_price_cents: item.snapshot_price_cents,
  }));

  const subtotal_cents = line_items.reduce(
    (sum, i) => sum + i.unit_price_cents * i.quantity,
    0,
  );

  await storage.upsertOrder({
    stripe_payment_intent_id: pi.id,
    customer: { email: pi.receipt_email ?? '' },
    line_items,
    subtotal_cents,
    shipping_cents: 0,
    tax_cents: pi.amount - subtotal_cents > 0 ? pi.amount - subtotal_cents : 0,
    total_cents: pi.amount,
    currency: pi.currency.toUpperCase(),
    status: 'paid',
  });

  // Decrement inventory on tracked products.
  for (const item of cart.items) {
    const product = await storage.getProductById(item.product_id);
    if (!product || product.inventory === null) continue;
    await storage.upsertProduct({
      ...product,
      inventory: Math.max(0, product.inventory - item.quantity),
    });
  }

  // Clear the cart's items server-side. The cookie gets cleared on the
  // client's next page load when it sees the empty cart.
  cart.items = [];
  cart.subtotal_cents = 0;
  await storage.updateCart(cart);
}

async function handleChargeRefunded(charge: Stripe.Charge) {
  const pi_id =
    typeof charge.payment_intent === 'string'
      ? charge.payment_intent
      : charge.payment_intent?.id;
  if (!pi_id) return;

  const storage = getStorage();
  const order = await storage.getOrderByPaymentIntent(pi_id);
  if (!order) return;

  const status: 'refunded' | 'partially_refunded' =
    charge.amount_refunded >= charge.amount ? 'refunded' : 'partially_refunded';

  await storage.upsertOrder({
    stripe_payment_intent_id: pi_id,
    status,
  });
}
