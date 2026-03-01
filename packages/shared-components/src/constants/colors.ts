/**
 * Color Constants - TypeScript counterpart to theme.css
 *
 * These values mirror the CSS variables in styles/theme.css
 * Use these when you need colors in TypeScript/JavaScript (e.g., dynamic styling,
 * inline styles for conditional rendering).
 *
 * For static CSS styling, prefer using the CSS variables directly.
 */

// Accent colors
export const ACCENT_COLOR: string = '#f59e0b';
export const ACCENT_LIGHT: string = '#fbbf24';
export const ACCENT_GRADIENT: string = 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)';

// Background colors
export const BG: string = '#0a1929';
export const BG_CARD: string = '#1e3a5f';
export const BG_DARK: string = '#0c1f2e';

// Border colors
export const BORDER: string = 'rgba(59, 130, 246, 0.3)';
export const BORDER_LIGHT: string = 'rgba(59, 130, 246, 0.15)';

// Text colors
export const TEXT: string = '#ffffff';
export const TEXT_MUTED: string = '#93c5fd';
export const TEXT_DIM: string = '#60a5fa';

// Semantic colors
export const SUCCESS: string = '#22c55e';
export const DANGER: string = '#ef4444';
export const WARNING: string = '#f59e0b';
export const INFO: string = '#3b82f6';

// Additional palette
export const PURPLE: string = '#a855f7';
export const PINK: string = '#ec4899';
export const TEAL: string = '#14b8a6';
export const GRAY: string = '#9ca3af';

// Named color object for convenience
export const COLORS = {
  accent: ACCENT_COLOR,
  accentLight: ACCENT_LIGHT,
  bg: BG,
  bgCard: BG_CARD,
  bgDark: BG_DARK,
  border: BORDER,
  borderLight: BORDER_LIGHT,
  text: TEXT,
  textMuted: TEXT_MUTED,
  textDim: TEXT_DIM,
  success: SUCCESS,
  danger: DANGER,
  warning: WARNING,
  info: INFO,
  purple: PURPLE,
  pink: PINK,
  teal: TEAL,
  gray: GRAY,
} as const;
