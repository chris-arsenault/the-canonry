/**
 * Profile utility functions for generator matching and usage computation
 */

/** Check if a creation entry uses the specified culture. */
function creationMatchesCulture(creation, cultureId) {
  if (!creation.culture) return true;
  if (typeof creation.culture === "string") return creation.culture === cultureId;
  if (creation.culture.inherit || creation.culture.from) return true;
  return false;
}

/** Check if a creation entry matches the given conditions. Returns null if no match, or a match object. */
function matchCreationToConditions(creation, conditions, genId, genName) {
  const creationSubtype = typeof creation.subtype === "string" ? creation.subtype : null;

  if (!conditions) {
    return {
      generatorId: genId,
      generatorName: genName,
      entityKind: creation.kind,
      subtype: creationSubtype,
      isDefault: true,
    };
  }

  if (!matchEntityKind(conditions, creation.kind)) return null;
  if (!matchSubtype(conditions, creationSubtype)) return null;
  if (!matchProminence(conditions, creation.prominence)) return null;
  if (!matchTags(conditions, creation.tags)) return null;

  return {
    generatorId: genId,
    generatorName: genName,
    entityKind: creation.kind,
    subtype: creationSubtype,
    isDefault: false,
  };
}

function matchEntityKind(conditions, kind) {
  const entityKinds = conditions.entityKinds || [];
  return entityKinds.length === 0 || entityKinds.includes(kind);
}

function matchSubtype(conditions, creationSubtype) {
  const subtypes = conditions.subtypes || [];
  if (subtypes.length === 0) return true;
  return creationSubtype && subtypes.includes(creationSubtype);
}

function matchProminence(conditions, creationProminence) {
  const prominence = conditions.prominence || [];
  if (prominence.length === 0) return true;
  if (!creationProminence) return true;
  return prominence.includes(creationProminence);
}

function matchTags(conditions, creationTagsObj) {
  const conditionTags = conditions.tags || [];
  if (conditionTags.length === 0) return true;
  const creationTags = creationTagsObj ? Object.keys(creationTagsObj) : [];
  if (conditions.tagMatchAll) {
    return conditionTags.every((t) => creationTags.includes(t));
  }
  return conditionTags.some((t) => creationTags.includes(t));
}

/**
 * Analyze which generators will match a specific strategy group's conditions
 */
export function findMatchingGenerators(generators, cultureId, conditions) {
  if (!generators || generators.length === 0) return [];

  const matches = [];

  for (const gen of generators) {
    if (gen.enabled === false) continue;
    const creations = gen.creation || [];
    const genName = gen.name || gen.id;

    for (const creation of creations) {
      if (!creationMatchesCulture(creation, cultureId)) continue;

      const match = matchCreationToConditions(creation, conditions, gen.id, genName);
      if (match) matches.push(match);
    }
  }

  return matches;
}

/**
 * Compute generator usage for all profiles in a culture
 */
export function computeProfileGeneratorUsage(profiles, generators, cultureId) {
  const usage = {};

  for (const profile of profiles) {
    usage[profile.id] = {
      totalMatches: 0,
      groups: {},
    };

    for (const group of profile.strategyGroups || []) {
      const matches = findMatchingGenerators(generators, cultureId, group.conditions);
      usage[profile.id].groups[group.name || "Default"] = matches;
      usage[profile.id].totalMatches += matches.length;
    }
  }

  return usage;
}
