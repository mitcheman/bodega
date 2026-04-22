// Public entry point for @bodega/commerce.
//
// The components layer (ProductGrid, ProductPage, Cart, Checkout) lands
// in a focused next pass when we can test against a real Next.js project.
// For now: types and theme resolution — the foundation everything else
// hangs off.

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

export {
  DEFAULT_THEME,
  parseImpeccableTokens,
  parseGlobalsCss,
  mergeThemes,
  themeToCss,
} from './theme.js';

export type { BodegaTheme } from './theme.js';
