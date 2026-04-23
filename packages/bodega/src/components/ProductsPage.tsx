import Link from 'next/link';
import { getStorage, formatPrice } from '../index.js';
import type { Product } from '../types.js';

/**
 * Studio products list. All products, published and draft.
 *
 * Server component.
 */
export async function ProductsPage() {
  const storage = getStorage();
  const products = await storage.listProducts({ includeUnpublished: true });

  return (
    <section>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2rem',
          gap: '1rem',
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
          Products
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

      {products.length === 0 ? (
        <EmptyProducts />
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {products.map((product) => (
            <ProductRow key={product.id} product={product} />
          ))}
        </ul>
      )}
    </section>
  );
}

function EmptyProducts() {
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
        No products yet.
      </p>
      <p style={{ opacity: 0.65, margin: '0 0 1.5rem 0' }}>
        Add your first product — it takes about two minutes.
      </p>
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
        Add a product
      </Link>
    </div>
  );
}

function ProductRow({ product }: { product: Product }) {
  const primaryImage = product.images[0];

  return (
    <li
      style={{
        borderTop: '1px solid var(--bodega-muted)',
        padding: '1rem 0',
      }}
    >
      <Link
        href={`/studio/products/${product.id}`}
        style={{
          display: 'flex',
          gap: '1rem',
          alignItems: 'center',
          color: 'var(--bodega-fg)',
          textDecoration: 'none',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            background: 'var(--bodega-muted)',
            flexShrink: 0,
          }}
        >
          {primaryImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={primaryImage}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--bodega-font-display)', fontSize: '1rem' }}>
            {product.title}
          </div>
          <div style={{ fontSize: '0.85rem', opacity: 0.6, marginTop: '0.125rem' }}>
            {formatPrice(product.price_cents, product.currency)}
            {product.inventory !== null && ` · ${product.inventory} in stock`}
          </div>
        </div>

        <div style={{ fontSize: '0.8rem' }}>
          <span
            style={{
              padding: '0.2rem 0.625rem',
              background: product.published ? 'var(--bodega-accent)' : 'var(--bodega-muted)',
              color: 'var(--bodega-bg)',
              textTransform: 'lowercase',
            }}
          >
            {product.published ? 'live' : 'draft'}
          </span>
        </div>
      </Link>
    </li>
  );
}
