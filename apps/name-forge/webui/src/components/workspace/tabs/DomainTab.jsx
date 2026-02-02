import { useState } from 'react';
import { NumberInput } from '@penguin-tales/shared-components';
import { getAllDomains } from '../../utils';
import PhonemeWeightGrid from './PhonemeWeightGrid';

function DomainTab({ cultureId, cultureConfig, allCultures, onDomainsChange }) {
  const [editing, setEditing] = useState(false);
  const [editingIndex, setEditingIndex] = useState(-1); // -1 = new domain, >= 0 = editing existing
  const [expandedSections, setExpandedSections] = useState({
    phonology: true,
    morphology: false,
    style: false,
    weights: false
  });

  const cultureDomains = cultureConfig?.naming?.domains || [];

  // Collect ALL domains from ALL cultures for "copy from other cultures" feature
  const allDomains = getAllDomains(allCultures);

  const defaultDomain = {
    id: `${cultureId}_domain_${cultureDomains.length + 1}`,
    cultureId: cultureId,
    phonology: {
      consonants: [], vowels: [], syllableTemplates: ['CV', 'CVC'], lengthRange: [2, 4],
      favoredClusters: [], forbiddenClusters: [], favoredClusterBoost: 1.0
    },
    morphology: { prefixes: [], suffixes: [], structure: ['root', 'root-suffix'], structureWeights: [0.5, 0.5] },
    style: {
      capitalization: 'title', apostropheRate: 0, hyphenRate: 0,
      preferredEndings: [], preferredEndingBoost: 1.0, rhythmBias: 'neutral'
    }
  };

  const [formData, setFormData] = useState(defaultDomain);

  const toggleSection = (section) => {
    setExpandedSections(prev => ({...prev, [section]: !prev[section]}));
  };

  // Save domain to culture-level domains array
  const handleSave = () => {
    let newDomains;
    if (editingIndex >= 0) {
      // Update existing domain
      newDomains = [...cultureDomains];
      newDomains[editingIndex] = formData;
    } else {
      // Add new domain
      newDomains = [...cultureDomains, formData];
    }

    // Save via callback
    if (onDomainsChange) {
      onDomainsChange(newDomains);
    }

    setEditing(false);
    setEditingIndex(-1);
  };

  const handleCreateNew = () => {
    setFormData({
      ...defaultDomain,
      id: `${cultureId}_domain_${cultureDomains.length + 1}`
    });
    setEditingIndex(-1);
    setEditing(true);
  };

  const handleEditDomain = (domain, index) => {
    setFormData({ ...domain });
    setEditingIndex(index);
    setEditing(true);
  };

  const handleDeleteDomain = (index) => {
    if (!window.confirm('Delete this domain? This cannot be undone.')) return;

    const newDomains = cultureDomains.filter((_, i) => i !== index);

    // Save via callback
    if (onDomainsChange) {
      onDomainsChange(newDomains);
    }
  };

  const handleCopyDomain = (domain) => {
    // Create a copy with new ID
    setFormData({
      ...domain,
      id: `${domain.id}_copy`
    });
    setEditingIndex(-1);
    setEditing(true);
  };

  // View mode - show list of culture-level domains
  if (!editing && cultureDomains.length > 0) {
    return (
      <div>
        <div className="tab-header">
          <h3>Phonological Domains ({cultureDomains.length})</h3>
          <button className="primary" onClick={handleCreateNew}>
            + Add Domain
          </button>
        </div>

        <p className="text-muted tab-intro">
          Domains define the sound patterns for <strong>{cultureId}</strong> names.
          Reference them in grammars using <code>domain:domain_id</code>.
          Use the <strong>Optimizer</strong> tab to tune domain parameters.
        </p>

        {/* Domain List */}
        <div className="grid gap-md">
          {cultureDomains.map((domain, index) => (
            <div key={domain.id} className="domain-card">
              <div className="domain-card-header">
                <div>
                  <strong className="domain-card-title">{domain.id}</strong>
                  <div className="domain-card-hint">
                    Use in grammars: <code>domain:{domain.id}</code>
                  </div>
                </div>
                <div className="domain-card-actions">
                  <button className="secondary icon-btn" onClick={() => handleCopyDomain(domain)}>📋</button>
                  <button className="secondary icon-btn" onClick={() => handleEditDomain(domain, index)}>✏️</button>
                  <button className="secondary icon-btn danger" onClick={() => handleDeleteDomain(index)}>🗑️</button>
                </div>
              </div>

              <div className="domain-summary-grid">
                <div>
                  <div>Phonology</div>
                  <div>
                    <div>C: {domain.phonology?.consonants?.slice(0, 5).join(' ') || 'None'}{domain.phonology?.consonants?.length > 5 ? '...' : ''}</div>
                    <div>V: {domain.phonology?.vowels?.join(' ') || 'None'}</div>
                    <div>Syl: {domain.phonology?.syllableTemplates?.join(', ') || 'CV, CVC'}</div>
                  </div>
                </div>
                <div>
                  <div>Morphology</div>
                  <div>
                    <div>Pre: {domain.morphology?.prefixes?.slice(0, 3).join(', ') || 'None'}</div>
                    <div>Suf: {domain.morphology?.suffixes?.slice(0, 3).join(', ') || 'None'}</div>
                  </div>
                </div>
                <div>
                  <div>Style</div>
                  <div>
                    <div>Cap: {domain.style?.capitalization || 'title'}</div>
                    <div>Rhythm: {domain.style?.rhythmBias || 'neutral'}</div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // No domains yet - show create prompt
  if (!editing && cultureDomains.length === 0) {
    return (
      <div>
        <h3>Phonological Domains</h3>
        <p className="text-muted">
          Define the sound patterns and morphology for <strong>{cultureId}</strong> names.
        </p>

        <div className="empty-state-card">
          <p>No domains configured for this culture yet.</p>
          <button className="primary" onClick={handleCreateNew}>
            + Create First Domain
          </button>
        </div>

        {/* Show domains from other cultures as inspiration */}
        {allDomains.filter(d => d.sourceCulture !== cultureId).length > 0 && (
          <div className="copy-from-section">
            <h4>Copy from other cultures</h4>
            <div className="grid gap-sm">
              {allDomains.filter(d => d.sourceCulture !== cultureId).slice(0, 5).map((domain) => (
                <div key={`${domain.sourceCulture}_${domain.id}`} className="copy-item">
                  <div>
                    <strong>{domain.id}</strong>
                    <div className="copy-item-meta">From culture: {domain.sourceCulture}</div>
                  </div>
                  <button className="secondary sm" onClick={() => handleCopyDomain(domain)}>
                    Copy & Edit
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Editing mode - full form
  return (
    <div>
      <div className="tab-header">
        <h3>{editingIndex >= 0 ? 'Edit Domain' : 'Create Domain'}</h3>
        <div className="flex gap-sm">
          <button className="primary" onClick={handleSave}>Save</button>
          <button className="secondary" onClick={() => { setEditing(false); setEditingIndex(-1); }}>
            Cancel
          </button>
        </div>
      </div>

      <div className="form-group mb-md">
        <label>Domain ID</label>
        <input
          value={formData.id}
          onChange={(e) => setFormData({...formData, id: e.target.value})}
          placeholder={`${cultureId}_domain`}
        />
        <small className="text-muted">Unique identifier for this domain. Use in grammars as <code>domain:{formData.id || 'domain_id'}</code></small>
      </div>

      {/* Phonology Section */}
      <div className="collapsible-section">
        <div className="collapsible-header" onClick={() => toggleSection('phonology')}>
          <h4>Phonology</h4>
          <span>{expandedSections.phonology ? '▼' : '▶'}</span>
        </div>
        {expandedSections.phonology && (
          <div className="collapsible-content">
            <div className="form-grid-2">
              <div className="form-group">
                <label>Consonants (space-separated)</label>
                <input
                  defaultValue={formData.phonology?.consonants?.join(' ') || ''}
                  onBlur={(e) => setFormData({
                    ...formData,
                    phonology: {...formData.phonology, consonants: e.target.value.split(/\s+/).filter(s => s)}
                  })}
                  placeholder="l r th f n m v s"
                />
              </div>
              <div className="form-group">
                <label>Vowels (space-separated)</label>
                <input
                  defaultValue={formData.phonology?.vowels?.join(' ') || ''}
                  onBlur={(e) => setFormData({
                    ...formData,
                    phonology: {...formData.phonology, vowels: e.target.value.split(/\s+/).filter(s => s)}
                  })}
                  placeholder="a e i o u ae"
                />
              </div>
              <div className="form-group">
                <label>Syllable Templates</label>
                <input
                  defaultValue={formData.phonology?.syllableTemplates?.join(' ') || ''}
                  onBlur={(e) => setFormData({
                    ...formData,
                    phonology: {...formData.phonology, syllableTemplates: e.target.value.split(/\s+/).filter(s => s)}
                  })}
                  placeholder="CV CVC CVV"
                />
              </div>
              <div className="flex-row-responsive">
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Min Length</label>
                  <NumberInput
                    value={formData.phonology?.lengthRange?.[0] || 2}
                    onChange={(v) => setFormData({
                      ...formData,
                      phonology: {...formData.phonology, lengthRange: [v ?? 2, formData.phonology?.lengthRange?.[1] || 4]}
                    })}
                    integer
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Max Length</label>
                  <NumberInput
                    value={formData.phonology?.lengthRange?.[1] || 4}
                    onChange={(v) => setFormData({
                      ...formData,
                      phonology: {...formData.phonology, lengthRange: [formData.phonology?.lengthRange?.[0] || 2, v ?? 4]}
                    })}
                    integer
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Favored Clusters (optional)</label>
                <input
                  defaultValue={formData.phonology?.favoredClusters?.join(' ') || ''}
                  onBlur={(e) => setFormData({
                    ...formData,
                    phonology: {...formData.phonology, favoredClusters: e.target.value.split(/\s+/).filter(s => s)}
                  })}
                  placeholder="th ae gr"
                />
              </div>
              <div className="form-group">
                <label>Forbidden Clusters (optional)</label>
                <input
                  defaultValue={formData.phonology?.forbiddenClusters?.join(' ') || ''}
                  onBlur={(e) => setFormData({
                    ...formData,
                    phonology: {...formData.phonology, forbiddenClusters: e.target.value.split(/\s+/).filter(s => s)}
                  })}
                  placeholder="ii uu xx"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Morphology Section */}
      <div className="collapsible-section">
        <div className="collapsible-header" onClick={() => toggleSection('morphology')}>
          <h4>Morphology</h4>
          <span>{expandedSections.morphology ? '▼' : '▶'}</span>
        </div>
        {expandedSections.morphology && (
          <div className="collapsible-content">
            <div className="form-grid-2">
              <div className="form-group">
                <label>Prefixes (space-separated)</label>
                <input
                  defaultValue={formData.morphology?.prefixes?.join(' ') || ''}
                  onBlur={(e) => setFormData({
                    ...formData,
                    morphology: {...formData.morphology, prefixes: e.target.value.split(/\s+/).filter(s => s)}
                  })}
                  placeholder="Ael Ith Vor"
                />
              </div>
              <div className="form-group">
                <label>Suffixes (space-separated)</label>
                <input
                  defaultValue={formData.morphology?.suffixes?.join(' ') || ''}
                  onBlur={(e) => setFormData({
                    ...formData,
                    morphology: {...formData.morphology, suffixes: e.target.value.split(/\s+/).filter(s => s)}
                  })}
                  placeholder="riel ion aen"
                />
              </div>
              <div className="form-group">
                <label>Structure (comma-separated)</label>
                <input
                  defaultValue={formData.morphology?.structure?.join(', ') || ''}
                  onBlur={(e) => setFormData({
                    ...formData,
                    morphology: {...formData.morphology, structure: e.target.value.split(',').map(s => s.trim()).filter(s => s)}
                  })}
                  placeholder="root, root-suffix, prefix-root"
                />
              </div>
              <div className="form-group">
                <label>Structure Weights (comma-separated)</label>
                <input
                  defaultValue={formData.morphology?.structureWeights?.join(', ') || ''}
                  onBlur={(e) => setFormData({
                    ...formData,
                    morphology: {...formData.morphology, structureWeights: e.target.value.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n))}
                  })}
                  placeholder="0.5, 0.3, 0.2"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Style Section */}
      <div className="collapsible-section">
        <div className="collapsible-header" onClick={() => toggleSection('style')}>
          <h4>Style</h4>
          <span>{expandedSections.style ? '▼' : '▶'}</span>
        </div>
        {expandedSections.style && (
          <div className="collapsible-content">
            <div className="form-grid-3">
              <div className="form-group">
                <label>Capitalization</label>
                <select
                  value={formData.style?.capitalization || 'title'}
                  onChange={(e) => setFormData({
                    ...formData,
                    style: {...formData.style, capitalization: e.target.value}
                  })}
                >
                  <option value="title">Title Case</option>
                  <option value="lower">lowercase</option>
                  <option value="upper">UPPERCASE</option>
                  <option value="mixed">MiXeD</option>
                </select>
              </div>
              <div className="form-group">
                <label>Rhythm Bias</label>
                <select
                  value={formData.style?.rhythmBias || 'neutral'}
                  onChange={(e) => setFormData({
                    ...formData,
                    style: {...formData.style, rhythmBias: e.target.value}
                  })}
                >
                  <option value="neutral">Neutral</option>
                  <option value="flowing">Flowing</option>
                  <option value="harsh">Harsh</option>
                  <option value="staccato">Staccato</option>
                </select>
              </div>
              <div className="form-group">
                <label>Apostrophe Rate</label>
                <NumberInput
                  step={0.05}
                  min={0}
                  max={1}
                  value={formData.style?.apostropheRate || 0}
                  onChange={(v) => setFormData({
                    ...formData,
                    style: {...formData.style, apostropheRate: v ?? 0}
                  })}
                />
              </div>
              <div className="form-group">
                <label>Hyphen Rate</label>
                <NumberInput
                  step={0.05}
                  min={0}
                  max={1}
                  value={formData.style?.hyphenRate || 0}
                  onChange={(v) => setFormData({
                    ...formData,
                    style: {...formData.style, hyphenRate: v ?? 0}
                  })}
                />
              </div>
              <div className="form-group">
                <label>Preferred Endings</label>
                <input
                  defaultValue={formData.style?.preferredEndings?.join(' ') || ''}
                  onBlur={(e) => setFormData({
                    ...formData,
                    style: {...formData.style, preferredEndings: e.target.value.split(/\s+/).filter(s => s)}
                  })}
                  placeholder="iel ion riel"
                />
              </div>
              <div className="form-group">
                <label>Ending Boost</label>
                <NumberInput
                  step={0.1}
                  value={formData.style?.preferredEndingBoost || 1.0}
                  onChange={(v) => setFormData({
                    ...formData,
                    style: {...formData.style, preferredEndingBoost: v ?? 1.0}
                  })}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Weights Section */}
      <div className="collapsible-section">
        <div className="collapsible-header" onClick={() => toggleSection('weights')}>
          <h4>Weights (Advanced Tuning)</h4>
          <span>{expandedSections.weights ? '▼' : '▶'}</span>
        </div>
        {expandedSections.weights && (
          <div className="collapsible-content">
            <p className="text-muted mb-md">
              Fine-tune phoneme selection probabilities. Higher weights = more likely to appear.
              Default is 1.0 for all.
            </p>

            <PhonemeWeightGrid
              label="Consonant Weights"
              items={formData.phonology?.consonants || []}
              weights={formData.phonology?.consonantWeights || []}
              onChange={(newWeights) => setFormData({
                ...formData,
                phonology: { ...formData.phonology, consonantWeights: newWeights }
              })}
            />

            <PhonemeWeightGrid
              label="Vowel Weights"
              items={formData.phonology?.vowels || []}
              weights={formData.phonology?.vowelWeights || []}
              onChange={(newWeights) => setFormData({
                ...formData,
                phonology: { ...formData.phonology, vowelWeights: newWeights }
              })}
            />

            <PhonemeWeightGrid
              label="Template Weights"
              items={formData.phonology?.syllableTemplates || []}
              weights={formData.phonology?.templateWeights || []}
              onChange={(newWeights) => setFormData({
                ...formData,
                phonology: { ...formData.phonology, templateWeights: newWeights }
              })}
            />

            <div className="form-group mt-md">
              <label>Favored Cluster Boost</label>
              <NumberInput
                step={0.1}
                min={1.0}
                max={5.0}
                value={formData.phonology?.favoredClusterBoost || 1.0}
                onChange={(v) => setFormData({
                  ...formData,
                  phonology: { ...formData.phonology, favoredClusterBoost: v ?? 1.0 }
                })}
              />
              <small className="text-muted">
                Multiplier applied to favored clusters (defined in Phonology section). Default: 1.0
              </small>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

export default DomainTab;
