'use client';

import Link from 'next/link';
import { useCart } from '../cart/state.js';
import { formatPrice } from '../format.js';

/**
 * Full cart view. Mounts at /cart. Shows line items, quantity editors,
 * subtotal, and a "Checkout" CTA.
 */
export function Cart() {
  const { cart, loading, itemCount, subtotalCents, setQuantity, removeItem } =
    useCart();

  if (loading && !cart) {
    return <CartShell><p style={{ opacity: 0.6 }}>Loading your cart…</p></CartShell>;
  }

  if (!cart || cart.items.length === 0) {
    return <EmptyCart />;
  }

  const currency = cart.currency;

  return (
    <CartShell>
      <h1
        style={{
          fontFamily: 'var(--bodega-font-display)',
          fontSize: '2rem',
          fontWeight: 500,
          margin: '0 0 2rem 0',
        }}
      >
        Cart ({itemCount} {itemCount === 1 ? 'item' : 'items'})
      </h1>

      <ul
        style={{
          listStyle: 'none',
          padding: 0,
          margin: '0 0 3rem 0',
          borderTop: '1px solid var(--bodega-muted)',
        }}
      >
        {cart.items.map((item) => (
          <li
            key={item.product_id}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto',
              gap: '1rem',
              padding: '1.25rem 0',
              borderBottom: '1px solid var(--bodega-muted)',
              alignItems: 'center',
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: 'var(--bodega-font-display)',
                  fontSize: '1.05rem',
                }}
              >
                {item.snapshot_title}
              </div>
              <div
                style={{
                  fontSize: '0.9rem',
                  opacity: 0.7,
                  marginTop: '0.25rem',
                }}
              >
                {formatPrice(item.snapshot_price_cents, currency)} each
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
              }}
            >
              <QuantityStepper
                value={item.quantity}
                onChange={(q) => setQuantity(item.product_id, q)}
              />
              <div
                style={{
                  minWidth: '5rem',
                  textAlign: 'right',
                  fontFamily: 'var(--bodega-font-body)',
                }}
              >
                {formatPrice(item.snapshot_price_cents * item.quantity, currency)}
              </div>
              <button
                type="button"
                onClick={() => removeItem(item.product_id)}
                aria-label={`Remove ${item.snapshot_title}`}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--bodega-fg)',
                  opacity: 0.5,
                  cursor: 'pointer',
                  fontSize: '1.25rem',
                  padding: '0.25rem 0.5rem',
                }}
              >
                ×
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '1.1rem',
          marginBottom: '2rem',
          fontFamily: 'var(--bodega-font-body)',
        }}
      >
        <span style={{ opacity: 0.75 }}>Subtotal</span>
        <strong style={{ fontFamily: 'var(--bodega-font-display)', fontSize: '1.3rem' }}>
          {formatPrice(subtotalCents, currency)}
        </strong>
      </div>

      <p style={{ fontSize: '0.85rem', opacity: 0.6, marginBottom: '2rem' }}>
        Shipping and tax calculated at checkout.
      </p>

      <Link
        href="/checkout"
        style={{
          display: 'block',
          width: '100%',
          padding: '1rem 1.5rem',
          fontSize: '1rem',
          fontWeight: 500,
          textAlign: 'center',
          color: 'var(--bodega-bg)',
          background: 'var(--bodega-accent)',
          textDecoration: 'none',
          fontFamily: 'var(--bodega-font-body)',
        }}
      >
        Checkout
      </Link>
    </CartShell>
  );
}

function QuantityStepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (quantity: number) => void;
}) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        border: '1px solid var(--bodega-muted)',
      }}
    >
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        aria-label="Decrease quantity"
        style={{
          padding: '0.4rem 0.75rem',
          background: 'transparent',
          border: 'none',
          color: 'var(--bodega-fg)',
          cursor: 'pointer',
        }}
      >
        −
      </button>
      <span
        style={{
          padding: '0 0.75rem',
          minWidth: '1.5rem',
          textAlign: 'center',
        }}
      >
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        aria-label="Increase quantity"
        style={{
          padding: '0.4rem 0.75rem',
          background: 'transparent',
          border: 'none',
          color: 'var(--bodega-fg)',
          cursor: 'pointer',
        }}
      >
        +
      </button>
    </div>
  );
}

function CartShell({ children }: { children: React.ReactNode }) {
  return (
    <section
      className="bodega-cart"
      style={{
        maxWidth: '720px',
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

function EmptyCart() {
  return (
    <CartShell>
      <div
        style={{
          textAlign: 'center',
          padding: '4rem 1rem',
        }}
      >
        <p
          style={{
            fontFamily: 'var(--bodega-font-display)',
            fontSize: '1.5rem',
            marginBottom: '0.5rem',
          }}
        >
          Your cart is empty.
        </p>
        <p style={{ opacity: 0.65, marginBottom: '2rem' }}>
          Take a look at the shop.
        </p>
        <Link
          href="/shop"
          style={{
            color: 'var(--bodega-accent)',
            textDecoration: 'underline',
            fontFamily: 'var(--bodega-font-body)',
          }}
        >
          Back to the shop →
        </Link>
      </div>
    </CartShell>
  );
}
