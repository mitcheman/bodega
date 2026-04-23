'use client';

// Product editor form. Used for both new (/studio/products/new) and
// edit (/studio/products/[id]). When `product` is null, it's a new
// form; when provided, it prefills and updates.

import { useRef, useState, useTransition } from 'react';
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
  const [images, setImages] = useState<string[]>(product?.images ?? []);
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

        <Field label="Photos" hint="First photo is the primary one shown on the product card.">
          <ImageUploader images={images} onChange={setImages} />
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

// ─── ImageUploader ─────────────────────────────────────────────────────

function ImageUploader({
  images,
  onChange,
}: {
  images: string[];
  onChange: (images: string[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function uploadFile(file: File): Promise<string | null> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/bodega/upload', {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const out = await res.json().catch(() => ({ message: `Upload failed (${res.status}).` }));
      throw new Error(out.message ?? 'Upload failed.');
    }
    const { url } = (await res.json()) as { url: string };
    return url;
  }

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadError(null);
    const added: string[] = [];
    try {
      for (const file of Array.from(files)) {
        const url = await uploadFile(file);
        if (url) added.push(url);
      }
      onChange([...images, ...added]);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function removeAt(index: number) {
    onChange(images.filter((_, i) => i !== index));
  }

  function moveUp(index: number) {
    if (index === 0) return;
    const next = [...images];
    [next[index - 1], next[index]] = [next[index]!, next[index - 1]!];
    onChange(next);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => onFiles(e.target.files)}
        disabled={uploading}
        style={{
          padding: '0.5rem',
          fontSize: '0.9rem',
          fontFamily: 'inherit',
          color: 'var(--bodega-fg)',
        }}
      />

      {uploading && (
        <div style={{ fontSize: '0.85rem', opacity: 0.7 }}>Uploading…</div>
      )}

      {uploadError && (
        <div
          role="alert"
          style={{
            padding: '0.5rem 0.75rem',
            background: 'rgba(200, 50, 50, 0.1)',
            color: '#b52a2a',
            fontSize: '0.85rem',
          }}
        >
          {uploadError}
        </div>
      )}

      {images.length > 0 && (
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
            gap: '0.5rem',
          }}
        >
          {images.map((src, i) => (
            <li
              key={src}
              style={{
                position: 'relative',
                aspectRatio: '1 / 1',
                background: 'var(--bodega-muted)',
                border: i === 0 ? '2px solid var(--bodega-accent)' : 'none',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt=""
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  display: 'flex',
                  gap: '2px',
                  padding: '2px',
                }}
              >
                {i > 0 && (
                  <button
                    type="button"
                    onClick={() => moveUp(i)}
                    title="Move up (make primary)"
                    style={photoButtonStyle}
                  >
                    ↑
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => removeAt(i)}
                  title="Remove"
                  style={photoButtonStyle}
                >
                  ×
                </button>
              </div>
              {i === 0 && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    padding: '2px 4px',
                    background: 'var(--bodega-accent)',
                    color: 'var(--bodega-bg)',
                    fontSize: '0.7rem',
                    textAlign: 'center',
                  }}
                >
                  primary
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const photoButtonStyle: React.CSSProperties = {
  width: '22px',
  height: '22px',
  background: 'rgba(0, 0, 0, 0.6)',
  color: '#fff',
  border: 'none',
  borderRadius: '2px',
  cursor: 'pointer',
  fontSize: '0.8rem',
  lineHeight: 1,
  padding: 0,
};

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
