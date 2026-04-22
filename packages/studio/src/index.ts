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
export { requireSession, requireOwner } from './auth/require-session.js';

// Components
export { default as StudioLayout } from './components/StudioLayout.js';
export { LoginPage } from './components/LoginPage.js';
export { StudioHome } from './components/StudioHome.js';
export { ProductsPage } from './components/ProductsPage.js';
export { ProductEditor } from './components/ProductEditor.js';
