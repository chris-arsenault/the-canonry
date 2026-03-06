import React, { useState, useRef, useEffect } from "react";
import "./HeaderMenu.css";

export type EdgeMetric = "strength" | "distance" | "none";
export type ViewMode = "graph3d" | "graph2d" | "map";

function MenuRadio<T extends string>({ value, current, label, onSelect }: Readonly<{
  value: T; current: T; label: string; onSelect: (v: T) => void;
}>) {
  const active = value === current;
  return (
    <button onClick={() => onSelect(value)} className={`header-menu-item ${active ? "active" : ""}`}>
      <span className="header-menu-item-icon">{active ? "✓" : "○"}</span>
      <span>{label}</span>
    </button>
  );
}

interface HeaderMenuProps {
  viewMode: ViewMode; edgeMetric: EdgeMetric;
  onViewModeChange: (mode: ViewMode) => void; onEdgeMetricChange: (metric: EdgeMetric) => void;
  onRecalculateLayout: () => void; onToggleStats: () => void;
}

export default function HeaderMenu({
  viewMode, edgeMetric, onViewModeChange, onEdgeMetricChange, onRecalculateLayout, onToggleStats,
}: Readonly<HeaderMenuProps>) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setIsOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);
  const act = (fn: () => void) => { fn(); setIsOpen(false); };

  return (
    <div className="header-menu" ref={menuRef}>
      <button onClick={() => setIsOpen(!isOpen)} className="header-menu-button" title="Menu">
        <span className="header-menu-icon">☰</span>
      </button>
      {isOpen && (
        <div className="header-menu-dropdown">
          <div className="header-menu-group">
            <div className="header-menu-group-title">View Mode</div>
            <MenuRadio value="graph3d" current={viewMode} label="3D Graph" onSelect={onViewModeChange} />
            <MenuRadio value="graph2d" current={viewMode} label="2D Graph" onSelect={onViewModeChange} />
            <MenuRadio value="map" current={viewMode} label="Coordinate Map" onSelect={onViewModeChange} />
          </div>
          <div className="header-menu-group">
            <div className="header-menu-group-title">Edge Spring Metric</div>
            <MenuRadio value="strength" current={edgeMetric} label="Strength" onSelect={onEdgeMetricChange} />
            <MenuRadio value="distance" current={edgeMetric} label="Distance" onSelect={onEdgeMetricChange} />
            <MenuRadio value="none" current={edgeMetric} label="None (Equal)" onSelect={onEdgeMetricChange} />
          </div>
          <button onClick={() => act(onRecalculateLayout)} className="header-menu-item">
            <span className="header-menu-item-icon">♻️</span><span>Recalculate Layout</span>
          </button>
          <button onClick={() => act(onToggleStats)} className="header-menu-item">
            <span className="header-menu-item-icon">📊</span><span>Toggle Stats</span>
          </button>
        </div>
      )}
    </div>
  );
}
