/**
 * LLMCallConfigPanel - Per-call LLM model and thinking configuration
 *
 * Compact table-based UI for configuring model and extended thinking settings
 * for each LLM call type. Settings persist in localStorage across all projects.
 */

import React, { useState, useCallback } from "react";
import PropTypes from "prop-types";
import {
  getLLMModelSettings,
  saveLLMModelSettings,
  getCallConfig,
  resetToDefaults,
  hasOverrides,
  getOverrideCount,
} from "../lib/llmModelSettings";
import {
  LLM_CALL_METADATA,
  AVAILABLE_MODELS,
  THINKING_BUDGET_OPTIONS,
  MAX_TOKENS_OPTIONS,
  THINKING_CAPABLE_MODELS,
  CATEGORY_LABELS,
  getCallTypesByCategory,
} from "../lib/llmCallTypes";

// Compact model labels for table display
const MODEL_SHORT_LABELS = {
  "claude-opus-4-6": "Opus",
  "claude-sonnet-4-6": "Sonnet",
  "claude-haiku-4-5-20251001": "Haiku",
};

// Compact thinking budget labels
const THINKING_SHORT_LABELS = {
  0: "Off",
  4096: "4K",
  8192: "8K",
  16384: "16K",
  32768: "32K",
};

const MAX_TOKENS_SHORT_LABELS = {
  256: "256",
  512: "512",
  1024: "1K",
  2048: "2K",
  4096: "4K",
  8192: "8K",
  16384: "16K",
  32768: "32K",
  65536: "64K",
};

const STREAM_TIMEOUT_OPTIONS = [
  { value: 0, label: "Off" },
  { value: 30, label: "30s" },
  { value: 60, label: "60s" },
  { value: 120, label: "2m" },
  { value: 300, label: "5m" },
];

function CallTypeRow({ callType, config, isDefault, onUpdate, isLast }) {
  const metadata = LLM_CALL_METADATA[callType];
  const canThink = THINKING_CAPABLE_MODELS.includes(config.model);
  const supportsSamplingControls = callType === "chronicle.generation";
  const maxTokenOptions =
    metadata.defaults.maxTokens === 0 || config.maxTokens === 0
      ? [{ value: 0, label: "Auto" }, ...MAX_TOKENS_OPTIONS]
      : MAX_TOKENS_OPTIONS;

  const resolveOverride = (value, defaultValue) => (value === defaultValue ? undefined : value);

  const buildUpdatePayload = (overrides = {}) => ({
    model: resolveOverride(overrides.model ?? config.model, metadata.defaults.model),
    thinkingBudget: resolveOverride(
      overrides.thinkingBudget ?? config.thinkingBudget,
      metadata.defaults.thinkingBudget
    ),
    maxTokens: resolveOverride(
      overrides.maxTokens ?? config.maxTokens,
      metadata.defaults.maxTokens
    ),
    ...(supportsSamplingControls
      ? {
          temperature: resolveOverride(
            overrides.temperature ?? config.temperature,
            metadata.defaults.temperature
          ),
          topP: resolveOverride(overrides.topP ?? config.topP, metadata.defaults.topP),
        }
      : {}),
    streamTimeout: resolveOverride(
      overrides.streamTimeout ?? config.streamTimeout,
      metadata.defaults.streamTimeout ?? 0
    ),
    disableStreaming: resolveOverride(
      overrides.disableStreaming ?? config.disableStreaming,
      metadata.defaults.disableStreaming ?? false
    ),
    runInBrowser: resolveOverride(
      overrides.runInBrowser ?? config.runInBrowser,
      metadata.defaults.runInBrowser ?? false
    ),
  });

  const handleModelChange = (e) => {
    const newModel = e.target.value;
    const newThinkingBudget = THINKING_CAPABLE_MODELS.includes(newModel)
      ? config.thinkingBudget
      : 0;
    onUpdate(callType, buildUpdatePayload({ model: newModel, thinkingBudget: newThinkingBudget }));
  };

  const handleThinkingChange = (e) => {
    const newBudget = parseInt(e.target.value, 10);
    onUpdate(callType, buildUpdatePayload({ thinkingBudget: newBudget }));
  };

  const handleMaxTokensChange = (e) => {
    const newMaxTokens = parseInt(e.target.value, 10);
    onUpdate(callType, buildUpdatePayload({ maxTokens: newMaxTokens }));
  };

  const handleTemperatureChange = (e) => {
    const newTemperature = parseFloat(e.target.value);
    if (Number.isNaN(newTemperature)) return;
    onUpdate(callType, buildUpdatePayload({ temperature: newTemperature }));
  };

  // Low sampling toggle: checked = 0.95, unchecked = 1.0
  const handleLowSamplingToggle = (e) => {
    const newTopP = e.target.checked ? 0.95 : 1.0;
    onUpdate(callType, buildUpdatePayload({ topP: newTopP }));
  };

  const handleTimeoutChange = (e) => {
    const newTimeout = parseInt(e.target.value, 10);
    onUpdate(callType, buildUpdatePayload({ streamTimeout: newTimeout }));
  };

  const handleSyncToggle = (e) => {
    onUpdate(callType, buildUpdatePayload({ disableStreaming: e.target.checked }));
  };

  const handleBrowserToggle = (e) => {
    onUpdate(callType, buildUpdatePayload({ runInBrowser: e.target.checked }));
  };

  const handleReset = () => {
    onUpdate(callType, {});
  };

  return (
    <tr className={`llm-table-row ${isLast ? "llm-table-row-last" : ""}`}>
      <td className="llm-table-cell llm-table-cell-label" title={metadata.description}>
        <span className="llm-table-label-text">{metadata.label}</span>
        {!isDefault && <span className="llm-table-modified-dot" title="Modified from default" />}
      </td>
      <td className="llm-table-cell llm-table-cell-model">
        <select value={config.model} onChange={handleModelChange} className="llm-table-select">
          {AVAILABLE_MODELS.map((m) => (
            <option key={m.value} value={m.value}>
              {MODEL_SHORT_LABELS[m.value] || m.label}
              {m.value === metadata.defaults.model ? "*" : ""}
            </option>
          ))}
        </select>
      </td>
      <td className="llm-table-cell llm-table-cell-thinking">
        <select
          value={config.thinkingBudget}
          onChange={handleThinkingChange}
          disabled={!canThink}
          className="llm-table-select"
          title={canThink ? "Extended thinking budget" : "Haiku does not support thinking"}
        >
          {THINKING_BUDGET_OPTIONS.map((b) => (
            <option key={b.value} value={b.value}>
              {THINKING_SHORT_LABELS[b.value] || b.label}
              {b.value === metadata.defaults.thinkingBudget ? "*" : ""}
            </option>
          ))}
        </select>
      </td>
      <td className="llm-table-cell llm-table-cell-temp">
        {supportsSamplingControls ? (
          <input
            type="number"
            min="0"
            max="2"
            step="0.05"
            value={config.temperature ?? metadata.defaults.temperature ?? ""}
            onChange={handleTemperatureChange}
            className="llm-table-input"
            title="Temperature used when thinking is disabled"
          />
        ) : (
          <span className="llm-table-cell-placeholder">—</span>
        )}
      </td>
      <td className="llm-table-cell llm-table-cell-top-p">
        {supportsSamplingControls ? (
          <label
            className="llm-table-checkbox-label"
            title="Low sampling uses top_p=0.95 (when thinking enabled). Unchecked uses top_p=1.0."
          >
            <input
              type="checkbox"
              checked={(config.topP ?? metadata.defaults.topP) <= 0.95}
              onChange={handleLowSamplingToggle}
              className="llm-table-checkbox"
            />
            <span className="llm-table-checkbox-text">Low</span>
          </label>
        ) : (
          <span className="llm-table-cell-placeholder">—</span>
        )}
      </td>
      <td className="llm-table-cell llm-table-cell-max">
        <select
          value={config.maxTokens}
          onChange={handleMaxTokensChange}
          className="llm-table-select"
          title="Max tokens before thinking budget"
        >
          {maxTokenOptions.map((b) => (
            <option key={b.value} value={b.value}>
              {MAX_TOKENS_SHORT_LABELS[b.value] || b.label}
              {b.value === metadata.defaults.maxTokens ? "*" : ""}
            </option>
          ))}
        </select>
      </td>
      <td className="llm-table-cell llm-table-cell-timeout">
        <select
          value={config.streamTimeout}
          onChange={handleTimeoutChange}
          disabled={config.disableStreaming}
          className="llm-table-select"
          title={
            config.disableStreaming
              ? "Timeout disabled in sync mode"
              : "SSE read timeout — abort if no data received within this period"
          }
        >
          {STREAM_TIMEOUT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
              {o.value === (metadata.defaults.streamTimeout ?? 0) ? "*" : ""}
            </option>
          ))}
        </select>
      </td>
      <td className="llm-table-cell llm-table-cell-sync">
        <label
          className="llm-table-checkbox-label"
          title="Get full response at once instead of streaming. No live thinking/text output, but avoids SSE stall issues."
        >
          <input
            type="checkbox"
            checked={config.disableStreaming}
            onChange={handleSyncToggle}
            className="llm-table-checkbox"
          />
        </label>
      </td>
      <td className="llm-table-cell llm-table-cell-browser">
        <label
          className="llm-table-checkbox-label"
          title="Run in browser main thread instead of service worker. Work won't survive page reload, but avoids service worker lifecycle issues."
        >
          <input
            type="checkbox"
            checked={config.runInBrowser}
            onChange={handleBrowserToggle}
            className="llm-table-checkbox"
          />
        </label>
      </td>
      <td className="llm-table-cell llm-table-cell-action">
        {!isDefault && (
          <button onClick={handleReset} className="llm-table-reset-btn" title="Reset to default">
            ×
          </button>
        )}
      </td>
    </tr>
  );
}

CallTypeRow.propTypes = {
  callType: PropTypes.string,
  config: PropTypes.object,
  isDefault: PropTypes.bool,
  onUpdate: PropTypes.func,
  isLast: PropTypes.bool,
};

function CategoryHeader({ category }) {
  return (
    <tr className="llm-table-category-row">
      <td colSpan={10} className="llm-table-category-cell">
        {CATEGORY_LABELS[category]}
      </td>
    </tr>
  );
}

CategoryHeader.propTypes = {
  category: PropTypes.string,
};

export default function LLMCallConfigPanel() {
  const [settings, setSettings] = useState(() => getLLMModelSettings());
  const [, forceUpdate] = useState(0);

  const overrideCount = getOverrideCount();
  const callTypesByCategory = getCallTypesByCategory();

  const handleUpdate = useCallback(
    (callType, config) => {
      const next = {
        ...settings,
        callOverrides: {
          ...settings.callOverrides,
        },
      };

      if (
        !config.model &&
        config.thinkingBudget === undefined &&
        config.maxTokens === undefined &&
        config.streamTimeout === undefined &&
        config.disableStreaming === undefined &&
        config.runInBrowser === undefined
      ) {
        delete next.callOverrides[callType];
      } else {
        next.callOverrides[callType] = config;
      }

      setSettings(next);
      saveLLMModelSettings(next);
      forceUpdate((n) => n + 1);
    },
    [settings]
  );

  const handleResetAll = useCallback(() => {
    resetToDefaults();
    setSettings(getLLMModelSettings());
    forceUpdate((n) => n + 1);
  }, []);

  const categories = [
    "description",
    "perspective",
    "chronicle",
    "image",
    "palette",
    "dynamics",
    "revision",
    "historian",
  ];

  return (
    <div className="illuminator-card llm-config-panel">
      <div className="llm-config-header">
        <div className="llm-config-title-row">
          <h2 className="illuminator-card-title">LLM Call Configuration</h2>
          {overrideCount > 0 && (
            <span className="llm-config-override-count">{overrideCount} modified</span>
          )}
        </div>
        <div className="llm-config-actions">
          {overrideCount > 0 && (
            <button onClick={handleResetAll} className="llm-config-reset-all">
              Reset All
            </button>
          )}
        </div>
      </div>

      <div className="llm-table-container">
        <table className="llm-table">
          <thead>
            <tr className="llm-table-header">
              <th className="llm-table-th llm-table-th-label">Call Type</th>
              <th className="llm-table-th llm-table-th-model">Model</th>
              <th className="llm-table-th llm-table-th-thinking">Thinking</th>
              <th className="llm-table-th llm-table-th-temp">Temp</th>
              <th className="llm-table-th llm-table-th-top-p">Low P</th>
              <th className="llm-table-th llm-table-th-max">Max Tokens</th>
              <th className="llm-table-th llm-table-th-timeout">Timeout</th>
              <th className="llm-table-th llm-table-th-sync">No Stream</th>
              <th className="llm-table-th llm-table-th-browser">Browser</th>
              <th className="llm-table-th llm-table-th-action"></th>
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => {
              const callTypes = callTypesByCategory[category];
              return [
                <CategoryHeader key={`cat-${category}`} category={category} />,
                ...callTypes.map((callType, idx) => {
                  const resolved = getCallConfig(callType);
                  const isDefault = !hasOverrides(callType);
                  return (
                    <CallTypeRow
                      key={callType}
                      callType={callType}
                      config={resolved}
                      isDefault={isDefault}
                      onUpdate={handleUpdate}
                      isLast={idx === callTypes.length - 1}
                    />
                  );
                }),
              ];
            })}
          </tbody>
        </table>
      </div>

      <div className="llm-config-footer">
        <span className="llm-config-hint">* = default</span>
        <span className="llm-config-hint">Hover call type for description</span>
      </div>
    </div>
  );
}
