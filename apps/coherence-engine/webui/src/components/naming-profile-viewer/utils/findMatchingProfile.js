/**
 * Find which naming profile strategy group matches a given entity creation
 */

/**
 * Find which naming profile strategy group matches a given entity creation
 */

function matchesGroupConditions(cond, entityKind, subtype, prominence, tags) {
  if (cond.entityKinds?.length > 0 && !cond.entityKinds.includes(entityKind)) return false;
  if (cond.subtypes?.length > 0 && (!subtype || !cond.subtypes.includes(subtype))) return false;
  if (cond.prominence?.length > 0 && !cond.prominence.includes(prominence)) return false;
  if (cond.tags?.length > 0) {
    const entityTags = Array.isArray(tags) ? tags : Object.keys(tags || {});
    if (cond.tagMatchAll && !cond.tags.every((t) => entityTags.includes(t))) return false;
    if (!cond.tagMatchAll && !cond.tags.some((t) => entityTags.includes(t))) return false;
  }
  return true;
}

export function findMatchingProfile(namingConfig, entityKind, subtype, prominence, tags = []) {
  if (!namingConfig?.profiles) return null;
  for (const profile of namingConfig.profiles) {
    for (const group of profile.strategyGroups || []) {
      if (!matchesGroupConditions(group.conditions || {}, entityKind, subtype, prominence, tags)) continue;
      return { profileId: profile.id, profileName: profile.name, groupName: group.name, strategy: group.strategy, grammarId: group.grammarId };
    }
  }
  return null;
}
