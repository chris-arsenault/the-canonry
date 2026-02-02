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
import { copyEditTask } from './copyEditTask';
import { historianReviewTask } from './historianReviewTask';

export const TASK_HANDLERS = {
  description: descriptionTask,
  image: imageTask,
  entityChronicle: chronicleTask,
  paletteExpansion: paletteExpansionTask,
  dynamicsGeneration: dynamicsGenerationTask,
  summaryRevision: summaryRevisionTask,
  chronicleLoreBackport: chronicleLoreBackportTask,
  copyEdit: copyEditTask,
  historianReview: historianReviewTask,
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
  copyEditTask,
  historianReviewTask,
};
