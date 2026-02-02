/**
 * DependencySection - Expandable section for dependency items
 */

import React, { useState } from 'react';
import '../dependency-viewer.css';

export function DependencySection({ title, icon, items, renderItem, defaultExpanded = false }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [hovering, setHovering] = useState(false);

  if (items.length === 0) return null;

  return (
    <div className="dependency-viewer-section">
      <div
        className="dependency-section-header"
        onClick={() => setExpanded(!expanded)}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        <div className="dependency-section-title">
          <span>{icon}</span>
          <span>{title}</span>
          <span className="dependency-section-count">{items.length}</span>
        </div>
        <span className={`dependency-expand-icon ${expanded ? 'dependency-expand-icon-open' : ''}`}>▼</span>
      </div>
      {expanded && (
        <div className="dependency-section-content">
          {items.map((item, index) => renderItem(item, index))}
        </div>
      )}
    </div>
  );
}
