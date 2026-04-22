# @bodega/studio

Merchant-facing admin UI for Bodega stores. Mounts at `/studio` on the
merchant's site (not a separate dashboard) — so their daily tool lives
at their own domain, not ours.

## Install

```bash
npm install @bodega/studio
```

## Surface

```ts
import {
  StudioLayout,
  StudioHome,
  ProductList,
  ProductEditor,
  OrderList,
  OrderDetail,
  Settings,
  createMagicLink,
  verifyMagicLink,
  useStudioSession,
} from '@bodega/studio';
```

### Mounting in Next.js

`bodega:deploy` scaffolds these routes automatically. If you're wiring
manually:

```tsx
// app/studio/layout.tsx
import { StudioLayout } from '@bodega/studio';
export default StudioLayout;

// app/studio/page.tsx
import { StudioHome } from '@bodega/studio';
export default StudioHome;

// app/studio/products/[id]/page.tsx
import { ProductEditor } from '@bodega/studio';
export default ProductEditor;
```

## Design principles

- **Phone-first.** Most operations are one-thumb. The owner is adding
  products between throwing pots, not sitting at a desk.
- **4 taps for a product.** Camera → photo → title + price → publish.
- **3 taps for shipping an order.** Order → print label → mark shipped.
- **Plain English.** No "SKU", "variants", "inventory tracking" unless
  they turn it on. Defaults hide complexity.
- **The brand disappears.** Merchant sees their own store name in the
  header, not "Bodega". Their daily tool lives at their domain.

## Auth

Magic-link only. No passwords.

```ts
// Server
const link = await createMagicLink(email, { role: 'owner' });
// email it via Resend, expires in 24h

// Client
const session = useStudioSession();
```

Roles: `owner`, `manager`, `product-editor`, `packer`. Scoping enforced
in `/studio` middleware.

## First-run walkthrough

When a merchant logs in for the first time (no products yet), the home
view shows a guided 4-step walkthrough instead of an empty dashboard:

1. Add your first product
2. Set shipping options
3. Set return policy
4. Share your store (IG caption, QR link-in-bio)

Controlled by `.bodega.md` → `admin.first_run_walkthrough: true`.

## License

Apache 2.0.
