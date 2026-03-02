/**
 * InfoBox - Informational callout box
 */

import React from 'react';
import type { Optional } from '../types/optionality.js';

interface InfoBoxProps {
  readonly title: Optional<string>;
  readonly children: React.ReactNode;
  readonly className: Optional<string>;
}

/**
 * @param {Object} props
 * @param {string} [props.title] - Optional title for the info box
 * @param {React.ReactNode} props.children - Content of the info box
 * @param {string} [props.className] - Optional additional class names
 */
export function InfoBox({ title, children, className = '' }: InfoBoxProps) {
  return (
    <div className={`info-box ${className}`.trim()}>
      {title && <div className="info-box-title">{title}</div>}
      <div className="info-box-text">{children}</div>
    </div>
  );
}

export default InfoBox;

