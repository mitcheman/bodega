// Public entry point for @bodega/studio.

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

// Route helpers — imported directly via ./routes/* subpath exports.
// See package.json "exports" for the full list.

// Components — coming in the next commit:
// export { StudioLayout } from './components/StudioLayout.js';
// export { StudioHome } from './components/StudioHome.js';
// export { LoginPage } from './components/LoginPage.js';
// export { ProductList, ProductEditor } from './components/ProductList.js';
// export { OrderList, OrderDetail } from './components/OrderList.js';
