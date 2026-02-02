/**
 * Browser-compatible name generator
 *
 * Thin wrapper around the name-forge lib.
 */

import { generate, generateFromDomain, previewGrammar } from '@lib/generate.js';
import { setMarkovBaseUrl } from '@lib/markov-loader.js';

// Configure base URL for Markov models in browser
// Vite serves from public/ directory
setMarkovBaseUrl(`${import.meta.env.BASE_URL}markov-models`);

function toNameForgeCulture(culture) {
  if (!culture) return null;
  const naming = culture.naming || {};
  return {
    ...culture,
    domains: naming.domains || culture.domains || [],
    lexemeLists: naming.lexemeLists || culture.lexemeLists || {},
    lexemeSpecs: naming.lexemeSpecs || culture.lexemeSpecs || [],
    grammars: naming.grammars || culture.grammars || [],
    profiles: naming.profiles || culture.profiles || [],
  };
}

/**
 * Generate names using a culture's configuration.
 *
 * @param {Object} options
 * @param {Object} options.culture - The culture object (from project.cultures[id])
 * @param {string} options.profileId - Which profile to use (optional, uses first if not specified)
 * @param {number} options.count - Number of names to generate
 * @param {string} options.seed - Optional seed for reproducibility
 * @param {Object} options.context - Context key-value pairs for context:key slots
 * @param {string} options.kind - Entity kind for condition matching
 * @param {string} options.subtype - Entity subtype for condition matching
 * @param {string} options.prominence - Prominence level for condition matching
 * @param {string[]} options.tags - Tags for condition matching
 * @returns {Promise<Object>} { names: string[], strategyUsage: Record<string, number> }
 */
export async function generateTestNames({
  culture,
  profileId,
  count = 10,
  seed,
  context = {},
  kind,
  subtype,
  prominence,
  tags = []
}) {
  const nameForgeCulture = toNameForgeCulture(culture);
  if (!nameForgeCulture) {
    throw new Error('Culture required');
  }

  if (!nameForgeCulture.profiles || nameForgeCulture.profiles.length === 0) {
    throw new Error('Culture has no profiles');
  }

  // generate() handles Markov model preloading internally
  return generate(nameForgeCulture, {
    cultureId: nameForgeCulture.id,
    profileId: profileId,
    context: context,
    count: count,
    seed: seed || `test-${Date.now()}`,
    kind: kind,
    subtype: subtype,
    prominence: prominence,
    tags: tags
  });
}

/**
 * Generate names directly from a domain (without profile)
 */
export function generateNamesFromDomain(domain, count = 10, seed) {
  return generateFromDomain(domain, count, seed);
}

/**
 * Preview a grammar by generating sample names.
 * Used for live preview in the grammar editor.
 *
 * @param {Object} options
 * @param {Object} options.grammar - The grammar to preview
 * @param {Array} options.domains - Available domains
 * @param {Object} options.lexemeLists - Available lexeme lists (keyed by id)
 * @param {number} options.count - Number of names to generate (default 8)
 * @returns {Promise<string[]>} Generated sample names
 */
export async function previewGrammarNames({ grammar, domains, lexemeLists, count = 8 }) {
  if (!grammar || !grammar.rules || Object.keys(grammar.rules).length === 0) {
    return [];
  }

  // Convert lexemeLists object to array format expected by lib
  const lexemeListsArray = Object.entries(lexemeLists || {}).map(([id, list]) => ({
    id,
    entries: list.entries || [],
    ...list
  }));

  return previewGrammar({
    grammar,
    domains: domains || [],
    lexemeLists: lexemeListsArray,
    count
  });
}
