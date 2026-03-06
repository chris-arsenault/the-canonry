import { db, type WorldSchemaRecord } from "./illuminatorDb";
import type { CanonrySchemaSlice } from "@canonry/world-schema";

export async function getSchema(projectId: string): Promise<WorldSchemaRecord | undefined> {
  return db.worldSchemas.get(projectId);
}

export async function upsertSchema(projectId: string, schema: CanonrySchemaSlice): Promise<void> {
  await db.worldSchemas.put({
    projectId,
    schema,
    updatedAt: Date.now(),
  });
}
