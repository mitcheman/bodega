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

// Components — storefront (read-side)
export { ProductGrid } from './components/ProductGrid.js';
export { ProductCard } from './components/ProductCard.js';
export { ProductPage } from './components/ProductPage.js';

// Components — cart + checkout (coming in next commit)
// export { CartProvider, useCart } from './cart/state.js';
// export { Cart } from './components/Cart.js';
// export { Checkout } from './components/Checkout.js';
