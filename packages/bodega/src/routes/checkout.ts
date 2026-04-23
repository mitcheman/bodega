// Next.js route handler for checkout initiation.
//
// Mount at app/api/bodega/checkout/route.ts:
//   export { POST } from '@mitcheman/bodega/routes/checkout';
//
// Flow (deferred PaymentIntent):
//   Client has already called elements.submit() and validated the form.
//   This handler creates the PaymentIntent from the current cart and
//   returns the client_secret. The Order record is NOT created here —
//   that happens in the stripe-webhook handler on payment_intent.succeeded.

import { NextResponse, type NextRequest } from 'next/server';
import Stripe from 'stripe';
import { readCart } from './cart-session.js';
import { getStorage } from '../storage/blob.js';

let stripeClient: Stripe | null = null;
function stripe(): Stripe {
  if (stripeClient) return stripeClient;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      'STRIPE_SECRET_KEY is not set. Run /bodega:payments to wire this up.',
    );
  }
  stripeClient = new Stripe(key);
  return stripeClient;
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    email?: string;
  } | null;

  const email = body?.email?.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { message: 'A valid email is required.' },
      { status: 400 },
    );
  }

  const cart = await readCart();
  if (!cart || cart.items.length === 0) {
    return NextResponse.json(
      { message: 'Your cart is empty.' },
      { status: 400 },
    );
  }

  // Recompute totals from current products (defense against stale snapshots
  // in the cart where prices may have changed since they were added).
  const storage = getStorage();
  let subtotal_cents = 0;
  for (const item of cart.items) {
    const product = await storage.getProductById(item.product_id);
    if (!product || !product.published) {
      return NextResponse.json(
        {
          message: `"${item.snapshot_title}" is no longer available. Remove it from your cart.`,
        },
        { status: 409 },
      );
    }
    if (product.inventory !== null && product.inventory < item.quantity) {
      return NextResponse.json(
        {
          message: `Only ${product.inventory} of "${product.title}" left. Update your cart.`,
        },
        { status: 409 },
      );
    }
    subtotal_cents += product.price_cents * item.quantity;
  }

  // Phase 1: no shipping / tax calculation server-side. Stripe Tax can be
  // enabled in the dashboard to add tax at payment-collection time.
  // Shipping is passed at zero here; the store's shipping policy page
  // explains any flat-rate the merchant charges on ship.
  const amount = subtotal_cents;
  const currency = cart.currency.toLowerCase();

  try {
    const intent = await stripe().paymentIntents.create({
      amount,
      currency,
      automatic_payment_methods: { enabled: true },
      receipt_email: email,
      metadata: {
        cart_id: cart.id,
        bodega_version: '0.0.1',
      },
    });

    return NextResponse.json({
      client_secret: intent.client_secret,
      payment_intent_id: intent.id,
    });
  } catch (err) {
    const message =
      err instanceof Stripe.errors.StripeError
        ? err.message
        : 'Could not start checkout. Try again in a moment.';
    return NextResponse.json({ message }, { status: 502 });
  }
}
