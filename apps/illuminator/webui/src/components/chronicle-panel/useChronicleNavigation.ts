/**
 * useChronicleNavigation - Manages nav list state: filtering, sorting,
 * grouping, pagination, entity search, and wizard entity/event preparation.
 */

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { buildEventHeadline } from "../../lib/chronicleContextBuilder";
import { REFINEMENT_STEPS, NAV_PAGE_SIZE } from "./chroniclePanelConstants";
import type {
  ChronicleQueueItem,
  CombinedNavItem,
  WizardEra,
  WizardEvent,
  WizardRelationship,
  WizardEntity,
  EntityNavItem,
  ChronicleNavItem,
} from "./chroniclePanelTypes";
import type { StyleLibrary } from "@canonry/world-schema";
import type { ChronicleFilterBarProps } from "./ChronicleFilterBar";

interface UseChronicleNavigationParams {
  queue: ChronicleQueueItem[];
  chronicleWorldData: Record<string, unknown>;
  styleLibrary: StyleLibrary | null;
  eraNarrativeNavItems: Array<Record<string, unknown>>;
  simulationRunId: string;
  navEntities: EntityNavItem[] | null;
  entityNavMap: Map<string, EntityNavItem>;
  fullEntities: Array<Record<string, unknown>>;
  narrativeEvents: Array<Record<string, unknown>> | null;
  relationships: Array<Record<string, unknown>> | null;
  fullEntityMapRef: React.RefObject<Map<string, Record<string, unknown>>>;
}

export function useChronicleNavigation({
  queue,
  styleLibrary,
  eraNarrativeNavItems,
  simulationRunId,
  navEntities,
  entityNavMap,
  fullEntities,
  narrativeEvents,
  relationships,
}: UseChronicleNavigationParams) {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(() => {
    const saved = localStorage.getItem("illuminator:chronicle:selectedItemId");
    return saved || null;
  });
  const [groupByType, setGroupByType] = useState(false);
  const [sortMode, setSortMode] = useState("era_asc");
  const [statusFilter, setStatusFilter] = useState("all");
  const [focusFilter, setFocusFilter] = useState("all");
  const [entitySearchQuery, setEntitySearchQuery] = useState("");
  const [entitySearchSelectedId, setEntitySearchSelectedId] = useState<string | null>(null);
  const [showEntitySuggestions, setShowEntitySuggestions] = useState(false);
  const [navVisibleCount, setNavVisibleCount] = useState(NAV_PAGE_SIZE);
  const navListRef = useRef<HTMLDivElement>(null);
  const navLoadMoreRef = useRef<HTMLDivElement>(null);

  const entitySuggestions = useMemo(() => {
    const query = entitySearchQuery.trim().toLowerCase();
    if (!query || !navEntities?.length) return [];
    return navEntities.filter((entity) => entity.name?.toLowerCase().includes(query)).slice(0, 8);
  }, [navEntities, entitySearchQuery]);

  const narrativeStyleNameMap = useMemo(() => {
    const map = new Map<string, string>();
    const styles = styleLibrary?.narrativeStyles || [];
    for (const style of styles) {
      if (style?.id) map.set(style.id, style.name || style.id);
    }
    return map;
  }, [styleLibrary?.narrativeStyles]);

  const getEffectiveStatus = useCallback(
    (chronicleId: string, baseStatus: string): string => {
      const queueTask = queue.find(
        (item) =>
          item.type === "entityChronicle" &&
          item.chronicleId === chronicleId &&
          !REFINEMENT_STEPS.has(item.chronicleStep || ""),
      );
      if (queueTask) {
        const stepStatusMap: Record<string, string> = {
          validate: "validating",
          edit: "editing",
          generate_v2: "generating",
          regenerate_temperature: "generating",
        };
        if (queueTask.status === "running" || queueTask.status === "queued") {
          return stepStatusMap[queueTask.chronicleStep || ""] || baseStatus;
        }
      }
      return baseStatus;
    },
    [queue],
  );

  const getChronicleTypeLabel = useCallback(
    (item: CombinedNavItem): string => {
      if (item?.itemType === "era_narrative") return "Era Narrative";
      const navItem = item as ChronicleNavItem;
      if (navItem?.narrativeStyleName) return navItem.narrativeStyleName;
      if (navItem?.narrativeStyleId) return narrativeStyleNameMap.get(navItem.narrativeStyleId) || navItem.narrativeStyleId;
      return "Unknown Type";
    },
    [narrativeStyleNameMap],
  );

  // This is set from outside via useChronicleNavItems — we receive chronicleItems as input to filteredItems
  // We use a placeholder here; the actual chronicleItems come from the parent
  const [chronicleItemsForFilter, setChronicleItemsForFilter] = useState<ChronicleNavItem[]>([]);

  const filteredItems = useMemo((): CombinedNavItem[] => {
    const query = entitySearchQuery.trim().toLowerCase();
    let items: ChronicleNavItem[] = chronicleItemsForFilter;

    if (statusFilter !== "all") items = items.filter((item) => item.status === statusFilter);
    if (focusFilter !== "all") items = items.filter((item) => item.focusType === focusFilter);
    if (entitySearchSelectedId) {
      items = items.filter((item) => (item.selectedEntityIds || []).includes(entitySearchSelectedId));
    } else if (query) {
      items = items.filter((item) =>
        (item.roleAssignments || []).some((role: { entityName?: string }) =>
          role.entityName?.toLowerCase().includes(query),
        ),
      );
    }

    const allItems: CombinedNavItem[] = [...items, ...(eraNarrativeNavItems as CombinedNavItem[])];

    const getLength = (item: CombinedNavItem) => (item as Record<string, unknown>).wordCount as number || 0;
    const getEraOrder = (item: CombinedNavItem) =>
      typeof (item as Record<string, unknown>).focalEraOrder === "number"
        ? ((item as Record<string, unknown>).focalEraOrder as number)
        : Number.MAX_SAFE_INTEGER;
    const getEraName = (item: CombinedNavItem) => ((item as Record<string, unknown>).focalEraName as string) || "";

    return [...allItems].sort((a, b) => {
      switch (sortMode) {
        case "created_asc": return ((a as Record<string, unknown>).createdAt as number || 0) - ((b as Record<string, unknown>).createdAt as number || 0);
        case "created_desc": return ((b as Record<string, unknown>).createdAt as number || 0) - ((a as Record<string, unknown>).createdAt as number || 0);
        case "length_asc": return getLength(a) - getLength(b);
        case "length_desc": return getLength(b) - getLength(a);
        case "type_desc": return getChronicleTypeLabel(b).localeCompare(getChronicleTypeLabel(a));
        case "era_asc": {
          const oA = getEraOrder(a), oB = getEraOrder(b);
          if (oA !== oB) return oA - oB;
          const yA = ((a as Record<string, unknown>).eraYear as number) ?? Number.MAX_SAFE_INTEGER;
          const yB = ((b as Record<string, unknown>).eraYear as number) ?? Number.MAX_SAFE_INTEGER;
          if (yA !== yB) return yA - yB;
          return getEraName(a).localeCompare(getEraName(b));
        }
        case "era_desc": {
          const oA = getEraOrder(a), oB = getEraOrder(b);
          if (oA !== oB) return oB - oA;
          const yA = ((a as Record<string, unknown>).eraYear as number) ?? -1;
          const yB = ((b as Record<string, unknown>).eraYear as number) ?? -1;
          if (yA !== yB) return yB - yA;
          return getEraName(b).localeCompare(getEraName(a));
        }
        case "type_asc":
        default:
          return getChronicleTypeLabel(a).localeCompare(getChronicleTypeLabel(b));
      }
    });
  }, [chronicleItemsForFilter, eraNarrativeNavItems, entitySearchQuery, entitySearchSelectedId, focusFilter, getChronicleTypeLabel, sortMode, statusFilter]);

  // Pagination
  useEffect(() => { setNavVisibleCount(NAV_PAGE_SIZE); }, [statusFilter, focusFilter, entitySearchQuery, entitySearchSelectedId, sortMode, groupByType, simulationRunId]);

  const selectedNavIndex = useMemo(() => filteredItems.findIndex((item) => item.id === selectedItemId), [filteredItems, selectedItemId]);

  useEffect(() => {
    if (selectedNavIndex >= 0 && selectedNavIndex + 1 > navVisibleCount) {
      const nextCount = Math.min(filteredItems.length, Math.ceil((selectedNavIndex + 1) / NAV_PAGE_SIZE) * NAV_PAGE_SIZE);
      if (nextCount !== navVisibleCount) setNavVisibleCount(nextCount);
    }
  }, [selectedNavIndex, navVisibleCount, filteredItems.length]);

  useEffect(() => {
    if (filteredItems.length > 0 && navVisibleCount > filteredItems.length) setNavVisibleCount(filteredItems.length);
  }, [filteredItems.length, navVisibleCount]);

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const container = navListRef.current;
    const sentinel = navLoadMoreRef.current;
    if (!container || !sentinel || navVisibleCount >= filteredItems.length || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting) setNavVisibleCount((prev) => Math.min(prev + NAV_PAGE_SIZE, filteredItems.length)); },
      { root: container, rootMargin: "120px", threshold: 0.1 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [navVisibleCount, filteredItems.length]);

  const visibleItems = useMemo(() => {
    if (navVisibleCount >= filteredItems.length) return filteredItems;
    return filteredItems.slice(0, navVisibleCount);
  }, [filteredItems, navVisibleCount]);

  const groupedItems = useMemo(() => {
    if (!groupByType) return null;
    const groups = new Map<string, CombinedNavItem[]>();
    for (const item of visibleItems) {
      const label = getChronicleTypeLabel(item);
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label)!.push(item);
    }
    return Array.from(groups.keys()).sort().map((label) => ({ label, items: groups.get(label)! }));
  }, [visibleItems, getChronicleTypeLabel, groupByType]);

  // Wizard data
  const wizardEntities = useMemo((): WizardEntity[] => {
    if (!fullEntities.length) return [];
    return fullEntities.filter((e: Record<string, unknown>) => e.kind !== "era").map((e: Record<string, unknown>) => ({
      id: e.id as string,
      name: e.name as string,
      kind: e.kind as string,
      subtype: (e.subtype as string) || "",
      prominence: (e.prominence as string) || "",
      culture: (e.culture as string) || "",
      status: (e.status as string) || "",
      tags: (e.tags as Record<string, string>) || {},
      eraId: e.eraId as string | undefined,
      summary: e.summary as string | undefined,
      description: e.description as string | undefined,
      aliases: ((e.enrichment as Record<string, unknown>)?.text as Record<string, unknown>)?.aliases as string[] || [],
      coordinates: e.coordinates as { x: number; y: number } | undefined,
      createdAt: e.createdAt as number | undefined,
      updatedAt: e.updatedAt as number | undefined,
    }));
  }, [fullEntities]);

  const wizardRelationships = useMemo((): WizardRelationship[] => {
    if (!relationships?.length) return [];
    return relationships.map((r: Record<string, unknown>) => {
      const src = entityNavMap.get(r.src as string);
      const dst = entityNavMap.get(r.dst as string);
      return {
        src: r.src as string,
        dst: r.dst as string,
        kind: r.kind as string,
        strength: r.strength as number,
        sourceName: src?.name || (r.src as string),
        sourceKind: src?.kind || "unknown",
        targetName: dst?.name || (r.dst as string),
        targetKind: dst?.kind || "unknown",
      };
    });
  }, [relationships, entityNavMap]);

  const wizardEvents = useMemo((): WizardEvent[] => {
    if (!narrativeEvents?.length) return [];
    return narrativeEvents.map((e: Record<string, unknown>) => ({
      id: e.id as string,
      tick: e.tick as number,
      era: e.era as string,
      eventKind: e.eventKind as string,
      significance: e.significance as string,
      headline: buildEventHeadline(e),
      description: e.description as string,
      subjectId: (e.subject as Record<string, unknown>)?.id as string | undefined,
      subjectName: (e.subject as Record<string, unknown>)?.name as string | undefined,
      objectId: (e.object as Record<string, unknown>)?.id as string | undefined,
      objectName: (e.object as Record<string, unknown>)?.name as string | undefined,
      stateChanges: e.stateChanges,
      narrativeTags: e.narrativeTags,
    }));
  }, [narrativeEvents]);

  const wizardEras = useMemo((): WizardEra[] => {
    if (!fullEntities.length) return [];
    const eraEntities = fullEntities.filter((e: Record<string, unknown>) => e.kind === "era" && e.temporal);
    if (eraEntities.length === 0) return [];
    const sortedEras = [...eraEntities].sort((a, b) => ((a.temporal as Record<string, unknown>).startTick as number) - ((b.temporal as Record<string, unknown>).startTick as number));
    return sortedEras.map((era, index) => {
      const temporal = era.temporal as Record<string, unknown>;
      const startTick = temporal.startTick as number;
      const endTick = (temporal.endTick as number) ?? 150;
      return {
        id: (era.eraId as string) || (era.id as string),
        name: era.name as string,
        summary: (era.summary as string) || "",
        order: index,
        startTick,
        endTick,
        duration: endTick - startTick,
      };
    });
  }, [fullEntities]);

  const filterBarProps: ChronicleFilterBarProps = {
    groupByType,
    onSetGroupByType: setGroupByType,
    sortMode,
    onSetSortMode: setSortMode,
    statusFilter,
    onSetStatusFilter: setStatusFilter,
    focusFilter,
    onSetFocusFilter: setFocusFilter,
    entitySearchQuery,
    onSetEntitySearchQuery: setEntitySearchQuery,
    onSetEntitySearchSelectedId: setEntitySearchSelectedId,
    showEntitySuggestions,
    onSetShowEntitySuggestions: setShowEntitySuggestions,
    entitySuggestions,
  };

  return {
    selectedItemId,
    setSelectedItemId,
    groupByType,
    filteredItems,
    visibleItems,
    groupedItems,
    navListRef,
    navLoadMoreRef,
    hasMore: navVisibleCount < filteredItems.length,
    getEffectiveStatus,
    getChronicleTypeLabel,
    setChronicleItemsForFilter,
    filterBarProps,
    wizardEntities,
    wizardRelationships,
    wizardEvents,
    wizardEras,
  };
}
