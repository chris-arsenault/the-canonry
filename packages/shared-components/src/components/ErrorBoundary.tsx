/**
 * ErrorBoundary - Catches render errors in child component trees
 *
 * Displays a recovery UI with the error message and a retry button.
 * Intended for wrapping MFE remote entry points so a single module
 * failure doesn't crash the entire host application.
 */

import React from "react";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  title?: string;
  className?: string;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <div className={`empty-state error-boundary ${this.props.className || ""}`.trim()}>
          <div className="error-boundary-icon">!</div>
          <div className="empty-state-title">
            {this.props.title || "Something went wrong"}
          </div>
          <div className="empty-state-desc error-boundary-message">
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

