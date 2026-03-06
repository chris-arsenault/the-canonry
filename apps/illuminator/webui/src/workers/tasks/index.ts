import type { WorkerTask } from "../../lib/enrichmentTypes";
import type { TaskHandlerMap, TaskContext } from "./taskTypes";
import type { TaskResult } from "../types";
import { descriptionTask } from "./descriptionTask";
import { visualThesisTask } from "./visualThesisTask";
import { imageTask } from "./imageTask";
import { chronicleTask } from "./chronicleTask";
import { paletteExpansionTask } from "./paletteExpansionTask";
import { dynamicsGenerationTask } from "./dynamicsGenerationTask";
import { summaryRevisionTask } from "./summaryRevisionTask";
import { chronicleLoreBackportTask } from "./chronicleLoreBackportTask";
import { historianEditionTask } from "./historianEditionTask";
import { historianReviewTask } from "./historianReviewTask";
import { historianChronologyTask } from "./historianChronologyTask";
import { historianPrepTask } from "./historianPrepTask";
import { eraNarrativeTask } from "./eraNarrativeTask";
import { motifVariationTask } from "./motifVariationTask";
import { factCoverageTask } from "./factCoverageTask";
import { toneRankingTask } from "./toneRankingTask";
import { bulkToneRankingTask } from "./bulkToneRankingTask";

export const TASK_HANDLERS = {
  description: descriptionTask,
  visualThesis: visualThesisTask,
  image: imageTask,
  entityChronicle: chronicleTask,
  paletteExpansion: paletteExpansionTask,
  dynamicsGeneration: dynamicsGenerationTask,
  summaryRevision: summaryRevisionTask,
  chronicleLoreBackport: chronicleLoreBackportTask,
  historianEdition: historianEditionTask,
  historianReview: historianReviewTask,
  historianChronology: historianChronologyTask,
  historianPrep: historianPrepTask,
  eraNarrative: eraNarrativeTask,
  motifVariation: motifVariationTask,
  factCoverage: factCoverageTask,
  toneRanking: toneRankingTask,
  bulkToneRanking: bulkToneRankingTask,
} satisfies TaskHandlerMap;

export async function executeTask<TType extends WorkerTask["type"]>(
  task: Extract<WorkerTask, { type: TType }>,
  context: TaskContext
): Promise<TaskResult> {
  const handler = TASK_HANDLERS[task.type];

  // Wrap llmClient to auto-inject streaming callbacks into every complete() call.
  // This is transparent to task handlers — they call llmClient.complete() as usual.
  if (context.onThinkingDelta || context.onTextDelta) {
    const original = context.llmClient;
    const wrapped = Object.create(original) as typeof original;
    wrapped.complete = (req) =>
      original.complete({
        ...req,
        onThinkingDelta: context.onThinkingDelta,
        onTextDelta: context.onTextDelta,
      });
    return handler.execute(task, { ...context, llmClient: wrapped });
  }

  return handler.execute(task, context);
}

export {
  descriptionTask,
  visualThesisTask,
  imageTask,
  chronicleTask,
  paletteExpansionTask,
  dynamicsGenerationTask,
  summaryRevisionTask,
  chronicleLoreBackportTask,
  historianEditionTask,
  historianReviewTask,
  historianChronologyTask,
  historianPrepTask,
  eraNarrativeTask,
  motifVariationTask,
  factCoverageTask,
  toneRankingTask,
  bulkToneRankingTask,
};
