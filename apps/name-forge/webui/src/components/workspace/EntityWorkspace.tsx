import React, { useState, useCallback, useMemo } from "react";
import { ErrorMessage } from "@the-canonry/shared-components";
import { DomainTab, LexemesTab, GrammarsTab, ProfileTab } from "./tabs";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface NamingConfig {
  domains?: Array<{ id: string }>;
  lexemeLists?: Record<string, unknown>;
  lexemeSpecs?: unknown[];
  grammars?: Array<{ id: string }>;
  profiles?: Array<{ id: string }>;
}

interface CultureConfig {
  name?: string;
  naming?: NamingConfig;
}

interface EntityKind {
  kind: string;
  subtypes?: Array<{ id: string }>;
}

interface WorldSchema {
  entityKinds?: EntityKind[];
  tagRegistry?: Array<{ tag: string; category: string; rarity: string; description?: string }>;
}

interface Generator {
  id: string;
}

interface EntityWorkspaceProps {
  worldSchema: WorldSchema;
  cultureId: string;
  cultureConfig: CultureConfig;
  allCultures: Record<string, CultureConfig>;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  onCultureChange?: (config: CultureConfig) => void;
  onAddTag?: (tagDef: { tag: string; category: string; rarity: string; description?: string }) => void;
  apiKey?: string;
  generators?: Generator[];
}

type TabKey = "domain" | "lexemes" | "grammars" | "profiles";

const TAB_KEYS: TabKey[] = ["domain", "lexemes", "grammars", "profiles"];

/* ------------------------------------------------------------------ */
/*  Workspace header                                                   */
/* ------------------------------------------------------------------ */

interface WorkspaceHeaderProps {
  cultureConfig: CultureConfig;
  cultureId: string;
  error: string | null;
  onDismissError: () => void;
}

function WorkspaceHeader({ cultureConfig, cultureId, error, onDismissError }: WorkspaceHeaderProps) {
  return (
    <div className="workspace-header">
      <div className="workspace-header-row">
        <div>
          <h3 className="workspace-title">
            <span className="workspace-title-name">{cultureConfig?.name || cultureId}</span>
            <span className="workspace-title-label">Culture</span>
          </h3>
        </div>
        <div className="workspace-autosave">Auto-saved</div>
      </div>

      {error && (
        <div className="flex items-center mt-sm">
          <ErrorMessage message={error} />
          <button className="secondary ml-sm" onClick={onDismissError}>
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tab bar                                                            */
/* ------------------------------------------------------------------ */

interface WorkspaceTabBarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  naming: NamingConfig;
}

function getCompletionBadge(key: TabKey, naming: NamingConfig): string {
  switch (key) {
    case "domain": {
      const count = naming.domains?.length || 0;
      return count > 0 ? `(${count})` : "";
    }
    case "lexemes": {
      const count = Object.keys(naming.lexemeLists || {}).length;
      return count > 0 ? `(${count})` : "";
    }
    case "grammars": {
      const count = naming.grammars?.length || 0;
      return count > 0 ? `(${count})` : "";
    }
    case "profiles": {
      const count = naming.profiles?.length || 0;
      return count > 0 ? `(${count})` : "";
    }
  }
}

function WorkspaceTabBar({ activeTab, onTabChange, naming }: WorkspaceTabBarProps) {
  return (
    <div className="workspace-tabs">
      {TAB_KEYS.map((tab) => (
        <button
          key={tab}
          onClick={() => onTabChange(tab)}
          className={`workspace-tab ${activeTab === tab ? "active" : ""}`}
        >
          {tab} {getCompletionBadge(tab, naming)}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

function EntityWorkspace({
  worldSchema,
  cultureId,
  cultureConfig,
  allCultures,
  activeTab = "domain",
  onTabChange,
  onCultureChange,
  onAddTag,
  apiKey,
  generators = [],
}: EntityWorkspaceProps) {
  const [error, setError] = useState<string | null>(null);

  const setActiveTab = useMemo(
    () => onTabChange || (() => {}),
    [onTabChange],
  );

  const dismissError = useCallback(() => setError(null), []);

  const handleDomainsChange = useCallback(
    (newDomains: Array<{ id: string }>) => {
      if (onCultureChange) {
        onCultureChange({
          ...cultureConfig,
          naming: {
            ...cultureConfig?.naming,
            domains: newDomains,
          },
        });
      }
    },
    [cultureConfig, onCultureChange],
  );

  const handleLexemesChange = useCallback(
    (newLexemeLists?: Record<string, unknown>, newLexemeSpecs?: unknown[], newGrammars?: Array<{ id: string }>) => {
      if (onCultureChange) {
        const naming = { ...cultureConfig?.naming };
        if (newLexemeLists !== undefined) naming.lexemeLists = newLexemeLists;
        if (newLexemeSpecs !== undefined) naming.lexemeSpecs = newLexemeSpecs;
        if (newGrammars !== undefined) naming.grammars = newGrammars;
        onCultureChange({ ...cultureConfig, naming });
      }
    },
    [cultureConfig, onCultureChange],
  );

  const handleGrammarsChange = useCallback(
    (newGrammars: Array<{ id: string }>) => {
      if (onCultureChange) {
        onCultureChange({
          ...cultureConfig,
          naming: {
            ...cultureConfig?.naming,
            grammars: newGrammars,
          },
        });
      }
    },
    [cultureConfig, onCultureChange],
  );

  const handleProfilesChange = useCallback(
    (newProfiles: Array<{ id: string }>) => {
      if (onCultureChange) {
        onCultureChange({
          ...cultureConfig,
          naming: {
            ...cultureConfig?.naming,
            profiles: newProfiles,
          },
        });
      }
    },
    [cultureConfig, onCultureChange],
  );

  if (!cultureId) {
    return (
      <div className="workspace-empty">
        <p className="text-muted">Select a culture from the sidebar to begin</p>
      </div>
    );
  }

  const naming = cultureConfig?.naming || {};

  return (
    <div className="workspace">
      <WorkspaceHeader
        cultureConfig={cultureConfig}
        cultureId={cultureId}
        error={error}
        onDismissError={dismissError}
      />

      <WorkspaceTabBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        naming={naming}
      />

      {/* Content */}
      <div className="workspace-content">
        {activeTab === "domain" && (
          <DomainTab
            key={cultureId}
            cultureId={cultureId}
            cultureConfig={cultureConfig}
            allCultures={allCultures}
            onDomainsChange={handleDomainsChange}
          />
        )}

        {activeTab === "lexemes" && (
          <LexemesTab
            key={cultureId}
            cultureId={cultureId}
            cultureConfig={cultureConfig}
            allCultures={allCultures}
            onLexemesChange={handleLexemesChange}
            apiKey={apiKey}
          />
        )}

        {activeTab === "grammars" && (
          <GrammarsTab
            key={cultureId}
            cultureId={cultureId}
            cultureConfig={cultureConfig}
            allCultures={allCultures}
            onGrammarsChange={handleGrammarsChange}
            onLexemesChange={handleLexemesChange}
          />
        )}

        {activeTab === "profiles" && (
          <ProfileTab
            key={cultureId}
            cultureId={cultureId}
            cultureConfig={cultureConfig}
            onProfilesChange={handleProfilesChange}
            worldSchema={worldSchema}
            onAddTag={onAddTag}
            generators={generators}
          />
        )}
      </div>
    </div>
  );
}

export default EntityWorkspace;
