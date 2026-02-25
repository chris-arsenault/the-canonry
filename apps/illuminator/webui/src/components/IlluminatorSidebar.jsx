import { ImageSettingsTrigger } from "./ImageSettingsDrawer";
import { useIlluminatorModals } from "../lib/db/modalStore";

// Tabs ordered by workflow: setup -> work -> monitor -> manage
const TABS = [
  { id: "configure", label: "Configure" },
  { id: "context", label: "Context" },
  { id: "guidance", label: "Guidance" },
  { id: "identity", label: "Identity" },
  { id: "styles", label: "Styles" },
  { id: "entities", label: "Entities" },
  { id: "chronicle", label: "Chronicle" },
  { id: "coverage", label: "Coverage" },
  { id: "finaledit", label: "Final Edit" },
  { id: "pages", label: "Pages" },
  { id: "activity", label: "Activity" },
  { id: "costs", label: "Costs" },
  { id: "storage", label: "Storage" },
  { id: "traits", label: "Traits" },
  { id: "historian", label: "Historian" },
  { id: "preprint", label: "Pre-Print" },
];

function NavButton({ tab, activeTab, setActiveTab, stats }) {
  return (
    <button
      key={tab.id}
      onClick={() => setActiveTab(tab.id)}
      className={`illuminator-nav-button ${activeTab === tab.id ? "active" : ""}`}
    >
      {tab.label}
      {tab.id === "activity" && stats.running > 0 && (
        <span
          style={{
            marginLeft: "auto",
            background: "#f59e0b",
            color: "white",
            padding: "2px 6px",
            borderRadius: "10px",
            fontSize: "10px",
          }}
        >
          {stats.running}
        </span>
      )}
      {tab.id === "activity" && stats.errored > 0 && stats.running === 0 && (
        <span
          style={{
            marginLeft: "auto",
            background: "#ef4444",
            color: "white",
            padding: "2px 6px",
            borderRadius: "10px",
            fontSize: "10px",
          }}
        >
          {stats.errored}
        </span>
      )}
    </button>
  );
}

function ApiKeySection({
  showApiKeyInput, setShowApiKeyInput,
  hasRequiredKeys, anthropicApiKey, setAnthropicApiKey,
  openaiApiKey, setOpenaiApiKey, persistApiKeys, setPersistApiKeys,
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
          <p className="illuminator-api-dropdown-hint">Required for image generation.</p>
          <input
            type="password"
            value={openaiApiKey}
            onChange={(e) => setOpenaiApiKey(e.target.value)}
            placeholder="sk-..."
            className="illuminator-api-input"
          />
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginTop: "12px",
              fontSize: "12px",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={persistApiKeys}
              onChange={(e) => setPersistApiKeys(e.target.checked)}
            />
            Remember API keys (stored in browser)
          </label>
          <button
            onClick={() => setShowApiKeyInput(false)}
            className="illuminator-api-button active"
            style={{ marginTop: "12px" }}
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}

export default function IlluminatorSidebar({
  activeTab, setActiveTab, stats,
  imageGenSettings, styleLibrary,
  showApiKeyInput, setShowApiKeyInput,
  hasRequiredKeys, anthropicApiKey, setAnthropicApiKey,
  openaiApiKey, setOpenaiApiKey, persistApiKeys, setPersistApiKeys,
}) {
  return (
    <div className="illuminator-sidebar">
      <nav className="illuminator-nav">
        {TABS.map((tab) => (
          <NavButton
            key={tab.id}
            tab={tab}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            stats={stats}
          />
        ))}
      </nav>

      <div style={{ flex: 1 }} />

      {/* Image Settings trigger */}
      <div style={{ padding: "0 8px", marginBottom: "4px" }}>
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
        persistApiKeys={persistApiKeys}
        setPersistApiKeys={setPersistApiKeys}
      />
    </div>
  );
}
