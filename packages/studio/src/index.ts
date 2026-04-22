// Public entry point for @bodega/studio.
//
// Auth primitives first (the /studio skill needs these). Admin UI
// components (StudioHome, ProductList, ProductEditor, OrderList,
// OrderDetail, Settings) land in the components pass.

export type {
  StudioRole,
  MagicLinkOptions,
  MagicLinkRecord,
  Session,
  MagicLinkStorage,
} from './auth/magic-link.js';

export {
  createMagicLink,
  verifyMagicLink,
} from './auth/magic-link.js';
