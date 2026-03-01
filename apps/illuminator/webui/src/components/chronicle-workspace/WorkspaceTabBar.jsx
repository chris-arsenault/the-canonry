import React from "react";
import PropTypes from "prop-types";
export default function WorkspaceTabBar({ tabs, activeTab, onTabChange }) {
  return (
    <div className="workspace-subtabs">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={
            "workspace-subtab" +
            (activeTab === tab.id ? " active" : "") +
            (tab.align === "right" ? " right-aligned" : "")
          }
          onClick={() => onTabChange(tab.id)}
        >
          {tab.label}
          {tab.indicator ? ` ${tab.indicator}` : ""}
        </button>
      ))}
    </div>
  );
}

WorkspaceTabBar.propTypes = {
  tabs: PropTypes.array,
  activeTab: PropTypes.string,
  onTabChange: PropTypes.func,
};
