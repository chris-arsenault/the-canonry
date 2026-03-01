import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import "./ChronicleVersionSelector.css";

export default function ChronicleVersionSelector({
  versions,
  selectedVersionId,
  activeVersionId,
  compareToVersionId,
  onSelectVersion,
  onSelectCompareVersion,
  onSetActiveVersion,
  onDeleteVersion,
  disabled,
}) {
  const isActive = selectedVersionId === activeVersionId;
  const canDelete = versions.length > 1 && onDeleteVersion;
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);
  const confirmingDelete = confirmingDeleteId === selectedVersionId;

  useEffect(() => {
    if (!confirmingDeleteId) return;
    const stillExists = versions.some((v) => v.id === confirmingDeleteId);
    if (!stillExists || confirmingDeleteId !== selectedVersionId || disabled) {
      setConfirmingDeleteId(null);
    }
  }, [confirmingDeleteId, selectedVersionId, versions, disabled]);

  const handleDeleteClick = () => {
    if (confirmingDelete) {
      onDeleteVersion(selectedVersionId);
      setConfirmingDeleteId(null);
    } else {
      setConfirmingDeleteId(selectedVersionId);
    }
  };

  return (
    <div className="cvs-container">
      <select
        value={selectedVersionId}
        onChange={(e) => {
          onSelectVersion(e.target.value);
          setConfirmingDeleteId(null);
        }}
        disabled={disabled}
        className="illuminator-select ilu-compact-select cvs-select-version"
      >
        {versions.map((version) => (
          <option key={version.id} value={version.id}>
            {version.label}
          </option>
        ))}
      </select>
      <select
        value={compareToVersionId}
        onChange={(e) => onSelectCompareVersion(e.target.value)}
        disabled={disabled}
        className="illuminator-select ilu-compact-select cvs-select-compare"
        title="Select a version to diff against"
      >
        <option value="">Compare to...</option>
        {versions
          .filter((v) => v.id !== selectedVersionId)
          .map((version) => (
            <option key={version.id} value={version.id}>
              {version.shortLabel || version.label}
            </option>
          ))}
      </select>
      {isActive ? (
        <span className="ilu-active-badge">Active</span>
      ) : (
        <button
          onClick={() => onSetActiveVersion?.(selectedVersionId)}
          disabled={disabled || !onSetActiveVersion}
          className="ilu-action-btn-sm"
        >
          Make Active
        </button>
      )}
      {canDelete && (
        <button
          onClick={handleDeleteClick}
          onBlur={() => setConfirmingDeleteId(null)}
          disabled={disabled}
          title={confirmingDelete ? "Click again to confirm deletion" : "Delete this version"}
          className={`ilu-action-btn-sm cvs-btn-delete${confirmingDelete ? " cvs-btn-delete-confirming" : ""}`}
        >
          {confirmingDelete ? "Confirm Delete" : "Delete"}
        </button>
      )}
    </div>
  );
}

ChronicleVersionSelector.propTypes = {
  versions: PropTypes.array,
  selectedVersionId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  activeVersionId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  compareToVersionId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onSelectVersion: PropTypes.func,
  onSelectCompareVersion: PropTypes.func,
  onSetActiveVersion: PropTypes.func,
  onDeleteVersion: PropTypes.func,
  disabled: PropTypes.bool,
};
