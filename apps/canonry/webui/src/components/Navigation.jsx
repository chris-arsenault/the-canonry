/**
 * Navigation - Tab bar for switching between tools
 */

import React from 'react';
import { colors, typography, spacing, radius, getAccentColor, getAccentGradient, getHoverBg } from '../theme';

const styles = {
  nav: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.xs,
    padding: `${spacing.sm} ${spacing.lg}`,
    backgroundColor: colors.bgSidebar,
    borderBottom: `1px solid ${colors.border}`,
  },
  tabsContainer: {
    display: 'flex',
    gap: spacing.xs,
    flex: 1,
  },
  tab: {
    padding: `${spacing.md} ${spacing.xl}`,
    fontSize: typography.sizeLg,
    fontWeight: typography.weightMedium,
    fontFamily: typography.fontFamily,
    border: 'none',
    borderRadius: `${radius.md} ${radius.md} 0 0`,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  tabInactive: {
    backgroundColor: 'transparent',
    color: colors.textSecondary,
  },
  tabDisabled: {
    backgroundColor: 'transparent',
    color: colors.textMuted,
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  badge: {
    marginLeft: spacing.sm,
    padding: `2px ${spacing.sm}`,
    fontSize: typography.sizeXs,
    backgroundColor: colors.bgTertiary,
    borderRadius: '10px',
    color: colors.textMuted,
  },
  helpButton: {
    padding: `${spacing.sm} ${spacing.md}`,
    fontSize: typography.sizeMd,
    fontWeight: typography.weightMedium,
    fontFamily: typography.fontFamily,
    backgroundColor: 'transparent',
    color: colors.textSecondary,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.md,
    cursor: 'pointer',
    transition: 'all 0.15s',
    display: 'flex',
    alignItems: 'center',
    gap: spacing.xs,
  },
};

const TABS = [
  { id: 'enumerist', label: 'Enumerist', enabled: true },
  { id: 'names', label: 'Name Forge', enabled: true },
  { id: 'cosmography', label: 'Cosmographer', enabled: true },
  { id: 'coherence', label: 'Coherence Engine', enabled: true },
  { id: 'simulation', label: 'Lore Weave', enabled: true },
  { id: 'illuminator', label: 'Illuminator', enabled: true },
  { id: 'archivist', label: 'Archivist', enabled: true },
  { id: 'chronicler', label: 'Chronicler', enabled: true },
];

export default function Navigation({ activeTab, onTabChange, onHelpClick, onAwsClick }) {
  const getTabStyle = (tab) => {
    if (!tab.enabled) {
      return { ...styles.tab, ...styles.tabDisabled };
    }
    if (tab.id === activeTab) {
      return {
        ...styles.tab,
        background: getAccentGradient(tab.id),
        color: colors.bgSidebar,
        fontWeight: typography.weightSemibold,
      };
    }
    return { ...styles.tab, ...styles.tabInactive };
  };

  return (
    <nav style={styles.nav}>
      <div style={styles.tabsContainer}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => tab.enabled && onTabChange(tab.id)}
            style={getTabStyle(tab)}
            disabled={!tab.enabled}
            onMouseEnter={(e) => {
              if (tab.enabled && tab.id !== activeTab) {
                e.target.style.backgroundColor = getHoverBg(tab.id);
                e.target.style.color = getAccentColor(tab.id);
              }
            }}
            onMouseLeave={(e) => {
              if (tab.enabled && tab.id !== activeTab) {
                e.target.style.backgroundColor = 'transparent';
                e.target.style.color = colors.textSecondary;
              }
            }}
          >
            {tab.label}
            {tab.badge && <span style={styles.badge}>{tab.badge}</span>}
          </button>
        ))}
      </div>
      <button
        style={styles.helpButton}
        onClick={onAwsClick}
        onMouseEnter={(e) => {
          e.target.style.backgroundColor = colors.bgTertiary;
          e.target.style.color = colors.textPrimary;
          e.target.style.borderColor = colors.borderLight;
        }}
        onMouseLeave={(e) => {
          e.target.style.backgroundColor = 'transparent';
          e.target.style.color = colors.textSecondary;
          e.target.style.borderColor = colors.border;
        }}
        title="AWS & S3 Sync"
      >
        AWS
      </button>
      <button
        style={styles.helpButton}
        onClick={onHelpClick}
        onMouseEnter={(e) => {
          e.target.style.backgroundColor = colors.bgTertiary;
          e.target.style.color = colors.textPrimary;
          e.target.style.borderColor = colors.borderLight;
        }}
        onMouseLeave={(e) => {
          e.target.style.backgroundColor = 'transparent';
          e.target.style.color = colors.textSecondary;
          e.target.style.borderColor = colors.border;
        }}
        title="Help & Workflow Guide"
      >
        ? Help
      </button>
    </nav>
  );
}
