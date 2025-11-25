import { useState } from 'react';

const API_URL = 'http://localhost:3001';

function DomainEditor({ metaDomain, domains, onDomainsChange }) {
  const [editingDomain, setEditingDomain] = useState(null);
  const [expandedSections, setExpandedSections] = useState({
    appliesTo: true,
    phonology: true,
    morphology: false,
    style: false
  });
  const [formData, setFormData] = useState({
    id: '',
    cultureId: '',
    appliesTo: { kind: [], subKind: [], tags: [] },
    phonology: {
      consonants: [], vowels: [], syllableTemplates: [], lengthRange: [2, 4],
      favoredClusters: [], forbiddenClusters: [], favoredClusterBoost: 1.0
    },
    morphology: { prefixes: [], suffixes: [], structure: [], structureWeights: [] },
    style: {
      capitalization: 'title', apostropheRate: 0, hyphenRate: 0,
      preferredEndings: [], preferredEndingBoost: 1.0, rhythmBias: 'neutral'
    }
  });

  // Extract unique existing culture IDs
  const existingCultureIds = [...new Set(domains.map(d => d.cultureId).filter(Boolean))].sort();

  const toggleSection = (section) => {
    setExpandedSections(prev => ({...prev, [section]: !prev[section]}));
  };

  const handleAddNew = () => {
    setEditingDomain('new');
    setFormData({
      id: `${metaDomain}_new`,
      cultureId: metaDomain,
      appliesTo: { kind: [], subKind: [], tags: [] },
      phonology: {
        consonants: [], vowels: [], syllableTemplates: [], lengthRange: [2, 4],
        favoredClusters: [], forbiddenClusters: [], favoredClusterBoost: 1.0
      },
      morphology: { prefixes: [], suffixes: [], structure: [], structureWeights: [] },
      style: {
        capitalization: 'title', apostropheRate: 0, hyphenRate: 0,
        preferredEndings: [], preferredEndingBoost: 1.0, rhythmBias: 'neutral'
      }
    });
    setExpandedSections({ appliesTo: true, phonology: true, morphology: false, style: false });
  };

  const saveToDisk = async (updatedDomains) => {
    try {
      const response = await fetch(`${API_URL}/api/meta-domains/${metaDomain}/domains`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domains: updatedDomains })
      });

      if (!response.ok) {
        console.error('Failed to save domains to disk');
      } else {
        console.log('✅ Domains saved to disk');
      }
    } catch (error) {
      console.error('Error saving domains:', error);
    }
  };

  const handleSave = () => {
    const newDomains = editingDomain === 'new'
      ? [...domains, formData]
      : domains.map(d => d.id === formData.id ? formData : d);
    onDomainsChange(newDomains);
    saveToDisk(newDomains);
    setEditingDomain(null);
  };

  const handleDelete = (id) => {
    const newDomains = domains.filter(d => d.id !== id);
    onDomainsChange(newDomains);
    saveToDisk(newDomains);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2>Domains</h2>
        <button className="primary" onClick={handleAddNew}>+ New Domain</button>
      </div>

      {editingDomain ? (
        <div className="card" style={{ maxHeight: '80vh', overflowY: 'auto' }}>
          <h3>{editingDomain === 'new' ? 'New Domain' : 'Edit Domain'}</h3>

          <div className="form-grid-2">
            <div className="form-group">
              <label>ID</label>
              <input
                value={formData.id}
                onChange={(e) => setFormData({...formData, id: e.target.value})}
                placeholder="e.g., elven_high"
              />
            </div>

            <div className="form-group">
              <label>Culture ID</label>
              {existingCultureIds.length > 0 && (
                <select
                  value={formData.cultureId}
                  onChange={(e) => setFormData({...formData, cultureId: e.target.value})}
                  style={{ marginBottom: '0.5rem' }}
                >
                  <option value="">Select existing or type below...</option>
                  {existingCultureIds.map(id => (
                    <option key={id} value={id}>{id}</option>
                  ))}
                </select>
              )}
              <input
                value={formData.cultureId}
                onChange={(e) => setFormData({...formData, cultureId: e.target.value})}
                placeholder={existingCultureIds.length > 0 ? "Or enter new culture ID" : "e.g., elven"}
              />
              <small className="text-muted">
                Identifies which culture this domain represents
              </small>
            </div>
          </div>

          {/* Applies To Section */}
          <div className="collapsible-section">
            <div className="collapsible-header" onClick={() => toggleSection('appliesTo')}>
              <h4>Applies To</h4>
              <span className={`collapsible-toggle ${expandedSections.appliesTo ? 'open' : ''}`}>▶</span>
            </div>
            {expandedSections.appliesTo && (
              <div className="collapsible-content">
                <div className="form-grid-3">
                  <div className="form-group">
                    <label>Entity Kinds (space or comma-separated)</label>
                    <input
                      defaultValue={formData.appliesTo?.kind?.join(', ') || ''}
                      onBlur={(e) => setFormData({
                        ...formData,
                        appliesTo: {...(formData.appliesTo || {}), kind: e.target.value.split(/[,\s]+/).map(s => s.trim()).filter(s => s)}
                      })}
                      placeholder="npc location faction"
                    />
                  </div>

                  <div className="form-group">
                    <label>SubKinds (space or comma-separated)</label>
                    <input
                      defaultValue={formData.appliesTo?.subKind?.join(', ') || ''}
                      onBlur={(e) => setFormData({
                        ...formData,
                        appliesTo: {...(formData.appliesTo || {}), subKind: e.target.value.split(/[,\s]+/).map(s => s.trim()).filter(s => s)}
                      })}
                      placeholder="elf elven forest"
                    />
                  </div>

                  <div className="form-group">
                    <label>Tags (space or comma-separated)</label>
                    <input
                      defaultValue={formData.appliesTo?.tags?.join(', ') || ''}
                      onBlur={(e) => setFormData({
                        ...formData,
                        appliesTo: {...(formData.appliesTo || {}), tags: e.target.value.split(/[,\s]+/).map(s => s.trim()).filter(s => s)}
                      })}
                      placeholder="ancient high forest"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Phonology Section */}
          <div className="collapsible-section">
            <div className="collapsible-header" onClick={() => toggleSection('phonology')}>
              <h4>Phonology</h4>
              <span className={`collapsible-toggle ${expandedSections.phonology ? 'open' : ''}`}>▶</span>
            </div>
            {expandedSections.phonology && (
              <div className="collapsible-content">
                <div className="form-grid-2">
                  <div className="form-group">
                    <label>Consonants (space or comma-separated)</label>
                    <input
                      defaultValue={formData.phonology.consonants.join(', ')}
                      onBlur={(e) => setFormData({
                        ...formData,
                        phonology: {...formData.phonology, consonants: e.target.value.split(/[,\s]+/).map(s => s.trim()).filter(s => s)}
                      })}
                      placeholder="l r th f n m"
                    />
                  </div>

                  <div className="form-group">
                    <label>Vowels (space or comma-separated)</label>
                    <input
                      defaultValue={formData.phonology.vowels.join(', ')}
                      onBlur={(e) => setFormData({
                        ...formData,
                        phonology: {...formData.phonology, vowels: e.target.value.split(/[,\s]+/).map(s => s.trim()).filter(s => s)}
                      })}
                      placeholder="a e i o ae"
                    />
                  </div>

                  <div className="form-group">
                    <label>Syllable Templates (space or comma-separated)</label>
                    <input
                      defaultValue={formData.phonology.syllableTemplates.join(', ')}
                      onBlur={(e) => setFormData({
                        ...formData,
                        phonology: {...formData.phonology, syllableTemplates: e.target.value.split(/[,\s]+/).map(s => s.trim()).filter(s => s)}
                      })}
                      placeholder="CV CVC CVV"
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Length Min</label>
                      <input
                        type="number"
                        value={formData.phonology.lengthRange[0]}
                        onChange={(e) => setFormData({
                          ...formData,
                          phonology: {...formData.phonology, lengthRange: [parseInt(e.target.value) || 1, formData.phonology.lengthRange[1]]}
                        })}
                      />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Length Max</label>
                      <input
                        type="number"
                        value={formData.phonology.lengthRange[1]}
                        onChange={(e) => setFormData({
                          ...formData,
                          phonology: {...formData.phonology, lengthRange: [formData.phonology.lengthRange[0], parseInt(e.target.value) || 4]}
                        })}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Favored Clusters (optional, space or comma-separated)</label>
                    <input
                      defaultValue={formData.phonology.favoredClusters?.join(', ') || ''}
                      onBlur={(e) => setFormData({
                        ...formData,
                        phonology: {...formData.phonology, favoredClusters: e.target.value.split(/[,\s]+/).map(s => s.trim()).filter(s => s)}
                      })}
                      placeholder="th ae gr"
                    />
                  </div>

                  <div className="form-group">
                    <label>Favored Cluster Boost</label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.phonology.favoredClusterBoost || 1.0}
                      onChange={(e) => setFormData({
                        ...formData,
                        phonology: {...formData.phonology, favoredClusterBoost: parseFloat(e.target.value) || 1.0}
                      })}
                    />
                  </div>

                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label>Forbidden Clusters (optional, space or comma-separated)</label>
                    <input
                      defaultValue={formData.phonology.forbiddenClusters?.join(', ') || ''}
                      onBlur={(e) => setFormData({
                        ...formData,
                        phonology: {...formData.phonology, forbiddenClusters: e.target.value.split(/[,\s]+/).map(s => s.trim()).filter(s => s)}
                      })}
                      placeholder="ii uu"
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
              <span className={`collapsible-toggle ${expandedSections.morphology ? 'open' : ''}`}>▶</span>
            </div>
            {expandedSections.morphology && (
              <div className="collapsible-content">
                <div className="form-grid-2">
                  <div className="form-group">
                    <label>Prefixes (optional, space or comma-separated)</label>
                    <input
                      defaultValue={formData.morphology.prefixes?.join(', ') || ''}
                      onBlur={(e) => setFormData({
                        ...formData,
                        morphology: {...formData.morphology, prefixes: e.target.value.split(/[,\s]+/).map(s => s.trim()).filter(s => s)}
                      })}
                      placeholder="Ael Ith Vor"
                    />
                  </div>

                  <div className="form-group">
                    <label>Suffixes (optional, space or comma-separated)</label>
                    <input
                      defaultValue={formData.morphology.suffixes?.join(', ') || ''}
                      onBlur={(e) => setFormData({
                        ...formData,
                        morphology: {...formData.morphology, suffixes: e.target.value.split(/[,\s]+/).map(s => s.trim()).filter(s => s)}
                      })}
                      placeholder="riel ion aen"
                    />
                  </div>

                  <div className="form-group">
                    <label>Structure (optional, comma-separated)</label>
                    <input
                      defaultValue={formData.morphology.structure?.join(', ') || ''}
                      onBlur={(e) => setFormData({
                        ...formData,
                        morphology: {...formData.morphology, structure: e.target.value.split(',').map(s => s.trim()).filter(s => s)}
                      })}
                      placeholder="root, root-suffix, prefix-root"
                    />
                  </div>

                  <div className="form-group">
                    <label>Structure Weights (optional, comma-separated)</label>
                    <input
                      defaultValue={formData.morphology.structureWeights?.join(', ') || ''}
                      onBlur={(e) => setFormData({
                        ...formData,
                        morphology: {...formData.morphology, structureWeights: e.target.value.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n))}
                      })}
                      placeholder="0.3, 0.4, 0.2, 0.1"
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
              <span className={`collapsible-toggle ${expandedSections.style ? 'open' : ''}`}>▶</span>
            </div>
            {expandedSections.style && (
              <div className="collapsible-content">
                <div className="form-grid-3">
                  <div className="form-group">
                    <label>Capitalization</label>
                    <select
                      value={formData.style.capitalization}
                      onChange={(e) => setFormData({
                        ...formData,
                        style: {...formData.style, capitalization: e.target.value}
                      })}
                    >
                      <option value="title">Title Case</option>
                      <option value="lower">lowercase</option>
                      <option value="upper">UPPERCASE</option>
                      <option value="mixed">MiXeD CaSe</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Apostrophe Rate (0-1)</label>
                    <input
                      type="number"
                      step="0.05"
                      min="0"
                      max="1"
                      value={formData.style.apostropheRate}
                      onChange={(e) => setFormData({
                        ...formData,
                        style: {...formData.style, apostropheRate: parseFloat(e.target.value) || 0}
                      })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Hyphen Rate (0-1)</label>
                    <input
                      type="number"
                      step="0.05"
                      min="0"
                      max="1"
                      value={formData.style.hyphenRate}
                      onChange={(e) => setFormData({
                        ...formData,
                        style: {...formData.style, hyphenRate: parseFloat(e.target.value) || 0}
                      })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Rhythm Bias</label>
                    <select
                      value={formData.style.rhythmBias || 'neutral'}
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
                    <label>Preferred Endings (space or comma-separated)</label>
                    <input
                      defaultValue={formData.style.preferredEndings?.join(', ') || ''}
                      onBlur={(e) => setFormData({
                        ...formData,
                        style: {...formData.style, preferredEndings: e.target.value.split(/[,\s]+/).map(s => s.trim()).filter(s => s)}
                      })}
                      placeholder="iel ion riel"
                    />
                  </div>

                  <div className="form-group">
                    <label>Ending Boost</label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.style.preferredEndingBoost || 1.0}
                      onChange={(e) => setFormData({
                        ...formData,
                        style: {...formData.style, preferredEndingBoost: parseFloat(e.target.value) || 1.0}
                      })}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
            <button className="primary" onClick={handleSave}>Save Domain</button>
            <button className="secondary" onClick={() => setEditingDomain(null)}>Cancel</button>
          </div>
        </div>
      ) : (
        <div className="item-list">
          {domains.length === 0 ? (
            <p className="text-muted">No domains yet. Click "+ New Domain" to create one.</p>
          ) : (
            domains.map(domain => (
              <div key={domain.id} className="list-item">
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <strong>{domain.id}</strong>
                    <p className="text-muted" style={{ margin: '0.25rem 0 0 0' }}>
                      Culture: {domain.cultureId}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="secondary" onClick={() => { setEditingDomain(domain.id); setFormData(domain); }}>
                      Edit
                    </button>
                    <button className="danger" onClick={() => handleDelete(domain.id)}>Delete</button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default DomainEditor;
