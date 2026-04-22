import { notFound } from 'next/navigation';
import { getStorage } from '../storage/blob.js';
import { formatPrice } from '../format.js';
import type { Product } from '../types.js';

interface ProductPageProps {
  /** The slug from the dynamic route segment. */
  slug: string;
}

/**
 * Single-product detail page. Server component — reads from storage.
 *
 * Usage:
 *
 *   // app/shop/[slug]/page.tsx
 *   import { ProductPage } from '@bodega/commerce';
 *   export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
 *     const { slug } = await params;
 *     return <ProductPage slug={slug} />;
 *   }
 */
export async function ProductPage({ slug }: ProductPageProps) {
  const storage = getStorage();
  const product = await storage.getProductBySlug(slug);

  if (!product || !product.published) {
    notFound();
  }

  return (
    <article
      className="bodega-product-page"
      style={{
        maxWidth: '1100px',
        margin: '0 auto',
        padding: '2rem 1.5rem 5rem',
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.2fr) minmax(280px, 1fr)',
        gap: '3rem',
        color: 'var(--bodega-fg)',
        fontFamily: 'var(--bodega-font-body)',
      }}
    >
      <ProductImages product={product} />
      <ProductInfo product={product} />
    </article>
  );
}

function ProductImages({ product }: { product: Product }) {
  if (product.images.length === 0) {
    return (
      <div
        style={{
          aspectRatio: '1 / 1',
          background: 'var(--bodega-muted)',
          display: 'grid',
          placeItems: 'center',
          color: 'var(--bodega-bg)',
          opacity: 0.6,
          fontFamily: 'var(--bodega-font-display)',
        }}
      >
        no photo yet
      </div>
    );
  }

  return (
    <div
      className="bodega-product-images"
      style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
    >
      {product.images.map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          src={src}
          alt={`${product.title} — photo ${i + 1}`}
          loading={i === 0 ? 'eager' : 'lazy'}
          style={{
            width: '100%',
            height: 'auto',
            display: 'block',
            background: 'var(--bodega-muted)',
          }}
        />
      ))}
    </div>
  );
}

function ProductInfo({ product }: { product: Product }) {
  const soldOut = product.inventory === 0;

  return (
    <div
      className="bodega-product-info"
      style={{
        position: 'sticky',
        top: '2rem',
        alignSelf: 'start',
      }}
    >
      <h1
        style={{
          fontFamily: 'var(--bodega-font-display)',
          fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
          fontWeight: 500,
          lineHeight: 1.1,
          margin: '0 0 0.5rem 0',
        }}
      >
        {product.title}
      </h1>

      <p
        style={{
          fontSize: '1.25rem',
          margin: '0 0 2rem 0',
          color: 'var(--bodega-fg)',
          opacity: 0.85,
        }}
      >
        {soldOut ? 'sold out' : formatPrice(product.price_cents, product.currency)}
      </p>

      {product.description && (
        <div
          style={{
            fontSize: '1rem',
            lineHeight: 1.6,
            margin: '0 0 2rem 0',
            opacity: 0.9,
            whiteSpace: 'pre-wrap',
          }}
        >
          {product.description}
        </div>
      )}

      {/* AddToCart client component lands in the next commit. */}
      <AddToCartPlaceholder soldOut={soldOut} />

      {product.tags.length > 0 && (
        <div
          style={{
            marginTop: '2rem',
            fontSize: '0.85rem',
            opacity: 0.5,
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}
        >
          {product.tags.map((t) => (
            <span
              key={t}
              style={{
                padding: '0.25rem 0.625rem',
                border: '1px solid currentColor',
                borderRadius: '999px',
              }}
            >
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Placeholder for the Add-to-Cart button. Replaced by a real client
 * component in the cart commit. Rendering as a button with disabled
 * state so the page lays out correctly in the meantime.
 */
function AddToCartPlaceholder({ soldOut }: { soldOut: boolean }) {
  return (
    <button
      type="button"
      disabled
      title="Cart functionality coming in the next release"
      style={{
        width: '100%',
        padding: '0.875rem 1.5rem',
        fontSize: '1rem',
        fontFamily: 'var(--bodega-font-body)',
        fontWeight: 500,
        color: 'var(--bodega-bg)',
        background: soldOut ? 'var(--bodega-muted)' : 'var(--bodega-accent)',
        border: 'none',
        cursor: 'not-allowed',
        opacity: 0.7,
      }}
    >
      {soldOut ? 'Sold out' : 'Add to cart (coming soon)'}
    </button>
  );
}
