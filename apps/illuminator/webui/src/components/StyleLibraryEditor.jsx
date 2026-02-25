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

import React, { useState, useCallback, useRef } from "react";
import PropTypes from "prop-types";
import { LocalTextArea } from "@penguin-tales/shared-components";
import { SCENE_PROMPT_TEMPLATES, getCoverImageConfig } from "../lib/coverImageStyles";
import "./StyleLibraryEditor.css";

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
          <button onClick={() => onEdit(style)} className="illuminator-btn-icon" title="Edit style">
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
            <span key={kw} className="illuminator-style-keyword">
              {kw}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

StyleCard.propTypes = {
  style: PropTypes.object,
  type: PropTypes.string,
  onEdit: PropTypes.func,
  onDelete: PropTypes.func,
};

/**
 * Modal for editing a style
 */
function StyleEditModal({ style, type, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    id: style?.id || "",
    name: style?.name || "",
    description: style?.description || "",
    promptFragment: style?.promptFragment || "",
    keywords: style?.keywords?.join(", ") || "",
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

    if (type === "artistic" && formData.keywords.trim()) {
      result.keywords = formData.keywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);
    }

    onSave(result, isNew);
  };

  const isValid = formData.name.trim() && formData.promptFragment.trim();

  return (
    <div
      className="illuminator-modal-overlay"
      onMouseDown={handleOverlayMouseDown}
      onClick={handleOverlayClick}
    >
      <div className="illuminator-modal">
        <div className="illuminator-modal-header">
          <h3>
            {isNew ? "Add" : "Edit"} {type === "artistic" ? "Artistic" : "Composition"} Style
          </h3>
          <button onClick={onCancel} className="illuminator-modal-close">
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="illuminator-modal-body">
          <div className="illuminator-form-group">
            <label className="illuminator-label">Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange("name", e.target.value)}
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
              onChange={(e) => handleChange("description", e.target.value)}
              className="illuminator-input"
              placeholder="Brief description of the style"
            />
          </div>

          <div className="illuminator-form-group">
            <label className="illuminator-label">Prompt Fragment *</label>
            <LocalTextArea
              value={formData.promptFragment}
              onChange={(value) => handleChange("promptFragment", value)}
              className="illuminator-textarea"
              rows={3}
              placeholder="e.g., oil painting style, rich textures, visible brushstrokes"
            />
            <p className="style-editor-hint">
              This text will be injected into the image generation prompt.
            </p>
          </div>

          {type === "artistic" && (
            <div className="illuminator-form-group">
              <label className="illuminator-label">Keywords</label>
              <input
                type="text"
                value={formData.keywords}
                onChange={(e) => handleChange("keywords", e.target.value)}
                className="illuminator-input"
                placeholder="e.g., traditional, classical, painterly"
              />
              <p className="style-editor-hint">Comma-separated keywords for categorization.</p>
            </div>
          )}

          <div className="illuminator-modal-footer">
            <button type="button" onClick={onCancel} className="illuminator-btn">
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isValid}
              className="illuminator-btn illuminator-btn-primary"
            >
              {isNew ? "Add Style" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

StyleEditModal.propTypes = {
  style: PropTypes.object,
  type: PropTypes.string,
  onSave: PropTypes.func,
  onCancel: PropTypes.func,
};

/**
 * Narrative style card component
 */
function NarrativeStyleCard({ style, compositionStyles, onEdit, onDelete }) {
  const isDocument = style.format === "document";

  // Extract a short preview of instructions for display
  const instructionsPreview = isDocument
    ? style.documentInstructions?.slice(0, 80) +
      (style.documentInstructions?.length > 80 ? "..." : "")
    : style.narrativeInstructions?.slice(0, 80) +
      (style.narrativeInstructions?.length > 80 ? "..." : "");

  // Get word count from appropriate location
  const wordCountMin = isDocument
    ? style.pacing?.wordCount?.min || 300
    : style.pacing?.totalWordCount?.min || 1000;
  const wordCountMax = isDocument
    ? style.pacing?.wordCount?.max || 800
    : style.pacing?.totalWordCount?.max || 2000;

  // Cover image config
  const coverConfig = getCoverImageConfig(style.id);
  const sceneTemplate = SCENE_PROMPT_TEMPLATES.find((t) => t.id === coverConfig.scenePromptId);
  const coverComposition = compositionStyles?.find((c) => c.id === coverConfig.compositionStyleId);

  return (
    <div className="illuminator-style-card">
      <div className="illuminator-style-card-header">
        <div className="illuminator-style-card-title">{style.name}</div>
        <div className="illuminator-style-card-actions">
          <button onClick={() => onEdit(style)} className="illuminator-btn-icon" title="Edit style">
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
      <div className="style-editor-badge-row">
        {/* Type badge */}
        <span
          className={`style-editor-badge ${isDocument ? "style-editor-badge-document" : "style-editor-badge-story"}`}
        >
          {isDocument ? "document" : "story"}
        </span>
        {/* Word count badge */}
        <span className="style-editor-badge">
          {wordCountMin}-{wordCountMax} words
        </span>
        {/* Scenes badge for story styles */}
        {!isDocument && (
          <span className="style-editor-badge">
            {style.pacing?.sceneCount?.min || 3}-{style.pacing?.sceneCount?.max || 5} scenes
          </span>
        )}
        {/* Roles badge */}
        {style.roles?.length > 0 && (
          <span className="style-editor-badge">{style.roles.length} roles</span>
        )}
        {/* Cover image scene prompt badge */}
        {sceneTemplate && (
          <span className="style-editor-badge" title={`Cover scene: ${sceneTemplate.name}`}>
            cover: {sceneTemplate.name}
          </span>
        )}
      </div>
      {/* Instructions preview */}
      {instructionsPreview && (
        <div className="style-editor-instructions-preview">{instructionsPreview}</div>
      )}
      {style.tags?.length > 0 && (
        <div className="illuminator-style-card-keywords style-editor-tags-row">
          {style.tags.map((tag) => (
            <span key={tag} className="illuminator-style-keyword">
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

NarrativeStyleCard.propTypes = {
  style: PropTypes.object,
  compositionStyles: PropTypes.array,
  onEdit: PropTypes.func,
  onDelete: PropTypes.func,
};

/**
 * Shared read-only section showing cover image config for a narrative style
 */
function CoverImageConfigSection({ styleId, compositionStyles }) {
  const coverConfig = getCoverImageConfig(styleId);
  const sceneTemplate = SCENE_PROMPT_TEMPLATES.find((t) => t.id === coverConfig.scenePromptId);
  const coverComposition = compositionStyles?.find((c) => c.id === coverConfig.compositionStyleId);

  return (
    <div className="style-editor-cover-section">
      <div className="style-editor-cover-label">Cover Image</div>
      <div className="style-editor-cover-grid">
        <div className="style-editor-cover-card">
          <div className="style-editor-cover-card-label">Scene Prompt</div>
          <div className="style-editor-cover-card-value">
            {sceneTemplate?.name || coverConfig.scenePromptId}
          </div>
        </div>
        <div className="style-editor-cover-card">
          <div className="style-editor-cover-card-label">Composition</div>
          <div className="style-editor-cover-card-value">
            {coverComposition?.name || coverConfig.compositionStyleId}
          </div>
        </div>
      </div>
    </div>
  );
}

CoverImageConfigSection.propTypes = {
  styleId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  compositionStyles: PropTypes.array,
};

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
    <div
      className="illuminator-modal-overlay"
      onMouseDown={handleOverlayMouseDown}
      onClick={handleOverlayClick}
    >
      <div className="illuminator-modal style-editor-modal-wide">
        <div className="illuminator-modal-header">
          <h3>Document Style: {style.name}</h3>
          <button onClick={onCancel} className="illuminator-modal-close">
            &times;
          </button>
        </div>

        <div className="illuminator-modal-body style-editor-modal-body-scroll">
          {/* Basic info */}
          <div className="style-editor-detail-section">
            <div className="style-editor-detail-label">Description</div>
            <div>{style.description || "(none)"}</div>
          </div>

          {/* Word count */}
          <div className="style-editor-detail-section">
            <div className="style-editor-detail-label">Word Count</div>
            <div>
              {style.pacing?.wordCount?.min || 300} - {style.pacing?.wordCount?.max || 800} words
            </div>
          </div>

          {/* Document instructions */}
          {style.documentInstructions && (
            <div className="style-editor-detail-section">
              <div className="style-editor-detail-label">Document Instructions</div>
              <div className="style-editor-preformatted">{style.documentInstructions}</div>
            </div>
          )}

          {/* Event instructions */}
          {style.eventInstructions && (
            <div className="style-editor-detail-section">
              <div className="style-editor-detail-label">Event Instructions</div>
              <div className="style-editor-preformatted style-editor-preformatted-compact">
                {style.eventInstructions}
              </div>
            </div>
          )}

          {/* Roles */}
          {style.roles?.length > 0 && (
            <div className="style-editor-detail-section">
              <div className="style-editor-detail-label style-editor-detail-label-mb8">
                Roles ({style.roles.length})
              </div>
              <div className="style-editor-roles-list">
                {style.roles.map((role, i) => (
                  <div key={role.role || i} className="style-editor-role-card">
                    <div className="style-editor-role-header">
                      <div className="style-editor-role-name">{role.role}</div>
                      <div className="style-editor-role-count">
                        {role.count?.min || 0}-{role.count?.max || 1}
                      </div>
                    </div>
                    {role.description && (
                      <div className="style-editor-role-desc">{role.description}</div>
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
              <div className="style-editor-detail-label">Tags</div>
              <div className="style-editor-tags-flex">
                {style.tags.map((tag) => (
                  <span key={tag} className="illuminator-style-keyword">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="style-editor-readonly-notice">
            Document styles are pre-defined and cannot be edited in the UI. To customize, create a
            new story-format style or edit the style library JSON directly.
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

DocumentStyleViewModal.propTypes = {
  style: PropTypes.object,
  compositionStyles: PropTypes.array,
  onCancel: PropTypes.func,
};

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
  if (style?.format === "document") {
    return (
      <DocumentStyleViewModal
        // eslint-disable-next-line local/no-inline-styles -- not CSS: data prop
        style={style}
        compositionStyles={compositionStyles}
        onCancel={onCancel}
      />
    );
  }

  // Default roles for new styles
  const defaultRoles = [
    {
      role: "protagonist",
      count: { min: 1, max: 1 },
      description: "Main character driving the story",
    },
    {
      role: "antagonist",
      count: { min: 0, max: 1 },
      description: "Character opposing the protagonist",
    },
    { role: "supporting", count: { min: 1, max: 4 }, description: "Supporting characters" },
  ];

  const [formData, setFormData] = useState({
    id: style?.id || "",
    name: style?.name || "",
    description: style?.description || "",
    tags: style?.tags?.join(", ") || "",
    // Freeform text blocks
    narrativeInstructions: style?.narrativeInstructions || "",
    proseInstructions: style?.proseInstructions || "",
    eventInstructions: style?.eventInstructions || "",
    // Pacing
    wordCountMin: style?.pacing?.totalWordCount?.min ?? 1500,
    wordCountMax: style?.pacing?.totalWordCount?.max ?? 2500,
    sceneCountMin: style?.pacing?.sceneCount?.min ?? 3,
    sceneCountMax: style?.pacing?.sceneCount?.max ?? 5,
    // Roles (keep as array)
    roles: style?.roles || defaultRoles,
  });

  const [activeTab, setActiveTab] = useState("basic");

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const parseCommaSeparated = (str) =>
    str
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

  const handleSubmit = (e) => {
    e.preventDefault();

    const result = {
      id: isNew ? `narrative-${Date.now().toString(36)}` : formData.id,
      name: formData.name.trim(),
      description: formData.description.trim(),
      tags: parseCommaSeparated(formData.tags),
      format: "story",

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

  const isValid =
    formData.name.trim() &&
    formData.narrativeInstructions.trim() &&
    formData.proseInstructions.trim();

  const tabs = [
    { id: "basic", label: "Basic" },
    { id: "narrative", label: "Narrative" },
    { id: "prose", label: "Prose" },
    { id: "roles", label: "Roles" },
  ];

  // Role management
  const handleAddRole = () => {
    setFormData((prev) => ({
      ...prev,
      roles: [...prev.roles, { role: "", count: { min: 1, max: 1 }, description: "" }],
    }));
  };

  const handleUpdateRole = (index, field, value) => {
    setFormData((prev) => {
      const newRoles = [...prev.roles];
      if (field === "min" || field === "max") {
        newRoles[index] = {
          ...newRoles[index],
          count: { ...newRoles[index].count, [field]: parseInt(value, 10) || 0 },
        };
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
    <div
      className="illuminator-modal-overlay"
      onMouseDown={handleOverlayMouseDown}
      onClick={handleOverlayClick}
    >
      <div className="illuminator-modal style-editor-modal-extra-wide">
        <div className="illuminator-modal-header">
          <h3>{isNew ? "Add" : "Edit"} Narrative Style</h3>
          <button onClick={onCancel} className="illuminator-modal-close">
            &times;
          </button>
        </div>

        {/* Tab bar */}
        <div className="style-editor-tab-bar">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`style-editor-tab ${activeTab === tab.id ? "style-editor-tab-active" : ""}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="style-editor-form-scroll">
          <div className="illuminator-modal-body style-editor-modal-body-scroll">
            {/* Basic Tab */}
            {activeTab === "basic" && (
              <>
                <div className="illuminator-form-group">
                  <label className="illuminator-label">Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleChange("name", e.target.value)}
                    className="illuminator-input"
                    placeholder="e.g., Epic Drama"
                    autoFocus
                  />
                </div>
                <div className="illuminator-form-group">
                  <label className="illuminator-label">Description</label>
                  <LocalTextArea
                    value={formData.description}
                    onChange={(value) => handleChange("description", value)}
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
                    onChange={(e) => handleChange("tags", e.target.value)}
                    className="illuminator-input"
                    placeholder="e.g., dramatic, conflict, emotional"
                  />
                  <p className="style-editor-hint">Comma-separated tags for categorization.</p>
                </div>
                <div className="style-editor-pacing-grid">
                  <div className="illuminator-form-group">
                    <label className="illuminator-label">Word Count</label>
                    <div className="style-editor-range-row">
                      <input
                        type="number"
                        min="100"
                        step="100"
                        value={formData.wordCountMin}
                        onChange={(e) => handleChange("wordCountMin", e.target.value)}
                        className="illuminator-input style-editor-input-sm"
                      />
                      <span className="style-editor-range-separator">to</span>
                      <input
                        type="number"
                        min="100"
                        step="100"
                        value={formData.wordCountMax}
                        onChange={(e) => handleChange("wordCountMax", e.target.value)}
                        className="illuminator-input style-editor-input-sm"
                      />
                    </div>
                  </div>
                  <div className="illuminator-form-group">
                    <label className="illuminator-label">Scene Count</label>
                    <div className="style-editor-range-row">
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={formData.sceneCountMin}
                        onChange={(e) => handleChange("sceneCountMin", e.target.value)}
                        className="illuminator-input style-editor-input-xs"
                      />
                      <span className="style-editor-range-separator">to</span>
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={formData.sceneCountMax}
                        onChange={(e) => handleChange("sceneCountMax", e.target.value)}
                        className="illuminator-input style-editor-input-xs"
                      />
                    </div>
                  </div>
                </div>
                {/* Cover image config (read-only, derived from style ID) */}
                {!isNew && (
                  <CoverImageConfigSection
                    styleId={formData.id}
                    compositionStyles={compositionStyles}
                  />
                )}
              </>
            )}

            {/* Narrative Tab */}
            {activeTab === "narrative" && (
              <>
                <div className="illuminator-form-group">
                  <label className="illuminator-label">Narrative Instructions *</label>
                  <LocalTextArea
                    value={formData.narrativeInstructions}
                    onChange={(value) => handleChange("narrativeInstructions", value)}
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
                  <p className="style-editor-hint">
                    Freeform instructions for plot structure, scenes, and dramatic beats.
                  </p>
                </div>
                <div className="illuminator-form-group">
                  <label className="illuminator-label">Event Instructions</label>
                  <LocalTextArea
                    value={formData.eventInstructions}
                    onChange={(value) => handleChange("eventInstructions", value)}
                    className="illuminator-textarea"
                    rows={3}
                    placeholder="How to incorporate events from the world data into the narrative. E.g., 'Use events as dramatic turning points. Higher significance events should be climactic moments...'"
                  />
                  <p className="style-editor-hint">
                    Optional guidance for how world events should be woven into the story.
                  </p>
                </div>
              </>
            )}

            {/* Prose Tab */}
            {activeTab === "prose" && (
              <>
                <div className="illuminator-form-group">
                  <label className="illuminator-label">Prose Instructions *</label>
                  <LocalTextArea
                    value={formData.proseInstructions}
                    onChange={(value) => handleChange("proseInstructions", value)}
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
                  <p className="style-editor-hint">
                    Freeform instructions for tone, dialogue, description, and writing style.
                  </p>
                </div>
              </>
            )}

            {/* Roles Tab */}
            {activeTab === "roles" && (
              <>
                <div className="style-editor-roles-info">
                  <p className="style-editor-roles-info-text">
                    Define the narrative roles for this style. The AI will assign characters to
                    these roles.
                  </p>
                </div>
                {formData.roles.map((role, index) => (
                  <div key={index} className="style-editor-role-edit-card">
                    <div className="style-editor-role-edit-row">
                      <div className="style-editor-role-edit-fields">
                        <input
                          type="text"
                          value={role.role}
                          onChange={(e) => handleUpdateRole(index, "role", e.target.value)}
                          className="illuminator-input style-editor-input-role-name"
                          placeholder="Role name (e.g., protagonist)"
                        />
                        <input
                          type="text"
                          value={role.description}
                          onChange={(e) => handleUpdateRole(index, "description", e.target.value)}
                          className="illuminator-input"
                          placeholder="Role description"
                        />
                      </div>
                      <div className="style-editor-role-edit-counts">
                        <input
                          type="number"
                          min="0"
                          max="10"
                          value={role.count.min}
                          onChange={(e) => handleUpdateRole(index, "min", e.target.value)}
                          className="illuminator-input style-editor-input-count"
                        />
                        <span className="style-editor-range-separator">-</span>
                        <input
                          type="number"
                          min="0"
                          max="10"
                          value={role.count.max}
                          onChange={(e) => handleUpdateRole(index, "max", e.target.value)}
                          className="illuminator-input style-editor-input-count"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveRole(index)}
                        className="illuminator-btn-icon illuminator-btn-danger style-editor-role-remove-btn"
                      >
                        X
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={handleAddRole}
                  className="illuminator-btn style-editor-add-role-btn"
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
            <button
              type="submit"
              disabled={!isValid}
              className="illuminator-btn illuminator-btn-primary"
            >
              {isNew ? "Add Style" : "Save Changes"}
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
    setEditingType("artistic");
  }, []);

  const handleEditComposition = useCallback((style) => {
    setEditingStyle(style);
    setEditingType("composition");
  }, []);

  const handleAddArtistic = useCallback(() => {
    setEditingStyle({});
    setEditingType("artistic");
  }, []);

  const handleAddComposition = useCallback(() => {
    setEditingStyle({});
    setEditingType("composition");
  }, []);

  const handleEditNarrative = useCallback((style) => {
    setEditingStyle(style);
    setEditingType("narrative");
  }, []);

  const handleAddNarrative = useCallback(() => {
    setEditingStyle({});
    setEditingType("narrative");
  }, []);

  const handleSaveStyle = useCallback(
    async (styleData, isNew) => {
      if (editingType === "artistic") {
        if (isNew) {
          await onAddArtisticStyle(styleData);
        } else {
          await onUpdateArtisticStyle(styleData.id, styleData);
        }
      } else if (editingType === "composition") {
        if (isNew) {
          await onAddCompositionStyle(styleData);
        } else {
          await onUpdateCompositionStyle(styleData.id, styleData);
        }
      } else if (editingType === "narrative") {
        if (isNew) {
          await onAddNarrativeStyle(styleData);
        } else {
          await onUpdateNarrativeStyle(styleData.id, styleData);
        }
      }
      setEditingStyle(null);
      setEditingType(null);
    },
    [
      editingType,
      onAddArtisticStyle,
      onUpdateArtisticStyle,
      onAddCompositionStyle,
      onUpdateCompositionStyle,
      onAddNarrativeStyle,
      onUpdateNarrativeStyle,
    ]
  );

  const handleDeleteArtistic = useCallback(
    async (id) => {
      if (window.confirm("Delete this artistic style?")) {
        await onDeleteArtisticStyle(id);
      }
    },
    [onDeleteArtisticStyle]
  );

  const handleDeleteComposition = useCallback(
    async (id) => {
      if (window.confirm("Delete this composition style?")) {
        await onDeleteCompositionStyle(id);
      }
    },
    [onDeleteCompositionStyle]
  );

  const handleDeleteNarrative = useCallback(
    async (id) => {
      if (window.confirm("Delete this narrative style?")) {
        await onDeleteNarrativeStyle(id);
      }
    },
    [onDeleteNarrativeStyle]
  );

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
        <p className="style-editor-loading">Loading style library...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Status bar */}
      <div className="illuminator-card">
        <div className="style-editor-status-row">
          <div>
            <span className="style-editor-status-label">Style Library</span>
            <span className="style-editor-status-sublabel">
              {isCustom ? "(customized)" : "(defaults)"}
            </span>
          </div>
          <div>
            {!confirmReset && (
              <button
                onClick={() => setConfirmReset(true)}
                className="illuminator-btn style-editor-btn-sm"
                title={
                  isCustom ? "Reload defaults and discard custom styles" : "Reload default styles"
                }
              >
                Reload Default Styles
              </button>
            )}
            {confirmReset && (
              <span className="style-editor-confirm-row">
                <span className="style-editor-confirm-text">
                  {isCustom
                    ? "Reload defaults and discard custom styles?"
                    : "Reload default styles?"}
                </span>
                <button
                  onClick={handleReset}
                  className="illuminator-btn illuminator-btn-danger style-editor-btn-sm"
                >
                  Yes, Reload
                </button>
                <button
                  onClick={() => setConfirmReset(false)}
                  className="illuminator-btn style-editor-btn-sm"
                >
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
            <span className="style-editor-section-count">
              ({styleLibrary.artisticStyles.length})
            </span>
          </h2>
          <button
            onClick={handleAddArtistic}
            className="illuminator-btn illuminator-btn-primary style-editor-btn-sm"
          >
            + Add Style
          </button>
        </div>
        <p className="style-editor-description">
          Artistic styles define the visual rendering approach (e.g., oil painting, watercolor,
          digital art).
        </p>

        <div className="illuminator-style-grid">
          {styleLibrary.artisticStyles.map((style) => (
            <StyleCard
              key={style.id}
              // eslint-disable-next-line local/no-inline-styles -- not CSS: data prop
              style={style}
              type="artistic"
              onEdit={handleEditArtistic}
              onDelete={handleDeleteArtistic}
            />
          ))}
        </div>

        {styleLibrary.artisticStyles.length === 0 && (
          <p className="style-editor-empty">No artistic styles defined. Add one to get started.</p>
        )}
      </div>

      {/* Composition Styles */}
      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">
            Composition Styles
            <span className="style-editor-section-count">
              ({styleLibrary.compositionStyles.length})
            </span>
          </h2>
          <button
            onClick={handleAddComposition}
            className="illuminator-btn illuminator-btn-primary style-editor-btn-sm"
          >
            + Add Style
          </button>
        </div>
        <p className="style-editor-description">
          Composition styles define framing and visual arrangement (e.g., portrait, establishing
          shot, action scene).
        </p>

        <div className="illuminator-style-grid">
          {styleLibrary.compositionStyles.map((style) => (
            <StyleCard
              key={style.id}
              // eslint-disable-next-line local/no-inline-styles -- not CSS: data prop
              style={style}
              type="composition"
              onEdit={handleEditComposition}
              onDelete={handleDeleteComposition}
            />
          ))}
        </div>

        {styleLibrary.compositionStyles.length === 0 && (
          <p className="style-editor-empty">
            No composition styles defined. Add one to get started.
          </p>
        )}
      </div>

      {/* Narrative Styles */}
      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">
            Narrative Styles
            <span className="style-editor-section-count">
              ({styleLibrary.narrativeStyles.length})
            </span>
          </h2>
          <button
            onClick={handleAddNarrative}
            className="illuminator-btn illuminator-btn-primary style-editor-btn-sm"
          >
            + Add Style
          </button>
        </div>
        <p className="style-editor-description">
          Narrative styles define story structure, character selection, and prose tone for chronicle
          generation.
        </p>

        <div className="illuminator-style-grid">
          {styleLibrary.narrativeStyles.map((style) => (
            <NarrativeStyleCard
              key={style.id}
              // eslint-disable-next-line local/no-inline-styles -- not CSS: data prop
              style={style}
              compositionStyles={styleLibrary.compositionStyles}
              onEdit={handleEditNarrative}
              onDelete={handleDeleteNarrative}
            />
          ))}
        </div>

        {styleLibrary.narrativeStyles.length === 0 && (
          <p className="style-editor-empty">No narrative styles defined. Add one to get started.</p>
        )}
      </div>

      {/* Scene Prompt Templates */}
      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">
            Cover Image Scene Prompts
            <span className="style-editor-section-count">({SCENE_PROMPT_TEMPLATES.length})</span>
          </h2>
        </div>
        <p className="style-editor-description">
          Scene prompt templates direct the LLM on what kind of cover image scene to describe. Each
          narrative style maps to one of these templates.
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
              <div className="illuminator-style-card-prompt style-editor-scene-prompt-instructions">
                <strong>Instructions:</strong> {template.instructions}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Edit Modal for Artistic/Composition */}
      {editingStyle && (editingType === "artistic" || editingType === "composition") && (
        <StyleEditModal
          // eslint-disable-next-line local/no-inline-styles -- not CSS: data prop
          style={editingStyle}
          type={editingType}
          onSave={handleSaveStyle}
          onCancel={handleCloseModal}
        />
      )}

      {/* Edit Modal for Narrative */}
      {editingStyle && editingType === "narrative" && (
        <NarrativeStyleEditModal
          // eslint-disable-next-line local/no-inline-styles -- not CSS: data prop
          style={editingStyle}
          compositionStyles={styleLibrary.compositionStyles}
          onSave={handleSaveStyle}
          onCancel={handleCloseModal}
        />
      )}
    </div>
  );
}
