/**
 * Analyze generators and build naming mapping data
 */

import { findMatchingProfile } from "./findMatchingProfile";

function getCultureSourceAndIds(creation, culturesById) {
  if (!creation.culture) return { cultureSource: "any", cultureIds: Object.keys(culturesById) };
  if (typeof creation.culture === "string") return { cultureSource: "explicit", cultureIds: [creation.culture] };
  if (creation.culture.inherit) return { cultureSource: "inherited", cultureIds: Object.keys(culturesById) };
  if (creation.culture.from) return { cultureSource: "reference", cultureIds: Object.keys(culturesById) };
  return { cultureSource: "any", cultureIds: Object.keys(culturesById) };
}

function processCreation(gen, creation, culturesById, mappings, warnings) {
  const { cultureSource, cultureIds } = getCultureSourceAndIds(creation, culturesById);
  const entityKind = creation.kind;
  const subtype = typeof creation.subtype === "string" ? creation.subtype : null;
  const prominence = creation.prominence;
  const tags = creation.tags ? Object.keys(creation.tags) : [];

  for (const cultureId of cultureIds) {
    const culture = culturesById[cultureId];
    const namingConfig = culture?.naming;
    const hasProfiles = !!namingConfig?.profiles?.length;
    const match = hasProfiles
      ? findMatchingProfile(namingConfig, entityKind, subtype, prominence, tags)
      : null;

    mappings.push({
      generatorId: gen.id, generatorName: gen.name || gen.id,
      entityKind, subtype, prominence, cultureId,
      cultureName: culture?.name || cultureId, cultureColor: culture?.color || "#888",
      cultureSource, hasNamingProfile: hasProfiles, match,
    });

    if (!match && hasProfiles) {
      warnings.push({ generatorId: gen.id, generatorName: gen.name || gen.id, entityKind, subtype, cultureId, cultureName: culture?.name || cultureId, cultureSource, reason: "No matching strategy group" });
    } else if (!hasProfiles) {
      warnings.push({ generatorId: gen.id, generatorName: gen.name || gen.id, entityKind, subtype, cultureId, cultureName: culture?.name || cultureId, cultureSource, reason: "Culture has no naming profiles" });
    }
  }
}

export function analyzeNamingMappings(generators, schema) {
  const mappings = [];
  const warnings = [];
  const culturesById = {};
  (schema.cultures || []).forEach((c) => { culturesById[c.id] = c; });

  for (const gen of generators) {
    if (gen.enabled === false) continue;
    if (!gen.creation || gen.creation.length === 0) continue;
    for (const creation of gen.creation) {
      processCreation(gen, creation, culturesById, mappings, warnings);
    }
  }
  return { mappings, warnings };
}
