/**
 * EntityRenameModal - Three-phase entity rename with full propagation
 *
 * Phase 1: Name input (roll from name-forge or free text)
 * Phase 2: Preview — collapsible accordion grouped by source (entity/chronicle).
 *          Each source shows all its matches together so the user can reason
 *          about one entity or chronicle at a time.
 * Phase 3: Apply changes
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useEntityNavList } from "../lib/db/entitySelectors";
import * as entityRepo from "../lib/db/entityRepository";
import { useRelationships } from "../lib/db/relationshipSelectors";
import { useNarrativeEvents } from "../lib/db/narrativeEventSelectors";
import { generate } from "name-forge";
import { toCulture } from "../lib/chronicle/nameBank";
import {
  scanForReferences,
  buildRenamePatches,
  applyChroniclePatches,
  adjustReplacementForGrammar,
  type RenameMatch,
  type MatchDecision,
  type RenameScanResult,
  type EntityPatch,
  type EventPatch,
} from "../lib/entityRename";
import {
  getChroniclesForSimulation,
  getChronicle,
  putChronicle,
} from "../lib/db/chronicleRepository";
import type { CultureDefinition } from "@canonry/world-schema";
import "./EntityRenameModal.css";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Entity {
  id: string;
  name: string;
  kind: string;
  subtype?: string;
  culture?: string;
  summary?: string;
  description?: string;
  enrichment?: {
    descriptionHistory?: Array<{
      description: string;
      replacedAt: number;
      source: string;
    }>;
  };
}

interface Relationship {
  kind: string;
  src: string;
  dst: string;
  status?: string;
}

type ModalMode = "rename" | "patch";

interface EntityRenameModalProps {
  entityId: string;
  cultures: CultureDefinition[];
  simulationRunId: string;
  /** 'rename' = full rename flow, 'patch' = repair stale names in events */
  mode?: ModalMode;
  onApply: (manifest: {
    entityPatches: EntityPatch[];
    eventPatches: EventPatch[];
    targetEntityId: string | null;
    newName: string;
    addOldNameAsAlias?: boolean;
  }) => void;
  onClose: () => void;
}

type Phase = "input" | "scanning" | "preview" | "applying" | "done";

type DecisionAction = "accept" | "reject" | "edit";

interface DecisionState {
  action: DecisionAction;
  editText: string;
}

/** A source entity or chronicle with all its matches grouped together. */
interface SourceGroup {
  sourceId: string;
  sourceName: string;
  sourceType: "entity" | "chronicle" | "event";
  /** True for the entity being renamed */
  isSelf: boolean;
  /** Contextual label: "related", "general", "cast", etc. */
  tier: string;
  /** Actionable matches (full, partial, metadata) */
  matches: RenameMatch[];
  /** Non-actionable FK references */
  connections: RenameMatch[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TYPE_COLORS: Record<string, string> = {
  full: "#22c55e",
  partial: "#f59e0b",
  metadata: "#6366f1",
  id_slug: "#06b6d4",
};
const TYPE_LABELS: Record<string, string> = {
  full: "full",
  partial: "partial",
  metadata: "meta",
  id_slug: "connection",
};

// ---------------------------------------------------------------------------
// Match Row — actionable match with diff + accept/reject/edit
// ---------------------------------------------------------------------------

function MatchRow({
  match,
  decision,
  newName,
  onChangeAction,
  onChangeEditText,
}: Readonly<{
  match: RenameMatch;
  decision: DecisionState;
  newName: string;
  onChangeAction: (action: DecisionAction) => void;
  onChangeEditText: (text: string) => void;
}>) {
  const rawReplacementText = decision.action === "edit" ? decision.editText : newName;

  // Compute grammar-adjusted replacement for preview (text matches only)
  const preview = useMemo(() => {
    if (
      decision.action === "reject" ||
      decision.action === "edit" ||
      match.matchType === "metadata"
    ) {
      return {
        ctxBefore: match.contextBefore,
        strikethrough: match.matchedText,
        replacement: rawReplacementText,
        ctxAfter: match.contextAfter,
      };
    }
    const adjusted = adjustReplacementForGrammar(
      match.contextBefore,
      match.contextAfter,
      match.position,
      match.matchedText,
      rawReplacementText
    );

    const absorbedBefore = match.position - adjusted.position;
    const absorbedAfter = adjusted.originalLength - match.matchedText.length - absorbedBefore;

    let ctxBefore = match.contextBefore;
    let strikethrough = match.matchedText;
    let ctxAfter = match.contextAfter;

    if (absorbedBefore > 0) {
      ctxBefore = match.contextBefore.slice(0, match.contextBefore.length - absorbedBefore);
      strikethrough =
        match.contextBefore.slice(match.contextBefore.length - absorbedBefore) + strikethrough;
    }
    if (absorbedAfter > 0) {
      strikethrough = strikethrough + match.contextAfter.slice(0, absorbedAfter);
      ctxAfter = match.contextAfter.slice(absorbedAfter);
    }

    return {
      ctxBefore,
      strikethrough,
      replacement: adjusted.replacement,
      ctxAfter,
    };
  }, [match, rawReplacementText, decision.action]);

  return (
    <div
      className={`erm-match-row ${decision.action === "reject" ? "erm-match-row-rejected" : "erm-match-row-accepted"}`}
    >
      {/* Field label + type badge */}
      <div
        className="erm-match-header"
      >
        <span
          className="erm-type-badge"
          style={{ background: TYPE_COLORS[match.matchType] || "#666" }}
        >
          {TYPE_LABELS[match.matchType] || match.matchType}
        </span>
        <span className="erm-field-label">{match.field}</span>
        {match.partialFragment && (
          <span className="erm-partial-fragment">&ldquo;{match.partialFragment}&rdquo;</span>
        )}
      </div>

      {/* Context snippet with diff (grammar-adjusted) */}
      <div
        className="erm-snippet"
      >
        <span className="erm-context-text">{preview.ctxBefore}</span>
        <span className="erm-strikethrough">
          {preview.strikethrough}
        </span>
        {decision.action !== "reject" && (
          <span className="erm-replacement">
            {preview.replacement}
          </span>
        )}
        <span className="erm-context-text">{preview.ctxAfter}</span>
      </div>

      {/* Action controls */}
      <div className="erm-action-controls">
        {(["accept", "reject", "edit"] as DecisionAction[]).map((action) => (
          <button
            key={action}
            onClick={() => onChangeAction(action)}
            className={`erm-action-btn ${decision.action === action ? `erm-action-btn-${action}` : "erm-action-btn-inactive"}`}
          >
            {action}
          </button>
        ))}
        {decision.action === "edit" && (
          <input
            type="text"
            value={decision.editText}
            onChange={(e) => onChangeEditText(e.target.value)}
            placeholder="Custom replacement..."
            className="erm-edit-input"
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Source Section — collapsible accordion for one entity or chronicle
// ---------------------------------------------------------------------------

function SourceSection({
  group,
  expanded,
  onToggle,
  decisions,
  newName,
  onChangeAction,
  onChangeEditText,
  onAcceptAll,
  onRejectAll,
}: Readonly<{
  group: SourceGroup;
  expanded: boolean;
  onToggle: () => void;
  decisions: Map<string, DecisionState>;
  newName: string;
  onChangeAction: (matchId: string, action: DecisionAction) => void;
  onChangeEditText: (matchId: string, text: string) => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
}>) {
  // Per-source stats
  let accepts = 0,
    rejects = 0,
    edits = 0;
  for (const m of group.matches) {
    const d = decisions.get(m.id);
    if (!d) continue;
    if (d.action === "accept") accepts++;
    else if (d.action === "reject") rejects++;
    else if (d.action === "edit") edits++;
  }
  const total = group.matches.length;

  return (
    <div
      className="erm-source-section"
    >
      {/* Clickable header */}
      <div
        onClick={onToggle}
        className="erm-source-header"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onToggle(e); }}
      >
        {/* Expand indicator */}
        <span className="erm-expand-icon">
          {expanded ? "\u25BC" : "\u25B6"}
        </span>

        {/* Source name */}
        <span className="erm-source-name">
          {group.sourceName}
        </span>

        {/* Type + tier badge */}
        <span className="erm-source-badge">
          {group.sourceType}
          {group.tier ? `, ${group.tier}` : ""}
        </span>

        {/* Match stats */}
        <span className="erm-match-count">
          {total} {total === 1 ? "match" : "matches"}
          {group.connections.length > 0 && ` + ${group.connections.length} conn`}
        </span>
        {accepts > 0 && (
          <span className="erm-stat-accepts">
            {accepts}
            {"\u2713"}
          </span>
        )}
        {rejects > 0 && (
          <span className="erm-stat-rejects">
            {rejects}
            {"\u2717"}
          </span>
        )}
        {edits > 0 && (
          <span className="erm-stat-edits">
            {edits}
            {"\u270E"}
          </span>
        )}

        {/* Per-source bulk actions (stop propagation so click doesn't toggle) */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAcceptAll();
          }}
          title="Accept all matches in this source"
          className="erm-bulk-accept-btn"
        >
          {"all\u2713"}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRejectAll();
          }}
          title="Reject all matches in this source"
          className="erm-bulk-reject-btn"
        >
          {"all\u2717"}
        </button>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="erm-source-body">
          {group.matches.map((match) => {
            const decision = decisions.get(match.id) || {
              action: "reject" as DecisionAction,
              editText: newName,
            };
            return (
              <MatchRow
                key={match.id}
                match={match}
                decision={decision}
                newName={newName}
                onChangeAction={(action) => onChangeAction(match.id, action)}
                onChangeEditText={(text) => onChangeEditText(match.id, text)}
              />
            );
          })}

          {/* Connection info for this source */}
          {group.connections.length > 0 && (
            <div className="erm-connection-section">
              {group.connections.map((conn) => (
                <div
                  key={conn.id}
                  className="erm-connection-item"
                >
                  <span
                    className="erm-fk-badge"
                    style={{ background: TYPE_COLORS.id_slug }}
                  >
                    FK
                  </span>
                  <span>{conn.contextBefore}</span>
                  <span>{conn.contextAfter}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Modal
// ---------------------------------------------------------------------------

export default function EntityRenameModal({
  entityId,
  cultures,
  simulationRunId,
  mode = "rename",
  onApply,
  onClose,
}: Readonly<EntityRenameModalProps>) {
  const navEntities = useEntityNavList();
  const relationships = useRelationships();
  const narrativeEvents = useNarrativeEvents();
  const entity = useMemo(() => navEntities.find((e) => e.id === entityId), [navEntities, entityId]);

  const isPatch = mode === "patch";

  const [phase, setPhase] = useState<Phase>("input");
  const [addOldNameAsAlias, setAddOldNameAsAlias] = useState(true);
  // In patch mode: newName = entity.name (current, correct), oldNameInput = user-entered stale name
  const [newName, setNewName] = useState(isPatch ? entity?.name || "" : "");
  const [oldNameInput, setOldNameInput] = useState(
    isPatch ? entityId.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : ""
  );
  const [scanResult, setScanResult] = useState<RenameScanResult | null>(null);
  const [decisions, setDecisions] = useState<Map<string, DecisionState>>(new Map());
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());
  const [applyProgress, setApplyProgress] = useState("");
  const [applyResult, setApplyResult] = useState("");
  const [isRolling, setIsRolling] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (phase === "input" && inputRef.current) {
      inputRef.current.focus();
    }
  }, [phase]);

  // --- Name rolling ---
  const handleRollName = useCallback(async () => {
    if (!entity?.culture) return;
    const cultureDef = cultures.find((c) => c.id === entity.culture);
    if (!cultureDef) return;
    const culture = toCulture(cultureDef);
    if (!culture) return;

    setIsRolling(true);
    try {
      const result = await generate(culture, {
        kind: entity.kind,
        subtype: entity.subtype,
        count: 1,
        seed: `rename-${Date.now()}`,
      });
      if (result.names.length > 0) {
        setNewName(result.names[0]);
      }
    } catch (err) {
      console.warn("[EntityRename] Name generation failed:", err);
    } finally {
      setIsRolling(false);
    }
  }, [entity, cultures]);

  // --- Scanning ---
  const scanOldName = isPatch ? oldNameInput.trim() : entity.name;

  const handleScan = useCallback(async () => {
    if (isPatch ? !oldNameInput.trim() : !newName.trim()) return;
    setPhase("scanning");

    console.log("[EntityRenameModal] handleScan starting", {
      scanOldName,
      newName,
      narrativeEventCount: narrativeEvents?.length ?? 0,
    });

    // Sample a narrative event to check if it has patched or original text
    if (narrativeEvents && narrativeEvents.length > 0) {
      const sample = narrativeEvents[0];
      console.log("[EntityRenameModal] Sample narrative event", {
        id: sample.id,
        description: sample.description?.substring(0, 200),
        action: sample.action?.substring(0, 200),
        hasSimulationRunId: "simulationRunId" in sample,
      });
    }

    try {
      const [chronicles, fullEntities] = await Promise.all([
        getChroniclesForSimulation(simulationRunId),
        entityRepo.getEntitiesForRun(simulationRunId),
      ]);
      const result = scanForReferences(
        entityId,
        scanOldName,
        fullEntities,
        chronicles,
        relationships,
        narrativeEvents
      );
      // Filter out no-op matches where the matched text already equals the new name
      const effectiveName = isPatch ? entity.name : newName;
      result.matches = result.matches.filter(
        (m) => m.matchType === "id_slug" || m.matchedText !== effectiveName
      );

      console.log("[EntityRenameModal] Scan result", {
        totalMatches: result.matches.length,
        eventMatches: result.matches.filter((m) => m.sourceType === "event").length,
      });
      setScanResult(result);

      // Initialize decisions: accept for full+metadata, reject for partial.
      // id_slug matches are informational only — no decision needed.
      const initial = new Map<string, DecisionState>();
      for (const match of result.matches) {
        if (match.matchType === "id_slug") continue;
        initial.set(match.id, {
          action: match.matchType === "partial" ? "reject" : "accept",
          editText: newName,
        });
      }
      setDecisions(initial);

      // Self entity starts expanded
      setExpandedSources(new Set([entityId]));
      setPhase("preview");
    } catch (err) {
      console.error("[EntityRename] Scan failed:", err);
      setPhase("input");
    }
  }, [
    newName,
    oldNameInput,
    isPatch,
    scanOldName,
    entity,
    entityId,
    simulationRunId,
    relationships,
    narrativeEvents,
  ]);

  // --- Decision handling ---
  const handleChangeAction = useCallback(
    (matchId: string, action: DecisionAction) => {
      setDecisions((prev) => {
        const next = new Map(prev);
        const current = next.get(matchId) || {
          action: "reject",
          editText: newName,
        };
        next.set(matchId, { ...current, action });
        return next;
      });
    },
    [newName]
  );

  const handleChangeEditText = useCallback(
    (matchId: string, text: string) => {
      setDecisions((prev) => {
        const next = new Map(prev);
        const current = next.get(matchId) || {
          action: "edit",
          editText: newName,
        };
        next.set(matchId, { ...current, editText: text });
        return next;
      });
    },
    [newName]
  );

  // --- Bulk actions (global) ---
  const handleAcceptAll = useCallback(() => {
    setDecisions((prev) => {
      const next = new Map(prev);
      for (const [id, state] of next) {
        next.set(id, { ...state, action: "accept" });
      }
      return next;
    });
  }, []);

  const handleRejectAllPartials = useCallback(() => {
    if (!scanResult) return;
    setDecisions((prev) => {
      const next = new Map(prev);
      for (const match of scanResult.matches) {
        if (match.matchType === "partial") {
          const current = next.get(match.id);
          if (current) {
            next.set(match.id, { ...current, action: "reject" });
          }
        }
      }
      return next;
    });
  }, [scanResult]);

  // --- Bulk actions (per-source) ---
  const handleAcceptSource = useCallback((matchIds: string[]) => {
    setDecisions((prev) => {
      const next = new Map(prev);
      for (const id of matchIds) {
        const current = next.get(id);
        if (current) next.set(id, { ...current, action: "accept" });
      }
      return next;
    });
  }, []);

  const handleRejectSource = useCallback((matchIds: string[]) => {
    setDecisions((prev) => {
      const next = new Map(prev);
      for (const id of matchIds) {
        const current = next.get(id);
        if (current) next.set(id, { ...current, action: "reject" });
      }
      return next;
    });
  }, []);

  // --- Expand/collapse ---
  const toggleSource = useCallback((sourceId: string) => {
    setExpandedSources((prev) => {
      const next = new Set(prev);
      if (next.has(sourceId)) {
        next.delete(sourceId);
      } else {
        next.add(sourceId);
      }
      return next;
    });
  }, []);

  // --- Apply ---
  const handleApply = useCallback(async () => {
    if (!scanResult) return;
    setPhase("applying");

    try {
      const decisionArray: MatchDecision[] = [];
      for (const [matchId, state] of decisions) {
        decisionArray.push({
          matchId,
          action: state.action,
          editText: state.action === "edit" ? state.editText : undefined,
        });
      }

      setApplyProgress("Building patches...");
      const patches = buildRenamePatches(scanResult, newName, decisionArray);
      console.log("[EntityRenameModal] Built patches", {
        entityPatchCount: patches.entityPatches.length,
        eventPatchCount: patches.eventPatches.length,
        chroniclePatchCount: patches.chroniclePatches.length,
        eventPatchIds: patches.eventPatches.map((p) => p.eventId),
        eventPatchKeys: patches.eventPatches.map((p) => Object.keys(p.changes)),
      });

      // Apply chronicle patches directly (chronicles have their own IDB store)
      let chronicleCount = 0;
      if (patches.chroniclePatches.length > 0) {
        setApplyProgress(`Updating ${patches.chroniclePatches.length} chronicles...`);
        chronicleCount = await applyChroniclePatches(
          patches.chroniclePatches,
          getChronicle,
          putChronicle
        );
      }

      setApplyProgress(`Persisting ${patches.entityPatches.length} entity patches...`);

      const parts = [`${patches.entityPatches.length} entities`, `${chronicleCount} chronicles`];
      if (patches.eventPatches.length > 0) {
        parts.push(`${patches.eventPatches.length} events`);
      }
      setApplyResult(`Updated ${parts.join(", ")}.`);

      // Pass patch manifest to parent — parent handles Dexie persistence
      onApply({
        entityPatches: patches.entityPatches,
        eventPatches: patches.eventPatches,
        targetEntityId: isPatch ? null : entityId,
        newName,
        addOldNameAsAlias: isPatch ? false : addOldNameAsAlias,
      });
      setPhase("done");
    } catch (err) {
      console.error("[EntityRename] Apply failed:", err);
      setApplyProgress(`Error: ${err}`);
    }
  }, [scanResult, decisions, newName, entityId, onApply, isPatch, addOldNameAsAlias]);

  // --- Stats ---
  const stats = useMemo(() => {
    if (!scanResult) return { accepts: 0, rejects: 0, edits: 0, total: 0, connections: 0 };
    let accepts = 0,
      rejects = 0,
      edits = 0,
      connections = 0;
    for (const match of scanResult.matches) {
      if (match.matchType === "id_slug") {
        connections++;
        continue;
      }
      const state = decisions.get(match.id);
      if (!state) continue;
      if (state.action === "accept") accepts++;
      else if (state.action === "reject") rejects++;
      else if (state.action === "edit") edits++;
    }
    return { accepts, rejects, edits, total: accepts + rejects + edits, connections };
  }, [scanResult, decisions]);

  // --- Source groups (accordion data) ---
  const sourceGroups = useMemo(() => {
    if (!scanResult) return [];

    // Build a map of sourceId → { matches, connections }
    const groupMap = new Map<
      string,
      {
        sourceName: string;
        sourceType: "entity" | "chronicle" | "event";
        matches: RenameMatch[];
        connections: RenameMatch[];
      }
    >();

    for (const match of scanResult.matches) {
      let entry = groupMap.get(match.sourceId);
      if (!entry) {
        entry = {
          sourceName: match.sourceName,
          sourceType: match.sourceType,
          matches: [],
          connections: [],
        };
        groupMap.set(match.sourceId, entry);
      }
      if (match.matchType === "id_slug") {
        entry.connections.push(match);
      } else {
        entry.matches.push(match);
      }
    }

    // Convert to sorted array: self first, then entities, then chronicles
    // Tier is derived from the matches themselves (set by the scan function).
    const groups: SourceGroup[] = [];
    for (const [sourceId, entry] of groupMap) {
      const isSelf = sourceId === entityId && entry.sourceType === "entity";

      // Use the tier from the first match/connection — all matches for a given
      // source share the same tier since it's set per-scan-pass.
      const firstMatch = entry.matches[0] || entry.connections[0];
      const tier = isSelf ? "this entity" : (firstMatch?.tier ?? "general");

      groups.push({
        sourceId,
        sourceName: entry.sourceName,
        sourceType: entry.sourceType,
        isSelf,
        tier,
        matches: entry.matches,
        connections: entry.connections,
      });
    }

    // Sort: self first, then entities (related before general), then events, then chronicles
    // Tier priority: FK-confirmed tiers sort before text-only mentions
    const tierOrder: Record<string, number> = {
      "this entity": 0,
      self: 0,
      related: 1,
      participant: 1,
      cast: 1,
      mention: 2,
      general: 2,
    };
    const typeOrder: Record<string, number> = { entity: 0, event: 1, chronicle: 2 };
    groups.sort((a, b) => {
      if (a.isSelf) return -1;
      if (b.isSelf) return 1;
      // entities before events before chronicles
      const typeA = typeOrder[a.sourceType] ?? 9;
      const typeB = typeOrder[b.sourceType] ?? 9;
      if (typeA !== typeB) return typeA - typeB;
      // FK-confirmed before text-only mentions
      const ta = tierOrder[a.tier] ?? 9;
      const tb = tierOrder[b.tier] ?? 9;
      if (ta !== tb) return ta - tb;
      return a.sourceName.localeCompare(b.sourceName);
    });

    return groups;
  }, [scanResult, entityId]);

  // Separate: sources with actionable matches vs connection-only sources
  const actionableGroups = useMemo(
    () => sourceGroups.filter((g) => g.matches.length > 0),
    [sourceGroups]
  );
  const connectionOnlyGroups = useMemo(
    () => sourceGroups.filter((g) => g.matches.length === 0 && g.connections.length > 0),
    [sourceGroups]
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (!entity) return null;

  return (
    <div
      className="erm-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && phase !== "applying") onClose();
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.currentTarget.click(); }}
    >
      <div
        className="erm-card"
      >
        {/* Header */}
        <div
          className="erm-header"
        >
          <div>
            <h2 className="erm-title">
              {isPatch ? "Patch Stale Names" : "Rename Entity"}
            </h2>
            <p className="erm-subtitle">
              {entity.kind}
              {entity.subtype ? ` / ${entity.subtype}` : ""}
              {entity.culture ? ` / ${entity.culture}` : ""}
            </p>
          </div>
          {phase !== "applying" && (
            <button
              onClick={onClose}
              className="illuminator-button illuminator-button-secondary erm-cancel-btn"
            >
              Cancel
            </button>
          )}
        </div>

        {/* Scrollable content */}
        <div
          className="erm-body"
        >
          {/* Phase 1: Name Input */}
          {phase === "input" && (
            <div>
              <div className="erm-current-name-box">
                <div className="erm-current-name-label">
                  Current Name
                </div>
                <div className="erm-current-name-value">
                  {entity.name}
                </div>
              </div>

              {isPatch ? (
                /* Patch mode: user enters the OLD stale name to find */
                <>
                  <div className="erm-input-row">
                    <input
                      ref={inputRef}
                      type="text"
                      value={oldNameInput}
                      onChange={(e) => setOldNameInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && oldNameInput.trim()) void handleScan();
                      }}
                      placeholder="Enter old/stale name to find..."
                      className="erm-name-input"
                    />
                  </div>
                  <p className="erm-help-text">
                    Enter the old or stale name to search for. All occurrences will be shown for
                    review and replaced with the current name &ldquo;{entity.name}&rdquo;.
                  </p>
                </>
              ) : (
                /* Rename mode: user enters the NEW name */
                <>
                  <div className="erm-input-row">
                    <input
                      ref={inputRef}
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newName.trim()) void handleScan();
                      }}
                      placeholder="Enter new name..."
                      className="erm-name-input"
                    />
                    {entity.culture && (
                      <button
                        onClick={() => void handleRollName()}
                        disabled={isRolling}
                        className="illuminator-button illuminator-button-secondary erm-roll-btn"
                        title="Generate a culture-appropriate name using Name Forge"
                      >
                        {isRolling ? "Rolling..." : "Roll Name"}
                      </button>
                    )}
                  </div>
                  <label className="erm-alias-label">
                    <input
                      type="checkbox"
                      checked={addOldNameAsAlias}
                      onChange={(e) => setAddOldNameAsAlias(e.target.checked)}
                    />
                    Add &ldquo;{entity.name}&rdquo; as alias (keeps wiki links working)
                  </label>
                  <p className="erm-help-text">
                    Enter a new name or use Roll Name to generate one from Name Forge. The scan will
                    find all references to &ldquo;
                    {entity.name}&rdquo; across related entities and chronicles.
                  </p>
                </>
              )}
            </div>
          )}

          {/* Phase: Scanning */}
          {phase === "scanning" && (
            <div className="erm-centered-phase">
              <div className="erm-phase-title">
                Scanning entities and chronicles...
              </div>
              <div className="erm-phase-subtitle">
                Looking for references to &ldquo;{scanOldName}&rdquo;
              </div>
            </div>
          )}

          {/* Phase 2: Preview — accordion grouped by source */}
          {phase === "preview" && scanResult && (
            <div>
              {/* Summary stats bar */}
              <div className="erm-stats-bar">
                <span>
                  <strong>{isPatch ? oldNameInput : entity.name}</strong> &rarr;{" "}
                  <strong>{newName}</strong>
                </span>
                <span className="erm-stat-separator">|</span>
                <span className="erm-stat-accepts">{stats.accepts} accept</span>
                <span className="erm-stat-rejects">{stats.rejects} reject</span>
                <span className="erm-stat-edits">{stats.edits} edit</span>
                <span className="erm-stat-total">/ {stats.total} total</span>
                {stats.connections > 0 && (
                  <span className="erm-stat-connections">+ {stats.connections} connections</span>
                )}
                <div className="erm-stats-spacer" />
                <button
                  onClick={handleAcceptAll}
                  className="erm-accept-all-btn"
                >
                  Accept All
                </button>
                <button
                  onClick={handleRejectAllPartials}
                  className="erm-reject-partials-btn"
                >
                  Reject All Partials
                </button>
              </div>

              {/* Accordion: one section per source */}
              {actionableGroups.map((group) => (
                <SourceSection
                  key={group.sourceId}
                  group={group}
                  expanded={expandedSources.has(group.sourceId)}
                  onToggle={() => toggleSource(group.sourceId)}
                  decisions={decisions}
                  newName={newName}
                  onChangeAction={handleChangeAction}
                  onChangeEditText={handleChangeEditText}
                  onAcceptAll={() => handleAcceptSource(group.matches.map((m) => m.id))}
                  onRejectAll={() => handleRejectSource(group.matches.map((m) => m.id))}
                />
              ))}

              {/* Connection-only sources (no text matches, just FK refs) */}
              {connectionOnlyGroups.length > 0 && (
                <div className="erm-conn-only-section">
                  <div className="erm-conn-only-header">
                    Connections without text matches ({connectionOnlyGroups.length})
                  </div>
                  {connectionOnlyGroups.map((group) => (
                    <div
                      key={group.sourceId}
                      className="erm-conn-only-item"
                    >
                      <span
                        className="erm-fk-badge"
                        style={{ background: TYPE_COLORS.id_slug }}
                      >
                        FK
                      </span>
                      <span className="erm-conn-only-name">{group.sourceName}</span>
                      <span>
                        ({group.sourceType}
                        {group.connections.length > 1 ? `, ${group.connections.length} refs` : ""})
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {actionableGroups.length === 0 && connectionOnlyGroups.length === 0 && (
                <div className="erm-empty-preview">
                  No references found. The entity name will still be updated.
                </div>
              )}
            </div>
          )}

          {/* Phase 3: Applying / Done */}
          {(phase === "applying" || phase === "done") && (
            <div className="erm-centered-phase">
              <div className="erm-phase-title">
                {(() => {
                  if (phase === "applying") return applyProgress;
                  if (isPatch) return "Patch Complete";
                  return "Rename Complete";
                })()}
              </div>
              {phase === "done" && applyResult && (
                <div className="erm-done-subtitle">
                  {applyResult}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="erm-footer">
          {phase === "input" && (
            <button
              onClick={() => void handleScan()}
              disabled={isPatch ? !oldNameInput.trim() : !newName.trim()}
              className="illuminator-button erm-footer-btn"
              style={{ '--erm-opacity': (isPatch ? oldNameInput.trim() : newName.trim()) ? 1 : 0.5, opacity: 'var(--erm-opacity)' } as React.CSSProperties}
            >
              Scan References
            </button>
          )}
          {phase === "preview" && (
            <>
              <button
                onClick={() => setPhase("input")}
                className="illuminator-button illuminator-button-secondary erm-footer-btn-secondary"
              >
                Back
              </button>
              <button
                onClick={() => void handleApply()}
                disabled={stats.accepts === 0 && stats.edits === 0}
                className="illuminator-button erm-footer-btn"
                style={{ opacity: stats.accepts === 0 && stats.edits === 0 ? 0.5 : 1 }}
              >
                {isPatch ? "Apply Patch" : "Apply Rename"} ({stats.accepts + stats.edits} changes)
              </button>
            </>
          )}
          {phase === "done" && (
            <button
              onClick={onClose}
              className="illuminator-button erm-footer-btn"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
