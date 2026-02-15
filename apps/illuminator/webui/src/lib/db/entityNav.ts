import type { PersistedEntity } from './illuminatorDb';

export interface EntityNavItem {
  id: string;
  name: string;
  kind: string;
  subtype: string;
  prominence: number;
  culture: string;
  status: string;
  summary?: string;
  eraId?: string;

  // Enrichment status flags (lightweight projections of heavy enrichment object)
  hasDescription: boolean;
  hasVisualThesis: boolean;
  imageId?: string;
  descriptionCost?: number;
  imageCost?: number;
  aliases: string[];
  slugAliases: string[];
  backrefCount: number;
  unconfiguredBackrefCount: number;
  isManual: boolean;
  lockedSummary: boolean;
}

export function buildEntityNavItem(entity: PersistedEntity): EntityNavItem {
  const backrefs = entity.enrichment?.chronicleBackrefs || [];
  return {
    id: entity.id,
    name: entity.name,
    kind: entity.kind,
    subtype: entity.subtype,
    prominence: entity.prominence,
    culture: entity.culture,
    status: entity.status,
    summary: entity.summary,
    eraId: entity.eraId,
    hasDescription: !!(entity.summary && entity.description),
    hasVisualThesis: !!entity.enrichment?.text?.visualThesis,
    imageId: entity.enrichment?.image?.imageId,
    descriptionCost: entity.enrichment?.text?.actualCost,
    imageCost: entity.enrichment?.image?.actualCost,
    aliases: entity.enrichment?.text?.aliases || [],
    slugAliases: entity.enrichment?.slugAliases || [],
    backrefCount: backrefs.length,
    unconfiguredBackrefCount: backrefs.filter(
      (b: { imageSource?: unknown }) => b.imageSource === undefined,
    ).length,
    isManual: entity.id.startsWith('manual_'),
    lockedSummary: !!entity.lockedSummary,
  };
}
