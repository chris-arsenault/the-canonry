export default function ChronicleVersionSelector({
  versions,
  selectedVersionId,
  activeVersionId,
  compareToVersionId,
  onSelectVersion,
  onSelectCompareVersion,
  onSetActiveVersion,
  disabled,
}) {
  const isActive = selectedVersionId === activeVersionId;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
      <select
        value={selectedVersionId}
        onChange={(e) => onSelectVersion(e.target.value)}
        disabled={disabled}
        className="illuminator-select"
        style={{ width: 'auto', minWidth: '240px', fontSize: '12px', padding: '4px 6px' }}
      >
        {versions.map((version) => (
          <option key={version.id} value={version.id}>{version.label}</option>
        ))}
      </select>
      <select
        value={compareToVersionId}
        onChange={(e) => onSelectCompareVersion(e.target.value)}
        disabled={disabled}
        className="illuminator-select"
        style={{ width: 'auto', minWidth: '160px', fontSize: '12px', padding: '4px 6px' }}
        title="Select a version to diff against"
      >
        <option value="">Compare to...</option>
        {versions.filter(v => v.id !== selectedVersionId).map((version) => (
          <option key={version.id} value={version.id}>{version.shortLabel || version.label}</option>
        ))}
      </select>
      {isActive ? (
        <span
          style={{
            fontSize: '11px',
            padding: '2px 8px',
            background: 'rgba(16, 185, 129, 0.15)',
            color: '#10b981',
            borderRadius: '999px',
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
            padding: '6px 12px',
            fontSize: '11px',
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            color: 'var(--text-secondary)',
            cursor: disabled || !onSetActiveVersion ? 'not-allowed' : 'pointer',
            opacity: disabled || !onSetActiveVersion ? 0.6 : 1,
          }}
        >
          Make Active
        </button>
      )}
    </div>
  );
}
