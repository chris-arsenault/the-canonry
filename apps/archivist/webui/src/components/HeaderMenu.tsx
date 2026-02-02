import { useState, useRef, useEffect } from 'react';
import './HeaderMenu.css';

export type EdgeMetric = 'strength' | 'distance' | 'none';
export type ViewMode = 'graph3d' | 'graph2d' | 'map';

interface HeaderMenuProps {
  viewMode: ViewMode;
  edgeMetric: EdgeMetric;
  onViewModeChange: (mode: ViewMode) => void;
  onEdgeMetricChange: (metric: EdgeMetric) => void;
  onRecalculateLayout: () => void;
  onToggleStats: () => void;
}

export default function HeaderMenu({ viewMode, edgeMetric, onViewModeChange, onEdgeMetricChange, onRecalculateLayout, onToggleStats }: HeaderMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleMenuItemClick = (action: () => void) => {
    action();
    setIsOpen(false);
  };

  return (
    <div className="header-menu" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="header-menu-button"
        title="Menu"
      >
        <span className="header-menu-icon">☰</span>
      </button>

      {isOpen && (
        <div className="header-menu-dropdown">
          <div className="header-menu-section">
            <div className="header-menu-section-title">View Mode</div>
            <button
              onClick={() => handleMenuItemClick(() => onViewModeChange('graph3d'))}
              className={`header-menu-item ${viewMode === 'graph3d' ? 'active' : ''}`}
            >
              <span className="header-menu-item-icon">{viewMode === 'graph3d' ? '✓' : '○'}</span>
              <span>3D Graph</span>
            </button>
            <button
              onClick={() => handleMenuItemClick(() => onViewModeChange('graph2d'))}
              className={`header-menu-item ${viewMode === 'graph2d' ? 'active' : ''}`}
            >
              <span className="header-menu-item-icon">{viewMode === 'graph2d' ? '✓' : '○'}</span>
              <span>2D Graph</span>
            </button>
            <button
              onClick={() => handleMenuItemClick(() => onViewModeChange('map'))}
              className={`header-menu-item ${viewMode === 'map' ? 'active' : ''}`}
            >
              <span className="header-menu-item-icon">{viewMode === 'map' ? '✓' : '○'}</span>
              <span>Coordinate Map</span>
            </button>
          </div>

          <div className="header-menu-section">
            <div className="header-menu-section-title">Edge Spring Metric</div>
            <button
              onClick={() => handleMenuItemClick(() => onEdgeMetricChange('strength'))}
              className={`header-menu-item ${edgeMetric === 'strength' ? 'active' : ''}`}
            >
              <span className="header-menu-item-icon">{edgeMetric === 'strength' ? '✓' : '○'}</span>
              <span>Strength</span>
            </button>
            <button
              onClick={() => handleMenuItemClick(() => onEdgeMetricChange('distance'))}
              className={`header-menu-item ${edgeMetric === 'distance' ? 'active' : ''}`}
            >
              <span className="header-menu-item-icon">{edgeMetric === 'distance' ? '✓' : '○'}</span>
              <span>Distance</span>
            </button>
            <button
              onClick={() => handleMenuItemClick(() => onEdgeMetricChange('none'))}
              className={`header-menu-item ${edgeMetric === 'none' ? 'active' : ''}`}
            >
              <span className="header-menu-item-icon">{edgeMetric === 'none' ? '✓' : '○'}</span>
              <span>None (Equal)</span>
            </button>
          </div>

          <button
            onClick={() => handleMenuItemClick(onRecalculateLayout)}
            className="header-menu-item"
          >
            <span className="header-menu-item-icon">♻️</span>
            <span>Recalculate Layout</span>
          </button>

          <button
            onClick={() => handleMenuItemClick(onToggleStats)}
            className="header-menu-item"
          >
            <span className="header-menu-item-icon">📊</span>
            <span>Toggle Stats</span>
          </button>
        </div>
      )}
    </div>
  );
}
