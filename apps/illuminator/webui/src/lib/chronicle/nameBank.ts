/**
 * Name Bank Generator
 *
 * Generates a bank of culture-appropriate names for chronicles to use
 * when they need to invent minor characters to represent factions.
 */

import { generate } from 'name-forge';
import type { Culture } from 'name-forge';
import type { CultureDefinition } from '@canonry/world-schema';

const NAMES_PER_CULTURE = 4;

/**
 * Convert CultureDefinition (Canonry) to Culture (name-forge)
 */
export function toCulture(def: CultureDefinition): Culture | null {
  if (!def.naming) return null;

  return {
    id: def.id,
    name: def.name,
    description: def.description,
    domains: def.naming.domains || [],
    lexemeLists: def.naming.lexemeLists || {},
    grammars: def.naming.grammars || [],
    profiles: def.naming.profiles || [],
  };
}

/**
 * Generate a name bank for the given cultures.
 *
 * @param cultures - All culture definitions from the project
 * @param cultureIds - Culture IDs to generate names for
 * @returns Map of culture ID -> array of generated names
 */
export async function generateNameBank(
  cultures: CultureDefinition[],
  cultureIds: string[]
): Promise<Record<string, string[]>> {
  const nameBank: Record<string, string[]> = {};
  const uniqueCultureIds = [...new Set(cultureIds)];

  for (const cultureId of uniqueCultureIds) {
    const cultureDef = cultures.find((c) => c.id === cultureId);
    if (!cultureDef) continue;

    const culture = toCulture(cultureDef);
    if (!culture) continue;

    try {
      const result = await generate(culture, {
        kind: 'npc',
        count: NAMES_PER_CULTURE,
        seed: `namebank-${cultureId}-${Date.now()}`,
      });
      nameBank[cultureId] = result.names;
    } catch (e) {
      console.warn(`[NameBank] Failed to generate names for culture ${cultureId}:`, e);
      // Continue without names for this culture
    }
  }

  return nameBank;
}

/**
 * Extract unique culture IDs from a list of entities.
 */
export function extractCultureIds(
  entities: Array<{ culture?: string }>
): string[] {
  const cultureIds = entities
    .map((e) => e.culture)
    .filter((c): c is string => c !== undefined && c !== null && c !== '');
  return [...new Set(cultureIds)];
}
