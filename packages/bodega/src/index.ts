// Public entry point for @mitcheman/bodega.

// Domain types (Cart aliased to CartState to avoid collision with <Cart> component)
export type {
  Product,
  ProductKind,
  Order,
  OrderLineItem,
  OrderStatus,
  Address,
  Cart as CartState,
  CartItem,
  BodegaConfig,
  SetupState,
} from './types.js';

// Theme resolution
export {
  DEFAULT_THEME,
  parseImpeccableTokens,
  parseGlobalsCss,
  mergeThemes,
  themeToCss,
} from './theme.js';
export type { BodegaTheme } from './theme.js';

// Format helpers
export { formatPrice } from './format.js';

// Storage
export type { CommerceStorage } from './storage/interface.js';
export { VercelBlobStorage, getStorage, computeCartSubtotal } from './storage/blob.js';

// Cart state (client-side)
export { CartProvider, useCart, subtotalOf } from './cart/state.js';

// Auth primitives
export type {
  StudioRole,
  MagicLinkOptions,
  MagicLinkRecord,
  Session,
  MagicLinkStorage,
} from './auth/magic-link.js';
export { createMagicLink, verifyMagicLink } from './auth/magic-link.js';
export {
  VercelBlobMagicLinkStorage,
  getMagicLinkStorage,
} from './auth/blob-storage.js';
export { issueSession, getSession, endSession } from './auth/session.js';
export { requireSession, requireOwner } from './auth/require-session.js';

// Storefront components (server)
export { ProductGrid } from './components/ProductGrid.js';
export { ProductCard } from './components/ProductCard.js';
export { ProductPage } from './components/ProductPage.js';

// Storefront components (client)
export { AddToCartButton } from './components/AddToCartButton.js';
export { Cart } from './components/Cart.js';
export { Checkout } from './components/Checkout.js';

// Route helpers — cart-session utilities (route files re-export directly)
export {
  getOrCreateCart,
  readCart,
  clearCartCookie,
} from './routes/cart-session.js';

// Studio admin components
export { default as StudioLayout } from './components/StudioLayout.js';
export { LoginPage } from './components/LoginPage.js';
export { StudioHome } from './components/StudioHome.js';
export { ProductsPage } from './components/ProductsPage.js';
export { ProductEditor } from './components/ProductEditor.js';
export { OrdersPage } from './components/OrdersPage.js';
export { OrderDetail } from './components/OrderDetail.js';
export { MarkShippedButton } from './components/MarkShippedButton.js';
