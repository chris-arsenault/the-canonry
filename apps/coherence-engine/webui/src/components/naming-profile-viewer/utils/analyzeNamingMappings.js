/**
 * Analyze generators and build naming mapping data
 */

import { findMatchingProfile } from './findMatchingProfile';

export function analyzeNamingMappings(generators, schema) {
  const mappings = [];
  const warnings = [];

  // Build culture lookup
  const culturesById = {};
  (schema.cultures || []).forEach(c => {
    culturesById[c.id] = c;
  });

  for (const gen of generators) {
    if (gen.enabled === false) continue;
    if (!gen.creation || gen.creation.length === 0) continue;

    for (const creation of gen.creation) {
      const entityKind = creation.kind;
      // Subtype can be a string or object - ensure we get a string
      const subtype = typeof creation.subtype === 'string' ? creation.subtype : null;
      const status = creation.status;
      const prominence = creation.prominence;
      const tags = creation.tags ? Object.keys(creation.tags) : [];

      // Determine culture source
      let cultureSource = null;
      let cultureIds = [];

      if (creation.culture) {
        if (typeof creation.culture === 'string') {
          cultureIds = [creation.culture];
          cultureSource = 'explicit';
        } else if (creation.culture.inherit) {
          cultureSource = 'inherited';
          // Culture is inherited from target - could be any culture
          cultureIds = Object.keys(culturesById);
        } else if (creation.culture.from) {
          cultureSource = 'reference';
          cultureIds = Object.keys(culturesById);
        }
      } else {
        // No culture specified - could be any
        cultureSource = 'any';
        cultureIds = Object.keys(culturesById);
      }

      // Check each possible culture for naming profile match
      for (const cultureId of cultureIds) {
        const culture = culturesById[cultureId];
        const namingConfig = culture?.naming;
        const hasProfiles = !!namingConfig?.profiles?.length;
        const match = hasProfiles
          ? findMatchingProfile(namingConfig, entityKind, subtype, prominence, tags)
          : null;

        mappings.push({
          generatorId: gen.id,
          generatorName: gen.name || gen.id,
          entityKind,
          subtype,
          prominence,
          cultureId,
          cultureName: culture?.name || cultureId,
          cultureColor: culture?.color || '#888',
          cultureSource,
          hasNamingProfile: hasProfiles,
          match,
        });

        // Add warning if no match found
        if (!match && hasProfiles) {
          warnings.push({
            generatorId: gen.id,
            generatorName: gen.name || gen.id,
            entityKind,
            subtype,
            cultureId,
            cultureName: culture?.name || cultureId,
            cultureSource,
            reason: 'No matching strategy group',
          });
        } else if (!hasProfiles) {
          warnings.push({
            generatorId: gen.id,
            generatorName: gen.name || gen.id,
            entityKind,
            subtype,
            cultureId,
            cultureName: culture?.name || cultureId,
            cultureSource,
            reason: 'Culture has no naming profiles',
          });
        }
      }
    }
  }

  return { mappings, warnings };
}
