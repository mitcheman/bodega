'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Inline "mark shipped" action on the order detail page. Two-step:
 * click → reveal tracking-number form → submit.
 *
 * For MVP, tracking number is free-text + carrier dropdown — we don't
 * integrate Shippo for label generation yet. Merchants print labels
 * via USPS Click-n-Ship (or equivalent) and paste the tracking number.
 */
export function MarkShippedButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [carrier, setCarrier] = useState('USPS');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/bodega/orders/${orderId}/ship`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          carrier,
          number: trackingNumber.trim(),
        }),
      });
      if (!res.ok) {
        const out = await res.json().catch(() => ({ message: 'Could not save.' }));
        setError(out.message ?? 'Could not save.');
        return;
      }
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          padding: '0.75rem 1.25rem',
          background: 'var(--bodega-accent)',
          color: 'var(--bodega-bg)',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'inherit',
          fontSize: '0.95rem',
          fontWeight: 500,
        }}
      >
        Mark as shipped
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
        <span style={{ fontSize: '0.85rem', opacity: 0.75 }}>Carrier</span>
        <select
          value={carrier}
          onChange={(e) => setCarrier(e.target.value)}
          style={inputStyle}
        >
          <option value="USPS">USPS</option>
          <option value="UPS">UPS</option>
          <option value="FedEx">FedEx</option>
          <option value="DHL">DHL</option>
          <option value="Other">Other</option>
        </select>
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
        <span style={{ fontSize: '0.85rem', opacity: 0.75 }}>Tracking number</span>
        <input
          type="text"
          required
          value={trackingNumber}
          onChange={(e) => setTrackingNumber(e.target.value)}
          placeholder="9400 1000 0000 0000 0000 00"
          style={inputStyle}
        />
      </label>

      {error && (
        <div
          role="alert"
          style={{
            padding: '0.5rem 0.75rem',
            background: 'rgba(200, 50, 50, 0.1)',
            color: '#b52a2a',
            fontSize: '0.85rem',
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          type="submit"
          disabled={pending}
          style={{
            flex: 1,
            padding: '0.75rem 1rem',
            background: 'var(--bodega-accent)',
            color: 'var(--bodega-bg)',
            border: 'none',
            cursor: pending ? 'wait' : 'pointer',
            opacity: pending ? 0.7 : 1,
            fontFamily: 'inherit',
            fontSize: '0.9rem',
            fontWeight: 500,
          }}
        >
          {pending ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          style={{
            padding: '0.75rem 1rem',
            background: 'transparent',
            border: '1px solid var(--bodega-muted)',
            color: 'var(--bodega-fg)',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: '0.9rem',
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '0.5rem 0.6rem',
  fontSize: '0.9rem',
  border: '1px solid var(--bodega-muted)',
  background: 'var(--bodega-bg)',
  color: 'var(--bodega-fg)',
  fontFamily: 'inherit',
  width: '100%',
  boxSizing: 'border-box',
};
