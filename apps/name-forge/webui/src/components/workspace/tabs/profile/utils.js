/**
 * Profile utility functions for generator matching and usage computation
 */

/**
 * Analyze which generators will match a specific strategy group's conditions
 */
export function findMatchingGenerators(generators, cultureId, conditions) {
  if (!generators || generators.length === 0) return [];

  const matches = [];

  for (const gen of generators) {
    if (gen.enabled === false) continue;
    const creations = gen.creation || [];

    for (const creation of creations) {
      // Check if this creation could use this culture
      let matchesCulture = false;
      if (creation.culture) {
        if (typeof creation.culture === 'string') {
          matchesCulture = creation.culture === cultureId;
        } else if (creation.culture.inherit || creation.culture.from) {
          // Inherited culture - could be any culture
          matchesCulture = true;
        }
      } else {
        // No culture specified - could be any
        matchesCulture = true;
      }

      if (!matchesCulture) continue;

      // Check if conditions match (if any)
      if (!conditions) {
        // No conditions = default group, matches everything
        matches.push({
          generatorId: gen.id,
          generatorName: gen.name || gen.id,
          entityKind: creation.kind,
          subtype: typeof creation.subtype === 'string' ? creation.subtype : null,
          isDefault: true,
        });
        continue;
      }

      // Check entity kind condition
      const entityKinds = conditions.entityKinds || [];
      if (entityKinds.length > 0 && !entityKinds.includes(creation.kind)) {
        continue;
      }

      // Check subtype condition
      const subtypes = conditions.subtypes || [];
      const creationSubtype = typeof creation.subtype === 'string' ? creation.subtype : null;
      if (subtypes.length > 0) {
        if (!creationSubtype || !subtypes.includes(creationSubtype)) {
          continue;
        }
      }

      // Check prominence condition
      const prominence = conditions.prominence || [];
      if (prominence.length > 0 && creation.prominence) {
        if (!prominence.includes(creation.prominence)) {
          continue;
        }
      }

      // Check tags condition
      const conditionTags = conditions.tags || [];
      if (conditionTags.length > 0) {
        const creationTags = creation.tags ? Object.keys(creation.tags) : [];
        if (conditions.tagMatchAll) {
          if (!conditionTags.every(t => creationTags.includes(t))) {
            continue;
          }
        } else {
          if (!conditionTags.some(t => creationTags.includes(t))) {
            continue;
          }
        }
      }

      // Matches!
      matches.push({
        generatorId: gen.id,
        generatorName: gen.name || gen.id,
        entityKind: creation.kind,
        subtype: creationSubtype,
        isDefault: false,
      });
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

    for (const group of (profile.strategyGroups || [])) {
      const matches = findMatchingGenerators(generators, cultureId, group.conditions);
      usage[profile.id].groups[group.name || 'Default'] = matches;
      usage[profile.id].totalMatches += matches.length;
    }
  }

  return usage;
}
