import { ImageSettingsTrigger } from "./ImageSettingsDrawer";
import { useIlluminatorModals } from "../lib/db/modalStore";
import PropTypes from "prop-types";
import "./IlluminatorSidebar.css";
import React, { useState, useCallback } from "react";

const STORAGE_KEY = "illuminator:nav:collapsed";

const NAV_GROUPS = [
  {
    id: "setup",
    label: "Setup",
    tabs: [
      { id: "configure", label: "Configure" },
      { id: "context", label: "Context" },
      { id: "guidance", label: "Guidance" },
      { id: "identity", label: "Identity" },
      { id: "styles", label: "Styles" },
      { id: "historian", label: "Historian" },
    ],
  },
  {
    id: "content",
    label: "Content",
    tabs: [
      { id: "entities", label: "Entities" },
      { id: "chronicle", label: "Chronicle" },
      { id: "traits", label: "Traits" },
    ],
  },
  {
    id: "curation",
    label: "Curation",
    tabs: [
      { id: "curation", label: "Chronicle Images" },
      { id: "entitycuration", label: "Entity Images" },
      { id: "coverage", label: "Coverage" },
    ],
  },
  {
    id: "publish",
    label: "Publish",
    tabs: [
      { id: "finaledit", label: "Final Edit" },
      { id: "pages", label: "Pages" },
      { id: "preprint", label: "Pre-Print" },
      { id: "catalog", label: "Catalog" },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    tabs: [
      { id: "bulkactions", label: "Bulk Actions" },
      { id: "activity", label: "Activity" },
      { id: "costs", label: "Costs" },
      { id: "storage", label: "Storage" },
      { id: "testimage", label: "Test Image" },
    ],
  },
];

function loadCollapsed() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function NavButton({ tab, activeTab, setActiveTab, stats }) {
  return (
    <button
      onClick={() => setActiveTab(tab.id)}
      className={`illuminator-nav-button ${activeTab === tab.id ? "active" : ""}`}
    >
      {tab.label}
      {tab.id === "activity" && stats.running > 0 && (
        <span className="isb-badge isb-badge-running">{stats.running}</span>
      )}
      {tab.id === "activity" && stats.errored > 0 && stats.running === 0 && (
        <span className="isb-badge isb-badge-errored">{stats.errored}</span>
      )}
    </button>
  );
}

function NavGroup({ group, activeTab, setActiveTab, stats, collapsed, onToggle }) {
  const containsActive = group.tabs.some((t) => t.id === activeTab);
  const isOpen = containsActive || !collapsed;

  return (
    <div className="isb-group">
      <button
        className={`isb-group-header ${containsActive ? "isb-group-active" : ""}`}
        onClick={onToggle}
        title={isOpen ? "Collapse" : "Expand"}
      >
        <span className={`isb-group-arrow ${isOpen ? "isb-group-arrow-open" : ""}`}>&#9656;</span>
        {group.label}
      </button>
      {isOpen && (
        <div className="isb-group-items">
          {group.tabs.map((tab) => (
            <NavButton key={tab.id} tab={tab} activeTab={activeTab} setActiveTab={setActiveTab} stats={stats} />
          ))}
        </div>
      )}
    </div>
  );
}

function ApiKeySection({
  showApiKeyInput,
  setShowApiKeyInput,
  hasRequiredKeys,
  anthropicApiKey,
  setAnthropicApiKey,
  openaiApiKey,
  setOpenaiApiKey,
  wavespeedApiKey,
  setWavespeedApiKey,
  bflApiKey,
  setBflApiKey,
  falApiKey,
  setFalApiKey,
  persistApiKeys,
  setPersistApiKeys,
}) {
  return (
    <div className="illuminator-api-section">
      <button
        onClick={() => setShowApiKeyInput(!showApiKeyInput)}
        className={`illuminator-api-button ${hasRequiredKeys ? "active" : ""}`}
      >
        {hasRequiredKeys ? "API Keys Set" : "Set API Keys"}
      </button>
      {showApiKeyInput && (
        <div className="illuminator-api-dropdown">
          <div className="illuminator-api-dropdown-title">Anthropic API Key</div>
          <p className="illuminator-api-dropdown-hint">Required for text enrichment.</p>
          <input
            type="password"
            value={anthropicApiKey}
            onChange={(e) => setAnthropicApiKey(e.target.value)}
            placeholder="sk-ant-..."
            className="illuminator-api-input"
          />
          <div className="illuminator-api-dropdown-title">OpenAI API Key</div>
          <p className="illuminator-api-dropdown-hint">Required for OpenAI image models.</p>
          <input
            type="password"
            value={openaiApiKey}
            onChange={(e) => setOpenaiApiKey(e.target.value)}
            placeholder="sk-..."
            className="illuminator-api-input"
          />
          <div className="illuminator-api-dropdown-title">BFL API Key</div>
          <p className="illuminator-api-dropdown-hint">Required for Flux image models (Black Forest Labs).</p>
          <input
            type="password"
            value={bflApiKey}
            onChange={(e) => setBflApiKey(e.target.value)}
            placeholder="bfl-..."
            className="illuminator-api-input"
          />
          <div className="illuminator-api-dropdown-title">WaveSpeed API Key</div>
          <p className="illuminator-api-dropdown-hint">Required for WaveSpeed image models (Qwen, Recraft, etc.).</p>
          <input
            type="password"
            value={wavespeedApiKey}
            onChange={(e) => setWavespeedApiKey(e.target.value)}
            placeholder="ws-..."
            className="illuminator-api-input"
          />
          <div className="illuminator-api-dropdown-title">FAL API Key</div>
          <p className="illuminator-api-dropdown-hint">Required for fal.ai upscale models (Clarity, Creative, Topaz).</p>
          <input
            type="password"
            value={falApiKey}
            onChange={(e) => setFalApiKey(e.target.value)}
            placeholder="fal-..."
            className="illuminator-api-input"
          />
          <label className="isb-persist-label">
            <input
              type="checkbox"
              checked={persistApiKeys}
              onChange={(e) => setPersistApiKeys(e.target.checked)}
            />
            Remember API keys (stored in browser)
          </label>
          <button
            onClick={() => setShowApiKeyInput(false)}
            className="illuminator-api-button active isb-done-button"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}

export default function IlluminatorSidebar({
  activeTab,
  setActiveTab,
  stats,
  imageGenSettings,
  styleLibrary,
  showApiKeyInput,
  setShowApiKeyInput,
  hasRequiredKeys,
  anthropicApiKey,
  setAnthropicApiKey,
  openaiApiKey,
  setOpenaiApiKey,
  wavespeedApiKey,
  setWavespeedApiKey,
  bflApiKey,
  setBflApiKey,
  falApiKey,
  setFalApiKey,
  persistApiKeys,
  setPersistApiKeys,
}) {
  const [collapsedGroups, setCollapsedGroups] = useState(loadCollapsed);

  const toggleGroup = useCallback((groupId) => {
    setCollapsedGroups((prev) => {
      const next = prev.includes(groupId) ? prev.filter((g) => g !== groupId) : [...prev, groupId];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return (
    <div className="illuminator-sidebar">
      <nav className="illuminator-nav">
        {NAV_GROUPS.map((group) => (
          <NavGroup
            key={group.id}
            group={group}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            stats={stats}
            collapsed={collapsedGroups.includes(group.id)}
            onToggle={() => toggleGroup(group.id)}
          />
        ))}
      </nav>

      <div className="isb-spacer" />

      {/* Image Settings trigger */}
      <div className="isb-image-settings">
        <ImageSettingsTrigger
          settings={imageGenSettings}
          styleLibrary={styleLibrary}
          onClick={() => useIlluminatorModals.getState().openImageSettings()}
        />
      </div>

      {/* API Key section */}
      <ApiKeySection
        showApiKeyInput={showApiKeyInput}
        setShowApiKeyInput={setShowApiKeyInput}
        hasRequiredKeys={hasRequiredKeys}
        anthropicApiKey={anthropicApiKey}
        setAnthropicApiKey={setAnthropicApiKey}
        openaiApiKey={openaiApiKey}
        setOpenaiApiKey={setOpenaiApiKey}
        wavespeedApiKey={wavespeedApiKey}
        setWavespeedApiKey={setWavespeedApiKey}
        bflApiKey={bflApiKey}
        setBflApiKey={setBflApiKey}
        falApiKey={falApiKey}
        setFalApiKey={setFalApiKey}
        persistApiKeys={persistApiKeys}
        setPersistApiKeys={setPersistApiKeys}
      />
    </div>
  );
}

NavButton.propTypes = {
  tab: PropTypes.object.isRequired,
  activeTab: PropTypes.string.isRequired,
  setActiveTab: PropTypes.func.isRequired,
  stats: PropTypes.object.isRequired,
};

NavGroup.propTypes = {
  group: PropTypes.object.isRequired,
  activeTab: PropTypes.string.isRequired,
  setActiveTab: PropTypes.func.isRequired,
  stats: PropTypes.object.isRequired,
  collapsed: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
};

ApiKeySection.propTypes = {
  showApiKeyInput: PropTypes.bool,
  setShowApiKeyInput: PropTypes.func.isRequired,
  hasRequiredKeys: PropTypes.bool,
  anthropicApiKey: PropTypes.string,
  setAnthropicApiKey: PropTypes.func.isRequired,
  openaiApiKey: PropTypes.string,
  setOpenaiApiKey: PropTypes.func.isRequired,
  wavespeedApiKey: PropTypes.string,
  setWavespeedApiKey: PropTypes.func.isRequired,
  bflApiKey: PropTypes.string,
  setBflApiKey: PropTypes.func.isRequired,
  falApiKey: PropTypes.string,
  setFalApiKey: PropTypes.func.isRequired,
  persistApiKeys: PropTypes.bool,
  setPersistApiKeys: PropTypes.func.isRequired,
};

IlluminatorSidebar.propTypes = {
  activeTab: PropTypes.string.isRequired,
  setActiveTab: PropTypes.func.isRequired,
  stats: PropTypes.object,
  imageGenSettings: PropTypes.object,
  styleLibrary: PropTypes.object,
  showApiKeyInput: PropTypes.bool,
  setShowApiKeyInput: PropTypes.func.isRequired,
  hasRequiredKeys: PropTypes.bool,
  anthropicApiKey: PropTypes.string,
  setAnthropicApiKey: PropTypes.func.isRequired,
  openaiApiKey: PropTypes.string,
  setOpenaiApiKey: PropTypes.func.isRequired,
  wavespeedApiKey: PropTypes.string,
  setWavespeedApiKey: PropTypes.func.isRequired,
  bflApiKey: PropTypes.string,
  setBflApiKey: PropTypes.func.isRequired,
  falApiKey: PropTypes.string,
  setFalApiKey: PropTypes.func.isRequired,
  persistApiKeys: PropTypes.bool,
  setPersistApiKeys: PropTypes.func.isRequired,
};
