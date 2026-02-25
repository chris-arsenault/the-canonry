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

    // Clear processed markers if task is retried (queued/running again).
    for (const item of queue) {
      if ((item.status === "queued" || item.status === "running") && processed.has(item.id)) {
        processed.delete(item.id);
      }
    }

    // Prune processed entries for tasks no longer in queue.
    const queueIds = new Set(queue.map((item) => item.id));
    for (const id of processed.keys()) {
      if (!queueIds.has(id)) processed.delete(id);
    }

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

        if (task.type === "image" && task.imageType === "chronicle") {
          if (!task.chronicleId || !task.imageRefId) continue;
          const chronicleId = task.chronicleId;
          const isCover = task.imageRefId === "__cover_image__";
          const imageId = task.result?.imageId || "";

          if (task.status === "complete") {
            if (!imageId) {
              const error = "Image generation returned no image id";
              if (isCover) {
                updates.push(
                  updateChronicleCoverImageStatus(chronicleId, {
                    status: "failed",
                    error,
                  })
                );
              } else {
                updates.push(
                  updateChronicleImageRef(chronicleId, task.imageRefId, {
                    status: "failed",
                    error,
                  })
                );
              }
            } else if (isCover) {
              updates.push(
                updateChronicleCoverImageStatus(chronicleId, {
                  status: "complete",
                  generatedImageId: imageId,
                })
              );
            } else {
              updates.push(
                updateChronicleImageRef(chronicleId, task.imageRefId, {
                  status: "complete",
                  generatedImageId: imageId,
                })
              );
            }
          } else {
            const error = task.error || "Image generation failed";
            if (isCover) {
              updates.push(
                updateChronicleCoverImageStatus(chronicleId, {
                  status: "failed",
                  error,
                })
              );
            } else {
              updates.push(
                updateChronicleImageRef(chronicleId, task.imageRefId, {
                  status: "failed",
                  error,
                })
              );
            }
          }

          chronicleIds.add(chronicleId);
          continue;
        }

        // Era narrative images — chronicleId is repurposed as narrativeId
        if (task.type === "image" && task.imageType === "era_narrative") {
          const narrativeId = task.chronicleId;
          if (!narrativeId || !task.imageRefId) continue;
          const isCover = task.imageRefId === "__cover_image__";
          const imageId = task.result?.imageId || "";

          if (task.status === "complete") {
            if (!imageId) {
              const error = "Image generation returned no image id";
              if (isCover) {
                updates.push(
                  updateEraNarrativeCoverImageStatus(narrativeId, "failed", undefined, error)
                );
              } else {
                updates.push(
                  updateEraNarrativeImageRefStatus(
                    narrativeId,
                    task.imageRefId,
                    "failed",
                    undefined,
                    error
                  )
                );
              }
            } else if (isCover) {
              updates.push(updateEraNarrativeCoverImageStatus(narrativeId, "complete", imageId));
            } else {
              updates.push(
                updateEraNarrativeImageRefStatus(narrativeId, task.imageRefId, "complete", imageId)
              );
            }
          } else {
            const error = task.error || "Image generation failed";
            if (isCover) {
              updates.push(
                updateEraNarrativeCoverImageStatus(narrativeId, "failed", undefined, error)
              );
            } else {
              updates.push(
                updateEraNarrativeImageRefStatus(
                  narrativeId,
                  task.imageRefId,
                  "failed",
                  undefined,
                  error
                )
              );
            }
          }
          // No chronicle refresh needed — EraNarrativeViewer polls directly
          continue;
        }

        if (task.type === "historianPrep") {
          if (task.chronicleId) chronicleIds.add(task.chronicleId);
          continue;
        }

        if (task.type === "entityChronicle") {
          // Prefer result's chronicleId (the actual ID that was updated) over input chronicleId
          const chronicleId = task.result?.chronicleId || task.chronicleId;
          if (chronicleId) {
            chronicleIds.add(chronicleId);
          } else {
            console.log(
              "[ChronicleQueueWatcher] No chronicleId found on task, triggering refreshAll"
            );
            refreshAll = true;
          }
        }
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
          store.refreshAll();
        }
        for (const id of chronicleIds) {
          console.log("[ChronicleQueueWatcher] Calling refreshChronicle for:", id);
          store.refreshChronicle(id);
        }
      };

      if (updates.length > 0) {
        Promise.allSettled(updates).then(refresh);
      } else {
        refresh();
      }
    }
  }, [queue]);
}
