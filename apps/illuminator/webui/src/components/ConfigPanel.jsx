/**
 * ConfigPanel - Model and API configuration
 *
 * Contains settings for:
 * - LLM call configuration (per-call model and thinking settings)
 * - Image model, size, and quality options
 * - Multishot prompting options
 * - Performance settings
 */

import LLMCallConfigPanel from './LLMCallConfigPanel';
import { LocalTextArea } from '@penguin-tales/shared-components';
import { IMAGE_MODELS } from '../lib/imageSettings';

const DEFAULT_IMAGE_PROMPT_TEMPLATE = `Transform the structured prompt below into a single, coherent image prompt for {{modelName}}. Do NOT simply reformat—actively synthesize and reshape:

Honor the VISUAL THESIS: This is the primary visual signal. The thesis describes the dominant silhouette feature that makes this entity instantly recognizable. Build the entire image around it.

Synthesize, don't list:
- Merge SUBJECT + CONTEXT + CULTURAL IDENTITY into a unified visual
- Apply STYLE (artistic approach) and COMPOSITION (framing/perspective) to shape the rendering
- Translate SUPPORTING TRAITS into concrete visual details that reinforce the thesis
- Incorporate COLOR PALETTE if provided

Establish clear composition and perspective:
- Honor the COMPOSITION directive for framing and vantage point
- Use environmental storytelling (objects, weathering, traces) to convey history
- The SETTING provides world context but the subject is the focus

Create specific visual instructions: Rather than listing adjectives, use concrete visual language: "weathered by decades of X," "visible scars of Y," "rendered in the style of Z"

Respect the AVOID list: These are hard constraints—elements that break the visual language.

Condense to a single, authoritative prompt: Output should be 150-300 words, reading as clear artistic direction that could be handed to a concept artist—not a bulleted list.
{{globalImageRules}}
Original prompt:
{{prompt}}`;

const DEFAULT_CHRONICLE_IMAGE_PROMPT_TEMPLATE = `Synthesize the structured prompt below into a single, coherent image prompt for {{modelName}}.

The SCENE describes what to depict. Do not invent new elements or characters not in the scene.

Apply the rendering directives:
- STYLE defines the artistic rendering approach — apply it to the entire image
- COLOR PALETTE defines the dominant color language — it overrides any colors the scene describes
- COMPOSITION defines framing, perspective, and spatial arrangement

Maintain all SPECIES and AVOID constraints absolutely.

Output 150-250 words of concrete visual direction. Write as unified artistic direction, not sections or lists.
{{globalImageRules}}
Original prompt:
{{prompt}}`;

export default function ConfigPanel({ config, onConfigChange }) {
  const handleModelChange = (newModel) => {
    onConfigChange({ imageModel: newModel });
  };

  return (
    <div>
      {/* LLM Call Configuration - per-call model and thinking settings */}
      <LLMCallConfigPanel />

      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">Image Generation</h2>
        </div>

        <div className="illuminator-form-group">
          <label className="illuminator-label">Model (OpenAI)</label>
          <select
            value={config.imageModel}
            onChange={(e) => handleModelChange(e.target.value)}
            className="illuminator-select"
          >
            {IMAGE_MODELS.map((model) => (
              <option key={model.value} value={model.value}>
                {model.label}
              </option>
            ))}
          </select>
        </div>

        <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
          Size and quality settings are in the Image Settings panel (sidebar).
        </p>
      </div>

      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">Multishot Prompting</h2>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
          Improve image generation by chaining multiple AI calls.
        </p>

        <div className="illuminator-checkbox-group" style={{ marginBottom: '12px' }}>
          <input
            type="checkbox"
            id="requireDescription"
            checked={config.requireDescription || false}
            onChange={(e) => onConfigChange({ requireDescription: e.target.checked })}
            className="illuminator-checkbox"
          />
          <label htmlFor="requireDescription">Require description before image</label>
        </div>
        <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '16px', marginLeft: '24px' }}>
          Enforces description generation before image generation. The description will be included in the image prompt.
        </p>

        <div className="illuminator-checkbox-group" style={{ marginBottom: '12px' }}>
          <input
            type="checkbox"
            id="useClaudeForImagePrompt"
            checked={config.useClaudeForImagePrompt || false}
            onChange={(e) => onConfigChange({ useClaudeForImagePrompt: e.target.checked })}
            className="illuminator-checkbox"
          />
          <label htmlFor="useClaudeForImagePrompt">Use Claude to format image prompt</label>
        </div>
        <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px', marginLeft: '24px' }}>
          Sends the image prompt through Claude first to optimize it for the image model.
        </p>

        {config.useClaudeForImagePrompt && (
          <>
            <div className="illuminator-form-group" style={{ marginLeft: '24px' }}>
              <label className="illuminator-label">Global Image Rules</label>
              <LocalTextArea
                value={config.globalImageRules || ''}
                onChange={(value) => onConfigChange({ globalImageRules: value })}
                className="illuminator-template-textarea"
                placeholder="SPECIES RULE: This world contains only [species]. Any figures depicted must be explicitly described as [species], never as humans or generic figures."
                rows={4}
              />
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Domain-specific rules injected into all image prompts. Use this to enforce species, setting constraints, or other world-specific requirements.
              </p>
            </div>
            <div className="illuminator-form-group" style={{ marginLeft: '24px' }}>
              <label className="illuminator-label">Entity image prompt template</label>
              <LocalTextArea
                value={config.claudeImagePromptTemplate || DEFAULT_IMAGE_PROMPT_TEMPLATE}
                onChange={(value) => onConfigChange({ claudeImagePromptTemplate: value })}
                className="illuminator-template-textarea"
                placeholder={DEFAULT_IMAGE_PROMPT_TEMPLATE}
              />
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Used for entity portrait images. Use {'{{modelName}}'} for the image model name, {'{{prompt}}'} for the original prompt, and {'{{globalImageRules}}'} for the global rules above.
              </p>
            </div>
            <div className="illuminator-form-group" style={{ marginLeft: '24px' }}>
              <label className="illuminator-label">Chronicle image prompt template</label>
              <LocalTextArea
                value={config.claudeChronicleImagePromptTemplate || DEFAULT_CHRONICLE_IMAGE_PROMPT_TEMPLATE}
                onChange={(value) => onConfigChange({ claudeChronicleImagePromptTemplate: value })}
                className="illuminator-template-textarea"
                placeholder={DEFAULT_CHRONICLE_IMAGE_PROMPT_TEMPLATE}
              />
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Used for chronicle cover and scene images. Use {'{{modelName}}'} for the image model name, {'{{prompt}}'} for the original prompt, and {'{{globalImageRules}}'} for the global rules above.
              </p>
            </div>
          </>
        )}
      </div>

      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">Performance</h2>
        </div>

        <div className="illuminator-form-group">
          <label className="illuminator-label">Parallel workers</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <input
              type="range"
              min="1"
              max="8"
              value={config.numWorkers || 4}
              onChange={(e) => onConfigChange({ numWorkers: parseInt(e.target.value, 10) })}
              style={{ flex: 1 }}
            />
            <span style={{ minWidth: '24px', textAlign: 'right', fontWeight: 500 }}>
              {config.numWorkers || 4}
            </span>
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Number of concurrent API calls. Higher = faster but may hit rate limits.
          </p>
        </div>
      </div>

      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">About</h2>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
          Illuminator enriches your world simulation with LLM-generated content.
          Use the <strong>Entities</strong> tab to generate descriptions and images for entities.
          Use the <strong>Chronicle</strong> tab to generate multi-entity narratives and in-world documents.
        </p>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.6, marginTop: '12px' }}>
          All enrichments are saved automatically to your current world slot.
        </p>
      </div>
    </div>
  );
}
