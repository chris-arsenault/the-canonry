/**
 * IdentityPanel - Define in-universe traits per culture
 *
 * Two sections:
 * 1. Visual Identity - For image prompts (ATTIRE, SPECIES, ARCHITECTURE)
 * 2. Descriptive Identity - For text prompts (CUSTOMS, SPEECH, VALUES)
 *
 * Keys are synchronized across all cultures - adding a key to one culture
 * creates empty entries in others, with warnings until filled.
 */

import { useState, useMemo, useCallback } from 'react';

/**
 * Generic editor for culture identity KVPs
 * Shared between visual and descriptive identity
 */
function CultureIdentityEditor({
  cultures,
  identities,
  onIdentitiesChange,
  allKeys,
  keyPlaceholder = 'KEY',
  valuePlaceholder = 'Value...',
}) {
  const [selectedCulture, setSelectedCulture] = useState(cultures[0]?.id || null);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const currentIdentity = selectedCulture ? (identities?.[selectedCulture] || {}) : {};

  // Count missing/empty entries per culture
  const warningsByCulture = useMemo(() => {
    const warnings = {};
    for (const culture of cultures) {
      const identity = identities?.[culture.id] || {};
      let count = 0;
      for (const key of allKeys) {
        if (!identity[key] || identity[key].trim() === '') {
          count++;
        }
      }
      if (count > 0) {
        warnings[culture.id] = count;
      }
    }
    return warnings;
  }, [cultures, identities, allKeys]);

  // Add key to ALL cultures (empty for others)
  const handleAddEntry = () => {
    if (!selectedCulture || !newKey.trim()) return;
    const key = newKey.trim().toUpperCase();

    const newIdentities = { ...identities };
    for (const culture of cultures) {
      const existing = newIdentities[culture.id] || {};
      if (culture.id === selectedCulture) {
        newIdentities[culture.id] = { ...existing, [key]: newValue.trim() };
      } else if (!(key in existing)) {
        newIdentities[culture.id] = { ...existing, [key]: '' };
      }
    }

    onIdentitiesChange(newIdentities);
    setNewKey('');
    setNewValue('');
  };

  const handleUpdateEntry = (key, value) => {
    if (!selectedCulture) return;
    onIdentitiesChange({
      ...identities,
      [selectedCulture]: {
        ...currentIdentity,
        [key]: value,
      },
    });
  };

  const handleRequestDelete = (key) => {
    setDeleteConfirm(key);
  };

  const handleDeleteSingle = (key) => {
    if (!selectedCulture) return;
    const { [key]: _, ...rest } = currentIdentity;
    onIdentitiesChange({
      ...identities,
      [selectedCulture]: rest,
    });
    setDeleteConfirm(null);
  };

  const handleDeleteAll = (key) => {
    const newIdentities = { ...identities };
    for (const culture of cultures) {
      if (newIdentities[culture.id]) {
        const { [key]: _, ...rest } = newIdentities[culture.id];
        newIdentities[culture.id] = rest;
      }
    }
    onIdentitiesChange(newIdentities);
    setDeleteConfirm(null);
  };

  if (cultures.length === 0) {
    return (
      <div className="illuminator-template-section-hint">
        No cultures defined in schema.
      </div>
    );
  }

  const displayEntries = allKeys.map(key => ({
    key,
    value: currentIdentity[key] ?? '',
    isMissing: !(key in currentIdentity),
    isEmpty: !currentIdentity[key] || currentIdentity[key].trim() === '',
  }));

  return (
    <div className="illuminator-visual-identity-editor">
      {/* Culture selector with warning badges */}
      <div className="illuminator-kind-selector" style={{ marginBottom: '12px' }}>
        {cultures.map((culture) => {
          const warnings = warningsByCulture[culture.id];
          return (
            <button
              key={culture.id}
              onClick={() => setSelectedCulture(culture.id)}
              className={`illuminator-kind-button ${selectedCulture === culture.id ? 'active' : ''} ${warnings ? 'has-warning' : ''}`}
              style={{ borderLeft: `3px solid ${culture.color || 'var(--accent-color)'}` }}
            >
              {culture.name || culture.id}
              {warnings && (
                <span className="illuminator-warning-badge" title={`${warnings} missing value${warnings > 1 ? 's' : ''}`}>
                  {warnings}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {selectedCulture && (
        <>
          {displayEntries.length > 0 && (
            <div className="illuminator-visual-identity-entries">
              {displayEntries.map(({ key, value, isEmpty }) => (
                <div
                  key={key}
                  className={`illuminator-visual-identity-entry ${isEmpty ? 'is-empty' : ''}`}
                >
                  <span className="illuminator-visual-identity-key">{key}</span>
                  <input
                    type="text"
                    className={`illuminator-input ${isEmpty ? 'warning' : ''}`}
                    value={value}
                    onChange={(e) => handleUpdateEntry(key, e.target.value)}
                    placeholder={valuePlaceholder}
                    style={{ flex: 1 }}
                  />
                  {deleteConfirm === key ? (
                    <div className="illuminator-delete-confirm">
                      <button
                        className="illuminator-button-small"
                        onClick={() => handleDeleteSingle(key)}
                        title="Delete from this culture only"
                      >
                        This
                      </button>
                      <button
                        className="illuminator-button-small danger"
                        onClick={() => handleDeleteAll(key)}
                        title="Delete from all cultures"
                      >
                        All
                      </button>
                      <button
                        className="illuminator-button-link"
                        onClick={() => setDeleteConfirm(null)}
                        style={{ padding: '4px 6px' }}
                      >
                        x
                      </button>
                    </div>
                  ) : (
                    <button
                      className="illuminator-button-link"
                      onClick={() => handleRequestDelete(key)}
                      style={{ color: 'var(--error-color)', padding: '4px 8px' }}
                      title="Delete"
                    >
                      x
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Add new key */}
          <div className="illuminator-visual-identity-add">
            <input
              type="text"
              className="illuminator-input"
              placeholder={keyPlaceholder}
              value={newKey}
              onChange={(e) => setNewKey(e.target.value.toUpperCase())}
              style={{ width: '120px', textTransform: 'uppercase' }}
            />
            <input
              type="text"
              className="illuminator-input"
              placeholder={valuePlaceholder}
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              style={{ flex: 1 }}
            />
            <button
              className="illuminator-button"
              onClick={handleAddEntry}
              disabled={!newKey.trim()}
            >
              Add
            </button>
          </div>

          {allKeys.length > 0 && (
            <div className="illuminator-template-section-hint" style={{ marginTop: '8px', fontSize: '11px' }}>
              Adding a key creates entries across all cultures. Delete prompts for single or all cultures.
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Generic selector for which identity keys apply to each entity kind
 * Shared between visual and descriptive identity
 */
function IdentityKeySelector({
  entityKinds,
  availableKeys,
  keysByKind,
  onKeysByKindChange,
  emptyMessage = 'No identity keys defined yet. Add keys to cultures above.',
}) {
  const [selectedKind, setSelectedKind] = useState(entityKinds[0]?.kind || null);

  const selectedKeys = selectedKind ? (keysByKind?.[selectedKind] || []) : [];

  const handleToggleKey = (key) => {
    if (!selectedKind) return;
    const currentKeys = keysByKind?.[selectedKind] || [];
    const newKeys = currentKeys.includes(key)
      ? currentKeys.filter((k) => k !== key)
      : [...currentKeys, key];

    onKeysByKindChange({
      ...keysByKind,
      [selectedKind]: newKeys,
    });
  };

  if (entityKinds.length === 0) {
    return (
      <div className="illuminator-template-section-hint">
        No entity kinds defined in schema.
      </div>
    );
  }

  return (
    <div>
      <div className="illuminator-kind-selector" style={{ marginBottom: '12px' }}>
        {entityKinds.map((kind) => {
          const count = keysByKind?.[kind.kind]?.length || 0;
          return (
            <button
              key={kind.kind}
              onClick={() => setSelectedKind(kind.kind)}
              className={`illuminator-kind-button ${selectedKind === kind.kind ? 'active' : ''}`}
            >
              {kind.description || kind.kind}
              {count > 0 && (
                <span style={{ marginLeft: '4px', opacity: 0.6 }}>({count})</span>
              )}
            </button>
          );
        })}
      </div>

      {selectedKind && availableKeys.length > 0 && (
        <div className="illuminator-kind-selector">
          {availableKeys.map((key) => {
            const isSelected = selectedKeys.includes(key);
            return (
              <button
                key={key}
                onClick={() => handleToggleKey(key)}
                className={`illuminator-kind-button ${isSelected ? 'active' : ''}`}
                style={{ textTransform: 'uppercase', fontSize: '11px' }}
              >
                {isSelected ? '+ ' : ''}{key}
              </button>
            );
          })}
        </div>
      )}

      {selectedKind && availableKeys.length === 0 && (
        <div className="illuminator-template-section-hint">
          {emptyMessage}
        </div>
      )}
    </div>
  );
}

/**
 * Collapsible section wrapper for identity groups
 */
function IdentitySection({ title, subtitle, children, defaultOpen = true }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="illuminator-identity-section">
      <button
        className="illuminator-identity-section-header"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="illuminator-identity-section-toggle">{isOpen ? '-' : '+'}</span>
        <div>
          <h3 className="illuminator-identity-section-title">{title}</h3>
          <span className="illuminator-identity-section-subtitle">{subtitle}</span>
        </div>
      </button>
      {isOpen && (
        <div className="illuminator-identity-section-content">
          {children}
        </div>
      )}
    </div>
  );
}

export default function VisualIdentityPanel({
  cultures,
  entityKinds,
  cultureIdentities,
  onCultureIdentitiesChange,
}) {
  // Collect all visual identity keys
  const visualKeys = useMemo(() => {
    const keys = new Set();
    const identities = cultureIdentities.visual || {};
    for (const cultureId of Object.keys(identities)) {
      for (const key of Object.keys(identities[cultureId])) {
        keys.add(key);
      }
    }
    return Array.from(keys).sort();
  }, [cultureIdentities.visual]);

  // Collect all descriptive identity keys
  const descriptiveKeys = useMemo(() => {
    const keys = new Set();
    const identities = cultureIdentities.descriptive || {};
    for (const cultureId of Object.keys(identities)) {
      for (const key of Object.keys(identities[cultureId])) {
        keys.add(key);
      }
    }
    return Array.from(keys).sort();
  }, [cultureIdentities.descriptive]);

  // Visual identity handlers
  const handleVisualIdentitiesChange = useCallback((newIdentities) => {
    onCultureIdentitiesChange({
      ...cultureIdentities,
      visual: newIdentities,
    });
  }, [cultureIdentities, onCultureIdentitiesChange]);

  const handleVisualKeysByKindChange = useCallback((newKeysByKind) => {
    onCultureIdentitiesChange({
      ...cultureIdentities,
      visualKeysByKind: newKeysByKind,
    });
  }, [cultureIdentities, onCultureIdentitiesChange]);

  // Descriptive identity handlers
  const handleDescriptiveIdentitiesChange = useCallback((newIdentities) => {
    onCultureIdentitiesChange({
      ...cultureIdentities,
      descriptive: newIdentities,
    });
  }, [cultureIdentities, onCultureIdentitiesChange]);

  const handleDescriptiveKeysByKindChange = useCallback((newKeysByKind) => {
    onCultureIdentitiesChange({
      ...cultureIdentities,
      descriptiveKeysByKind: newKeysByKind,
    });
  }, [cultureIdentities, onCultureIdentitiesChange]);

  return (
    <div className="illuminator-visual-identity-panel">
      {/* Visual Identity Section */}
      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">Visual Identity</h2>
          <span className="illuminator-card-subtitle">
            In-universe visual traits for image prompts (clothing, species, architecture)
          </span>
        </div>

        <IdentitySection
          title="Culture Traits"
          subtitle="Define visual characteristics for each culture"
          defaultOpen={true}
        >
          <CultureIdentityEditor
            cultures={cultures}
            identities={cultureIdentities.visual}
            onIdentitiesChange={handleVisualIdentitiesChange}
            allKeys={visualKeys}
            keyPlaceholder="KEY (e.g., ATTIRE)"
            valuePlaceholder="e.g., fur parkas with bone jewelry"
          />
        </IdentitySection>

        <IdentitySection
          title="Entity Kind Mapping"
          subtitle="Which visual traits to include per entity kind"
          defaultOpen={visualKeys.length > 0}
        >
          <IdentityKeySelector
            entityKinds={entityKinds}
            availableKeys={visualKeys}
            keysByKind={cultureIdentities.visualKeysByKind}
            onKeysByKindChange={handleVisualKeysByKindChange}
            emptyMessage="No visual identity keys defined yet. Add keys to cultures above."
          />
        </IdentitySection>
      </div>

      {/* Descriptive Identity Section */}
      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">Descriptive Identity</h2>
          <span className="illuminator-card-subtitle">
            In-universe traits for text prompts (customs, speech patterns, values)
          </span>
        </div>

        <IdentitySection
          title="Culture Traits"
          subtitle="Define descriptive characteristics for each culture"
          defaultOpen={true}
        >
          <CultureIdentityEditor
            cultures={cultures}
            identities={cultureIdentities.descriptive}
            onIdentitiesChange={handleDescriptiveIdentitiesChange}
            allKeys={descriptiveKeys}
            keyPlaceholder="KEY (e.g., CUSTOMS)"
            valuePlaceholder="e.g., elaborate greeting rituals involving fish exchange"
          />
        </IdentitySection>

        <IdentitySection
          title="Entity Kind Mapping"
          subtitle="Which descriptive traits to include per entity kind"
          defaultOpen={descriptiveKeys.length > 0}
        >
          <IdentityKeySelector
            entityKinds={entityKinds}
            availableKeys={descriptiveKeys}
            keysByKind={cultureIdentities.descriptiveKeysByKind}
            onKeysByKindChange={handleDescriptiveKeysByKindChange}
            emptyMessage="No descriptive identity keys defined yet. Add keys to cultures above."
          />
        </IdentitySection>
      </div>
    </div>
  );
}
