// Domain types for Bodega commerce. These are the contracts every other
// part of the SDK hangs off of. Keep them stable; additive changes only.

/** A product sold on the store. Physical, digital, or service. */
export interface Product {
  /** Stable id, generated once at creation (not a Stripe id). */
  id: string;
  /** URL-safe slug derived from title. Unique per store. */
  slug: string;
  /** Display title, e.g. "Frog Lamp No. 3". */
  title: string;
  /** Short paragraph shown on the product page. Markdown OK. */
  description: string;
  /** Integer in the smallest currency unit (cents for USD). */
  price_cents: number;
  /** ISO-4217 code. Must match the store's configured currency. */
  currency: string;
  /** Ordered list of image URLs. First is the primary. */
  images: string[];
  /** Free-form tags for filtering/SEO. Lowercase kebab-case. */
  tags: string[];
  /**
   * Kind of good. Drives fulfillment UX (shipping vs. digital delivery
   * vs. scheduling). Defaults to 'physical'.
   */
  kind: ProductKind;
  /**
   * Current available inventory. null = unlimited (digital goods, services).
   */
  inventory: number | null;
  /**
   * For physical goods: weight in grams for shipping quotes.
   */
  weight_grams?: number;
  /**
   * Published (visible on the storefront)? Draft products are hidden.
   */
  published: boolean;
  /** Timestamps in ISO 8601. */
  created_at: string;
  updated_at: string;
}

export type ProductKind = 'physical' | 'digital' | 'service';

/** A line item on an order — a product + quantity at the purchased price. */
export interface OrderLineItem {
  product_id: string;
  /** Snapshot of title at purchase time (in case product later changes). */
  title: string;
  quantity: number;
  /** Price per unit at purchase time, smallest currency unit. */
  unit_price_cents: number;
}

export interface Order {
  id: string;
  /** Stripe PaymentIntent id. Canonical reference into Stripe. */
  stripe_payment_intent_id: string;
  /** Customer contact — minimal by default. */
  customer: {
    email: string;
    name?: string;
    phone?: string;
  };
  /** Shipping address for physical orders. Missing for digital. */
  shipping_address?: Address;
  line_items: OrderLineItem[];
  /** Totals, all smallest currency unit. */
  subtotal_cents: number;
  shipping_cents: number;
  tax_cents: number;
  total_cents: number;
  currency: string;
  status: OrderStatus;
  /** Shippo / EasyPost tracking info once label is bought. */
  tracking?: {
    carrier: string;
    number: string;
    label_url?: string;
  };
  created_at: string;
  updated_at: string;
}

export type OrderStatus =
  | 'pending' // PaymentIntent created, not yet paid
  | 'paid' // Paid, not yet shipped (physical) or delivered (digital)
  | 'shipped' // Physical only — label bought and marked shipped
  | 'delivered' // Digital only — download link delivered
  | 'cancelled'
  | 'refunded'
  | 'partially_refunded';

export interface Address {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string; // ISO 3166-1 alpha-2
}

/** In-browser cart state. Persisted to cookie + server-side session. */
export interface Cart {
  id: string;
  items: CartItem[];
  /** Computed server-side on read; never trust client values. */
  subtotal_cents: number;
  currency: string;
  /** Optional shipping address to get a real shipping estimate. */
  shipping_address?: Address;
  /** Updated whenever items change. */
  updated_at: string;
}

export interface CartItem {
  product_id: string;
  quantity: number;
  /**
   * Snapshot of price at add-to-cart time. Checkout re-validates
   * against the current product price before charging.
   */
  snapshot_price_cents: number;
  snapshot_title: string;
}

/** Voice the plugin uses during setup + in-skill output. */
export type VoiceMode = 'developer' | 'simple';

/** What kind of site this is. Drives which routes get scaffolded and
 *  which components render. */
export type SiteMode =
  | 'marketing'   // just home/about/contact, no commerce at all
  | 'showcase'    // products displayed, no cart/checkout ("contact to buy")
  | 'digital'     // cart + checkout + digital delivery, no shipping UI
  | 'commerce';   // full store: cart + checkout + shipping + fulfillment

/** Shipping cost policy. Ignored in modes that don't ship physical goods. */
export type ShippingPolicy =
  | { mode: 'free' }
  | { mode: 'flat'; cents: number }
  | { mode: 'per_item'; cents: number };

/** Configuration read from .bodega.md — the structured part. */
export interface BodegaConfig {
  version: number;
  /** Voice of the plugin during setup (developer/simple). */
  mode: VoiceMode;
  /** Kind of site being built. Drives scaffolding + component behavior.
   *  Defaults to 'commerce' when absent for back-compat with v0.1.x. */
  site_mode?: SiteMode;
  handoff: boolean;
  merchant?: { email: string; first_name?: string };
  operator?: { email: string; first_name?: string };
  business: {
    name: string;
    slug: string;
    kind: 'physical-goods' | 'digital' | 'service';
    shipping_from: string;
    locale: string;
    currency: string;
    domain: {
      preference: 'subdomain' | 'custom' | 'custom-later';
      value: string | null;
      already_owned: boolean;
      verified_at: string | null;
    };
    vibe: string;
    /** Shipping cost policy. Required when site_mode is 'commerce'. */
    shipping?: ShippingPolicy;
    /** Enable Stripe Tax automatic tax calculation at checkout. Default false. */
    stripe_tax?: boolean;
  };
  state: {
    hosting: SetupState;
    payments: SetupState;
    deploy: SetupState | 'preview';
    admin: SetupState;
    domain: SetupState;
    backup: SetupState;
    preview_mode: boolean;
    webhook_configured: boolean;
  };
}

export type SetupState =
  | 'not-started'
  | 'done'
  | 'pending'
  | 'skipped'
  | 'partial'
  | 'failed';
