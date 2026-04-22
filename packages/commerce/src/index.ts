// Public entry point for @bodega/commerce.

// Domain types
export type {
  Product,
  ProductKind,
  Order,
  OrderLineItem,
  OrderStatus,
  Address,
  Cart,
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

// Components — storefront (server)
export { ProductGrid } from './components/ProductGrid.js';
export { ProductCard } from './components/ProductCard.js';
export { ProductPage } from './components/ProductPage.js';

// Components — cart + checkout (client)
export { AddToCartButton } from './components/AddToCartButton.js';
export { Cart } from './components/Cart.js';
export { Checkout } from './components/Checkout.js';

// Route helpers — cart-session utilities (route files re-export directly)
export {
  getOrCreateCart,
  readCart,
  clearCartCookie,
} from './routes/cart-session.js';
