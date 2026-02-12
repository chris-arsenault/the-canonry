import { db, type CoordinateStateRecord } from './illuminatorDb';
import type { CoordinateState } from '@canonry/world-schema';

export async function getCoordinateState(
  simulationRunId: string,
): Promise<CoordinateStateRecord | undefined> {
  return db.coordinateStates.get(simulationRunId);
}

export async function upsertCoordinateState(
  simulationRunId: string,
  coordinateState: CoordinateState,
): Promise<void> {
  await db.coordinateStates.put({
    simulationRunId,
    coordinateState,
    updatedAt: Date.now(),
  });
}
