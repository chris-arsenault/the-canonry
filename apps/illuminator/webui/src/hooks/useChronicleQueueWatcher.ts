/**
 * useChronicleQueueWatcher - Bridges the enrichment queue to the chronicle store.
 *
 * Watches for chronicle-related task completions (chronicle generation + chronicle images)
 * and triggers targeted refreshChronicle() calls on the Zustand store.
 *
 * Also handles retries by allowing tasks to be processed again if they return
 * to queued/running after an error.
 */

import { useEffect, useRef } from "react";
import type { QueueItem } from "../lib/enrichmentTypes";
import { useChronicleStore } from "../lib/db/chronicleStore";
import {
  updateChronicleCoverImageStatus,
  updateChronicleImageRef,
} from "../lib/db/chronicleRepository";
import {
  updateEraNarrativeCoverImageStatus,
  updateEraNarrativeImageRefStatus,
} from "../lib/db/eraNarrativeRepository";

type ProcessedStatus = "complete" | "error";

type ProcessedMap = Map<string, ProcessedStatus>;

function syncProcessedMarkers(queue: QueueItem[], processed: ProcessedMap): void {
  for (const item of queue) {
    if ((item.status === "queued" || item.status === "running") && processed.has(item.id)) {
      processed.delete(item.id);
    }
  }
  const queueIds = new Set(queue.map((item) => item.id));
  for (const id of processed.keys()) {
    if (!queueIds.has(id)) processed.delete(id);
  }
}

function queueChronicleImageUpdate(
  chronicleId: string,
  imageRefId: string,
  isCover: boolean,
  isComplete: boolean,
  imageId: string,
  taskError: string | undefined,
  updates: Promise<unknown>[]
): void {
  const isSuccess = isComplete && !!imageId;
  const error = !isSuccess
    ? isComplete
      ? "Image generation returned no image id"
      : (taskError ?? "Image generation failed")
    : undefined;
  if (isCover) {
    updates.push(
      isSuccess
        ? updateChronicleCoverImageStatus(chronicleId, { status: "complete", generatedImageId: imageId })
        : updateChronicleCoverImageStatus(chronicleId, { status: "failed", error })
    );
  } else {
    updates.push(
      isSuccess
        ? updateChronicleImageRef(chronicleId, imageRefId, { status: "complete", generatedImageId: imageId })
        : updateChronicleImageRef(chronicleId, imageRefId, { status: "failed", error })
    );
  }
}

function processChronicleImageTask(
  task: QueueItem,
  updates: Promise<unknown>[],
  chronicleIds: Set<string>
): void {
  if (!task.chronicleId || !task.imageRefId) return;
  const isCover = task.imageRefId === "__cover_image__";
  const imageId = task.result?.imageId ?? "";
  queueChronicleImageUpdate(
    task.chronicleId,
    task.imageRefId,
    isCover,
    task.status === "complete",
    imageId,
    task.error,
    updates
  );
  chronicleIds.add(task.chronicleId);
}

function queueEraNarrativeImageUpdate(
  narrativeId: string,
  imageRefId: string,
  isCover: boolean,
  isComplete: boolean,
  imageId: string,
  taskError: string | undefined,
  updates: Promise<unknown>[]
): void {
  const isSuccess = isComplete && !!imageId;
  const error = !isSuccess
    ? isComplete
      ? "Image generation returned no image id"
      : (taskError ?? "Image generation failed")
    : undefined;
  if (isCover) {
    updates.push(
      isSuccess
        ? updateEraNarrativeCoverImageStatus(narrativeId, "complete", imageId)
        : updateEraNarrativeCoverImageStatus(narrativeId, "failed", undefined, error)
    );
  } else {
    updates.push(
      isSuccess
        ? updateEraNarrativeImageRefStatus(narrativeId, imageRefId, "complete", imageId)
        : updateEraNarrativeImageRefStatus(narrativeId, imageRefId, "failed", undefined, error)
    );
  }
}

function processEraNarrativeImageTask(task: QueueItem, updates: Promise<unknown>[]): void {
  const narrativeId = task.chronicleId;
  if (!narrativeId || !task.imageRefId) return;
  const isCover = task.imageRefId === "__cover_image__";
  const imageId = task.result?.imageId ?? "";
  queueEraNarrativeImageUpdate(
    narrativeId,
    task.imageRefId,
    isCover,
    task.status === "complete",
    imageId,
    task.error,
    updates
  );
  // No chronicle refresh needed — EraNarrativeViewer polls directly
}

// Returns true if refreshAll should be triggered
function dispatchCompletedTask(
  task: QueueItem,
  updates: Promise<unknown>[],
  chronicleIds: Set<string>
): boolean {
  if (task.type === "image" && task.imageType === "chronicle") {
    processChronicleImageTask(task, updates, chronicleIds);
    return false;
  }
  if (task.type === "image" && task.imageType === "era_narrative") {
    processEraNarrativeImageTask(task, updates);
    return false;
  }
  if (task.type === "historianPrep") {
    if (task.chronicleId) chronicleIds.add(task.chronicleId);
    return false;
  }
  if (task.type === "entityChronicle") {
    const chronicleId = task.result?.chronicleId ?? task.chronicleId;
    if (chronicleId) {
      chronicleIds.add(chronicleId);
    } else {
      console.log("[ChronicleQueueWatcher] No chronicleId found on task, triggering refreshAll");
      return true;
    }
  }
  return false;
}

export function useChronicleQueueWatcher(queue: QueueItem[]): void {
  const processedRef = useRef<Map<string, ProcessedStatus>>(new Map());
  const activeRef = useRef(true);

  useEffect(() => {
    activeRef.current = true;
    return () => {
      activeRef.current = false;
    };
  }, []);

  useEffect(() => {
    const processed = processedRef.current;
    syncProcessedMarkers(queue, processed);

    const chronicleTasks = queue.filter(
      (item) =>
        item.type === "entityChronicle" ||
        item.type === "historianPrep" ||
        (item.type === "image" &&
          (item.imageType === "chronicle" || item.imageType === "era_narrative"))
    );

    const completedTasks = chronicleTasks.filter(
      (item) =>
        (item.status === "complete" || item.status === "error") &&
        processed.get(item.id) !== item.status
    );

    if (completedTasks.length > 0) {
      console.log(
        "[ChronicleQueueWatcher] Processing",
        completedTasks.length,
        "completed tasks:",
        completedTasks.map((t) => ({
          id: t.id,
          type: t.type,
          step: t.chronicleStep,
          chronicleId: t.chronicleId,
          resultChronicleId: t.result?.chronicleId,
        }))
      );
      const chronicleIds = new Set<string>();
      const updates: Promise<unknown>[] = [];
      let refreshAll = false;

      for (const task of completedTasks) {
        processed.set(task.id, task.status as ProcessedStatus);
        refreshAll = refreshAll || dispatchCompletedTask(task, updates, chronicleIds);
      }

      const store = useChronicleStore.getState();
      const refresh = () => {
        if (!activeRef.current) {
          console.log("[ChronicleQueueWatcher] Skipping refresh - component inactive");
          return;
        }
        console.log("[ChronicleQueueWatcher] Refreshing:", {
          refreshAll,
          chronicleIds: Array.from(chronicleIds),
        });
        if (refreshAll) {
          void store.refreshAll();
        }
        for (const id of chronicleIds) {
          console.log("[ChronicleQueueWatcher] Calling refreshChronicle for:", id);
          void store.refreshChronicle(id);
        }
      };

      if (updates.length > 0) {
        void Promise.allSettled(updates).then(refresh);
      } else {
        refresh();
      }
    }
  }, [queue]);
}
