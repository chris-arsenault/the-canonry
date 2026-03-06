/**
 * RemotePlaceholder - Shown when a remote module is not available
 */

import React from "react";
import PropTypes from "prop-types";
import "./RemotePlaceholder.css";

export default function RemotePlaceholder({ name, instructions }) {
  return (
    <div className="rph-container">
      <div className="rph-icon">🔌</div>
      <div className="rph-title">{name} Not Connected</div>
      <div className="rph-message">
        The {name} module is not currently running. Start it to enable this feature.
      </div>
      {instructions && <div className="rph-instructions">{instructions}</div>}
    </div>
  );
}

RemotePlaceholder.propTypes = {
  name: PropTypes.string.isRequired,
  instructions: PropTypes.string,
};
