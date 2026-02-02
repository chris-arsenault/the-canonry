/**
 * StyleLibraryEditor - Manage artistic, composition, and narrative styles
 *
 * Allows users to:
 * - View all styles in the library
 * - Add new artistic/composition/narrative styles
 * - Edit existing styles
 * - Delete styles
 * - Reset to defaults
 */

import { useState, useCallback, useRef } from 'react';
import { LocalTextArea } from '@penguin-tales/shared-components';
import { SCENE_PROMPT_TEMPLATES, getCoverImageConfig } from '../lib/coverImageStyles';

/**
 * Generate a unique ID for a new style
 */
function generateStyleId(prefix) {
  return `${prefix}-${Date.now().toString(36)}`;
}

/**
 * Style card component for displaying a single style
 */
function StyleCard({ style, type, onEdit, onDelete }) {
  return (
    <div className="illuminator-style-card">
      <div className="illuminator-style-card-header">
        <div className="illuminator-style-card-title">{style.name}</div>
        <div className="illuminator-style-card-actions">
          <button
            onClick={() => onEdit(style)}
            className="illuminator-btn-icon"
            title="Edit style"
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(style.id)}
            className="illuminator-btn-icon illuminator-btn-danger"
            title="Delete style"
          >
            Delete
          </button>
        </div>
      </div>
      {style.description && (
        <div className="illuminator-style-card-description">{style.description}</div>
      )}
      <div className="illuminator-style-card-prompt">
        <strong>Prompt:</strong> {style.promptFragment}
      </div>
      {style.keywords?.length > 0 && (
        <div className="illuminator-style-card-keywords">
          {style.keywords.map((kw) => (
            <span key={kw} className="illuminator-style-keyword">{kw}</span>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Modal for editing a style
 */
function StyleEditModal({ style, type, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    id: style?.id || '',
    name: style?.name || '',
    description: style?.description || '',
    promptFragment: style?.promptFragment || '',
    keywords: style?.keywords?.join(', ') || '',
  });
  const mouseDownOnOverlay = useRef(false);

  const handleOverlayMouseDown = (e) => {
    mouseDownOnOverlay.current = e.target === e.currentTarget;
  };

  const handleOverlayClick = (e) => {
    if (mouseDownOnOverlay.current && e.target === e.currentTarget) {
      onCancel();
    }
  };

  const isNew = !style?.id;

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const result = {
      id: isNew ? generateStyleId(type) : formData.id,
      name: formData.name.trim(),
      promptFragment: formData.promptFragment.trim(),
    };

    if (formData.description.trim()) {
      result.description = formData.description.trim();
    }

    if (type === 'artistic' && formData.keywords.trim()) {
      result.keywords = formData.keywords.split(',').map((k) => k.trim()).filter(Boolean);
    }

    onSave(result, isNew);
  };

  const isValid = formData.name.trim() && formData.promptFragment.trim();

  return (
    <div className="illuminator-modal-overlay" onMouseDown={handleOverlayMouseDown} onClick={handleOverlayClick}>
      <div className="illuminator-modal">
        <div className="illuminator-modal-header">
          <h3>{isNew ? 'Add' : 'Edit'} {type === 'artistic' ? 'Artistic' : 'Composition'} Style</h3>
          <button onClick={onCancel} className="illuminator-modal-close">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="illuminator-modal-body">
          <div className="illuminator-form-group">
            <label className="illuminator-label">Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className="illuminator-input"
              placeholder="e.g., Oil Painting"
              autoFocus
            />
          </div>

          <div className="illuminator-form-group">
            <label className="illuminator-label">Description</label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              className="illuminator-input"
              placeholder="Brief description of the style"
            />
          </div>

          <div className="illuminator-form-group">
            <label className="illuminator-label">Prompt Fragment *</label>
            <LocalTextArea
              value={formData.promptFragment}
              onChange={(value) => handleChange('promptFragment', value)}
              className="illuminator-textarea"
              rows={3}
              placeholder="e.g., oil painting style, rich textures, visible brushstrokes"
            />
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              This text will be injected into the image generation prompt.
            </p>
          </div>

          {type === 'artistic' && (
            <div className="illuminator-form-group">
              <label className="illuminator-label">Keywords</label>
              <input
                type="text"
                value={formData.keywords}
                onChange={(e) => handleChange('keywords', e.target.value)}
                className="illuminator-input"
                placeholder="e.g., traditional, classical, painterly"
              />
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Comma-separated keywords for categorization.
              </p>
            </div>
          )}

          <div className="illuminator-modal-footer">
            <button type="button" onClick={onCancel} className="illuminator-btn">
              Cancel
            </button>
            <button type="submit" disabled={!isValid} className="illuminator-btn illuminator-btn-primary">
              {isNew ? 'Add Style' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Narrative style card component
 */
function NarrativeStyleCard({ style, compositionStyles, onEdit, onDelete }) {
  const isDocument = style.format === 'document';

  // Extract a short preview of instructions for display
  const instructionsPreview = isDocument
    ? (style.documentInstructions?.slice(0, 80) + (style.documentInstructions?.length > 80 ? '...' : ''))
    : (style.narrativeInstructions?.slice(0, 80) + (style.narrativeInstructions?.length > 80 ? '...' : ''));

  // Get word count from appropriate location
  const wordCountMin = isDocument
    ? (style.pacing?.wordCount?.min || 300)
    : (style.pacing?.totalWordCount?.min || 1000);
  const wordCountMax = isDocument
    ? (style.pacing?.wordCount?.max || 800)
    : (style.pacing?.totalWordCount?.max || 2000);

  // Cover image config
  const coverConfig = getCoverImageConfig(style.id);
  const sceneTemplate = SCENE_PROMPT_TEMPLATES.find((t) => t.id === coverConfig.scenePromptId);
  const coverComposition = compositionStyles?.find((c) => c.id === coverConfig.compositionStyleId);

  return (
    <div className="illuminator-style-card">
      <div className="illuminator-style-card-header">
        <div className="illuminator-style-card-title">{style.name}</div>
        <div className="illuminator-style-card-actions">
          <button
            onClick={() => onEdit(style)}
            className="illuminator-btn-icon"
            title="Edit style"
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(style.id)}
            className="illuminator-btn-icon illuminator-btn-danger"
            title="Delete style"
          >
            Delete
          </button>
        </div>
      </div>
      {style.description && (
        <div className="illuminator-style-card-description">{style.description}</div>
      )}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
        {/* Type badge */}
        <span
          style={{
            fontSize: '10px',
            padding: '2px 6px',
            background: isDocument ? '#059669' : 'var(--accent-primary)',
            color: 'white',
            borderRadius: '4px',
          }}
        >
          {isDocument ? 'document' : 'story'}
        </span>
        {/* Word count badge */}
        <span
          style={{
            fontSize: '10px',
            padding: '2px 6px',
            background: 'var(--bg-tertiary)',
            borderRadius: '4px',
          }}
        >
          {wordCountMin}-{wordCountMax} words
        </span>
        {/* Scenes badge for story styles */}
        {!isDocument && (
          <span
            style={{
              fontSize: '10px',
              padding: '2px 6px',
              background: 'var(--bg-tertiary)',
              borderRadius: '4px',
            }}
          >
            {style.pacing?.sceneCount?.min || 3}-{style.pacing?.sceneCount?.max || 5} scenes
          </span>
        )}
        {/* Roles badge */}
        {style.roles?.length > 0 && (
          <span
            style={{
              fontSize: '10px',
              padding: '2px 6px',
              background: 'var(--bg-tertiary)',
              borderRadius: '4px',
            }}
          >
            {style.roles.length} roles
          </span>
        )}
        {/* Cover image scene prompt badge */}
        {sceneTemplate && (
          <span
            style={{
              fontSize: '10px',
              padding: '2px 6px',
              background: 'var(--bg-tertiary)',
              borderRadius: '4px',
            }}
            title={`Cover scene: ${sceneTemplate.name}`}
          >
            cover: {sceneTemplate.name}
          </span>
        )}
      </div>
      {/* Instructions preview */}
      {instructionsPreview && (
        <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
          {instructionsPreview}
        </div>
      )}
      {style.tags?.length > 0 && (
        <div className="illuminator-style-card-keywords" style={{ marginTop: '8px' }}>
          {style.tags.map((tag) => (
            <span key={tag} className="illuminator-style-keyword">{tag}</span>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Shared read-only section showing cover image config for a narrative style
 */
function CoverImageConfigSection({ styleId, compositionStyles }) {
  const coverConfig = getCoverImageConfig(styleId);
  const sceneTemplate = SCENE_PROMPT_TEMPLATES.find((t) => t.id === coverConfig.scenePromptId);
  const coverComposition = compositionStyles?.find((c) => c.id === coverConfig.compositionStyleId);

  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>Cover Image</div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '8px',
      }}>
        <div style={{
          padding: '10px',
          background: 'var(--bg-tertiary)',
          borderRadius: '6px',
          border: '1px solid var(--border-color)',
        }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Scene Prompt</div>
          <div style={{ fontSize: '13px', fontWeight: 500 }}>{sceneTemplate?.name || coverConfig.scenePromptId}</div>
        </div>
        <div style={{
          padding: '10px',
          background: 'var(--bg-tertiary)',
          borderRadius: '6px',
          border: '1px solid var(--border-color)',
        }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Composition</div>
          <div style={{ fontSize: '13px', fontWeight: 500 }}>{coverComposition?.name || coverConfig.compositionStyleId}</div>
        </div>
      </div>
    </div>
  );
}

/**
 * Modal for viewing/editing a document-format narrative style (read-only for now)
 */
function DocumentStyleViewModal({ style, compositionStyles, onCancel }) {
  const mouseDownOnOverlay = useRef(false);

  const handleOverlayMouseDown = (e) => {
    mouseDownOnOverlay.current = e.target === e.currentTarget;
  };

  const handleOverlayClick = (e) => {
    if (mouseDownOnOverlay.current && e.target === e.currentTarget) {
      onCancel();
    }
  };

  return (
    <div className="illuminator-modal-overlay" onMouseDown={handleOverlayMouseDown} onClick={handleOverlayClick}>
      <div
        className="illuminator-modal"
        style={{ maxWidth: '700px', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
      >
        <div className="illuminator-modal-header">
          <h3>Document Style: {style.name}</h3>
          <button onClick={onCancel} className="illuminator-modal-close">&times;</button>
        </div>

        <div className="illuminator-modal-body" style={{ flex: 1, overflow: 'auto' }}>
          {/* Basic info */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Description</div>
            <div>{style.description || '(none)'}</div>
          </div>

          {/* Word count */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Word Count</div>
            <div>{style.pacing?.wordCount?.min || 300} - {style.pacing?.wordCount?.max || 800} words</div>
          </div>

          {/* Document instructions */}
          {style.documentInstructions && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Document Instructions</div>
              <div style={{ fontSize: '13px', background: 'var(--bg-tertiary)', padding: '12px', borderRadius: '6px', whiteSpace: 'pre-wrap', maxHeight: '300px', overflow: 'auto' }}>
                {style.documentInstructions}
              </div>
            </div>
          )}

          {/* Event instructions */}
          {style.eventInstructions && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Event Instructions</div>
              <div style={{ fontSize: '13px', background: 'var(--bg-tertiary)', padding: '12px', borderRadius: '6px', whiteSpace: 'pre-wrap' }}>
                {style.eventInstructions}
              </div>
            </div>
          )}

          {/* Roles */}
          {style.roles?.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                Roles ({style.roles.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {style.roles.map((role, i) => (
                  <div
                    key={role.role || i}
                    style={{
                      padding: '12px',
                      background: 'var(--bg-tertiary)',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <div style={{ fontWeight: 500 }}>{role.role}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {role.count?.min || 0}-{role.count?.max || 1}
                      </div>
                    </div>
                    {role.description && (
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{role.description}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cover Image Config */}
          <CoverImageConfigSection styleId={style.id} compositionStyles={compositionStyles} />

          {/* Tags */}
          {style.tags?.length > 0 && (
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Tags</div>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {style.tags.map((tag) => (
                  <span key={tag} className="illuminator-style-keyword">{tag}</span>
                ))}
              </div>
            </div>
          )}

          <div
            style={{
              marginTop: '24px',
              padding: '12px',
              background: 'rgba(234, 179, 8, 0.1)',
              border: '1px solid rgba(234, 179, 8, 0.3)',
              borderRadius: '6px',
              fontSize: '12px',
              color: 'var(--text-secondary)',
            }}
          >
            Document styles are pre-defined and cannot be edited in the UI. To customize, create a new story-format style or edit the style library JSON directly.
          </div>
        </div>

        <div className="illuminator-modal-footer">
          <button onClick={onCancel} className="illuminator-btn illuminator-btn-primary">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Modal for editing a narrative style
 *
 * Simplified structure with freeform text blocks:
 * - narrativeInstructions: Plot structure, scenes, beats, emotional arcs
 * - proseInstructions: Tone, dialogue, description, pacing, avoid
 * - eventInstructions: How to use events (optional)
 * - roles: Cast positions with counts
 * - pacing: Word/scene counts
 */
function NarrativeStyleEditModal({ style, compositionStyles, onSave, onCancel }) {
  const isNew = !style?.id;
  const mouseDownOnOverlay = useRef(false);

  const handleOverlayMouseDown = (e) => {
    mouseDownOnOverlay.current = e.target === e.currentTarget;
  };

  const handleOverlayClick = (e) => {
    if (mouseDownOnOverlay.current && e.target === e.currentTarget) {
      onCancel();
    }
  };

  // If this is a document format, show view-only modal
  if (style?.format === 'document') {
    return <DocumentStyleViewModal style={style} compositionStyles={compositionStyles} onCancel={onCancel} />;
  }

  // Default roles for new styles
  const defaultRoles = [
    { role: 'protagonist', count: { min: 1, max: 1 }, description: 'Main character driving the story' },
    { role: 'antagonist', count: { min: 0, max: 1 }, description: 'Character opposing the protagonist' },
    { role: 'supporting', count: { min: 1, max: 4 }, description: 'Supporting characters' },
  ];

  const [formData, setFormData] = useState({
    id: style?.id || '',
    name: style?.name || '',
    description: style?.description || '',
    tags: style?.tags?.join(', ') || '',
    // Freeform text blocks
    narrativeInstructions: style?.narrativeInstructions || '',
    proseInstructions: style?.proseInstructions || '',
    eventInstructions: style?.eventInstructions || '',
    // Pacing
    wordCountMin: style?.pacing?.totalWordCount?.min ?? 1500,
    wordCountMax: style?.pacing?.totalWordCount?.max ?? 2500,
    sceneCountMin: style?.pacing?.sceneCount?.min ?? 3,
    sceneCountMax: style?.pacing?.sceneCount?.max ?? 5,
    // Roles (keep as array)
    roles: style?.roles || defaultRoles,
  });

  const [activeTab, setActiveTab] = useState('basic');

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const parseCommaSeparated = (str) => str.split(',').map((s) => s.trim()).filter(Boolean);

  const handleSubmit = (e) => {
    e.preventDefault();

    const result = {
      id: isNew ? `narrative-${Date.now().toString(36)}` : formData.id,
      name: formData.name.trim(),
      description: formData.description.trim(),
      tags: parseCommaSeparated(formData.tags),
      format: 'story',

      // Freeform text blocks
      narrativeInstructions: formData.narrativeInstructions.trim(),
      proseInstructions: formData.proseInstructions.trim(),
      eventInstructions: formData.eventInstructions.trim() || undefined,

      // Roles
      roles: formData.roles,

      // Pacing
      pacing: {
        totalWordCount: {
          min: parseInt(formData.wordCountMin, 10),
          max: parseInt(formData.wordCountMax, 10),
        },
        sceneCount: {
          min: parseInt(formData.sceneCountMin, 10),
          max: parseInt(formData.sceneCountMax, 10),
        },
      },
    };

    onSave(result, isNew);
  };

  const isValid = formData.name.trim() && formData.narrativeInstructions.trim() && formData.proseInstructions.trim();

  const tabs = [
    { id: 'basic', label: 'Basic' },
    { id: 'narrative', label: 'Narrative' },
    { id: 'prose', label: 'Prose' },
    { id: 'roles', label: 'Roles' },
  ];

  // Role management
  const handleAddRole = () => {
    setFormData((prev) => ({
      ...prev,
      roles: [...prev.roles, { role: '', count: { min: 1, max: 1 }, description: '' }],
    }));
  };

  const handleUpdateRole = (index, field, value) => {
    setFormData((prev) => {
      const newRoles = [...prev.roles];
      if (field === 'min' || field === 'max') {
        newRoles[index] = { ...newRoles[index], count: { ...newRoles[index].count, [field]: parseInt(value, 10) || 0 } };
      } else {
        newRoles[index] = { ...newRoles[index], [field]: value };
      }
      return { ...prev, roles: newRoles };
    });
  };

  const handleRemoveRole = (index) => {
    setFormData((prev) => ({
      ...prev,
      roles: prev.roles.filter((_, i) => i !== index),
    }));
  };

  return (
    <div className="illuminator-modal-overlay" onMouseDown={handleOverlayMouseDown} onClick={handleOverlayClick}>
      <div
        className="illuminator-modal"
        style={{ maxWidth: '800px', maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
      >
        <div className="illuminator-modal-header">
          <h3>{isNew ? 'Add' : 'Edit'} Narrative Style</h3>
          <button onClick={onCancel} className="illuminator-modal-close">&times;</button>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '8px 16px',
                border: 'none',
                background: activeTab === tab.id ? 'var(--bg-primary)' : 'transparent',
                borderBottom: activeTab === tab.id ? '2px solid var(--accent-primary)' : '2px solid transparent',
                color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: activeTab === tab.id ? 600 : 400,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          <div className="illuminator-modal-body" style={{ flex: 1, overflow: 'auto' }}>
            {/* Basic Tab */}
            {activeTab === 'basic' && (
              <>
                <div className="illuminator-form-group">
                  <label className="illuminator-label">Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    className="illuminator-input"
                    placeholder="e.g., Epic Drama"
                    autoFocus
                  />
                </div>
                <div className="illuminator-form-group">
                  <label className="illuminator-label">Description</label>
                  <LocalTextArea
                    value={formData.description}
                    onChange={(value) => handleChange('description', value)}
                    className="illuminator-textarea"
                    rows={2}
                    placeholder="Brief description of this narrative style"
                  />
                </div>
                <div className="illuminator-form-group">
                  <label className="illuminator-label">Tags</label>
                  <input
                    type="text"
                    value={formData.tags}
                    onChange={(e) => handleChange('tags', e.target.value)}
                    className="illuminator-input"
                    placeholder="e.g., dramatic, conflict, emotional"
                  />
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Comma-separated tags for categorization.
                  </p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="illuminator-form-group">
                    <label className="illuminator-label">Word Count</label>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input
                        type="number"
                        min="100"
                        step="100"
                        value={formData.wordCountMin}
                        onChange={(e) => handleChange('wordCountMin', e.target.value)}
                        className="illuminator-input"
                        style={{ width: '80px' }}
                      />
                      <span style={{ color: 'var(--text-muted)' }}>to</span>
                      <input
                        type="number"
                        min="100"
                        step="100"
                        value={formData.wordCountMax}
                        onChange={(e) => handleChange('wordCountMax', e.target.value)}
                        className="illuminator-input"
                        style={{ width: '80px' }}
                      />
                    </div>
                  </div>
                  <div className="illuminator-form-group">
                    <label className="illuminator-label">Scene Count</label>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={formData.sceneCountMin}
                        onChange={(e) => handleChange('sceneCountMin', e.target.value)}
                        className="illuminator-input"
                        style={{ width: '60px' }}
                      />
                      <span style={{ color: 'var(--text-muted)' }}>to</span>
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={formData.sceneCountMax}
                        onChange={(e) => handleChange('sceneCountMax', e.target.value)}
                        className="illuminator-input"
                        style={{ width: '60px' }}
                      />
                    </div>
                  </div>
                </div>
                {/* Cover image config (read-only, derived from style ID) */}
                {!isNew && (
                  <CoverImageConfigSection styleId={formData.id} compositionStyles={compositionStyles} />
                )}
              </>
            )}

            {/* Narrative Tab */}
            {activeTab === 'narrative' && (
              <>
                <div className="illuminator-form-group">
                  <label className="illuminator-label">Narrative Instructions *</label>
                  <LocalTextArea
                    value={formData.narrativeInstructions}
                    onChange={(value) => handleChange('narrativeInstructions', value)}
                    className="illuminator-textarea"
                    rows={12}
                    placeholder={`Describe the narrative structure for this style. Include:

- Overall story arc and emotional journey
- Scene types and their purposes (e.g., "The Opening: Establish world and stakes...")
- Dramatic beats and turning points
- How to build tension and release
- What the ending should feel like

Example:
"This is a sweeping narrative that builds through conflict toward transformation.

Scene Types:
- The Setup: Establish the world and the protagonist's ordinary life
- The Disruption: Something threatens the established order
- The Struggle: Characters face mounting challenges
- The Climax: Peak confrontation where everything comes together
- The Resolution: Show the changed world and transformed characters"`}
                  />
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Freeform instructions for plot structure, scenes, and dramatic beats.
                  </p>
                </div>
                <div className="illuminator-form-group">
                  <label className="illuminator-label">Event Instructions</label>
                  <LocalTextArea
                    value={formData.eventInstructions}
                    onChange={(value) => handleChange('eventInstructions', value)}
                    className="illuminator-textarea"
                    rows={3}
                    placeholder="How to incorporate events from the world data into the narrative. E.g., 'Use events as dramatic turning points. Higher significance events should be climactic moments...'"
                  />
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Optional guidance for how world events should be woven into the story.
                  </p>
                </div>
              </>
            )}

            {/* Prose Tab */}
            {activeTab === 'prose' && (
              <>
                <div className="illuminator-form-group">
                  <label className="illuminator-label">Prose Instructions *</label>
                  <LocalTextArea
                    value={formData.proseInstructions}
                    onChange={(value) => handleChange('proseInstructions', value)}
                    className="illuminator-textarea"
                    rows={12}
                    placeholder={`Describe the prose style for this narrative. Include:

- Tone and mood (e.g., "epic, dramatic, tense, emotionally charged")
- Dialogue style (e.g., "Formal and weighty, characters speak with purpose")
- Description style (e.g., "Rich sensory detail, focus on atmosphere")
- Pacing guidance (e.g., "Build tension steadily, breathe in quiet moments")
- World elements to emphasize (e.g., locations, artifacts, cultural practices)
- Things to avoid (e.g., "modern slang, breaking fourth wall, rushed endings")

Example:
"Tone: epic, dramatic, tense, emotionally charged.
Dialogue: Formal and weighty. Characters speak with purpose and meaning.
Description: Rich sensory detail. Focus on atmosphere and emotion.
Pacing: Build tension steadily. Allow quiet moments to breathe.
World Elements: Integrate locations and cultural practices naturally.
Avoid: modern slang, breaking fourth wall, rushed emotional beats."`}
                  />
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Freeform instructions for tone, dialogue, description, and writing style.
                  </p>
                </div>
              </>
            )}

            {/* Roles Tab */}
            {activeTab === 'roles' && (
              <>
                <div style={{ marginBottom: '12px' }}>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                    Define the narrative roles for this style. The AI will assign characters to these roles.
                  </p>
                </div>
                {formData.roles.map((role, index) => (
                  <div
                    key={index}
                    style={{
                      padding: '12px',
                      background: 'var(--bg-tertiary)',
                      borderRadius: '6px',
                      marginBottom: '8px',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <input
                          type="text"
                          value={role.role}
                          onChange={(e) => handleUpdateRole(index, 'role', e.target.value)}
                          className="illuminator-input"
                          placeholder="Role name (e.g., protagonist)"
                          style={{ marginBottom: '8px' }}
                        />
                        <input
                          type="text"
                          value={role.description}
                          onChange={(e) => handleUpdateRole(index, 'description', e.target.value)}
                          className="illuminator-input"
                          placeholder="Role description"
                        />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <input
                          type="number"
                          min="0"
                          max="10"
                          value={role.count.min}
                          onChange={(e) => handleUpdateRole(index, 'min', e.target.value)}
                          className="illuminator-input"
                          style={{ width: '50px' }}
                        />
                        <span style={{ color: 'var(--text-muted)' }}>-</span>
                        <input
                          type="number"
                          min="0"
                          max="10"
                          value={role.count.max}
                          onChange={(e) => handleUpdateRole(index, 'max', e.target.value)}
                          className="illuminator-input"
                          style={{ width: '50px' }}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveRole(index)}
                        className="illuminator-btn-icon illuminator-btn-danger"
                        style={{ padding: '4px 8px' }}
                      >
                        X
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={handleAddRole}
                  className="illuminator-btn"
                  style={{ fontSize: '12px' }}
                >
                  + Add Role
                </button>
              </>
            )}
          </div>

          <div className="illuminator-modal-footer">
            <button type="button" onClick={onCancel} className="illuminator-btn">
              Cancel
            </button>
            <button type="submit" disabled={!isValid} className="illuminator-btn illuminator-btn-primary">
              {isNew ? 'Add Style' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Main StyleLibraryEditor component
 */
export default function StyleLibraryEditor({
  styleLibrary,
  loading,
  isCustom,
  onAddArtisticStyle,
  onUpdateArtisticStyle,
  onDeleteArtisticStyle,
  onAddCompositionStyle,
  onUpdateCompositionStyle,
  onDeleteCompositionStyle,
  onAddNarrativeStyle,
  onUpdateNarrativeStyle,
  onDeleteNarrativeStyle,
  onReset,
}) {
  const [editingStyle, setEditingStyle] = useState(null);
  const [editingType, setEditingType] = useState(null); // 'artistic' | 'composition' | 'narrative'
  const [confirmReset, setConfirmReset] = useState(false);

  const handleEditArtistic = useCallback((style) => {
    setEditingStyle(style);
    setEditingType('artistic');
  }, []);

  const handleEditComposition = useCallback((style) => {
    setEditingStyle(style);
    setEditingType('composition');
  }, []);

  const handleAddArtistic = useCallback(() => {
    setEditingStyle({});
    setEditingType('artistic');
  }, []);

  const handleAddComposition = useCallback(() => {
    setEditingStyle({});
    setEditingType('composition');
  }, []);

  const handleEditNarrative = useCallback((style) => {
    setEditingStyle(style);
    setEditingType('narrative');
  }, []);

  const handleAddNarrative = useCallback(() => {
    setEditingStyle({});
    setEditingType('narrative');
  }, []);

  const handleSaveStyle = useCallback(async (styleData, isNew) => {
    if (editingType === 'artistic') {
      if (isNew) {
        await onAddArtisticStyle(styleData);
      } else {
        await onUpdateArtisticStyle(styleData.id, styleData);
      }
    } else if (editingType === 'composition') {
      if (isNew) {
        await onAddCompositionStyle(styleData);
      } else {
        await onUpdateCompositionStyle(styleData.id, styleData);
      }
    } else if (editingType === 'narrative') {
      if (isNew) {
        await onAddNarrativeStyle(styleData);
      } else {
        await onUpdateNarrativeStyle(styleData.id, styleData);
      }
    }
    setEditingStyle(null);
    setEditingType(null);
  }, [editingType, onAddArtisticStyle, onUpdateArtisticStyle, onAddCompositionStyle, onUpdateCompositionStyle, onAddNarrativeStyle, onUpdateNarrativeStyle]);

  const handleDeleteArtistic = useCallback(async (id) => {
    if (window.confirm('Delete this artistic style?')) {
      await onDeleteArtisticStyle(id);
    }
  }, [onDeleteArtisticStyle]);

  const handleDeleteComposition = useCallback(async (id) => {
    if (window.confirm('Delete this composition style?')) {
      await onDeleteCompositionStyle(id);
    }
  }, [onDeleteCompositionStyle]);

  const handleDeleteNarrative = useCallback(async (id) => {
    if (window.confirm('Delete this narrative style?')) {
      await onDeleteNarrativeStyle(id);
    }
  }, [onDeleteNarrativeStyle]);

  const handleReset = useCallback(async () => {
    await onReset();
    setConfirmReset(false);
  }, [onReset]);

  const handleCloseModal = useCallback(() => {
    setEditingStyle(null);
    setEditingType(null);
  }, []);

  if (loading) {
    return (
      <div className="illuminator-card">
        <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Loading style library...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Status bar */}
      <div className="illuminator-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontWeight: 500 }}>Style Library</span>
            <span style={{ marginLeft: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
              {isCustom ? '(customized)' : '(defaults)'}
            </span>
          </div>
          <div>
            {!confirmReset && (
              <button
                onClick={() => setConfirmReset(true)}
                className="illuminator-btn"
                style={{ fontSize: '12px' }}
                title={isCustom ? 'Reload defaults and discard custom styles' : 'Reload default styles'}
              >
                Reload Default Styles
              </button>
            )}
            {confirmReset && (
              <span style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {isCustom ? 'Reload defaults and discard custom styles?' : 'Reload default styles?'}
                </span>
                <button onClick={handleReset} className="illuminator-btn illuminator-btn-danger" style={{ fontSize: '12px' }}>
                  Yes, Reload
                </button>
                <button onClick={() => setConfirmReset(false)} className="illuminator-btn" style={{ fontSize: '12px' }}>
                  Cancel
                </button>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Artistic Styles */}
      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">
            Artistic Styles
            <span style={{ fontWeight: 400, fontSize: '14px', color: 'var(--text-muted)', marginLeft: '8px' }}>
              ({styleLibrary.artisticStyles.length})
            </span>
          </h2>
          <button onClick={handleAddArtistic} className="illuminator-btn illuminator-btn-primary" style={{ fontSize: '12px' }}>
            + Add Style
          </button>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
          Artistic styles define the visual rendering approach (e.g., oil painting, watercolor, digital art).
        </p>

        <div className="illuminator-style-grid">
          {styleLibrary.artisticStyles.map((style) => (
            <StyleCard
              key={style.id}
              style={style}
              type="artistic"
              onEdit={handleEditArtistic}
              onDelete={handleDeleteArtistic}
            />
          ))}
        </div>

        {styleLibrary.artisticStyles.length === 0 && (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>
            No artistic styles defined. Add one to get started.
          </p>
        )}
      </div>

      {/* Composition Styles */}
      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">
            Composition Styles
            <span style={{ fontWeight: 400, fontSize: '14px', color: 'var(--text-muted)', marginLeft: '8px' }}>
              ({styleLibrary.compositionStyles.length})
            </span>
          </h2>
          <button onClick={handleAddComposition} className="illuminator-btn illuminator-btn-primary" style={{ fontSize: '12px' }}>
            + Add Style
          </button>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
          Composition styles define framing and visual arrangement (e.g., portrait, establishing shot, action scene).
        </p>

        <div className="illuminator-style-grid">
          {styleLibrary.compositionStyles.map((style) => (
            <StyleCard
              key={style.id}
              style={style}
              type="composition"
              onEdit={handleEditComposition}
              onDelete={handleDeleteComposition}
            />
          ))}
        </div>

        {styleLibrary.compositionStyles.length === 0 && (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>
            No composition styles defined. Add one to get started.
          </p>
        )}
      </div>

      {/* Narrative Styles */}
      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">
            Narrative Styles
            <span style={{ fontWeight: 400, fontSize: '14px', color: 'var(--text-muted)', marginLeft: '8px' }}>
              ({styleLibrary.narrativeStyles.length})
            </span>
          </h2>
          <button onClick={handleAddNarrative} className="illuminator-btn illuminator-btn-primary" style={{ fontSize: '12px' }}>
            + Add Style
          </button>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
          Narrative styles define story structure, character selection, and prose tone for chronicle generation.
        </p>

        <div className="illuminator-style-grid">
          {styleLibrary.narrativeStyles.map((style) => (
            <NarrativeStyleCard
              key={style.id}
              style={style}
              compositionStyles={styleLibrary.compositionStyles}
              onEdit={handleEditNarrative}
              onDelete={handleDeleteNarrative}
            />
          ))}
        </div>

        {styleLibrary.narrativeStyles.length === 0 && (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>
            No narrative styles defined. Add one to get started.
          </p>
        )}
      </div>

      {/* Scene Prompt Templates */}
      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">
            Cover Image Scene Prompts
            <span style={{ fontWeight: 400, fontSize: '14px', color: 'var(--text-muted)', marginLeft: '8px' }}>
              ({SCENE_PROMPT_TEMPLATES.length})
            </span>
          </h2>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
          Scene prompt templates direct the LLM on what kind of cover image scene to describe. Each narrative style maps to one of these templates.
        </p>

        <div className="illuminator-style-grid">
          {SCENE_PROMPT_TEMPLATES.map((template) => (
            <div key={template.id} className="illuminator-style-card">
              <div className="illuminator-style-card-header">
                <div className="illuminator-style-card-title">{template.name}</div>
              </div>
              <div className="illuminator-style-card-prompt">
                <strong>Framing:</strong> {template.framing}
              </div>
              <div className="illuminator-style-card-prompt" style={{ marginTop: '8px' }}>
                <strong>Instructions:</strong> {template.instructions}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Edit Modal for Artistic/Composition */}
      {editingStyle && (editingType === 'artistic' || editingType === 'composition') && (
        <StyleEditModal
          style={editingStyle}
          type={editingType}
          onSave={handleSaveStyle}
          onCancel={handleCloseModal}
        />
      )}

      {/* Edit Modal for Narrative */}
      {editingStyle && editingType === 'narrative' && (
        <NarrativeStyleEditModal
          style={editingStyle}
          compositionStyles={styleLibrary.compositionStyles}
          onSave={handleSaveStyle}
          onCancel={handleCloseModal}
        />
      )}
    </div>
  );
}
