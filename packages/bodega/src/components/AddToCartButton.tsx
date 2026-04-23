'use client';

import { useState, useTransition } from 'react';
import { useCart } from '../cart/state.js';
import type { Product, SiteMode } from '../types.js';

interface AddToCartButtonProps {
  product: Product;
  /** Optional: show "View cart" action after adding. Default true. */
  showCartLinkOnAdd?: boolean;
  /** Site mode. In 'showcase' or 'marketing' mode, the buy flow is
   *  replaced with a "contact to buy" link. Default: 'commerce'. */
  siteMode?: SiteMode;
  /** Where the contact CTA links to in showcase mode. Default: '/contact'. */
  contactHref?: string;
}

/**
 * Primary purchase CTA on the product detail page. Wraps useCart()
 * with a pending state and a brief success flash. In non-commerce
 * modes, renders a contact CTA instead.
 */
export function AddToCartButton({
  product,
  showCartLinkOnAdd = true,
  siteMode = 'commerce',
  contactHref = '/contact',
}: AddToCartButtonProps) {
  // Non-commerce modes: no cart, no Stripe — just a contact CTA.
  if (siteMode === 'showcase' || siteMode === 'marketing') {
    return <ContactCTA product={product} href={contactHref} />;
  }

  return (
    <CommerceCTA
      product={product}
      showCartLinkOnAdd={showCartLinkOnAdd}
    />
  );
}

// ─── Contact CTA (showcase / marketing) ───────────────────────────────

function ContactCTA({ product, href }: { product: Product; href: string }) {
  const soldOut = product.inventory === 0;
  const subject = encodeURIComponent(`Interested in: ${product.title}`);
  const hrefWithSubject = href.includes('?')
    ? `${href}&subject=${subject}`
    : `${href}?subject=${subject}`;

  return (
    <a
      href={soldOut ? href : hrefWithSubject}
      className="bodega-contact-cta"
      style={{
        display: 'block',
        width: '100%',
        padding: '0.875rem 1.5rem',
        fontSize: '1rem',
        fontFamily: 'var(--bodega-font-body)',
        fontWeight: 500,
        textAlign: 'center',
        color: 'var(--bodega-bg)',
        background: soldOut ? 'var(--bodega-muted)' : 'var(--bodega-accent)',
        textDecoration: 'none',
      }}
    >
      {soldOut ? 'Sold out' : 'Contact to buy'}
    </a>
  );
}

// ─── Commerce CTA (full store) ────────────────────────────────────────

function CommerceCTA({
  product,
  showCartLinkOnAdd,
}: {
  product: Product;
  showCartLinkOnAdd: boolean;
}) {
  const { addItem } = useCart();
  const [pending, startTransition] = useTransition();
  const [justAdded, setJustAdded] = useState(false);

  const soldOut = product.inventory === 0;
  const disabled = soldOut || pending;

  function onAdd() {
    startTransition(async () => {
      await addItem(product, 1);
      setJustAdded(true);
      setTimeout(() => setJustAdded(false), 2000);
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <button
        type="button"
        onClick={onAdd}
        disabled={disabled}
        className="bodega-add-to-cart"
        style={{
          width: '100%',
          padding: '0.875rem 1.5rem',
          fontSize: '1rem',
          fontFamily: 'var(--bodega-font-body)',
          fontWeight: 500,
          color: 'var(--bodega-bg)',
          background: soldOut
            ? 'var(--bodega-muted)'
            : 'var(--bodega-accent)',
          border: 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.7 : 1,
          transition: 'opacity 150ms ease',
        }}
      >
        {soldOut
          ? 'Sold out'
          : pending
            ? 'Adding…'
            : justAdded
              ? 'Added ✓'
              : 'Add to cart'}
      </button>

      {justAdded && showCartLinkOnAdd && (
        <a
          href="/cart"
          style={{
            textAlign: 'center',
            fontSize: '0.9rem',
            color: 'var(--bodega-accent)',
            textDecoration: 'underline',
            fontFamily: 'var(--bodega-font-body)',
          }}
        >
          View cart →
        </a>
      )}
    </div>
  );
}
