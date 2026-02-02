/**
 * Get effective domain from culture config
 */
export function getEffectiveDomain(cultureConfig) {
  const domains = cultureConfig?.naming?.domains;
  if (domains && domains.length > 0) {
    return domains[0];
  }
  return null;
}

/**
 * Collect all domains from all cultures
 */
export function getAllDomains(allCultures) {
  const allDomains = [];
  if (allCultures) {
    Object.entries(allCultures).forEach(([cultId, cultConfig]) => {
      if (cultConfig?.naming?.domains) {
        cultConfig.naming.domains.forEach((domain) => {
          allDomains.push({
            ...domain,
            sourceCulture: cultId
          });
        });
      }
    });
  }
  return allDomains;
}

/**
 * Get strategy color based on type
 */
export function getStrategyColor(type) {
  switch (type) {
    case 'phonotactic': return 'rgba(59, 130, 246, 0.3)';
    case 'grammar': return 'rgba(147, 51, 234, 0.3)';
    default: return 'rgba(100, 100, 100, 0.3)';
  }
}

/**
 * Get strategy border color based on type
 */
export function getStrategyBorder(type) {
  switch (type) {
    case 'phonotactic': return 'rgba(59, 130, 246, 0.5)';
    case 'grammar': return 'rgba(147, 51, 234, 0.5)';
    default: return 'rgba(100, 100, 100, 0.5)';
  }
}

/**
 * Check if a lexeme list applies to a given culture/entity
 */
export function listAppliesHere(list, cultureId, entityKind) {
  const appliesTo = list.appliesTo || {};
  const cultures = appliesTo.cultures || [];
  const entityKinds = appliesTo.entityKinds || [];

  // Check culture match (empty array or '*' means all)
  const cultureMatch = cultures.length === 0 ||
    cultures.includes('*') ||
    cultures.includes(cultureId);

  // Check entity kind match
  const entityMatch = entityKinds.length === 0 ||
    entityKinds.includes('*') ||
    entityKinds.includes(entityKind);

  return cultureMatch && entityMatch;
}

/**
 * Get shared lexeme lists from other cultures/entity types
 */
export function getSharedLexemeLists(allCultures, cultureId, entityKind) {
  const shared = {};

  if (allCultures) {
    Object.entries(allCultures).forEach(([cultId, cultConfig]) => {
      if (cultId === cultureId) return;
      const lists = cultConfig?.naming?.lexemeLists || {};
      Object.entries(lists).forEach(([listId, list]) => {
        if (listAppliesHere(list, cultureId, entityKind) && !shared[listId]) {
          shared[listId] = {
            ...list,
            id: listId,
            sourceCulture: cultId,
            isShared: true
          };
        }
      });
    });
  }

  return shared;
}

/**
 * Get available lexeme lists (local and shared from same culture)
 */
export function getAvailableLexemeLists(entityConfig, cultureConfig, cultureId, entityKind) {
  const lists = [];
  // Local lists
  if (entityConfig?.lexemeLists) {
    Object.keys(entityConfig.lexemeLists).forEach(id => {
      lists.push({ id, source: 'local' });
    });
  }
  // Shared lists from same culture
  const cultureLists = cultureConfig?.naming?.lexemeLists || {};
  Object.entries(cultureLists).forEach(([id, list]) => {
    if (entityConfig?.lexemeLists && entityConfig.lexemeLists[id]) return;
    const appliesTo = list.appliesTo || {};
    const cultureMatch = !appliesTo.cultures?.length || appliesTo.cultures.includes('*') || appliesTo.cultures.includes(cultureId);
    const entityMatch = !appliesTo.entityKinds?.length || appliesTo.entityKinds.includes('*') || appliesTo.entityKinds.includes(entityKind);
    if (cultureMatch && entityMatch) {
      lists.push({ id, source: cultureId });
    }
  });
  return lists;
}

/**
 * Sort strategy groups by priority (highest first)
 */
export function getSortedGroups(groups) {
  if (!groups) return [];
  return [...groups].sort((a, b) => b.priority - a.priority);
}
