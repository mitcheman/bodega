'use client';

// Product editor form. Used for both new (/studio/products/new) and
// edit (/studio/products/[id]). When `product` is null, it's a new
// form; when provided, it prefills and updates.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Product } from '../types.js';

interface ProductEditorProps {
  /** Existing product to edit. Null for new. */
  product?: Product | null;
}

export function ProductEditor({ product = null }: ProductEditorProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState(product?.title ?? '');
  const [priceDollars, setPriceDollars] = useState(
    product ? (product.price_cents / 100).toFixed(2) : '',
  );
  const [description, setDescription] = useState(product?.description ?? '');
  const [imagesCsv, setImagesCsv] = useState(product?.images.join('\n') ?? '');
  const [inventoryText, setInventoryText] = useState(
    product?.inventory === null || product?.inventory === undefined
      ? ''
      : String(product.inventory),
  );
  const [published, setPublished] = useState(product?.published ?? false);
  const [kind, setKind] = useState(product?.kind ?? 'physical');

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const price_cents = Math.round(parseFloat(priceDollars) * 100);
    if (!title.trim()) {
      setError('Product needs a name.');
      return;
    }
    if (Number.isNaN(price_cents) || price_cents <= 0) {
      setError('Price needs to be a number greater than zero.');
      return;
    }

    const images = imagesCsv
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const inventory = inventoryText.trim() === '' ? null : parseInt(inventoryText, 10);

    const body: Partial<Product> & { title: string; price_cents: number } = {
      ...(product?.id ? { id: product.id } : {}),
      title: title.trim(),
      price_cents,
      description: description.trim(),
      images,
      inventory,
      kind: kind as Product['kind'],
      published,
      tags: product?.tags ?? [],
      currency: product?.currency ?? 'USD',
    };

    startTransition(async () => {
      const res = await fetch(
        product ? `/api/bodega/products/${product.id}` : '/api/bodega/products',
        {
          method: product ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) {
        const out = await res.json().catch(() => ({ message: 'Could not save.' }));
        setError(out.message ?? 'Could not save.');
        return;
      }
      router.push('/studio/products');
      router.refresh();
    });
  }

  return (
    <section style={{ maxWidth: '640px' }}>
      <h1
        style={{
          fontFamily: 'var(--bodega-font-display)',
          fontSize: '1.75rem',
          fontWeight: 500,
          margin: '0 0 2rem 0',
        }}
      >
        {product ? 'Edit product' : 'New product'}
      </h1>

      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <Field label="Name">
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Frog Lamp No. 3"
            style={inputStyle}
          />
        </Field>

        <Field label="Price (USD)">
          <input
            type="number"
            required
            min="0"
            step="0.01"
            value={priceDollars}
            onChange={(e) => setPriceDollars(e.target.value)}
            placeholder="68.00"
            style={inputStyle}
          />
        </Field>

        <Field label="Description">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            placeholder="Hand-built, hand-painted. Dishwasher-safe."
            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
          />
        </Field>

        <Field
          label="Photo URLs (one per line)"
          hint="Upload to any image host (imgur, Cloudinary, or Vercel Blob) and paste the URLs here. First one is the primary."
        >
          <textarea
            value={imagesCsv}
            onChange={(e) => setImagesCsv(e.target.value)}
            rows={3}
            placeholder={'https://...\nhttps://...'}
            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', fontSize: '0.9rem' }}
          />
        </Field>

        <Field label="Inventory (leave blank for unlimited)">
          <input
            type="number"
            min="0"
            value={inventoryText}
            onChange={(e) => setInventoryText(e.target.value)}
            placeholder="e.g. 3"
            style={inputStyle}
          />
        </Field>

        <Field label="Kind">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as Product['kind'])}
            style={inputStyle}
          >
            <option value="physical">Physical — ships to the customer</option>
            <option value="digital">Digital — download after purchase</option>
            <option value="service">Service — scheduled separately</option>
          </select>
        </Field>

        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
          />
          <span>Publish now (visible on your store)</span>
        </label>

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

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
          <button
            type="submit"
            disabled={pending}
            style={{
              padding: '0.875rem 1.5rem',
              fontSize: '1rem',
              fontWeight: 500,
              color: 'var(--bodega-bg)',
              background: 'var(--bodega-accent)',
              border: 'none',
              cursor: pending ? 'wait' : 'pointer',
              opacity: pending ? 0.7 : 1,
              fontFamily: 'inherit',
            }}
          >
            {pending ? 'Saving…' : product ? 'Save changes' : 'Save product'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            style={{
              padding: '0.875rem 1.5rem',
              fontSize: '1rem',
              background: 'transparent',
              border: '1px solid var(--bodega-muted)',
              color: 'var(--bodega-fg)',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '0.75rem',
  fontSize: '1rem',
  border: '1px solid var(--bodega-muted)',
  background: 'var(--bodega-bg)',
  color: 'var(--bodega-fg)',
  fontFamily: 'inherit',
  width: '100%',
  boxSizing: 'border-box',
};

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <span style={{ fontSize: '0.9rem', opacity: 0.85 }}>{label}</span>
      {children}
      {hint && (
        <span style={{ fontSize: '0.8rem', opacity: 0.55, marginTop: '0.2rem' }}>
          {hint}
        </span>
      )}
    </label>
  );
}
