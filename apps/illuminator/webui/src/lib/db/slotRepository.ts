/**
 * Slot Repository — discrete per-slot simulation metadata.
 */

import { db, type SimulationSlotRecord } from './illuminatorDb';

export async function getSlot(
  projectId: string,
  slotIndex: number
): Promise<SimulationSlotRecord | undefined> {
  return db.simulationSlots.get([projectId, slotIndex]);
}

export async function upsertSlot(record: SimulationSlotRecord): Promise<void> {
  await db.simulationSlots.put(record);
}

export async function deleteSlot(
  projectId: string,
  slotIndex: number
): Promise<void> {
  await db.simulationSlots.delete([projectId, slotIndex]);
}
