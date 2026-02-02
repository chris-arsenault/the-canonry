/**
 * Find which naming profile strategy group matches a given entity creation
 */

export function findMatchingProfile(namingConfig, entityKind, subtype, prominence, tags = []) {
  if (!namingConfig?.profiles) return null;

  for (const profile of namingConfig.profiles) {
    for (const group of (profile.strategyGroups || [])) {
      const cond = group.conditions || {};

      // Check entity kind
      if (cond.entityKinds?.length > 0 && !cond.entityKinds.includes(entityKind)) {
        continue;
      }

      // Check subtype
      if (cond.subtypes?.length > 0) {
        if (cond.subtypeMatchAll) {
          // All subtypes must match - not applicable for single entity
          if (!subtype || !cond.subtypes.includes(subtype)) continue;
        } else {
          // Any subtype matches
          if (!subtype || !cond.subtypes.includes(subtype)) continue;
        }
      }

      // Check prominence
      if (cond.prominence?.length > 0 && !cond.prominence.includes(prominence)) {
        continue;
      }

      // Check tags
      if (cond.tags?.length > 0) {
        const entityTags = Array.isArray(tags) ? tags : Object.keys(tags || {});
        if (cond.tagMatchAll) {
          // All tags must be present
          if (!cond.tags.every(t => entityTags.includes(t))) continue;
        } else {
          // Any tag matches
          if (!cond.tags.some(t => entityTags.includes(t))) continue;
        }
      }

      // Found a match!
      return {
        profileId: profile.id,
        profileName: profile.name,
        groupName: group.name,
        strategy: group.strategy,
        grammarId: group.grammarId,
      };
    }
  }

  return null;
}
