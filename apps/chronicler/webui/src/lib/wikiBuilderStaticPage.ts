/**
 * wikiBuilderStaticPage — static page, region page, and template variable handling
 */

import type {
  WorldState,
  LoreData,
  WikiPage,
  WikiSection,
  HardState,
  Region,
} from "../types/world.ts";
import type { Optional } from "@the-canonry/shared-components";
import { applyWikiLinks } from "./entityLinking.ts";
import {
  slugify,
  capitalize,
  buildStaticPageSlug,
  extractLinkedEntities,
} from "./wikiBuilderUtils.ts";
import type { StaticPage } from "./staticPageStorage.ts";

// --- Template variable processing ---

interface TemplateContext {
  worldData: WorldState;
  loreData: LoreData | null;
}

function resolveWorldContext(worldData: WorldState): string {
  const era = worldData.metadata?.era;
  if (!era) return "";
  const tickSuffix = worldData.metadata?.tick ? ` (Tick ${worldData.metadata.tick})` : "";
  return `Era: ${era}${tickSuffix}`;
}

function resolveKindsSummary(worldData: WorldState): string {
  const kindCounts = new Map<string, number>();
  for (const e of worldData.hardState) kindCounts.set(e.kind, (kindCounts.get(e.kind) || 0) + 1);
  return Array.from(kindCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([kind, count]) => `- **${kind}:** ${count}`)
    .join("\n");
}

function resolveEntityRef(entityName: string, worldData: WorldState): string {
  const entity = worldData.hardState.find((e) => e.name.toLowerCase() === entityName.toLowerCase());
  if (!entity) return `_Entity "${entityName}" not found_`;
  const kindLabel = entity.subtype ? `${entity.kind} - ${entity.subtype}` : entity.kind;
  return `**[[${entity.name}]]** (${kindLabel})`;
}

// eslint-disable-next-line complexity -- switch dispatches to 6 distinct template variable resolvers — each case processes a different variable type
function resolveTemplateVariable(trimmed: string, worldData: WorldState): string | null {
  switch (trimmed) {
    case "world.context": return resolveWorldContext(worldData);
    case "cultures": {
      const cultures = worldData.schema?.cultures || [];
      if (cultures.length === 0) return "_No cultures defined_";
      return cultures.map((c: { id: string; name: Optional<string> }) => `- **${c.name || c.id}**`).join("\n");
    }
    case "eras": {
      const eras = worldData.hardState.filter((e) => e.kind === "era");
      if (eras.length === 0) return "_No eras_";
      return eras.map((e) => `- [[${e.name}]]`).join("\n");
    }
    case "stats": {
      const entityCount = worldData.hardState.length;
      const relCount = worldData.relationships.length;
      const eraCount = worldData.hardState.filter((e) => e.kind === "era").length;
      return `- **Entities:** ${entityCount}\n- **Relationships:** ${relCount}\n- **Eras:** ${eraCount}`;
    }
    case "kinds": return resolveKindsSummary(worldData);
    default:
      if (trimmed.startsWith("entity:")) return resolveEntityRef(trimmed.slice(7).trim(), worldData);
      return null;
  }
}

function processTemplateVariables(content: string, ctx: TemplateContext): string {
  const { worldData } = ctx;
  // eslint-disable-next-line sonarjs/slow-regex -- character-class bounded, no backtracking
  return content.replace(/\{\{([^}]+)\}\}/g, (match: string, variable: string) => {
    const resolved = resolveTemplateVariable(variable.trim(), worldData);
    return resolved ?? match;
  });
}

// --- Static page ---

function buildStaticPageSections(content: string): { sections: WikiSection[] } {
  const trimmed = content.trim();
  if (!trimmed) return { sections: [] };

  let body = trimmed;
  let pageTitle = "";
  if (body.startsWith("# ")) {
    const lines = body.split("\n");
    pageTitle = lines[0].replace(/^#\s+/, "").trim();
    body = lines.slice(1).join("\n").trim();
  }

  const sections: WikiSection[] = [];
  let currentHeading = pageTitle || "Content";
  let buffer: string[] = [];
  let sectionIndex = 0;

  const flush = () => {
    const sectionBody = buffer.join("\n").trim();
    if (!sectionBody) return;
    sections.push({ id: `static-section-${sectionIndex}`, heading: currentHeading || "Content", level: 2, content: sectionBody });
    sectionIndex++;
  };

  for (const line of body.split("\n")) {
    if (line.startsWith("## ")) { flush(); currentHeading = line.replace(/^##\s+/, "").trim() || "Content"; buffer = []; continue; }
    buffer.push(line);
  }
  flush();

  if (sections.length === 0 && body) {
    sections.push({ id: "static-section-0", heading: pageTitle || "Content", level: 2, content: body });
  }
  return { sections };
}

export function buildStaticPageFromStaticPage(
  staticPage: StaticPage, worldData: WorldState, loreData: LoreData | null,
  aliasIndex: Map<string, string>, pageNameIndex: Map<string, string>
): WikiPage {
  const processedContent = processTemplateVariables(staticPage.content, { worldData, loreData });
  const { sections } = buildStaticPageSections(processedContent);

  const linkableNames: Array<{ name: string; id: string }> = [];
  for (const entity of worldData.hardState) linkableNames.push({ name: entity.name, id: entity.id });
  for (const [name, id] of pageNameIndex) {
    if (!linkableNames.some((n) => n.name.toLowerCase() === name)) linkableNames.push({ name, id });
  }

  const linkedContent = applyWikiLinks(processedContent, linkableNames);
  const linkedEntities = Array.from(new Set(
    extractLinkedEntities(
      [{ id: "temp", heading: "", level: 2, content: linkedContent }],
      worldData, aliasIndex, pageNameIndex
    )
  ));

  return {
    id: staticPage.pageId, slug: buildStaticPageSlug(staticPage), title: staticPage.title, type: "static",
    static: { pageId: staticPage.pageId, status: staticPage.status },
    content: { sections, summary: staticPage.summary || undefined },
    categories: [], linkedEntities, images: [], lastUpdated: staticPage.updatedAt,
  };
}

// --- Region page ---

export function buildRegionPage(
  region: Region, entityKind: string, worldData: WorldState,
  _aliasIndex: Map<string, string>
): WikiPage {
  const entitiesInRegion = worldData.hardState.filter(
    (e) => e.regionId === region.id || e.allRegionIds?.includes(region.id)
  );

  const byKind = new Map<string, HardState[]>();
  for (const entity of entitiesInRegion) {
    if (!byKind.has(entity.kind)) byKind.set(entity.kind, []);
    byKind.get(entity.kind)!.push(entity);
  }

  const sections: WikiSection[] = [];
  const overviewLines: string[] = [];
  if (region.description) overviewLines.push(region.description);
  if (region.culture) {
    const culture = worldData.schema.cultures.find((c) => c.id === region.culture);
    overviewLines.push(`**Culture:** ${culture?.name ?? region.culture}`);
  }
  overviewLines.push(`**Entity Kind:** ${entityKind}`);
  overviewLines.push(`**Total Entities:** ${entitiesInRegion.length}`);
  sections.push({ id: "overview", heading: "Overview", level: 2, content: overviewLines.join("\n\n") });

  for (const [kind, entities] of byKind) {
    const rows = [...entities]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((e) => `| [[${e.name}]] | ${e.subtype} | ${e.status} |`)
      .join("\n");
    sections.push({
      id: `entities-${kind}`, heading: capitalize(kind), level: 2,
      content: `| Name | Subtype | Status |\n|------|---------|--------|\n${rows}`,
    });
  }

  return {
    id: `region:${region.id}`, slug: `region/${slugify(region.label)}`, title: region.label, type: "region",
    content: { sections, summary: region.description },
    categories: [`region-${entityKind}`],
    linkedEntities: entitiesInRegion.map((e) => e.id),
    images: [], lastUpdated: region.createdAt ?? Date.now(),
  };
}
