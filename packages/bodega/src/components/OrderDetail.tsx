import { notFound } from 'next/navigation';
import { getStorage, formatPrice } from '../index.js';
import type { Order } from '../types.js';
import { MarkShippedButton } from './MarkShippedButton.js';

interface OrderDetailProps {
  id: string;
}

/**
 * Single-order detail page for the studio. Shows line items, customer
 * contact, shipping address (physical), current status, and the
 * mark-shipped action when status is 'paid'.
 *
 * Server component.
 */
export async function OrderDetail({ id }: OrderDetailProps) {
  const storage = getStorage();
  const order = await storage.getOrderById(id);
  if (!order) notFound();

  return (
    <section>
      <BackLink />

      <header style={{ marginBottom: '2rem' }}>
        <h1
          style={{
            fontFamily: 'var(--bodega-font-display)',
            fontSize: '1.75rem',
            fontWeight: 500,
            margin: '0 0 0.25rem 0',
          }}
        >
          Order {order.id.slice(0, 8)}
        </h1>
        <div style={{ fontSize: '0.9rem', opacity: 0.65 }}>
          {new Date(order.created_at).toLocaleString()}
          {' · '}
          <StatusBadge status={order.status} />
        </div>
      </header>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 2fr) minmax(240px, 1fr)',
          gap: '2rem',
        }}
      >
        <LineItems order={order} />
        <SidebarInfo order={order} />
      </div>
    </section>
  );
}

function BackLink() {
  return (
    <a
      href="/studio/orders"
      style={{
        display: 'inline-block',
        marginBottom: '1.5rem',
        fontSize: '0.9rem',
        opacity: 0.7,
        color: 'var(--bodega-fg)',
        textDecoration: 'none',
      }}
    >
      ← All orders
    </a>
  );
}

function LineItems({ order }: { order: Order }) {
  return (
    <div>
      <h2
        style={{
          fontFamily: 'var(--bodega-font-display)',
          fontSize: '1.125rem',
          fontWeight: 500,
          marginBottom: '1rem',
        }}
      >
        Items
      </h2>
      <ul
        style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
          borderTop: '1px solid var(--bodega-muted)',
        }}
      >
        {order.line_items.map((item) => (
          <li
            key={item.product_id}
            style={{
              padding: '0.9rem 0',
              borderBottom: '1px solid var(--bodega-muted)',
              display: 'flex',
              justifyContent: 'space-between',
              gap: '1rem',
            }}
          >
            <div>
              <div style={{ fontFamily: 'var(--bodega-font-display)' }}>
                {item.title}
              </div>
              <div style={{ fontSize: '0.85rem', opacity: 0.65 }}>
                {item.quantity} ×{' '}
                {formatPrice(item.unit_price_cents, order.currency)}
              </div>
            </div>
            <div style={{ fontWeight: 500 }}>
              {formatPrice(item.unit_price_cents * item.quantity, order.currency)}
            </div>
          </li>
        ))}
      </ul>

      <dl style={{ marginTop: '1.5rem', fontSize: '0.95rem' }}>
        <Row label="Subtotal" value={formatPrice(order.subtotal_cents, order.currency)} />
        {order.shipping_cents > 0 && (
          <Row label="Shipping" value={formatPrice(order.shipping_cents, order.currency)} />
        )}
        {order.tax_cents > 0 && (
          <Row label="Tax" value={formatPrice(order.tax_cents, order.currency)} />
        )}
        <Row
          label="Total"
          value={formatPrice(order.total_cents, order.currency)}
          emphasize
        />
      </dl>
    </div>
  );
}

function SidebarInfo({ order }: { order: Order }) {
  return (
    <aside
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
      }}
    >
      <Block title="Customer">
        <div>{order.customer.email || '—'}</div>
        {order.customer.name && <div style={{ opacity: 0.7 }}>{order.customer.name}</div>}
      </Block>

      {order.shipping_address && (
        <Block title="Shipping to">
          <address style={{ fontStyle: 'normal', lineHeight: 1.5 }}>
            {order.shipping_address.name}
            <br />
            {order.shipping_address.line1}
            {order.shipping_address.line2 && (
              <>
                <br />
                {order.shipping_address.line2}
              </>
            )}
            <br />
            {order.shipping_address.city}, {order.shipping_address.state}{' '}
            {order.shipping_address.postal_code}
            <br />
            {order.shipping_address.country}
          </address>
        </Block>
      )}

      {order.tracking && (
        <Block title="Tracking">
          <div>{order.tracking.carrier}</div>
          <div style={{ fontFamily: 'monospace', fontSize: '0.85rem', opacity: 0.85 }}>
            {order.tracking.number}
          </div>
        </Block>
      )}

      {order.status === 'paid' && <MarkShippedButton orderId={order.id} />}

      <Block title="Stripe">
        <div style={{ fontSize: '0.8rem', opacity: 0.75, wordBreak: 'break-all' }}>
          {order.stripe_payment_intent_id}
        </div>
        <a
          href={`https://dashboard.stripe.com/payments/${order.stripe_payment_intent_id}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-block',
            marginTop: '0.5rem',
            fontSize: '0.85rem',
            color: 'var(--bodega-accent)',
          }}
        >
          Open in Stripe →
        </a>
      </Block>
    </aside>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: '0.8rem', opacity: 0.65, marginBottom: '0.35rem' }}>
        {title}
      </div>
      <div style={{ fontSize: '0.95rem' }}>{children}</div>
    </div>
  );
}

function Row({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '0.35rem 0',
        fontWeight: emphasize ? 600 : 400,
        fontSize: emphasize ? '1.05rem' : '0.95rem',
        borderTop: emphasize ? '1px solid var(--bodega-muted)' : 'none',
        marginTop: emphasize ? '0.5rem' : 0,
        paddingTop: emphasize ? '0.75rem' : '0.35rem',
      }}
    >
      <dt style={{ opacity: 0.7 }}>{label}</dt>
      <dd style={{ margin: 0 }}>{value}</dd>
    </div>
  );
}

function StatusBadge({ status }: { status: Order['status'] }) {
  const colors: Record<Order['status'], { bg: string; fg: string }> = {
    pending: { bg: 'var(--bodega-muted)', fg: 'var(--bodega-bg)' },
    paid: { bg: 'var(--bodega-accent)', fg: 'var(--bodega-bg)' },
    shipped: { bg: '#8FA954', fg: '#fff' },
    delivered: { bg: '#8FA954', fg: '#fff' },
    cancelled: { bg: 'var(--bodega-muted)', fg: 'var(--bodega-bg)' },
    refunded: { bg: '#b52a2a', fg: '#fff' },
    partially_refunded: { bg: '#b58a2a', fg: '#fff' },
  };
  const c = colors[status] ?? colors.pending;
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '0.1rem 0.5rem',
        background: c.bg,
        color: c.fg,
        fontSize: '0.8rem',
        textTransform: 'lowercase',
      }}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}
