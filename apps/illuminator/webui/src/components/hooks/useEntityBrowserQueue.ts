/**
 * useEntityBrowserQueue - Queue operations extracted from EntityBrowser
 */

import { useCallback } from "react";
import { useEntityStore } from "../../lib/db/entityStore";
import { useEnrichmentQueueStore } from "../../lib/db/enrichmentQueueStore";
import { getEnqueue, getCancel } from "../../lib/db/enrichmentQueueBridge";
import { prominenceThresholdFromScale } from "@canonry/world-schema";
import type { ProminenceScale } from "@canonry/world-schema";
import type { EntityNavItem } from "../../lib/db/entityNav";
import type { EntityBrowserConfig, EnrichmentStatus } from "../EntityBrowserTypes";
import type { ImageGenSettings } from "../../hooks/useImageGenSettings";

type GetStatusFn = (nav: EntityNavItem, type: string) => EnrichmentStatus;

function prominenceAtLeast(
  prominence: number | string,
  minProminence: string,
  scale: ProminenceScale
): boolean {
  if (typeof prominence === "number" && Number.isFinite(prominence)) {
    return prominence >= prominenceThresholdFromScale(minProminence, scale);
  }
  if (typeof prominence === "string") {
    const prominenceIndex = scale.labels.indexOf(prominence);
    const minIndex = scale.labels.indexOf(minProminence);
    return prominenceIndex >= 0 && minIndex >= 0 && prominenceIndex >= minIndex;
  }
  return false;
}

export function useEntityBrowserQueue(
  selectedIds: Set<string>,
  navEntities: EntityNavItem[],
  filteredNavItems: EntityNavItem[],
  getStatus: GetStatusFn,
  buildPrompt: (entity: unknown, type: string) => string,
  getVisualConfig: ((entity: unknown) => Record<string, unknown>) | undefined,
  config: EntityBrowserConfig,
  imageGenSettings: ImageGenSettings,
  prominenceScale: ProminenceScale
) {
  const queue = useEnrichmentQueueStore((s) => s.queue);

  const queueItem = useCallback(
    async (entityId: string, type: string) => {
      const entity = await useEntityStore.getState().loadEntity(entityId);
      if (!entity) return;
      const prompt = buildPrompt(entity, type === "visualThesis" ? "description" : type);
      const visualConfig =
        (type === "description" || type === "visualThesis") && getVisualConfig
          ? getVisualConfig(entity)
          : {};
      const imageOverrides =
        type === "image"
          ? { imageSize: imageGenSettings.imageSize, imageQuality: imageGenSettings.imageQuality }
          : {};
      getEnqueue()([{ entity, type, prompt, ...visualConfig, ...imageOverrides }]);
    },
    [buildPrompt, getVisualConfig, imageGenSettings.imageSize, imageGenSettings.imageQuality]
  );

  const cancelItem = useCallback(
    (entityId: string, type: string) => {
      const item = queue.find((i) => i.entityId === entityId && i.type === type);
      if (item) getCancel()(item.id);
    },
    [queue]
  );

  const queueSelectedDescriptions = useCallback(async () => {
    const missingIds: string[] = [];
    for (const entityId of selectedIds) {
      const nav = navEntities.find((e) => e.id === entityId);
      if (nav && getStatus(nav, "description") === "missing") missingIds.push(entityId);
    }
    if (missingIds.length === 0) return;
    const fullEntities = await useEntityStore.getState().loadEntities(missingIds);
    const items = fullEntities.map((entity) => {
      const visualConfig = getVisualConfig ? getVisualConfig(entity) : {};
      return { entity, type: "description", prompt: buildPrompt(entity, "description"), ...visualConfig };
    });
    if (items.length > 0) getEnqueue()(items);
  }, [selectedIds, navEntities, getStatus, buildPrompt, getVisualConfig]);

  const queueSelectedImages = useCallback(async () => {
    const eligibleIds: string[] = [];
    for (const entityId of selectedIds) {
      const nav = navEntities.find((e) => e.id === entityId);
      if (
        nav &&
        prominenceAtLeast(nav.prominence, config.minProminenceForImage, prominenceScale) &&
        getStatus(nav, "image") === "missing" &&
        (!config.requireDescription || nav.hasDescription)
      ) {
        eligibleIds.push(entityId);
      }
    }
    if (eligibleIds.length === 0) return;
    const fullEntities = await useEntityStore.getState().loadEntities(eligibleIds);
    const items = fullEntities.map((entity) => ({
      entity,
      type: "image",
      prompt: buildPrompt(entity, "image"),
      imageSize: imageGenSettings.imageSize,
      imageQuality: imageGenSettings.imageQuality,
    }));
    if (items.length > 0) getEnqueue()(items);
  }, [selectedIds, navEntities, getStatus, buildPrompt, config.minProminenceForImage, config.requireDescription, imageGenSettings.imageSize, imageGenSettings.imageQuality, prominenceScale]);

  const regenSelectedDescriptions = useCallback(async () => {
    const completeIds: string[] = [];
    for (const entityId of selectedIds) {
      const nav = navEntities.find((e) => e.id === entityId);
      if (nav && getStatus(nav, "description") === "complete") completeIds.push(entityId);
    }
    if (completeIds.length === 0) return;
    const fullEntities = await useEntityStore.getState().loadEntities(completeIds);
    const items = fullEntities.map((entity) => {
      const visualConfig = getVisualConfig ? getVisualConfig(entity) : {};
      return { entity, type: "description", prompt: buildPrompt(entity, "description"), ...visualConfig };
    });
    if (items.length > 0) getEnqueue()(items);
  }, [selectedIds, navEntities, getStatus, buildPrompt, getVisualConfig]);

  const regenSelectedImages = useCallback(async () => {
    const completeIds: string[] = [];
    for (const entityId of selectedIds) {
      const nav = navEntities.find((e) => e.id === entityId);
      if (
        nav &&
        prominenceAtLeast(nav.prominence, config.minProminenceForImage, prominenceScale) &&
        getStatus(nav, "image") === "complete"
      ) {
        completeIds.push(entityId);
      }
    }
    if (completeIds.length === 0) return;
    const fullEntities = await useEntityStore.getState().loadEntities(completeIds);
    const items = fullEntities.map((entity) => ({
      entity,
      type: "image",
      prompt: buildPrompt(entity, "image"),
      imageSize: imageGenSettings.imageSize,
      imageQuality: imageGenSettings.imageQuality,
    }));
    if (items.length > 0) getEnqueue()(items);
  }, [selectedIds, navEntities, getStatus, buildPrompt, config.minProminenceForImage, imageGenSettings.imageSize, imageGenSettings.imageQuality, prominenceScale]);

  const queueAllMissingDescriptions = useCallback(async () => {
    const missingIds = filteredNavItems
      .filter((nav) => getStatus(nav, "description") === "missing")
      .map((nav) => nav.id);
    if (missingIds.length === 0) return;
    const fullEntities = await useEntityStore.getState().loadEntities(missingIds);
    const items = fullEntities.map((entity) => {
      const visualConfig = getVisualConfig ? getVisualConfig(entity) : {};
      return { entity, type: "description", prompt: buildPrompt(entity, "description"), ...visualConfig };
    });
    if (items.length > 0) getEnqueue()(items);
  }, [filteredNavItems, getStatus, buildPrompt, getVisualConfig]);

  const queueAllMissingImages = useCallback(async () => {
    const eligibleNavs = filteredNavItems.filter(
      (nav) =>
        prominenceAtLeast(nav.prominence, config.minProminenceForImage, prominenceScale) &&
        getStatus(nav, "image") === "missing"
    );
    if (eligibleNavs.length === 0) return;
    const fullEntities = await useEntityStore.getState().loadEntities(eligibleNavs.map((n) => n.id));
    const entityMap = new Map(fullEntities.map((e) => [e.id, e]));
    const items: Record<string, unknown>[] = [];
    for (const nav of eligibleNavs) {
      const entity = entityMap.get(nav.id);
      if (!entity) continue;
      if (config.requireDescription && !nav.hasDescription && getStatus(nav, "description") === "missing") {
        const visualConfig = getVisualConfig ? getVisualConfig(entity) : {};
        items.push({ entity, type: "description", prompt: buildPrompt(entity, "description"), ...visualConfig });
      }
      items.push({
        entity,
        type: "image",
        prompt: buildPrompt(entity, "image"),
        imageSize: imageGenSettings.imageSize,
        imageQuality: imageGenSettings.imageQuality,
      });
    }
    if (items.length > 0) getEnqueue()(items);
  }, [filteredNavItems, getStatus, buildPrompt, getVisualConfig, config.minProminenceForImage, config.requireDescription, imageGenSettings.imageSize, imageGenSettings.imageQuality, prominenceScale]);

  return {
    queueItem,
    cancelItem,
    queueSelectedDescriptions,
    queueSelectedImages,
    regenSelectedDescriptions,
    regenSelectedImages,
    queueAllMissingDescriptions,
    queueAllMissingImages,
  };
}
