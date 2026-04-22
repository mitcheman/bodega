'use client';

// /studio/login — the only unauthenticated page under /studio.
//
// Mount at app/studio/login/page.tsx:
//   import { LoginPage } from '@bodega/studio';
//   export default LoginPage;

import { useState, useTransition } from 'react';
import { useSearchParams } from 'next/navigation';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);
  const params = useSearchParams();
  const error = params.get('error');

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      await fetch('/api/bodega/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setSent(true);
    });
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: 'var(--bodega-bg)',
        color: 'var(--bodega-fg)',
        fontFamily: 'var(--bodega-font-body)',
        padding: '2rem 1rem',
      }}
    >
      <div style={{ maxWidth: '420px', width: '100%' }}>
        <h1
          style={{
            fontFamily: 'var(--bodega-font-display)',
            fontSize: '1.75rem',
            fontWeight: 500,
            margin: '0 0 0.5rem 0',
          }}
        >
          Your studio
        </h1>
        <p style={{ opacity: 0.7, margin: '0 0 2rem 0' }}>
          Enter the email your studio is set up with. We'll send you a
          one-time link.
        </p>

        {sent ? (
          <div
            style={{
              padding: '1.25rem 1.5rem',
              background: 'var(--bodega-muted)',
              color: 'var(--bodega-bg)',
            }}
          >
            <p style={{ margin: 0 }}>
              If that email belongs to this store, a login link is on its
              way. Check your inbox — it can take a minute. Check spam if
              you don't see it.
            </p>
          </div>
        ) : (
          <form
            onSubmit={onSubmit}
            style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
          >
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
                {decodeURIComponent(error)}
              </div>
            )}
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.9rem', opacity: 0.8 }}>Email</span>
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                style={{
                  padding: '0.75rem',
                  fontSize: '1rem',
                  border: '1px solid var(--bodega-muted)',
                  background: 'var(--bodega-bg)',
                  color: 'var(--bodega-fg)',
                  fontFamily: 'inherit',
                }}
              />
            </label>
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
              {pending ? 'Sending…' : 'Send me a link'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
