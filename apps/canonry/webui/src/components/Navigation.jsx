/**
 * Navigation - Tab bar for switching between tools
 */

import React from "react";
import PropTypes from "prop-types";
import {
  colors,
  getAccentColor,
  getAccentGradient,
  getHoverBg,
} from "../theme";
import "./Navigation.css";

const TABS = [
  { id: "enumerist", label: "Enumerist", enabled: true },
  { id: "names", label: "Name Forge", enabled: true },
  { id: "cosmography", label: "Cosmographer", enabled: true },
  { id: "coherence", label: "Coherence Engine", enabled: true },
  { id: "simulation", label: "Lore Weave", enabled: true },
  { id: "illuminator", label: "Illuminator", enabled: true },
  { id: "archivist", label: "Archivist", enabled: true },
  { id: "chronicler", label: "Chronicler", enabled: true },
];

export default function Navigation({ activeTab, onTabChange, onHelpClick, onAwsClick }) {
  const getTabClassName = (tab) => {
    if (!tab.enabled) {
      return "nav-tab nav-tab-disabled";
    }
    if (tab.id === activeTab) {
      return "nav-tab nav-tab-active";
    }
    return "nav-tab nav-tab-inactive";
  };

  const getTabDynamicStyle = (tab) => {
    if (tab.id === activeTab && tab.enabled) {
      return {
        '--nav-tab-bg': getAccentGradient(tab.id),
        '--nav-tab-color': colors.bgSidebar,
      };
    }
    return undefined;
  };

  return (
    <nav className="nav-bar">
      <div className="nav-tabs-container">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => tab.enabled && onTabChange(tab.id)}
            className={getTabClassName(tab)}
            style={getTabDynamicStyle(tab)}
            disabled={!tab.enabled}
            onMouseEnter={(e) => {
              if (tab.enabled && tab.id !== activeTab) {
                e.target.style.backgroundColor = getHoverBg(tab.id);
                e.target.style.color = getAccentColor(tab.id);
              }
            }}
            onMouseLeave={(e) => {
              if (tab.enabled && tab.id !== activeTab) {
                e.target.style.backgroundColor = "transparent";
                e.target.style.color = colors.textSecondary;
              }
            }}
          >
            {tab.label}
            {tab.badge && <span className="nav-badge">{tab.badge}</span>}
          </button>
        ))}
      </div>
      <button
        className="nav-help-button"
        onClick={onAwsClick}
        onMouseEnter={(e) => {
          e.target.style.backgroundColor = colors.bgTertiary;
          e.target.style.color = colors.textPrimary;
          e.target.style.borderColor = colors.borderLight;
        }}
        onMouseLeave={(e) => {
          e.target.style.backgroundColor = "transparent";
          e.target.style.color = colors.textSecondary;
          e.target.style.borderColor = colors.border;
        }}
        title="AWS & S3 Sync"
      >
        AWS
      </button>
      <button
        className="nav-help-button"
        onClick={onHelpClick}
        onMouseEnter={(e) => {
          e.target.style.backgroundColor = colors.bgTertiary;
          e.target.style.color = colors.textPrimary;
          e.target.style.borderColor = colors.borderLight;
        }}
        onMouseLeave={(e) => {
          e.target.style.backgroundColor = "transparent";
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

Navigation.propTypes = {
  activeTab: PropTypes.string.isRequired,
  onTabChange: PropTypes.func.isRequired,
  onHelpClick: PropTypes.func,
  onAwsClick: PropTypes.func,
};
