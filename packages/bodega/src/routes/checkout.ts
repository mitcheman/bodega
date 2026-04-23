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
//
// Reads shipping + tax config from env vars:
//   BODEGA_SHIPPING_MODE          — 'free' | 'flat' | 'per_item' (default 'free')
//   BODEGA_SHIPPING_CENTS         — integer cents, used in flat/per_item modes
//   BODEGA_STRIPE_TAX             — 'true' enables Stripe automatic tax
//   BODEGA_SITE_MODE              — 'marketing' | 'showcase' | 'digital' | 'commerce'
//                                   (digital + marketing + showcase force shipping to 0)

import { NextResponse, type NextRequest } from 'next/server';
import Stripe from 'stripe';
import { readCart } from './cart-session.js';
import { getStorage } from '../storage/blob.js';
import type { CartItem } from '../types.js';

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

function computeShippingCents(items: CartItem[]): number {
  const siteMode = process.env.BODEGA_SITE_MODE ?? 'commerce';
  // Only 'commerce' mode charges shipping. Digital/marketing/showcase don't ship.
  if (siteMode !== 'commerce') return 0;

  const mode = process.env.BODEGA_SHIPPING_MODE ?? 'free';
  const cents = parseInt(process.env.BODEGA_SHIPPING_CENTS ?? '0', 10) || 0;

  if (mode === 'flat') return cents;
  if (mode === 'per_item') {
    const qty = items.reduce((n, i) => n + i.quantity, 0);
    return cents * qty;
  }
  return 0;
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

  const shipping_cents = computeShippingCents(cart.items);
  const taxEnabled = process.env.BODEGA_STRIPE_TAX === 'true';

  // Total: subtotal + shipping. Tax is calculated by Stripe (if enabled)
  // and added at confirm time — don't bake it into `amount`.
  const amount = subtotal_cents + shipping_cents;
  const currency = cart.currency.toLowerCase();

  try {
    // Stripe Tax on PaymentIntent is supported by the API but the SDK
    // types occasionally lag. Use an inline type augmentation.
    type PIParams = Stripe.PaymentIntentCreateParams & {
      automatic_tax?: { enabled: boolean };
    };

    const params: PIParams = {
      amount,
      currency,
      automatic_payment_methods: { enabled: true },
      receipt_email: email,
      metadata: {
        cart_id: cart.id,
        bodega_version: '0.2.0',
        subtotal_cents: String(subtotal_cents),
        shipping_cents: String(shipping_cents),
      },
    };

    // Stripe Tax: automatic tax calculation at checkout. Off by default —
    // merchant opts in by setting BODEGA_STRIPE_TAX=true and configuring
    // their tax jurisdictions in the Stripe dashboard.
    if (taxEnabled) {
      params.automatic_tax = { enabled: true };
    }

    const intent = await stripe().paymentIntents.create(params);

    return NextResponse.json({
      client_secret: intent.client_secret,
      payment_intent_id: intent.id,
      subtotal_cents,
      shipping_cents,
    });
  } catch (err) {
    const message =
      err instanceof Stripe.errors.StripeError
        ? err.message
        : 'Could not start checkout. Try again in a moment.';
    return NextResponse.json({ message }, { status: 502 });
  }
}
