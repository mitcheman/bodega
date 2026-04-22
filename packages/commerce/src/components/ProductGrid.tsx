import { getStorage } from '../storage/blob.js';
import { ProductCard } from './ProductCard.js';

interface ProductGridProps {
  /** Include draft/unpublished products. Only true for /studio previews. */
  includeUnpublished?: boolean;
  /** Optional heading shown above the grid. */
  heading?: string;
  /** Maximum products to show. Defaults to all. */
  limit?: number;
}

/**
 * The storefront's main product grid. Server component — reads from
 * Vercel Blob on render.
 *
 * Usage in a Next.js app:
 *
 *   // app/shop/page.tsx
 *   import { ProductGrid } from '@bodega/commerce';
 *   export default ProductGrid;
 */
export async function ProductGrid({
  includeUnpublished = false,
  heading,
  limit,
}: ProductGridProps = {}) {
  const storage = getStorage();
  const products = await storage.listProducts({ includeUnpublished });
  const visible = limit ? products.slice(0, limit) : products;

  if (visible.length === 0) {
    return <EmptyStorefront />;
  }

  return (
    <section
      className="bodega-product-grid"
      style={{
        padding: '2rem 1.5rem',
        maxWidth: '1200px',
        margin: '0 auto',
      }}
    >
      {heading && (
        <h2
          style={{
            fontFamily: 'var(--bodega-font-display)',
            fontSize: '1.75rem',
            fontWeight: 500,
            marginBottom: '1.5rem',
            color: 'var(--bodega-fg)',
          }}
        >
          {heading}
        </h2>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: '2.5rem 1.75rem',
        }}
      >
        {visible.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}

/** Shown when there are no published products. Neutral, not apologetic. */
function EmptyStorefront() {
  return (
    <section
      style={{
        padding: '6rem 1.5rem',
        textAlign: 'center',
        color: 'var(--bodega-fg)',
        fontFamily: 'var(--bodega-font-body)',
      }}
    >
      <p
        style={{
          fontFamily: 'var(--bodega-font-display)',
          fontSize: '1.5rem',
          marginBottom: '0.5rem',
          opacity: 0.9,
        }}
      >
        The shop opens soon.
      </p>
      <p style={{ margin: 0, opacity: 0.65 }}>
        Come back in a bit — things are on their way.
      </p>
    </section>
  );
}
