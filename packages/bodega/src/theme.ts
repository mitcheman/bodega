// Design token resolution. The commerce components theme themselves via
// CSS custom properties. This module resolves tokens from the user's
// existing design system in priority order:
//
//   1. .impeccable.md — parsed palette + type tokens
//   2. app/globals.css — CSS custom properties already defined there
//   3. tailwind.config.{js,ts,mjs} — theme.extend.colors
//   4. Defaults — neutral warm palette
//
// Output is a tiny CSS string written to app/bodega-theme.css at deploy time.

export interface BodegaTheme {
  bg: string; // --bodega-bg
  fg: string; // --bodega-fg
  accent: string; // --bodega-accent (primary CTA, links)
  muted: string; // --bodega-muted (secondary text, borders)
  font_display: string; // --bodega-font-display (headings, product titles)
  font_body: string; // --bodega-font-body
}

/** Sensible defaults used when no other source is found. */
export const DEFAULT_THEME: BodegaTheme = {
  bg: '#faf8f3',
  fg: '#1e1a17',
  accent: '#b4552e',
  muted: '#8a847d',
  font_display: 'ui-serif, Georgia, serif',
  font_body: 'ui-sans-serif, system-ui, sans-serif',
};

/**
 * Parse an .impeccable.md file for design tokens. Looks for a palette
 * section with `--token #hex description` lines, and a type section
 * with font family names.
 *
 * Returns a partial theme — unresolved fields fall through to the next
 * source.
 */
export function parseImpeccableTokens(markdown: string): Partial<BodegaTheme> {
  const out: Partial<BodegaTheme> = {};

  // Match lines like: `--paper` #F5EEDF  warm unbleached background
  const paletteRe = /`--(\w+)`\s+(#[0-9A-Fa-f]{3,8})\s+(.+)/g;
  const palette: Record<string, { hex: string; label: string }> = {};
  let m: RegExpExecArray | null;
  while ((m = paletteRe.exec(markdown)) !== null) {
    if (m[1] && m[2] && m[3]) {
      palette[m[1]] = { hex: m[2], label: m[3] };
    }
  }

  // Map common impeccable names to our theme slots.
  // Known names used by the muddmann reference: paper, ink, matcha, sky,
  // banana, clay. We make best-effort semantic matches.
  const bg =
    palette.paper || palette.bg || palette.background || palette.cream;
  const fg = palette.ink || palette.fg || palette.foreground || palette.text;
  const accent =
    palette.clay ||
    palette.accent ||
    palette.primary ||
    palette.terracotta ||
    palette.sky;
  const muted = palette.matcha || palette.muted || palette.secondary;

  if (bg) out.bg = bg.hex;
  if (fg) out.fg = fg.hex;
  if (accent) out.accent = accent.hex;
  if (muted) out.muted = muted.hex;

  // Match type: `**Type:** Fraunces (display serif), Inter (body), ...`
  const typeRe =
    /\*\*Type:\*\*\s+([^(]+)\s*\((?:display\s+\w+)\)[^,]*,\s*([^(]+)\s*\((?:body|sans)[^)]*\)/i;
  const typeMatch = markdown.match(typeRe);
  if (typeMatch && typeMatch[1] && typeMatch[2]) {
    out.font_display = typeMatch[1].trim() + ', serif';
    out.font_body = typeMatch[2].trim() + ', sans-serif';
  }

  return out;
}

/**
 * Parse an app/globals.css file for bodega-compatible custom properties.
 * We look for `--bodega-*` vars first (direct hits), then fall back to
 * heuristics against common names (--bg, --fg, --primary, etc.).
 */
export function parseGlobalsCss(css: string): Partial<BodegaTheme> {
  const out: Partial<BodegaTheme> = {};
  const varRe = /--([\w-]+):\s*([^;]+);/g;
  const vars: Record<string, string> = {};
  let m: RegExpExecArray | null;
  while ((m = varRe.exec(css)) !== null) {
    if (m[1] && m[2]) vars[m[1]] = m[2].trim();
  }

  // Direct bodega hits.
  if (vars['bodega-bg']) out.bg = vars['bodega-bg'];
  if (vars['bodega-fg']) out.fg = vars['bodega-fg'];
  if (vars['bodega-accent']) out.accent = vars['bodega-accent'];
  if (vars['bodega-muted']) out.muted = vars['bodega-muted'];
  if (vars['bodega-font-display']) out.font_display = vars['bodega-font-display'];
  if (vars['bodega-font-body']) out.font_body = vars['bodega-font-body'];

  // Heuristics for common names.
  if (!out.bg) out.bg = vars.bg || vars.background || vars.paper;
  if (!out.fg) out.fg = vars.fg || vars.foreground || vars.text || vars.ink;
  if (!out.accent)
    out.accent = vars.accent || vars.primary || vars.clay || vars.brand;
  if (!out.muted) out.muted = vars.muted || vars.secondary;

  // Strip undefined.
  for (const k of Object.keys(out) as (keyof BodegaTheme)[]) {
    if (!out[k]) delete out[k];
  }

  return out;
}

/** Merge partial themes in priority order, with later sources filling gaps. */
export function mergeThemes(...sources: Partial<BodegaTheme>[]): BodegaTheme {
  const out = { ...DEFAULT_THEME };
  // Iterate in reverse so the FIRST source wins (highest priority).
  for (let i = sources.length - 1; i >= 0; i--) {
    Object.assign(out, sources[i]);
  }
  // But that's inverted. Redo correctly: first source wins.
  const resolved = { ...DEFAULT_THEME };
  for (const s of sources) {
    for (const k of Object.keys(s) as (keyof BodegaTheme)[]) {
      if (s[k] !== undefined && resolved[k] === DEFAULT_THEME[k]) {
        resolved[k] = s[k] as string;
      }
    }
  }
  return resolved;
}

/** Serialize a resolved theme as a CSS rule. Writes to app/bodega-theme.css. */
export function themeToCss(theme: BodegaTheme): string {
  return `:root {
  --bodega-bg: ${theme.bg};
  --bodega-fg: ${theme.fg};
  --bodega-accent: ${theme.accent};
  --bodega-muted: ${theme.muted};
  --bodega-font-display: ${theme.font_display};
  --bodega-font-body: ${theme.font_body};
}
`;
}
