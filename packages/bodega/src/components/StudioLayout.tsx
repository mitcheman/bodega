import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '../auth/session.js';

/**
 * Auth-gated layout for the studio. Reads the session cookie server-side
 * and redirects to /studio/login if absent. Wraps children with a minimal
 * shell: header, nav, content area.
 *
 * IMPORTANT: mount this in a (authed) route group, NOT at app/studio/layout.tsx
 * directly. If it wraps /studio/login, the redirect bounces back into the
 * same layout and you get an infinite loop.
 *
 * Correct mount:
 *   // app/studio/(authed)/layout.tsx
 *   import { StudioLayout } from '@mitcheman/bodega';
 *   export default StudioLayout;
 *
 * Then put authed pages under app/studio/(authed)/ and leave
 * /studio/login + /studio/verify outside the group, so they render
 * without the layout chrome and without the auth gate.
 */
export default async function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect('/studio/login');
  }

  const storeName = process.env.BODEGA_STORE_NAME ?? 'Your studio';

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bodega-bg)',
        color: 'var(--bodega-fg)',
        fontFamily: 'var(--bodega-font-body)',
      }}
    >
      <header
        style={{
          borderBottom: '1px solid var(--bodega-muted)',
          padding: '1rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
        }}
      >
        <Link
          href="/studio"
          style={{
            color: 'var(--bodega-fg)',
            textDecoration: 'none',
            fontFamily: 'var(--bodega-font-display)',
            fontSize: '1.125rem',
          }}
        >
          {storeName}
        </Link>

        <nav style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
          <NavLink href="/studio">Home</NavLink>
          <NavLink href="/studio/products">Products</NavLink>
          <NavLink href="/studio/orders">Orders</NavLink>
          <form action="/api/bodega/auth/logout" method="POST" style={{ margin: 0 }}>
            <button
              type="submit"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--bodega-fg)',
                opacity: 0.6,
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: '0.9rem',
              }}
            >
              Sign out
            </button>
          </form>
        </nav>
      </header>

      <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        {children}
      </main>
    </div>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      style={{
        color: 'var(--bodega-fg)',
        textDecoration: 'none',
        fontSize: '0.95rem',
      }}
    >
      {children}
    </Link>
  );
}
