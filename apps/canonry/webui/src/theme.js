/**
 * Shared theme constants for The Canonry suite
 *
 * Arctic Blue Theme - inspired by the Archivist world explorer
 * Deep blues with ice accents for a cohesive arctic aesthetic
 */

// Color palette - Arctic Blue Theme
export const colors = {
  // Backgrounds (arctic deep blues)
  bgPrimary: '#0a1929',      // Main app background (deepest arctic)
  bgSecondary: '#1e3a5f',    // Panels, cards (mid arctic)
  bgTertiary: '#2d4a6f',     // Inputs, nested elements (lighter arctic)
  bgSidebar: '#0c1f2e',      // Sidebar background (very dark arctic)

  // Borders (blue-tinted)
  border: 'rgba(59, 130, 246, 0.3)',         // Standard border
  borderLight: 'rgba(59, 130, 246, 0.5)',    // Lighter border for hover states

  // Text (ice-white tones)
  textPrimary: '#ffffff',    // Main text
  textSecondary: '#93c5fd',  // Secondary text (ice blue)
  textMuted: '#60a5fa',      // Muted/hint text (frost blue)

  // Primary accent (arctic ice blue)
  accent: '#3b82f6',
  accentLight: '#60a5fa',
  accentLighter: '#93c5fd',

  // Per-app accent colors (all arctic blue family for consistency)
  accentEnumerist: '#3b82f6',     // Arctic blue
  accentNameForge: '#fbbf24',     // Gold accent (for contrast)
  accentCosmographer: '#60a5fa',  // Frost blue
  accentCoherence: '#f59e0b',     // Amber (warm contrast)
  accentSimulation: '#a78bfa',    // Purple (cool contrast)
  accentIlluminator: '#a855f7',   // Purple/Magenta (enrichment/magic)
  accentArchivist: '#3b82f6',     // Arctic blue (primary)
  accentChronicler: '#10b981',    // Emerald (knowledge/writing)

  // Secondary accent shades (for gradients)
  accentEnumeristLight: '#60a5fa',
  accentNameForgeLight: '#fcd34d',
  accentCosmographerLight: '#93c5fd',
  accentCoherenceLight: '#fbbf24',
  accentSimulationLight: '#c4b5fd',
  accentIlluminatorLight: '#c084fc',
  accentArchivistLight: '#60a5fa',
  accentChroniclerLight: '#34d399',

  // Feature highlight colors
  highlightBlue: '#3b82f6',
  highlightPurple: '#a78bfa',
  highlightGreen: '#4ade80',
  highlightOrange: '#fbbf24',
  highlightRed: '#f87171',
  highlightTeal: '#2dd4bf',
  highlightAmber: '#f59e0b',

  // Semantic colors
  danger: '#ef4444',         // Delete, errors
  success: '#22c55e',        // Success states
  warning: '#f59e0b',        // Warnings

  // Interactive (arctic blue)
  buttonPrimary: '#3b82f6',
  buttonPrimaryHover: '#60a5fa',
  buttonSecondary: 'rgba(59, 130, 246, 0.2)',
  buttonSecondaryHover: 'rgba(59, 130, 246, 0.3)',

  // Hover/active backgrounds
  hoverBg: 'rgba(59, 130, 246, 0.15)',
  activeBg: 'rgba(59, 130, 246, 0.25)',
};

// Typography
export const typography = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',

  // Font sizes
  sizeXs: '11px',
  sizeSm: '12px',
  sizeMd: '13px',
  sizeLg: '14px',
  sizeXl: '16px',
  sizeXxl: '20px',
  sizeTitle: '24px',

  // Font weights
  weightNormal: 400,
  weightMedium: 500,
  weightSemibold: 600,
  weightBold: 700,
};

// Spacing
export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '20px',
  xxl: '24px',
  xxxl: '32px',
};

// Border radius
export const radius = {
  sm: '4px',
  md: '6px',
  lg: '8px',
  xl: '12px',
};

// Shadows (deeper for arctic theme)
export const shadows = {
  sm: '0 1px 3px rgba(0, 0, 0, 0.3)',
  md: '0 4px 6px rgba(0, 0, 0, 0.3)',
  lg: '0 10px 20px rgba(0, 0, 0, 0.4)',
  glow: '0 0 20px rgba(59, 130, 246, 0.3)',
};

// Common component styles
export const components = {
  // Sidebar navigation button
  navButton: {
    display: 'block',
    width: '100%',
    padding: `${spacing.sm} ${spacing.md}`,
    marginBottom: spacing.xs,
    fontSize: typography.sizeMd,
    fontWeight: typography.weightMedium,
    fontFamily: typography.fontFamily,
    textAlign: 'left',
    border: 'none',
    borderRadius: radius.md,
    cursor: 'pointer',
    transition: 'background-color 0.15s, color 0.15s',
  },

  navButtonInactive: {
    backgroundColor: 'transparent',
    color: colors.textSecondary,
  },

  // Input styles
  input: {
    width: '100%',
    padding: `${spacing.sm} ${spacing.md}`,
    fontSize: typography.sizeLg,
    fontFamily: typography.fontFamily,
    backgroundColor: 'rgba(10, 25, 41, 0.6)',
    border: `1px solid ${colors.border}`,
    borderRadius: radius.sm,
    color: colors.textPrimary,
    boxSizing: 'border-box',
  },

  // Select styles
  select: {
    width: '100%',
    padding: `${spacing.sm} ${spacing.md}`,
    fontSize: typography.sizeLg,
    fontFamily: typography.fontFamily,
    backgroundColor: 'rgba(10, 25, 41, 0.6)',
    border: `1px solid ${colors.border}`,
    borderRadius: radius.sm,
    color: colors.textPrimary,
  },

  // Label styles
  label: {
    display: 'block',
    fontSize: typography.sizeSm,
    fontWeight: typography.weightMedium,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },

  // Card styles - standardized to 16px (spacing.lg) padding
  card: {
    backgroundColor: colors.bgSecondary,
    borderRadius: radius.lg,
    border: `1px solid ${colors.border}`,
    boxShadow: shadows.md,
    padding: spacing.lg,
  },

  // Button styles
  buttonPrimary: {
    padding: `${spacing.sm} ${spacing.lg}`,
    fontSize: typography.sizeMd,
    fontWeight: typography.weightMedium,
    fontFamily: typography.fontFamily,
    background: `linear-gradient(135deg, ${colors.buttonPrimary} 0%, ${colors.buttonPrimaryHover} 100%)`,
    color: 'white',
    border: 'none',
    borderRadius: radius.sm,
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(59, 130, 246, 0.4)',
  },

  buttonDanger: {
    padding: `${spacing.sm} ${spacing.lg}`,
    fontSize: typography.sizeMd,
    fontWeight: typography.weightMedium,
    fontFamily: typography.fontFamily,
    backgroundColor: 'transparent',
    color: colors.danger,
    border: `1px solid ${colors.danger}`,
    borderRadius: radius.sm,
    cursor: 'pointer',
  },

  // Section title
  sectionTitle: {
    fontSize: typography.sizeXl,
    fontWeight: typography.weightSemibold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },

  // Subtitle
  subtitle: {
    fontSize: typography.sizeLg,
    color: colors.textSecondary,
  },
};

// Helper to get accent color for current app
export function getAccentColor(appId) {
  switch (appId) {
    case 'enumerist': return colors.accentEnumerist;
    case 'names': return colors.accentNameForge;
    case 'cosmography': return colors.accentCosmographer;
    case 'coherence': return colors.accentCoherence;
    case 'simulation': return colors.accentSimulation;
    case 'illuminator': return colors.accentIlluminator;
    case 'archivist': return colors.accentArchivist;
    case 'chronicler': return colors.accentChronicler;
    default: return colors.accent;
  }
}

// Helper to get gradient for active nav buttons
export function getAccentGradient(appId) {
  switch (appId) {
    case 'enumerist':
      return `linear-gradient(135deg, ${colors.accentEnumerist} 0%, ${colors.accentEnumeristLight} 100%)`;
    case 'names':
      return `linear-gradient(135deg, ${colors.accentNameForge} 0%, ${colors.accentNameForgeLight} 100%)`;
    case 'cosmography':
      return `linear-gradient(135deg, ${colors.accentCosmographer} 0%, ${colors.accentCosmographerLight} 100%)`;
    case 'coherence':
      return `linear-gradient(135deg, ${colors.accentCoherence} 0%, ${colors.accentCoherenceLight} 100%)`;
    case 'simulation':
      return `linear-gradient(135deg, ${colors.accentSimulation} 0%, ${colors.accentSimulationLight} 100%)`;
    case 'illuminator':
      return `linear-gradient(135deg, ${colors.accentIlluminator} 0%, ${colors.accentIlluminatorLight} 100%)`;
    case 'archivist':
      return `linear-gradient(135deg, ${colors.accentArchivist} 0%, ${colors.accentArchivistLight} 100%)`;
    case 'chronicler':
      return `linear-gradient(135deg, ${colors.accentChronicler} 0%, ${colors.accentChroniclerLight} 100%)`;
    default:
      return `linear-gradient(135deg, ${colors.accent} 0%, ${colors.accentLight} 100%)`;
  }
}

// Helper to get hover background for current app
export function getHoverBg(appId) {
  switch (appId) {
    case 'enumerist': return 'rgba(59, 130, 246, 0.15)';
    case 'names': return 'rgba(251, 191, 36, 0.15)';
    case 'cosmography': return 'rgba(96, 165, 250, 0.15)';
    case 'coherence': return 'rgba(245, 158, 11, 0.15)';
    case 'simulation': return 'rgba(167, 139, 250, 0.15)';
    case 'illuminator': return 'rgba(168, 85, 247, 0.15)';
    case 'archivist': return 'rgba(59, 130, 246, 0.15)';
    case 'chronicler': return 'rgba(16, 185, 129, 0.15)';
    default: return colors.hoverBg;
  }
}
