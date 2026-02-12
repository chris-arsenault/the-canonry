import type { WorkerTask } from '../../lib/enrichmentTypes';
import type { TaskHandlerMap, TaskContext } from './taskTypes';
import type { TaskResult } from '../types';
import { descriptionTask } from './descriptionTask';
import { imageTask } from './imageTask';
import { chronicleTask } from './chronicleTask';
import { paletteExpansionTask } from './paletteExpansionTask';
import { dynamicsGenerationTask } from './dynamicsGenerationTask';
import { summaryRevisionTask } from './summaryRevisionTask';
import { chronicleLoreBackportTask } from './chronicleLoreBackportTask';
import { historianEditionTask } from './historianEditionTask';
import { historianReviewTask } from './historianReviewTask';
import { historianChronologyTask } from './historianChronologyTask';
import { historianPrepTask } from './historianPrepTask';
import { eraNarrativeTask } from './eraNarrativeTask';

export const TASK_HANDLERS = {
  description: descriptionTask,
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
} satisfies TaskHandlerMap;

export async function executeTask<TType extends WorkerTask['type']>(
  task: Extract<WorkerTask, { type: TType }>,
  context: TaskContext
): Promise<TaskResult> {
  const handler = TASK_HANDLERS[task.type];
  return handler.execute(task, context);
}

export {
  descriptionTask,
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
};
