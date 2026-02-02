/**
 * ModalShell - Shared modal container with overlay, header, optional tabs, and close button
 *
 * Supports two modes:
 * - Simple mode: Just renders children in the body
 * - Tabbed mode: Renders a sidebar with tabs when `tabs` prop is provided
 */

import React, { useRef } from 'react';

/**
 * @param {Object} props
 * @param {Function} props.onClose - Called when overlay or close button is clicked
 * @param {string} props.icon - Icon to show in header
 * @param {string} props.title - Modal title
 * @param {boolean} [props.disabled] - Whether to show disabled badge
 * @param {Array<{id: string, icon: string, label: string}>} [props.tabs] - Tab definitions (optional)
 * @param {string} [props.activeTab] - Currently active tab ID
 * @param {Function} [props.onTabChange] - Called when tab changes
 * @param {Function} [props.renderTabBadge] - Optional function to render badge for each tab: (tabId) => ReactNode
 * @param {React.ReactNode} [props.sidebarFooter] - Optional content to render at bottom of sidebar
 * @param {React.ReactNode} props.children - Modal content (tab content if tabs provided, otherwise full body)
 * @param {string} [props.className] - Additional class for modal container
 */
export function ModalShell({
  onClose,
  icon,
  title,
  disabled,
  tabs,
  activeTab,
  onTabChange,
  renderTabBadge,
  sidebarFooter,
  children,
  className = '',
}) {
  const hasTabs = tabs && tabs.length > 0;
  const mouseDownOnOverlay = useRef(false);

  const handleOverlayMouseDown = (e) => {
    mouseDownOnOverlay.current = e.target === e.currentTarget;
  };

  const handleOverlayClick = (e) => {
    if (mouseDownOnOverlay.current && e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onMouseDown={handleOverlayMouseDown} onClick={handleOverlayClick}>
      <div className={`modal ${className}`.trim()} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            {icon && <span className="modal-title-icon">{icon}</span>}
            <span>{title}</span>
            {disabled && <span className="badge badge-orphan">Disabled</span>}
          </div>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {hasTabs ? (
            <>
              <div className="modal-sidebar">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    className={`btn-tab ${activeTab === tab.id ? 'btn-tab-active' : ''}`}
                    onClick={() => onTabChange?.(tab.id)}
                  >
                    <span className="btn-tab-icon">{tab.icon}</span>
                    <span>{tab.label}</span>
                    {renderTabBadge?.(tab.id)}
                  </button>
                ))}
                {sidebarFooter}
              </div>
              <div className="modal-content">{children}</div>
            </>
          ) : (
            children
          )}
        </div>
      </div>
    </div>
  );
}
