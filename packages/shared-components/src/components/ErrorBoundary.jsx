/**
 * ErrorBoundary - Catches render errors in child component trees
 *
 * Displays a recovery UI with the error message and a retry button.
 * Intended for wrapping MFE remote entry points so a single module
 * failure doesn't crash the entire host application.
 */

import React from "react";
import PropTypes from "prop-types";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <div className={`error-boundary ${this.props.className || ""}`.trim()}>
          <div className="error-boundary-icon">!</div>
          <div className="error-boundary-title">
            {this.props.title || "Something went wrong"}
          </div>
          <div className="error-boundary-message">
            {this.state.error.message || "An unexpected error occurred."}
          </div>
          <button
            className="error-boundary-retry"
            onClick={this.handleRetry}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;

ErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired,
  title: PropTypes.string,
  className: PropTypes.string,
};
