import Link from 'next/link';
import { getStorage, formatPrice } from '@bodega/commerce';
import type { Order, Product } from '@bodega/commerce/types';

/**
 * Studio home — the first thing the merchant sees after signing in.
 *
 * Two modes:
 *   - First-run (no products yet) → guided "add your first product" CTA
 *   - Working store → recent orders + quick links
 *
 * Server component.
 */
export async function StudioHome() {
  const storage = getStorage();
  const [products, orders] = await Promise.all([
    storage.listProducts({ includeUnpublished: true }),
    storage.listOrders(),
  ]);

  if (products.length === 0) {
    return <FirstRun />;
  }

  return <WorkingDashboard products={products} orders={orders} />;
}

// ─── First-run walkthrough ────────────────────────────────────────────

function FirstRun() {
  return (
    <section>
      <h1
        style={{
          fontFamily: 'var(--bodega-font-display)',
          fontSize: '1.75rem',
          fontWeight: 500,
          margin: '0 0 0.5rem 0',
        }}
      >
        Welcome to your studio.
      </h1>
      <p style={{ opacity: 0.75, margin: '0 0 2rem 0', maxWidth: '540px' }}>
        This is where you'll add products, see orders, and run your shop.
        Let's start with your first product — takes about two minutes.
      </p>

      <div
        style={{
          padding: '2rem',
          background: 'var(--bodega-muted)',
          color: 'var(--bodega-bg)',
          maxWidth: '540px',
        }}
      >
        <p
          style={{
            fontFamily: 'var(--bodega-font-display)',
            fontSize: '1.125rem',
            margin: '0 0 1rem 0',
          }}
        >
          Four taps to publish:
        </p>
        <ol
          style={{
            margin: '0 0 1.5rem 0',
            paddingLeft: '1.25rem',
            lineHeight: 1.7,
            fontSize: '0.95rem',
          }}
        >
          <li>Take a photo (or pick one from your phone)</li>
          <li>Give it a name and a price</li>
          <li>Write a sentence about it</li>
          <li>Tap publish — it's live on your store in a minute</li>
        </ol>
        <Link
          href="/studio/products/new"
          style={{
            display: 'inline-block',
            padding: '0.75rem 1.5rem',
            background: 'var(--bodega-accent)',
            color: 'var(--bodega-bg)',
            textDecoration: 'none',
            fontWeight: 500,
          }}
        >
          Add your first product
        </Link>
      </div>
    </section>
  );
}

// ─── Working dashboard (has products) ─────────────────────────────────

function WorkingDashboard({
  products,
  orders,
}: {
  products: Product[];
  orders: Order[];
}) {
  const publishedCount = products.filter((p) => p.published).length;
  const draftCount = products.length - publishedCount;
  const recentOrders = orders.slice(0, 5);

  return (
    <section>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: '1rem',
          marginBottom: '2rem',
          flexWrap: 'wrap',
        }}
      >
        <h1
          style={{
            fontFamily: 'var(--bodega-font-display)',
            fontSize: '1.75rem',
            fontWeight: 500,
            margin: 0,
          }}
        >
          Today
        </h1>
        <Link
          href="/studio/products/new"
          style={{
            padding: '0.625rem 1.25rem',
            background: 'var(--bodega-accent)',
            color: 'var(--bodega-bg)',
            textDecoration: 'none',
            fontWeight: 500,
            fontSize: '0.95rem',
          }}
        >
          + New product
        </Link>
      </header>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '3rem',
        }}
      >
        <Stat label="Published" value={publishedCount} />
        <Stat label="Drafts" value={draftCount} />
        <Stat label="Orders" value={orders.length} />
        <Stat
          label="Pending to ship"
          value={orders.filter((o) => o.status === 'paid').length}
          highlight
        />
      </div>

      <h2
        style={{
          fontFamily: 'var(--bodega-font-display)',
          fontSize: '1.25rem',
          fontWeight: 500,
          marginBottom: '1rem',
        }}
      >
        Recent orders
      </h2>

      {recentOrders.length === 0 ? (
        <p style={{ opacity: 0.6 }}>No orders yet. They'll land here as they come in.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {recentOrders.map((order) => (
            <li
              key={order.id}
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
          ))}
        </ul>
      )}
    </section>
  );
}

function Stat({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        padding: '1rem 1.25rem',
        border: `1px solid ${highlight ? 'var(--bodega-accent)' : 'var(--bodega-muted)'}`,
        background: highlight ? 'var(--bodega-accent)' : 'transparent',
        color: highlight ? 'var(--bodega-bg)' : 'var(--bodega-fg)',
      }}
    >
      <div style={{ fontSize: '0.85rem', opacity: 0.75 }}>{label}</div>
      <div
        style={{
          fontFamily: 'var(--bodega-font-display)',
          fontSize: '1.75rem',
          fontWeight: 500,
          marginTop: '0.25rem',
        }}
      >
        {value}
      </div>
    </div>
  );
}
