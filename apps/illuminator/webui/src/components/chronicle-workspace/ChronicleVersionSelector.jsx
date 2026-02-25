import { useState, useEffect } from "react";

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
    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
      <select
        value={selectedVersionId}
        onChange={(e) => {
          onSelectVersion(e.target.value);
          setConfirmingDeleteId(null);
        }}
        disabled={disabled}
        className="illuminator-select"
        style={{ width: "auto", minWidth: "240px", fontSize: "12px", padding: "4px 6px" }}
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
        className="illuminator-select"
        style={{ width: "auto", minWidth: "160px", fontSize: "12px", padding: "4px 6px" }}
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
        <span
          style={{
            fontSize: "11px",
            padding: "2px 8px",
            background: "rgba(16, 185, 129, 0.15)",
            color: "#10b981",
            borderRadius: "999px",
            fontWeight: 500,
          }}
        >
          Active
        </span>
      ) : (
        <button
          onClick={() => onSetActiveVersion?.(selectedVersionId)}
          disabled={disabled || !onSetActiveVersion}
          style={{
            padding: "6px 12px",
            fontSize: "11px",
            background: "var(--bg-tertiary)",
            border: "1px solid var(--border-color)",
            borderRadius: "6px",
            color: "var(--text-secondary)",
            cursor: disabled || !onSetActiveVersion ? "not-allowed" : "pointer",
            opacity: disabled || !onSetActiveVersion ? 0.6 : 1,
          }}
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
          style={{
            padding: "6px 12px",
            fontSize: "11px",
            background: confirmingDelete ? "var(--error-color, #ef4444)" : "var(--bg-tertiary)",
            border: `1px solid ${confirmingDelete ? "var(--error-color, #ef4444)" : "var(--border-color)"}`,
            borderRadius: "6px",
            color: confirmingDelete ? "#fff" : "var(--text-muted)",
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.6 : 1,
            transition: "background 0.15s, color 0.15s, border-color 0.15s",
          }}
        >
          {confirmingDelete ? "Confirm Delete" : "Delete"}
        </button>
      )}
    </div>
  );
}
