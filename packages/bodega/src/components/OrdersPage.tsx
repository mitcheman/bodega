import Link from 'next/link';
import { getStorage, formatPrice } from '../index.js';
import type { Order } from '../types.js';

/**
 * Studio orders list. All orders, most-recent-first.
 *
 * Server component.
 */
export async function OrdersPage() {
  const storage = getStorage();
  const orders = await storage.listOrders();

  return (
    <section>
      <h1
        style={{
          fontFamily: 'var(--bodega-font-display)',
          fontSize: '1.75rem',
          fontWeight: 500,
          margin: '0 0 2rem 0',
        }}
      >
        Orders
      </h1>

      {orders.length === 0 ? (
        <EmptyOrders />
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {orders.map((order) => (
            <OrderRow key={order.id} order={order} />
          ))}
        </ul>
      )}
    </section>
  );
}

function EmptyOrders() {
  return (
    <div
      style={{
        textAlign: 'center',
        padding: '4rem 1rem',
        border: '1px dashed var(--bodega-muted)',
      }}
    >
      <p
        style={{
          fontFamily: 'var(--bodega-font-display)',
          fontSize: '1.125rem',
          margin: '0 0 0.5rem 0',
        }}
      >
        No orders yet.
      </p>
      <p style={{ opacity: 0.65, margin: 0 }}>
        When someone buys something, it'll land here.
      </p>
    </div>
  );
}

function OrderRow({ order }: { order: Order }) {
  return (
    <li
      style={{
        borderTop: '1px solid var(--bodega-muted)',
        padding: '1rem 0',
      }}
    >
      <Link
        href={`/studio/orders/${order.id}`}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '1rem',
          color: 'var(--bodega-fg)',
          textDecoration: 'none',
        }}
      >
        <div>
          <div style={{ fontFamily: 'var(--bodega-font-display)' }}>
            {order.customer.email || 'Unknown customer'}
          </div>
          <div style={{ fontSize: '0.85rem', opacity: 0.6, marginTop: '0.125rem' }}>
            {new Date(order.created_at).toLocaleString()}
            {' · '}
            {order.line_items.length}{' '}
            {order.line_items.length === 1 ? 'item' : 'items'}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 500 }}>
            {formatPrice(order.total_cents, order.currency)}
          </div>
          <div
            style={{
              fontSize: '0.8rem',
              marginTop: '0.125rem',
              opacity: 0.75,
              textTransform: 'lowercase',
            }}
          >
            {order.status.replace(/_/g, ' ')}
          </div>
        </div>
      </Link>
    </li>
  );
}
