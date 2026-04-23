import Link from 'next/link';
import type { Product } from '../types.js';
import { formatPrice } from '../format.js';

/**
 * A single product tile. Pure presentation. Themes via CSS custom
 * properties (`--bodega-*`) — the user's existing design system
 * resolves those at the document root.
 *
 * Server component by default; renders synchronously.
 */
export function ProductCard({ product }: { product: Product }) {
  const primaryImage = product.images[0];
  const soldOut = product.inventory === 0;

  return (
    <Link
      href={`/shop/${product.slug}`}
      className="bodega-product-card"
      style={{
        display: 'block',
        color: 'var(--bodega-fg)',
        textDecoration: 'none',
        transition: 'transform 200ms ease, opacity 200ms ease',
      }}
    >
      <div
        style={{
          aspectRatio: '4 / 5',
          background: 'var(--bodega-muted)',
          overflow: 'hidden',
          marginBottom: '0.75rem',
          opacity: soldOut ? 0.6 : 1,
        }}
      >
        {primaryImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={primaryImage}
            alt={product.title}
            loading="lazy"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'grid',
              placeItems: 'center',
              color: 'var(--bodega-bg)',
              fontFamily: 'var(--bodega-font-display)',
              fontSize: '0.875rem',
              opacity: 0.6,
            }}
          >
            no photo yet
          </div>
        )}
      </div>

      <h3
        style={{
          fontFamily: 'var(--bodega-font-display)',
          fontSize: '1.125rem',
          fontWeight: 500,
          margin: '0 0 0.25rem 0',
          lineHeight: 1.2,
        }}
      >
        {product.title}
      </h3>

      <p
        style={{
          fontFamily: 'var(--bodega-font-body)',
          fontSize: '0.95rem',
          margin: 0,
          color: 'var(--bodega-fg)',
          opacity: 0.8,
        }}
      >
        {soldOut ? 'sold out' : formatPrice(product.price_cents, product.currency)}
      </p>
    </Link>
  );
}
