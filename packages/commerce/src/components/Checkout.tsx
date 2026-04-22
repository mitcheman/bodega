'use client';

// Checkout page — Stripe Payment Element integration.
//
// Flow (deferred PaymentIntent):
//   1. <Elements> mounts with { mode: 'payment', amount, currency }
//      — no server call yet.
//   2. User fills PaymentElement, submits.
//   3. elements.submit() validates locally.
//   4. POST to /api/bodega/checkout — server creates PaymentIntent
//      from the cart, returns client_secret.
//   5. stripe.confirmPayment({ elements, clientSecret, return_url, redirect: 'if_required' })
//      — Stripe handles the 3DS / redirect if needed; otherwise returns
//      a paymentIntent object here and we redirect to /checkout/success.
//
// API verified against @stripe/react-stripe-js current docs.

import { useEffect, useState } from 'react';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { useCart } from '../cart/state.js';
import { formatPrice } from '../format.js';

let stripePromise: Promise<Stripe | null> | null = null;
function getStripe() {
  if (!stripePromise) {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!key) {
      throw new Error(
        'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set. Run /bodega:payments to wire this up.',
      );
    }
    stripePromise = loadStripe(key);
  }
  return stripePromise;
}

/**
 * Top-level checkout page. Reads the cart, initializes Stripe Elements
 * with the cart total, renders the form.
 */
export function Checkout() {
  const { cart, subtotalCents, loading } = useCart();

  if (loading && !cart) {
    return <CheckoutShell><p style={{ opacity: 0.6 }}>Loading your cart…</p></CheckoutShell>;
  }

  if (!cart || cart.items.length === 0) {
    return (
      <CheckoutShell>
        <h1 style={headingStyle}>Your cart is empty</h1>
        <p style={{ opacity: 0.7 }}>
          <a
            href="/shop"
            style={{ color: 'var(--bodega-accent)', textDecoration: 'underline' }}
          >
            Back to the shop →
          </a>
        </p>
      </CheckoutShell>
    );
  }

  return (
    <CheckoutShell>
      <h1 style={headingStyle}>Checkout</h1>

      <OrderSummary />

      <Elements
        stripe={getStripe()}
        options={{
          mode: 'payment',
          amount: subtotalCents,
          currency: cart.currency.toLowerCase(),
          appearance: {
            theme: 'stripe',
            variables: {
              colorPrimary: 'var(--bodega-accent, #b4552e)',
              fontFamily: 'var(--bodega-font-body, system-ui)',
            },
          },
        }}
      >
        <CheckoutForm />
      </Elements>
    </CheckoutShell>
  );
}

// ─── Inner form (Elements children can use hooks) ─────────────────────

function CheckoutForm() {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements || submitting) return;

    setSubmitting(true);
    setError(null);

    // 1. Validate locally first.
    const { error: submitError } = await elements.submit();
    if (submitError) {
      setError(submitError.message ?? 'Please check your payment details.');
      setSubmitting(false);
      return;
    }

    // 2. Ask the server to create the PaymentIntent from the current cart.
    const res = await fetch('/api/bodega/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({ message: 'Checkout failed.' }));
      setError(body.message ?? 'Checkout failed. Please try again.');
      setSubmitting(false);
      return;
    }

    const { client_secret } = (await res.json()) as { client_secret: string };

    // 3. Confirm the payment. Redirect happens if 3DS or a redirect-based
    //    method is used; otherwise returns synchronously and we redirect.
    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      clientSecret: client_secret,
      confirmParams: {
        return_url: `${window.location.origin}/checkout/success`,
      },
      redirect: 'if_required',
    });

    if (confirmError) {
      setError(confirmError.message ?? 'Payment failed. Please try again.');
      setSubmitting(false);
      return;
    }

    if (paymentIntent?.status === 'succeeded') {
      window.location.href = `/checkout/success?pi=${paymentIntent.id}`;
    } else {
      setError('Payment is processing. You will receive an email when it completes.');
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
        marginTop: '2rem',
      }}
    >
      <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        <span style={{ fontSize: '0.9rem', opacity: 0.8 }}>Email</span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          style={{
            padding: '0.75rem',
            fontSize: '1rem',
            border: '1px solid var(--bodega-muted)',
            background: 'var(--bodega-bg)',
            color: 'var(--bodega-fg)',
            fontFamily: 'var(--bodega-font-body)',
          }}
        />
      </label>

      <PaymentElement options={{ layout: 'tabs' }} />

      {error && (
        <div
          role="alert"
          style={{
            padding: '0.75rem 1rem',
            background: 'rgba(200, 50, 50, 0.1)',
            color: '#b52a2a',
            fontSize: '0.9rem',
          }}
        >
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || submitting}
        style={{
          padding: '1rem 1.5rem',
          fontSize: '1rem',
          fontWeight: 500,
          color: 'var(--bodega-bg)',
          background: 'var(--bodega-accent)',
          border: 'none',
          cursor: submitting ? 'wait' : 'pointer',
          opacity: submitting ? 0.7 : 1,
          fontFamily: 'var(--bodega-font-body)',
        }}
      >
        {submitting ? 'Processing…' : 'Pay'}
      </button>
    </form>
  );
}

function OrderSummary() {
  const { cart, subtotalCents } = useCart();
  if (!cart) return null;

  return (
    <section
      style={{
        margin: '0 0 1rem 0',
        padding: '1.25rem 1.5rem',
        background: 'var(--bodega-muted)',
        color: 'var(--bodega-bg)',
      }}
    >
      <div style={{ fontSize: '0.9rem', marginBottom: '0.75rem', opacity: 0.8 }}>
        Order summary
      </div>
      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1rem 0' }}>
        {cart.items.map((item) => (
          <li
            key={item.product_id}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '0.25rem 0',
              fontSize: '0.95rem',
            }}
          >
            <span>
              {item.snapshot_title} × {item.quantity}
            </span>
            <span>
              {formatPrice(item.snapshot_price_cents * item.quantity, cart.currency)}
            </span>
          </li>
        ))}
      </ul>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '1rem',
          fontWeight: 500,
          paddingTop: '0.75rem',
          borderTop: '1px solid rgba(255,255,255,0.2)',
        }}
      >
        <span>Subtotal</span>
        <span>{formatPrice(subtotalCents, cart.currency)}</span>
      </div>
      <p style={{ fontSize: '0.8rem', opacity: 0.7, margin: '0.5rem 0 0 0' }}>
        Shipping and tax calculated at payment.
      </p>
    </section>
  );
}

// ─── Styling helpers ──────────────────────────────────────────────────

const headingStyle: React.CSSProperties = {
  fontFamily: 'var(--bodega-font-display)',
  fontSize: '2rem',
  fontWeight: 500,
  margin: '0 0 1.5rem 0',
};

function CheckoutShell({ children }: { children: React.ReactNode }) {
  return (
    <section
      className="bodega-checkout"
      style={{
        maxWidth: '560px',
        margin: '0 auto',
        padding: '2rem 1.5rem 5rem',
        color: 'var(--bodega-fg)',
        fontFamily: 'var(--bodega-font-body)',
      }}
    >
      {children}
    </section>
  );
}
