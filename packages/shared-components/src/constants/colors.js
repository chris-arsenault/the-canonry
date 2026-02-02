/**
 * Color Constants - JavaScript counterpart to theme.css
 *
 * These values mirror the CSS variables in styles/theme.css
 * Use these when you need colors in JavaScript (e.g., dynamic styling,
 * inline styles for conditional rendering).
 *
 * For static CSS styling, prefer using the CSS variables directly.
 */

// Accent colors
export const ACCENT_COLOR = '#f59e0b';
export const ACCENT_LIGHT = '#fbbf24';
export const ACCENT_GRADIENT = 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)';

// Background colors
export const BG = '#0a1929';
export const BG_CARD = '#1e3a5f';
export const BG_DARK = '#0c1f2e';

// Border colors
export const BORDER = 'rgba(59, 130, 246, 0.3)';
export const BORDER_LIGHT = 'rgba(59, 130, 246, 0.15)';

// Text colors
export const TEXT = '#ffffff';
export const TEXT_MUTED = '#93c5fd';
export const TEXT_DIM = '#60a5fa';

// Semantic colors
export const SUCCESS = '#22c55e';
export const DANGER = '#ef4444';
export const WARNING = '#f59e0b';
export const INFO = '#3b82f6';

// Additional palette
export const PURPLE = '#a855f7';
export const PINK = '#ec4899';
export const TEAL = '#14b8a6';
export const GRAY = '#9ca3af';

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
};
