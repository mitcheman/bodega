'use client';

// Cart state provider + hook. Client-side only (state lives in context).
// The cart is persisted server-side by the /api/bodega/cart/* routes
// (created separately at deploy-time by the deploy skill).
//
// Flow:
//   1. <CartProvider> mounts at the app root; reads cart id from cookie
//      (or creates a fresh one), fetches current state from the server.
//   2. Child components use useCart() to read items + dispatch updates.
//   3. Mutations (add/remove/setQuantity) call the server API; server
//      is the source of truth, client re-syncs after each mutation.

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import type { Cart, CartItem, Product } from '../types.js';

interface CartContextValue {
  cart: Cart | null;
  loading: boolean;
  itemCount: number;
  subtotalCents: number;
  addItem: (product: Product, quantity?: number) => Promise<void>;
  removeItem: (product_id: string) => Promise<void>;
  setQuantity: (product_id: string, quantity: number) => Promise<void>;
  refresh: () => Promise<void>;
}

const CartContext = createContext<CartContextValue | null>(null);

/**
 * App-root provider. Mounts once per layout. Keeps cart state in sync
 * with the server via the /api/bodega/cart route.
 */
export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/bodega/cart', { method: 'GET' });
      if (res.ok) {
        setCart((await res.json()) as Cart);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addItem = useCallback(
    async (product: Product, quantity = 1) => {
      const res = await fetch('/api/bodega/cart/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: product.id, quantity }),
      });
      if (res.ok) setCart((await res.json()) as Cart);
    },
    [],
  );

  const removeItem = useCallback(async (product_id: string) => {
    const res = await fetch(`/api/bodega/cart/items/${product_id}`, {
      method: 'DELETE',
    });
    if (res.ok) setCart((await res.json()) as Cart);
  }, []);

  const setQuantity = useCallback(
    async (product_id: string, quantity: number) => {
      if (quantity <= 0) {
        await removeItem(product_id);
        return;
      }
      const res = await fetch(`/api/bodega/cart/items/${product_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity }),
      });
      if (res.ok) setCart((await res.json()) as Cart);
    },
    [removeItem],
  );

  const itemCount = cart?.items.reduce((n, i) => n + i.quantity, 0) ?? 0;
  const subtotalCents = cart?.subtotal_cents ?? 0;

  const value: CartContextValue = {
    cart,
    loading,
    itemCount,
    subtotalCents,
    addItem,
    removeItem,
    setQuantity,
    refresh,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

/**
 * Access cart state anywhere below <CartProvider>. Throws if used outside
 * the provider (catches the common wiring mistake early).
 */
export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error(
      'useCart must be used within a <CartProvider>. Wrap your app layout with <CartProvider>.',
    );
  }
  return ctx;
}

/** Sum line-item totals. Exposed so checkout can recompute before charge. */
export function subtotalOf(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.snapshot_price_cents * i.quantity, 0);
}
