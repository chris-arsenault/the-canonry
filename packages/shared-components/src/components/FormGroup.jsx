/**
 * FormGroup - Wrapper for form label + input/control
 *
 * Provides consistent styling for form fields.
 */

import React from 'react';

/**
 * @param {Object} props
 * @param {string} [props.label] - Label text
 * @param {string} [props.htmlFor] - For attribute linking label to input
 * @param {string} [props.hint] - Help text below the input
 * @param {React.ReactNode} props.children - Form control (input, select, etc.)
 * @param {boolean} [props.wide] - If true, spans full width
 * @param {string} [props.className] - Additional class
 */
export function FormGroup({
  label,
  htmlFor,
  hint,
  children,
  wide,
  className = '',
}) {
  return (
    <div className={`form-group ${wide ? 'form-group-wide' : ''} ${className}`.trim()}>
      {label && (
        <label className="label" htmlFor={htmlFor}>
          {label}
        </label>
      )}
      {children}
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

/**
 * FormRow - Horizontal layout for multiple form groups
 */
export function FormRow({ children, className = '' }) {
  return (
    <div className={`form-row ${className}`.trim()}>
      {children}
    </div>
  );
}

export default FormGroup;
