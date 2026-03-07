/**
 * ConfigPanel - Model and API configuration
 *
 * Contains settings for:
 * - LLM call configuration (per-call model and thinking settings)
 * - Image model, size, and quality options
 * - Multishot prompting options
 * - Performance settings
 */

import LLMCallConfigPanel from "./LLMCallConfigPanel";
import { LocalTextArea } from "@the-canonry/shared-components";
import { IMAGE_MODELS } from "../lib/imageSettings";
import "./ConfigPanel.css";
import React, { useState } from "react";
import PropTypes from "prop-types";

const MODEL_INFO = {
  "gpt-image-1.5": {
    cost: "~$0.02\u2013$0.19 per image (token-based, varies by quality)",
    strengths: "Latest OpenAI model. Excellent text rendering in images, strong prompt adherence, fast generation. Best at combining text and visuals in a single image.",
    usages: "Marketing materials with text overlays, diagrams, infographics, UI mockups, any image that needs readable embedded text.",
    drawbacks: "Token-based pricing can be unpredictable for complex prompts. Tends toward a polished, commercial aesthetic that can feel generic for artistic work.",
  },
  "gpt-image-1": {
    cost: "~$0.02\u2013$0.17 per image (token-based, varies by quality)",
    strengths: "Strong photorealism, accurate text rendering, good prompt following. First OpenAI model with native transparency support.",
    usages: "Photorealistic scenes, product shots, portraits, images with text. Good all-rounder for most use cases.",
    drawbacks: "Slower than 1.5 for similar quality. Can over-smooth textures. Artistic styles sometimes feel derivative rather than distinctive.",
  },
  "dall-e-3": {
    cost: "$0.04\u2013$0.12 per image (fixed, by size and quality)",
    strengths: "Predictable fixed pricing. Reliable composition and scene understanding. Automatically rewrites prompts for better results (revised_prompt). Well-tested and stable.",
    usages: "Concept art, illustrations, scene compositions, character portraits. Good default choice when cost predictability matters.",
    drawbacks: "Cannot render legible text in images. Lower detail ceiling than GPT Image models. 1024\u20131792px max. Prompt rewriting can sometimes diverge from intent.",
  },
  "dall-e-2": {
    cost: "$0.016\u2013$0.02 per image (cheapest option)",
    strengths: "Very cheap. Fast generation. Good for quick iteration and bulk generation where quality is secondary.",
    usages: "Rapid prototyping, placeholder images, bulk generation, texture exploration. Budget-conscious workflows.",
    drawbacks: "Noticeably lower quality than all other options. Poor anatomy, inconsistent style, limited prompt understanding. 1024px max.",
  },
  "wavespeed-ai/flux-2-pro/text-to-image": {
    cost: "~$0.03 per image",
    strengths: "Studio-quality output without parameter tuning. Strong text rendering, excellent batch consistency, handles complex multi-subject prompts well. Zero cold starts, fast inference.",
    usages: "Production pipelines, high-volume generation with brand rules, web and print content, scenes with multiple subjects, any workflow needing reliable repeatability.",
    drawbacks: "Max 1536px resolution \u2014 lower ceiling than 4K-capable models. Less photorealistic than Seedream or Qwen for portrait work. Style leans toward digital illustration over photography.",
  },
  "wavespeed-ai/qwen-image-2.0-pro/text-to-image": {
    cost: "~$0.07 per image",
    strengths: "Excellent prompt adherence for complex, multi-element requests. Enhanced detail rendering \u2014 textures, skin tones, fabric. Built-in prompt enhancer. Strong with intricate character art and photorealistic portraits.",
    usages: "Detailed character portraits, fashion/beauty visualization, high-end branded content, any scene with many specific visual requirements.",
    drawbacks: "Higher cost than most WaveSpeed models. Async API adds latency (poll-based). Max 2048px resolution. Style can lean heavily photorealistic \u2014 less suited to stylized or abstract work.",
  },
  "google/nano-banana-pro/text-to-image": {
    cost: "~$0.14 per image (1\u20132K), ~$0.24 per image (4K)",
    strengths: "Multilingual text rendering with auto-translation. Consistent character and style across multiple generations. Camera-style controls for photographic results. Up to 4K resolution.",
    usages: "Multilingual content, character consistency across a series, high-res print work, scenes needing photographic lighting control.",
    drawbacks: "Most expensive option in the lineup. Async API latency. Originally optimized for mobile \u2014 some desktop compositions feel constrained.",
  },
  "bytedance/seedream-v5.0-lite": {
    cost: "~$0.035 per image",
    strengths: "Strong photorealism with camera and lighting references. Excellent text/typography rendering for posters and brand visuals. Supports up to 4K. Fast for its quality level.",
    usages: "Social media content, marketing campaigns, e-commerce product visuals, poster/brand design, photography-style rendering.",
    drawbacks: "\"Lite\" variant trades some detail for speed vs full Seedream. Async API latency. Can over-saturate colors in stylized prompts.",
  },
  "alibaba/wan-2.6/text-to-image": {
    cost: "~$0.03 per image",
    strengths: "Very affordable. Strong visual consistency. Good prompt adherence. Part of a multi-modal suite (also does video) so style transfers well if using WAN for both.",
    usages: "Bulk image generation, consistent style across large sets, budget-friendly production work, concept exploration.",
    drawbacks: "768\u20131440px resolution range is lower than competitors. Less detail in complex scenes. Fewer artistic style controls than specialized models.",
  },
  "kwaivgi/kling-image-o3/text-to-image": {
    cost: "~$0.028 per image (1\u20132K), ~$0.056 per image (4K)",
    strengths: "Strong detail and composition at high resolution. Natural lighting. Good value at 1\u20132K resolution. Up to 4K output. Built-in prompt enhancer.",
    usages: "Landscape and environment art, architectural visualization, scenes needing natural lighting, high-res output at moderate cost.",
    drawbacks: "Less tested for character/portrait work than Qwen or Seedream. Async API latency. Style range narrower than multi-purpose models.",
  },
};

function ModelGuide() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="cfgp-model-guide">
      <button
        onClick={() => setExpanded(!expanded)}
        className="cfgp-model-guide-toggle"
      >
        <span className="cfgp-model-guide-chevron" data-expanded={String(expanded)}>&#9654;</span>
        Model comparison guide
      </button>
      {expanded && (
        <div className="cfgp-model-guide-content">
          {IMAGE_MODELS.map((model) => {
            const info = MODEL_INFO[model.value];
            if (!info) return null;
            return (
              <div key={model.value} className="cfgp-model-entry">
                <div className="cfgp-model-entry-header">
                  <span className="cfgp-model-entry-name">{model.label}</span>
                  <span className="cfgp-model-entry-provider">{model.provider}</span>
                </div>
                <div className="cfgp-model-entry-cost">{info.cost}</div>
                <div className="cfgp-model-entry-rows">
                  <div className="cfgp-model-row">
                    <span className="cfgp-model-row-label">Strengths</span>
                    <span className="cfgp-model-row-text">{info.strengths}</span>
                  </div>
                  <div className="cfgp-model-row">
                    <span className="cfgp-model-row-label">Best for</span>
                    <span className="cfgp-model-row-text">{info.usages}</span>
                  </div>
                  <div className="cfgp-model-row">
                    <span className="cfgp-model-row-label">Drawbacks</span>
                    <span className="cfgp-model-row-text">{info.drawbacks}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

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
          <label htmlFor="model-image" className="illuminator-label">Image Model</label>
          <select id="model-image"
            value={config.imageModel}
            onChange={(e) => handleModelChange(e.target.value)}
            className="illuminator-select"
          >
            <optgroup label="OpenAI">
              {IMAGE_MODELS.filter(m => m.provider === "openai").map((model) => (
                <option key={model.value} value={model.value}>
                  {model.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="WaveSpeed">
              {IMAGE_MODELS.filter(m => m.provider === "wavespeed").map((model) => (
                <option key={model.value} value={model.value}>
                  {model.label}
                </option>
              ))}
            </optgroup>
          </select>
        </div>

        <ModelGuide />

        <p className="ilu-hint-sm cfgp-hint">
          Size and quality settings are in the Image Settings panel (sidebar).
        </p>
      </div>

      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">Multishot Prompting</h2>
        </div>
        <p className="ilu-hint cfgp-section-desc">Improve image generation by chaining multiple AI calls.</p>

        <div className="illuminator-checkbox-group cfgp-checkbox-spacer">
          <input
            type="checkbox"
            id="requireDescription"
            checked={config.requireDescription || false}
            onChange={(e) => onConfigChange({ requireDescription: e.target.checked })}
            className="illuminator-checkbox"
          />
          <label htmlFor="requireDescription">Require description before image</label>
        </div>
        <p className="ilu-hint-sm cfgp-checkbox-hint">
          Enforces description generation before image generation. The description will be included
          in the image prompt.
        </p>

        <div className="illuminator-checkbox-group cfgp-checkbox-spacer">
          <input
            type="checkbox"
            id="useClaudeForImagePrompt"
            checked={config.useClaudeForImagePrompt || false}
            onChange={(e) => onConfigChange({ useClaudeForImagePrompt: e.target.checked })}
            className="illuminator-checkbox"
          />
          <label htmlFor="useClaudeForImagePrompt">Use Claude to format image prompt</label>
        </div>
        <p className="ilu-hint-sm cfgp-checkbox-hint-tight">
          Sends the image prompt through Claude first to optimize it for the image model.
        </p>

        {config.useClaudeForImagePrompt && (
          <>
            <div className="illuminator-form-group cfgp-indented-group">
              <label className="illuminator-label">Global Image Rules
              <LocalTextArea
                value={config.globalImageRules || ""}
                onChange={(value) => onConfigChange({ globalImageRules: value })}
                className="illuminator-template-textarea"
                placeholder="SPECIES RULE: This world contains only [species]. Any figures depicted must be explicitly described as [species], never as humans or generic figures."
                rows={4}
              />
              </label>
              <p className="ilu-hint-sm cfgp-hint">
                Domain-specific rules injected into all image prompts. Use this to enforce species,
                setting constraints, or other world-specific requirements.
              </p>
            </div>
            <div className="illuminator-form-group cfgp-indented-group">
              <label className="illuminator-label">Entity image prompt template
              <LocalTextArea
                value={config.claudeImagePromptTemplate || DEFAULT_IMAGE_PROMPT_TEMPLATE}
                onChange={(value) => onConfigChange({ claudeImagePromptTemplate: value })}
                className="illuminator-template-textarea"
                placeholder={DEFAULT_IMAGE_PROMPT_TEMPLATE}
              />
              </label>
              <p className="ilu-hint-sm cfgp-hint">
                Used for entity portrait images. Use {"{{modelName}}"} for the image model name,{" "}
                {"{{prompt}}"} for the original prompt, and {"{{globalImageRules}}"} for the global
                rules above.
              </p>
            </div>
            <div className="illuminator-form-group cfgp-indented-group">
              <label className="illuminator-label">Chronicle image prompt template
              <LocalTextArea
                value={
                  config.claudeChronicleImagePromptTemplate ||
                  DEFAULT_CHRONICLE_IMAGE_PROMPT_TEMPLATE
                }
                onChange={(value) => onConfigChange({ claudeChronicleImagePromptTemplate: value })}
                className="illuminator-template-textarea"
                placeholder={DEFAULT_CHRONICLE_IMAGE_PROMPT_TEMPLATE}
              />
              </label>
              <p className="ilu-hint-sm cfgp-hint">
                Used for chronicle cover and scene images. Use {"{{modelName}}"} for the image model
                name, {"{{prompt}}"} for the original prompt, and {"{{globalImageRules}}"} for the
                global rules above.
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
          <span className="illuminator-label">Parallel workers</span>
          <div className="cfgp-workers-row">
            <input
              type="range"
              min="1"
              max="8"
              value={config.numWorkers || 4}
              onChange={(e) => onConfigChange({ numWorkers: parseInt(e.target.value, 10) })}
              className="cfgp-range-input"
            />
            <span className="cfgp-worker-count">{config.numWorkers || 4}</span>
          </div>
          <p className="ilu-hint-sm cfgp-hint">
            Number of concurrent API calls. Higher = faster but may hit rate limits.
          </p>
        </div>
      </div>

      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">About</h2>
        </div>
        <p className="ilu-hint cfgp-about-text">
          Illuminator enriches your world simulation with LLM-generated content. Use the{" "}
          <strong>Entities</strong> tab to generate descriptions and images for entities. Use the{" "}
          <strong>Chronicle</strong> tab to generate multi-entity narratives and in-world documents.
        </p>
        <p className="ilu-hint cfgp-about-text-spaced">
          All enrichments are saved automatically to your current world slot.
        </p>
      </div>
    </div>
  );
}

ConfigPanel.propTypes = {
  config: PropTypes.object,
  onConfigChange: PropTypes.func,
};
