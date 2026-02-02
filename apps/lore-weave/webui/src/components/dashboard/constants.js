/**
 * Dashboard constants - Status configurations
 */

// Status configurations for simulation states
export const STATUS_CONFIGS = {
  idle: { bg: 'var(--lw-bg-tertiary)', color: 'var(--lw-text-muted)', label: 'Ready', icon: '○' },
  initializing: { bg: 'rgba(59, 130, 246, 0.12)', color: 'var(--lw-info)', label: 'Initializing', icon: '◐' },
  validating: { bg: 'rgba(245, 158, 11, 0.12)', color: 'var(--lw-warning)', label: 'Validating', icon: '◑' },
  running: { bg: 'rgba(167, 139, 250, 0.12)', color: 'var(--lw-accent)', label: 'Running', icon: '●' },
  finalizing: { bg: 'rgba(59, 130, 246, 0.12)', color: 'var(--lw-info)', label: 'Finalizing', icon: '◕' },
  complete: { bg: 'rgba(34, 197, 94, 0.12)', color: 'var(--lw-success)', label: 'Complete', icon: '✓' },
  error: { bg: 'rgba(239, 68, 68, 0.12)', color: 'var(--lw-danger)', label: 'Error', icon: '✕' },
};
