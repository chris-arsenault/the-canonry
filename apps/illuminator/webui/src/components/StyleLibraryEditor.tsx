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

import React, { useState, useCallback, useRef, useMemo } from "react";
import { LocalTextArea } from "@the-canonry/shared-components";
import { SCENE_PROMPT_TEMPLATES, getCoverImageConfig } from "../lib/coverImageStyles";
import type { ScenePromptTemplate } from "../lib/coverImageStyles";
import "./StyleLibraryEditor.css";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StyleBase {
  id: string;
  name: string;
  description?: string;
  promptFragment?: string;
  keywords?: string[];
}

interface NarrativeRole {
  role: string;
  count: { min: number; max: number };
  description?: string;
}

interface NarrativePacing {
  totalWordCount?: { min: number; max: number };
  wordCount?: { min: number; max: number };
  sceneCount?: { min: number; max: number };
}

interface NarrativeStyle {
  id: string;
  name: string;
  description?: string;
  format?: "story" | "document";
  tags?: string[];
  narrativeInstructions?: string;
  proseInstructions?: string;
  eventInstructions?: string;
  documentInstructions?: string;
  roles?: NarrativeRole[];
  pacing?: NarrativePacing;
}

interface StyleLibrary {
  artisticStyles: StyleBase[];
  compositionStyles: StyleBase[];
  narrativeStyles: NarrativeStyle[];
}

type StyleType = "artistic" | "composition" | "narrative";

interface StyleLibraryEditorProps {
  styleLibrary: StyleLibrary;
  loading: boolean;
  isCustom: boolean;
  onAddArtisticStyle: (style: StyleBase) => Promise<void>;
  onUpdateArtisticStyle: (id: string, style: StyleBase) => Promise<void>;
  onDeleteArtisticStyle: (id: string) => Promise<void>;
  onAddCompositionStyle: (style: StyleBase) => Promise<void>;
  onUpdateCompositionStyle: (id: string, style: StyleBase) => Promise<void>;
  onDeleteCompositionStyle: (id: string) => Promise<void>;
  onAddNarrativeStyle: (style: NarrativeStyle) => Promise<void>;
  onUpdateNarrativeStyle: (id: string, style: NarrativeStyle) => Promise<void>;
  onDeleteNarrativeStyle: (id: string) => Promise<void>;
  onReset: () => Promise<void>;
}

interface StyleCardProps {
  style: StyleBase;
  onEdit: (style: StyleBase) => void;
  onDelete: (id: string) => void;
}

interface StyleEditModalProps {
  style: StyleBase | Record<string, never>;
  type: "artistic" | "composition";
  onSave: (style: StyleBase, isNew: boolean) => void;
  onCancel: () => void;
}

interface NarrativeStyleCardProps {
  style: NarrativeStyle;
  onEdit: (style: NarrativeStyle) => void;
  onDelete: (id: string) => void;
}

interface CoverImageConfigSectionProps {
  styleId: string;
  compositionStyles?: StyleBase[];
}

interface DocumentStyleViewModalProps {
  style: NarrativeStyle;
  compositionStyles?: StyleBase[];
  onCancel: () => void;
}

interface NarrativeStyleEditModalProps {
  style: NarrativeStyle | Record<string, never>;
  compositionStyles?: StyleBase[];
  onSave: (style: NarrativeStyle, isNew: boolean) => void;
  onCancel: () => void;
}

// ---------------------------------------------------------------------------
// Shared hook for modal overlay click-to-dismiss behavior
// ---------------------------------------------------------------------------

function useOverlayDismiss(onDismiss: () => void) {
  const mouseDownOnOverlay = useRef(false);
  const handleOverlayMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    mouseDownOnOverlay.current = e.target === e.currentTarget;
  }, []);
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement> | React.KeyboardEvent<HTMLDivElement>) => {
      if (mouseDownOnOverlay.current && e.target === e.currentTarget) {
        onDismiss();
      }
    },
    [onDismiss],
  );
  return {
    handleOverlayMouseDown,
    handleOverlayClick,
  };
}

// ---------------------------------------------------------------------------
// Shared form field change handler
// ---------------------------------------------------------------------------

function useFormChange<T extends Record<string, unknown>>(
  setFormData: React.Dispatch<React.SetStateAction<T>>,
) {
  return useCallback(
    (field: keyof T, value: T[keyof T]) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    },
    [setFormData],
  );
}

/**
 * Generate a unique ID for a new style
 */
function generateStyleId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}`;
}

// ---------------------------------------------------------------------------
// StyleCard
// ---------------------------------------------------------------------------

function StyleCard({ style, onEdit, onDelete }: StyleCardProps) {
  const handleEdit = useCallback(() => onEdit(style), [onEdit, style]);
  const handleDelete = useCallback(() => onDelete(style.id), [onDelete, style.id]);

  return (
    <div className="illuminator-style-card">
      <div className="illuminator-style-card-header">
        <div className="illuminator-style-card-title">{style.name}</div>
        <div className="illuminator-style-card-actions">
          <button onClick={handleEdit} className="illuminator-btn-icon" title="Edit style">
            Edit
          </button>
          <button
            onClick={handleDelete}
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
      {style.keywords && style.keywords.length > 0 && (
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

// ---------------------------------------------------------------------------
// StyleEditModal
// ---------------------------------------------------------------------------

interface StyleEditFormData {
  id: string;
  name: string;
  description: string;
  promptFragment: string;
  keywords: string;
}

function StyleEditModal({ style, type, onSave, onCancel }: StyleEditModalProps) {
  const [formData, setFormData] = useState<StyleEditFormData>({
    id: style?.id || "",
    name: style?.name || "",
    description: style?.description || "",
    promptFragment: style?.promptFragment || "",
    keywords: style?.keywords?.join(", ") || "",
  });

  const { handleOverlayMouseDown, handleOverlayClick } = useOverlayDismiss(onCancel);
  const handleChange = useFormChange(setFormData);
  const isNew = !style?.id;

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const result: StyleBase = {
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
    },
    [formData, isNew, type, onSave],
  );

  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => handleChange("name", e.target.value),
    [handleChange],
  );
  const handleDescriptionChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => handleChange("description", e.target.value),
    [handleChange],
  );
  const handlePromptChange = useCallback(
    (value: string) => handleChange("promptFragment", value),
    [handleChange],
  );
  const handleKeywordsChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => handleChange("keywords", e.target.value),
    [handleChange],
  );

  const isValid = formData.name.trim() && formData.promptFragment.trim();

  return (
    <div
      className="illuminator-modal-overlay"
      onMouseDown={handleOverlayMouseDown}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label={`${isNew ? "Add" : "Edit"} ${type} style`}
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
            <label htmlFor="name" className="illuminator-label">
              Name *
            </label>
            <input
              id="name"
              type="text"
              value={formData.name}
              onChange={handleNameChange}
              className="illuminator-input"
              placeholder="e.g., Oil Painting"
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
            />
          </div>

          <div className="illuminator-form-group">
            <label htmlFor="description" className="illuminator-label">
              Description
            </label>
            <input
              id="description"
              type="text"
              value={formData.description}
              onChange={handleDescriptionChange}
              className="illuminator-input"
              placeholder="Brief description of the style"
            />
          </div>

          <div className="illuminator-form-group">
            <label className="illuminator-label">
              Prompt Fragment *
              <LocalTextArea
                value={formData.promptFragment}
                onChange={handlePromptChange}
                className="illuminator-textarea"
                rows={3}
                placeholder="e.g., oil painting style, rich textures, visible brushstrokes"
              />
            </label>
            <p className="ilu-hint-sm style-editor-hint-spacing">
              This text will be injected into the image generation prompt.
            </p>
          </div>

          {type === "artistic" && (
            <div className="illuminator-form-group">
              <label htmlFor="keywords" className="illuminator-label">
                Keywords
              </label>
              <input
                id="keywords"
                type="text"
                value={formData.keywords}
                onChange={handleKeywordsChange}
                className="illuminator-input"
                placeholder="e.g., traditional, classical, painterly"
              />
              <p className="ilu-hint-sm style-editor-hint-spacing">
                Comma-separated keywords for categorization.
              </p>
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

// ---------------------------------------------------------------------------
// NarrativeStyleCard
// ---------------------------------------------------------------------------

function NarrativeStyleBadges({ style }: { style: NarrativeStyle }) {
  const isDocument = style.format === "document";
  const wordCountMin = isDocument
    ? style.pacing?.wordCount?.min || 300
    : style.pacing?.totalWordCount?.min || 1000;
  const wordCountMax = isDocument
    ? style.pacing?.wordCount?.max || 800
    : style.pacing?.totalWordCount?.max || 2000;

  const coverConfig = getCoverImageConfig(style.id);
  const sceneTemplate = SCENE_PROMPT_TEMPLATES.find((t) => t.id === coverConfig.scenePromptId);

  return (
    <div className="style-editor-badge-row">
      <span
        className={`style-editor-badge ${isDocument ? "style-editor-badge-document" : "style-editor-badge-story"}`}
      >
        {isDocument ? "document" : "story"}
      </span>
      <span className="style-editor-badge">
        {wordCountMin}-{wordCountMax} words
      </span>
      {!isDocument && (
        <span className="style-editor-badge">
          {style.pacing?.sceneCount?.min || 3}-{style.pacing?.sceneCount?.max || 5} scenes
        </span>
      )}
      {style.roles && style.roles.length > 0 && (
        <span className="style-editor-badge">{style.roles.length} roles</span>
      )}
      {sceneTemplate && (
        <span className="style-editor-badge" title={`Cover scene: ${sceneTemplate.name}`}>
          cover: {sceneTemplate.name}
        </span>
      )}
    </div>
  );
}

function NarrativeStyleCard({ style, onEdit, onDelete }: NarrativeStyleCardProps) {
  const isDocument = style.format === "document";
  const rawInstructions = isDocument ? style.documentInstructions : style.narrativeInstructions;

  const instructionsPreview = useMemo(() => {
    if (!rawInstructions) return "";
    const suffix = rawInstructions.length > 80 ? "..." : "";
    return rawInstructions.slice(0, 80) + suffix;
  }, [rawInstructions]);

  const handleEdit = useCallback(() => onEdit(style), [onEdit, style]);
  const handleDelete = useCallback(() => onDelete(style.id), [onDelete, style.id]);

  return (
    <div className="illuminator-style-card">
      <div className="illuminator-style-card-header">
        <div className="illuminator-style-card-title">{style.name}</div>
        <div className="illuminator-style-card-actions">
          <button onClick={handleEdit} className="illuminator-btn-icon" title="Edit style">
            Edit
          </button>
          <button
            onClick={handleDelete}
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
      <NarrativeStyleBadges style={style} />
      {instructionsPreview && (
        <div className="style-editor-instructions-preview">{instructionsPreview}</div>
      )}
      {style.tags && style.tags.length > 0 && (
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

// ---------------------------------------------------------------------------
// CoverImageConfigSection
// ---------------------------------------------------------------------------

function CoverImageConfigSection({ styleId, compositionStyles }: CoverImageConfigSectionProps) {
  const coverConfig = getCoverImageConfig(styleId);
  const sceneTemplate = SCENE_PROMPT_TEMPLATES.find((t) => t.id === coverConfig.scenePromptId);
  const coverComposition = compositionStyles?.find(
    (c) => c.id === coverConfig.compositionStyleId,
  );

  return (
    <div className="style-editor-cover-block">
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

// ---------------------------------------------------------------------------
// DocumentStyleViewModal
// ---------------------------------------------------------------------------

function DocumentStyleRolesList({ roles }: { roles: NarrativeRole[] }) {
  return (
    <div className="style-editor-detail-block">
      <div className="style-editor-detail-label style-editor-detail-label-mb8">
        Roles ({roles.length})
      </div>
      <div className="style-editor-roles-list">
        {roles.map((role, i) => (
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
  );
}

function DocumentStyleViewModal({
  style,
  compositionStyles,
  onCancel,
}: DocumentStyleViewModalProps) {
  const { handleOverlayMouseDown, handleOverlayClick } = useOverlayDismiss(onCancel);

  return (
    <div
      className="illuminator-modal-overlay"
      onMouseDown={handleOverlayMouseDown}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label={`Document style: ${style.name}`}
    >
      <div className="illuminator-modal style-editor-modal-wide">
        <div className="illuminator-modal-header">
          <h3>Document Style: {style.name}</h3>
          <button onClick={onCancel} className="illuminator-modal-close">
            &times;
          </button>
        </div>

        <div className="illuminator-modal-body style-editor-modal-body-scroll">
          <div className="style-editor-detail-block">
            <div className="style-editor-detail-label">Description</div>
            <div>{style.description || "(none)"}</div>
          </div>

          <div className="style-editor-detail-block">
            <div className="style-editor-detail-label">Word Count</div>
            <div>
              {style.pacing?.wordCount?.min || 300} - {style.pacing?.wordCount?.max || 800} words
            </div>
          </div>

          {style.documentInstructions && (
            <div className="style-editor-detail-block">
              <div className="style-editor-detail-label">Document Instructions</div>
              <div className="style-editor-preformatted">{style.documentInstructions}</div>
            </div>
          )}

          {style.eventInstructions && (
            <div className="style-editor-detail-block">
              <div className="style-editor-detail-label">Event Instructions</div>
              <div className="style-editor-preformatted style-editor-preformatted-compact">
                {style.eventInstructions}
              </div>
            </div>
          )}

          {style.roles && style.roles.length > 0 && (
            <DocumentStyleRolesList roles={style.roles} />
          )}

          <CoverImageConfigSection styleId={style.id} compositionStyles={compositionStyles} />

          {style.tags && style.tags.length > 0 && (
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

// ---------------------------------------------------------------------------
// NarrativeStyleEditModal
// ---------------------------------------------------------------------------

interface NarrativeFormData {
  id: string;
  name: string;
  description: string;
  tags: string;
  narrativeInstructions: string;
  proseInstructions: string;
  eventInstructions: string;
  wordCountMin: number;
  wordCountMax: number;
  sceneCountMin: number;
  sceneCountMax: number;
  roles: NarrativeRole[];
}

const DEFAULT_ROLES: NarrativeRole[] = [
  { role: "protagonist", count: { min: 1, max: 1 }, description: "Main character driving the story" },
  { role: "antagonist", count: { min: 0, max: 1 }, description: "Character opposing the protagonist" },
  { role: "supporting", count: { min: 1, max: 4 }, description: "Supporting characters" },
];

const NARRATIVE_TABS = [
  { id: "basic", label: "Basic" },
  { id: "narrative", label: "Narrative" },
  { id: "prose", label: "Prose" },
  { id: "roles", label: "Roles" },
] as const;

function NarrativeBasicTab({
  formData,
  compositionStyles,
  isNew,
  onFieldChange,
}: {
  formData: NarrativeFormData;
  compositionStyles?: StyleBase[];
  isNew: boolean;
  onFieldChange: (field: keyof NarrativeFormData, value: NarrativeFormData[keyof NarrativeFormData]) => void;
}) {
  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onFieldChange("name", e.target.value),
    [onFieldChange],
  );
  const handleDescChange = useCallback(
    (value: string) => onFieldChange("description", value),
    [onFieldChange],
  );
  const handleTagsChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onFieldChange("tags", e.target.value),
    [onFieldChange],
  );
  const handleWordMinChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onFieldChange("wordCountMin", e.target.value),
    [onFieldChange],
  );
  const handleWordMaxChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onFieldChange("wordCountMax", e.target.value),
    [onFieldChange],
  );
  const handleSceneMinChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onFieldChange("sceneCountMin", e.target.value),
    [onFieldChange],
  );
  const handleSceneMaxChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onFieldChange("sceneCountMax", e.target.value),
    [onFieldChange],
  );

  return (
    <>
      <div className="illuminator-form-group">
        <label htmlFor="name" className="illuminator-label">
          Name *
        </label>
        <input
          id="name"
          type="text"
          value={formData.name}
          onChange={handleNameChange}
          className="illuminator-input"
          placeholder="e.g., Epic Drama"
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
        />
      </div>
      <div className="illuminator-form-group">
        <label className="illuminator-label">
          Description
          <LocalTextArea
            value={formData.description}
            onChange={handleDescChange}
            className="illuminator-textarea"
            rows={2}
            placeholder="Brief description of this narrative style"
          />
        </label>
      </div>
      <div className="illuminator-form-group">
        <label htmlFor="tags" className="illuminator-label">
          Tags
        </label>
        <input
          id="tags"
          type="text"
          value={formData.tags}
          onChange={handleTagsChange}
          className="illuminator-input"
          placeholder="e.g., dramatic, conflict, emotional"
        />
        <p className="ilu-hint-sm style-editor-hint-spacing">
          Comma-separated tags for categorization.
        </p>
      </div>
      <div className="style-editor-pacing-grid">
        <div className="illuminator-form-group">
          <span className="illuminator-label">Word Count</span>
          <div className="style-editor-range-row">
            <input
              type="number"
              min="100"
              step="100"
              value={formData.wordCountMin}
              onChange={handleWordMinChange}
              className="illuminator-input style-editor-input-sm"
            />
            <span className="style-editor-range-separator">to</span>
            <input
              type="number"
              min="100"
              step="100"
              value={formData.wordCountMax}
              onChange={handleWordMaxChange}
              className="illuminator-input style-editor-input-sm"
            />
          </div>
        </div>
        <div className="illuminator-form-group">
          <span className="illuminator-label">Scene Count</span>
          <div className="style-editor-range-row">
            <input
              type="number"
              min="1"
              max="20"
              value={formData.sceneCountMin}
              onChange={handleSceneMinChange}
              className="illuminator-input style-editor-input-xs"
            />
            <span className="style-editor-range-separator">to</span>
            <input
              type="number"
              min="1"
              max="20"
              value={formData.sceneCountMax}
              onChange={handleSceneMaxChange}
              className="illuminator-input style-editor-input-xs"
            />
          </div>
        </div>
      </div>
      {!isNew && (
        <CoverImageConfigSection styleId={formData.id} compositionStyles={compositionStyles} />
      )}
    </>
  );
}

function NarrativeInstructionsTab({
  formData,
  onFieldChange,
}: {
  formData: NarrativeFormData;
  onFieldChange: (field: keyof NarrativeFormData, value: NarrativeFormData[keyof NarrativeFormData]) => void;
}) {
  const handleNarrativeChange = useCallback(
    (value: string) => onFieldChange("narrativeInstructions", value),
    [onFieldChange],
  );
  const handleEventChange = useCallback(
    (value: string) => onFieldChange("eventInstructions", value),
    [onFieldChange],
  );

  return (
    <>
      <div className="illuminator-form-group">
        <label className="illuminator-label">
          Narrative Instructions *
          <LocalTextArea
            value={formData.narrativeInstructions}
            onChange={handleNarrativeChange}
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
        </label>
        <p className="ilu-hint-sm style-editor-hint-spacing">
          Freeform instructions for plot structure, scenes, and dramatic beats.
        </p>
      </div>
      <div className="illuminator-form-group">
        <label className="illuminator-label">
          Event Instructions
          <LocalTextArea
            value={formData.eventInstructions}
            onChange={handleEventChange}
            className="illuminator-textarea"
            rows={3}
            placeholder="How to incorporate events from the world data into the narrative. E.g., 'Use events as dramatic turning points. Higher significance events should be climactic moments...'"
          />
        </label>
        <p className="ilu-hint-sm style-editor-hint-spacing">
          Optional guidance for how world events should be woven into the story.
        </p>
      </div>
    </>
  );
}

function NarrativeProseTab({
  formData,
  onFieldChange,
}: {
  formData: NarrativeFormData;
  onFieldChange: (field: keyof NarrativeFormData, value: NarrativeFormData[keyof NarrativeFormData]) => void;
}) {
  const handleProseChange = useCallback(
    (value: string) => onFieldChange("proseInstructions", value),
    [onFieldChange],
  );

  return (
    <div className="illuminator-form-group">
      <label className="illuminator-label">
        Prose Instructions *
        <LocalTextArea
          value={formData.proseInstructions}
          onChange={handleProseChange}
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
      </label>
      <p className="ilu-hint-sm style-editor-hint-spacing">
        Freeform instructions for tone, dialogue, description, and writing style.
      </p>
    </div>
  );
}

function NarrativeRolesTab({
  roles,
  onAddRole,
  onUpdateRole,
  onRemoveRole,
}: {
  roles: NarrativeRole[];
  onAddRole: () => void;
  onUpdateRole: (index: number, field: string, value: string) => void;
  onRemoveRole: (index: number) => void;
}) {
  return (
    <>
      <div className="style-editor-roles-info">
        <p className="style-editor-roles-info-text">
          Define the narrative roles for this style. The AI will assign characters to these roles.
        </p>
      </div>
      {roles.map((role, index) => (
        <NarrativeRoleEditCard
          key={index}
          role={role}
          index={index}
          onUpdate={onUpdateRole}
          onRemove={onRemoveRole}
        />
      ))}
      <button
        type="button"
        onClick={onAddRole}
        className="illuminator-btn style-editor-add-role-btn"
      >
        + Add Role
      </button>
    </>
  );
}

function NarrativeRoleEditCard({
  role,
  index,
  onUpdate,
  onRemove,
}: {
  role: NarrativeRole;
  index: number;
  onUpdate: (index: number, field: string, value: string) => void;
  onRemove: (index: number) => void;
}) {
  const handleRoleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onUpdate(index, "role", e.target.value),
    [onUpdate, index],
  );
  const handleDescChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onUpdate(index, "description", e.target.value),
    [onUpdate, index],
  );
  const handleMinChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onUpdate(index, "min", e.target.value),
    [onUpdate, index],
  );
  const handleMaxChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onUpdate(index, "max", e.target.value),
    [onUpdate, index],
  );
  const handleRemove = useCallback(() => onRemove(index), [onRemove, index]);

  return (
    <div className="style-editor-role-edit-card">
      <div className="style-editor-role-edit-row">
        <div className="style-editor-role-edit-fields">
          <input
            type="text"
            value={role.role}
            onChange={handleRoleNameChange}
            className="illuminator-input style-editor-input-role-name"
            placeholder="Role name (e.g., protagonist)"
          />
          <input
            type="text"
            value={role.description}
            onChange={handleDescChange}
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
            onChange={handleMinChange}
            className="illuminator-input style-editor-input-count"
          />
          <span className="style-editor-range-separator">-</span>
          <input
            type="number"
            min="0"
            max="10"
            value={role.count.max}
            onChange={handleMaxChange}
            className="illuminator-input style-editor-input-count"
          />
        </div>
        <button
          type="button"
          onClick={handleRemove}
          className="illuminator-btn-icon illuminator-btn-danger style-editor-role-remove-btn"
        >
          X
        </button>
      </div>
    </div>
  );
}

function NarrativeStyleEditModal({
  style,
  compositionStyles,
  onSave,
  onCancel,
}: NarrativeStyleEditModalProps) {
  const isNew = !style?.id;

  const [formData, setFormData] = useState<NarrativeFormData>({
    id: style?.id || "",
    name: style?.name || "",
    description: style?.description || "",
    tags: style?.tags?.join(", ") || "",
    narrativeInstructions: style?.narrativeInstructions || "",
    proseInstructions: style?.proseInstructions || "",
    eventInstructions: style?.eventInstructions || "",
    wordCountMin: style?.pacing?.totalWordCount?.min ?? 1500,
    wordCountMax: style?.pacing?.totalWordCount?.max ?? 2500,
    sceneCountMin: style?.pacing?.sceneCount?.min ?? 3,
    sceneCountMax: style?.pacing?.sceneCount?.max ?? 5,
    roles: style?.roles || DEFAULT_ROLES,
  });
  const [activeTab, setActiveTab] = useState("basic");
  const { handleOverlayMouseDown, handleOverlayClick } = useOverlayDismiss(onCancel);
  const handleChange = useFormChange(setFormData);

  // If this is a document format, show view-only modal
  if (style?.format === "document") {
    return (
      <DocumentStyleViewModal
        compositionStyles={compositionStyles}
        onCancel={onCancel}
        style={style as NarrativeStyle}
      />
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result: NarrativeStyle = {
      id: isNew ? `narrative-${Date.now().toString(36)}` : formData.id,
      name: formData.name.trim(),
      description: formData.description.trim(),
      tags: formData.tags
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      format: "story",
      narrativeInstructions: formData.narrativeInstructions.trim(),
      proseInstructions: formData.proseInstructions.trim(),
      eventInstructions: formData.eventInstructions.trim() || undefined,
      roles: formData.roles,
      pacing: {
        totalWordCount: {
          min: parseInt(String(formData.wordCountMin), 10),
          max: parseInt(String(formData.wordCountMax), 10),
        },
        sceneCount: {
          min: parseInt(String(formData.sceneCountMin), 10),
          max: parseInt(String(formData.sceneCountMax), 10),
        },
      },
    };
    onSave(result, isNew);
  };

  const isValid =
    formData.name.trim() &&
    formData.narrativeInstructions.trim() &&
    formData.proseInstructions.trim();

  const handleAddRole = () => {
    setFormData((prev) => ({
      ...prev,
      roles: [
        ...prev.roles,
        { role: "", count: { min: 1, max: 1 }, description: "" },
      ],
    }));
  };

  const handleUpdateRole = (index: number, field: string, value: string) => {
    setFormData((prev) => {
      const newRoles = [...prev.roles];
      if (field === "min" || field === "max") {
        newRoles[index] = {
          ...newRoles[index],
          count: {
            ...newRoles[index].count,
            [field]: parseInt(value, 10) || 0,
          },
        };
      } else {
        newRoles[index] = {
          ...newRoles[index],
          [field]: value,
        };
      }
      return { ...prev, roles: newRoles };
    });
  };

  const handleRemoveRole = (index: number) => {
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
      role="dialog"
      aria-modal="true"
      aria-label={`${isNew ? "Add" : "Edit"} narrative style`}
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
          {NARRATIVE_TABS.map((tab) => (
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
            {activeTab === "basic" && (
              <NarrativeBasicTab
                formData={formData}
                compositionStyles={compositionStyles}
                isNew={isNew}
                onFieldChange={handleChange}
              />
            )}
            {activeTab === "narrative" && (
              <NarrativeInstructionsTab formData={formData} onFieldChange={handleChange} />
            )}
            {activeTab === "prose" && (
              <NarrativeProseTab formData={formData} onFieldChange={handleChange} />
            )}
            {activeTab === "roles" && (
              <NarrativeRolesTab
                roles={formData.roles}
                onAddRole={handleAddRole}
                onUpdateRole={handleUpdateRole}
                onRemoveRole={handleRemoveRole}
              />
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

// ---------------------------------------------------------------------------
// ScenePromptTemplateCard
// ---------------------------------------------------------------------------

function ScenePromptTemplateCard({ template }: { template: ScenePromptTemplate }) {
  return (
    <div className="illuminator-style-card">
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
  );
}

// ---------------------------------------------------------------------------
// StyleSection - reusable section for each style type
// ---------------------------------------------------------------------------

interface StyleSectionProps {
  title: string;
  count: number;
  description: string;
  onAdd: () => void;
  emptyText: string;
  children: React.ReactNode;
}

function StyleSection({ title, count, description, onAdd, emptyText, children }: StyleSectionProps) {
  return (
    <div className="illuminator-card">
      <div className="illuminator-card-header">
        <h2 className="illuminator-card-title">
          {title}
          <span className="style-editor-count-label">({count})</span>
        </h2>
        <button
          onClick={onAdd}
          className="illuminator-btn illuminator-btn-primary style-editor-btn-sm"
        >
          + Add Style
        </button>
      </div>
      <p className="style-editor-description">{description}</p>
      <div className="illuminator-style-grid">{children}</div>
      {count === 0 && <p className="ilu-empty style-editor-empty">{emptyText}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main StyleLibraryEditor component
// ---------------------------------------------------------------------------

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
}: StyleLibraryEditorProps) {
  const [editingStyle, setEditingStyle] = useState<StyleBase | NarrativeStyle | null>(null);
  const [editingType, setEditingType] = useState<StyleType | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const handleEditArtistic = useCallback((style: StyleBase) => {
    setEditingStyle(style);
    setEditingType("artistic");
  }, []);
  const handleEditComposition = useCallback((style: StyleBase) => {
    setEditingStyle(style);
    setEditingType("composition");
  }, []);
  const handleAddArtistic = useCallback(() => {
    setEditingStyle({} as StyleBase);
    setEditingType("artistic");
  }, []);
  const handleAddComposition = useCallback(() => {
    setEditingStyle({} as StyleBase);
    setEditingType("composition");
  }, []);
  const handleEditNarrative = useCallback((style: NarrativeStyle) => {
    setEditingStyle(style);
    setEditingType("narrative");
  }, []);
  const handleAddNarrative = useCallback(() => {
    setEditingStyle({} as NarrativeStyle);
    setEditingType("narrative");
  }, []);

  const handleSaveStyle = useCallback(
    async (styleData: StyleBase | NarrativeStyle, isNew: boolean) => {
      if (editingType === "artistic") {
        if (isNew) {
          await onAddArtisticStyle(styleData as StyleBase);
        } else {
          await onUpdateArtisticStyle(styleData.id, styleData as StyleBase);
        }
      } else if (editingType === "composition") {
        if (isNew) {
          await onAddCompositionStyle(styleData as StyleBase);
        } else {
          await onUpdateCompositionStyle(styleData.id, styleData as StyleBase);
        }
      } else if (editingType === "narrative") {
        if (isNew) {
          await onAddNarrativeStyle(styleData as NarrativeStyle);
        } else {
          await onUpdateNarrativeStyle(styleData.id, styleData as NarrativeStyle);
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
    ],
  );

  const handleDeleteArtistic = useCallback(
    async (id: string) => {
      if (window.confirm("Delete this artistic style?")) {
        await onDeleteArtisticStyle(id);
      }
    },
    [onDeleteArtisticStyle],
  );
  const handleDeleteComposition = useCallback(
    async (id: string) => {
      if (window.confirm("Delete this composition style?")) {
        await onDeleteCompositionStyle(id);
      }
    },
    [onDeleteCompositionStyle],
  );
  const handleDeleteNarrative = useCallback(
    async (id: string) => {
      if (window.confirm("Delete this narrative style?")) {
        await onDeleteNarrativeStyle(id);
      }
    },
    [onDeleteNarrativeStyle],
  );

  const handleReset = useCallback(async () => {
    await onReset();
    setConfirmReset(false);
  }, [onReset]);

  const handleCloseModal = useCallback(() => {
    setEditingStyle(null);
    setEditingType(null);
  }, []);

  const handleShowConfirmReset = useCallback(() => setConfirmReset(true), []);
  const handleCancelReset = useCallback(() => setConfirmReset(false), []);

  if (loading) {
    return (
      <div className="illuminator-card">
        <p className="ilu-empty style-editor-loading">Loading style library...</p>
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
                onClick={handleShowConfirmReset}
                className="illuminator-btn style-editor-btn-sm"
                title={
                  isCustom
                    ? "Reload defaults and discard custom styles"
                    : "Reload default styles"
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
                <button onClick={handleCancelReset} className="illuminator-btn style-editor-btn-sm">
                  Cancel
                </button>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Artistic Styles */}
      <StyleSection
        title="Artistic Styles"
        count={styleLibrary.artisticStyles.length}
        description="Artistic styles define the visual rendering approach (e.g., oil painting, watercolor, digital art)."
        onAdd={handleAddArtistic}
        emptyText="No artistic styles defined. Add one to get started."
      >
        {styleLibrary.artisticStyles.map((s) => (
          <StyleCard key={s.id} style={s} onEdit={handleEditArtistic} onDelete={handleDeleteArtistic} />
        ))}
      </StyleSection>

      {/* Composition Styles */}
      <StyleSection
        title="Composition Styles"
        count={styleLibrary.compositionStyles.length}
        description="Composition styles define framing and visual arrangement (e.g., portrait, establishing shot, action scene)."
        onAdd={handleAddComposition}
        emptyText="No composition styles defined. Add one to get started."
      >
        {styleLibrary.compositionStyles.map((s) => (
          <StyleCard key={s.id} style={s} onEdit={handleEditComposition} onDelete={handleDeleteComposition} />
        ))}
      </StyleSection>

      {/* Narrative Styles */}
      <StyleSection
        title="Narrative Styles"
        count={styleLibrary.narrativeStyles.length}
        description="Narrative styles define story structure, character selection, and prose tone for chronicle generation."
        onAdd={handleAddNarrative}
        emptyText="No narrative styles defined. Add one to get started."
      >
        {styleLibrary.narrativeStyles.map((s) => (
          <NarrativeStyleCard
            key={s.id}
            style={s}
            onEdit={handleEditNarrative}
            onDelete={handleDeleteNarrative}
          />
        ))}
      </StyleSection>

      {/* Scene Prompt Templates */}
      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">
            Cover Image Scene Prompts
            <span className="style-editor-count-label">({SCENE_PROMPT_TEMPLATES.length})</span>
          </h2>
        </div>
        <p className="style-editor-description">
          Scene prompt templates direct the LLM on what kind of cover image scene to describe. Each
          narrative style maps to one of these templates.
        </p>

        <div className="illuminator-style-grid">
          {SCENE_PROMPT_TEMPLATES.map((template) => (
            <ScenePromptTemplateCard key={template.id} template={template} />
          ))}
        </div>
      </div>

      {/* Edit Modal for Artistic/Composition */}
      {editingStyle && (editingType === "artistic" || editingType === "composition") && (
        <StyleEditModal
          type={editingType}
          onSave={handleSaveStyle}
          onCancel={handleCloseModal}
          style={editingStyle as StyleBase}
        />
      )}

      {/* Edit Modal for Narrative */}
      {editingStyle && editingType === "narrative" && (
        <NarrativeStyleEditModal
          compositionStyles={styleLibrary.compositionStyles}
          onSave={handleSaveStyle}
          onCancel={handleCloseModal}
          style={editingStyle as NarrativeStyle}
        />
      )}
    </div>
  );
}
