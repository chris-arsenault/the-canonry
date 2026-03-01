/**
 * ErrorMessage - Inline error display for operation failures
 */

import React from 'react';

interface ErrorMessageProps {
  readonly message: string;
  readonly title?: string;
  readonly className?: string;
}

/**
 * @param {Object} props
 * @param {string} props.message - Error message text
 * @param {string} [props.title] - Optional title above the message
 * @param {string} [props.className] - Optional additional class names
 */
export function ErrorMessage({ message, title, className = '' }: ErrorMessageProps) {
  return (
    <div className={`error-message ${className}`.trim()} role="alert">
      {title && <div className="error-message-title">{title}</div>}
      <div className="error-message-text">{message}</div>
    </div>
  );
}

export default ErrorMessage;

