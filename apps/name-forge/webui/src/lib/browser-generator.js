/**
 * Browser-compatible name generator
 *
 * Generates names using profiles, domains, grammars, and lexemes
 * entirely in the browser (no server required).
 */

import { createRNG, pickRandom, pickWeighted } from '@lib/utils/rng.js';
import { generatePhonotacticName } from '@lib/phonotactic-pipeline.js';

// Markov model cache
const markovModelCache = new Map();

/**
 * Load a Markov model from the public directory
 */
async function loadMarkovModel(modelId) {
  if (markovModelCache.has(modelId)) {
    return markovModelCache.get(modelId);
  }

  try {
    const response = await fetch(`${import.meta.env.BASE_URL}markov-models/${modelId}.json`);
    if (!response.ok) {
      console.warn(`Markov model '${modelId}' not found`);
      return null;
    }
    const model = await response.json();
    markovModelCache.set(modelId, model);
    return model;
  } catch (error) {
    console.warn(`Failed to load Markov model '${modelId}':`, error);
    return null;
  }
}

/**
 * Generate a name from a Markov model
 */
function generateFromMarkov(model, rng, options = {}) {
  const { minLength = 3, maxLength = 12 } = options;

  // Pick start state using weighted random
  let state = weightedRandom(model.startStates, rng);
  let result = '';

  for (let i = 0; i < maxLength + model.order; i++) {
    const nextProbs = model.transitions[state];
    if (!nextProbs) break;

    const next = weightedRandom(nextProbs, rng);
    if (next === '$') { // END token
      if (result.length >= minLength) break;
      continue;
    }

    result += next;
    state = state.slice(1) + next;
  }

  // Capitalize first letter
  return result.charAt(0).toUpperCase() + result.slice(1);
}

/**
 * Weighted random selection
 */
function weightedRandom(probs, rng) {
  const r = rng();
  let sum = 0;
  for (const [item, prob] of Object.entries(probs)) {
    sum += prob;
    if (r <= sum) return item;
  }
  return Object.keys(probs)[0];
}

/**
 * Generate test names using a profile
 *
 * @param {Object} options
 * @param {Object} options.profile - The naming profile with strategyGroups
 * @param {Array} options.domains - Available domains for phonotactic generation
 * @param {Array} options.grammars - Available grammars for grammar-based generation
 * @param {Object} options.lexemes - Lexeme lists keyed by ID
 * @param {number} options.count - Number of names to generate
 * @param {string} options.seed - Optional seed for reproducibility
 * @param {Object} options.context - Context key-value pairs for context:key slots
 * @returns {Promise<Object>} { names: string[], strategyUsage: Record<string, number> }
 */
export async function generateTestNames({
  profile,
  domains = [],
  grammars = [],
  lexemes = {},
  count = 10,
  seed,
  context = {}
}) {
  if (!profile) {
    throw new Error('Profile required');
  }

  // Pre-load any Markov models referenced in grammars
  const markovModels = await preloadMarkovModels(grammars);

  const rng = createRNG(seed || `test-${Date.now()}`);
  const names = [];
  const strategyUsage = { grammar: 0, phonotactic: 0, markov: 0, fallback: 0 };

  // Get default strategy group (lowest priority / fallback)
  const groups = profile.strategyGroups || [];
  const sortedGroups = [...groups].sort((a, b) => (a.priority || 0) - (b.priority || 0));
  const defaultGroup = sortedGroups[0];

  if (!defaultGroup?.strategies?.length) {
    // No strategies - generate fallback names
    for (let i = 0; i < count; i++) {
      names.push(generateFallbackName(lexemes, rng, i));
      strategyUsage.fallback++;
    }
    return { names, strategyUsage };
  }

  const allStrategies = defaultGroup.strategies;

  // Calculate total weight
  const totalWeight = allStrategies.reduce((sum, s) => sum + (s.weight || 0), 0);

  // Separate strategies by type
  const grammarStrategies = allStrategies.filter(s => (s.type || s.kind) === 'grammar');
  const phonotacticStrategies = allStrategies.filter(s => (s.type || s.kind) === 'phonotactic');

  const grammarWeight = grammarStrategies.reduce((sum, s) => sum + (s.weight || 0), 0) / (totalWeight || 1);
  const phonotacticWeight = phonotacticStrategies.reduce((sum, s) => sum + (s.weight || 0), 0) / (totalWeight || 1);

  // Convert lexemes object to array for easier lookup
  const lexemeLists = Object.entries(lexemes)
    .filter(([, list]) => !list.type || list.type === 'lexeme')
    .map(([id, list]) => ({
      id,
      entries: list.entries || []
    }));

  for (let i = 0; i < count; i++) {
    let name;
    let strategyUsed;

    const roll = rng();

    if (grammarStrategies.length > 0 && roll < grammarWeight) {
      // Use grammar strategy
      const strategy = pickRandom(rng, grammarStrategies);
      const grammar = grammars.find(g => g.id === strategy.grammarId);

      if (grammar) {
        const result = expandGrammar(grammar, lexemeLists, domains, markovModels, rng, context);
        name = result.name;
        strategyUsed = result.usedMarkov ? 'markov' : 'grammar';
      } else {
        name = generateFallbackName(lexemes, rng, i);
        strategyUsed = 'fallback';
      }
    } else if (phonotacticStrategies.length > 0) {
      // Use phonotactic strategy
      const strategy = pickRandom(rng, phonotacticStrategies);
      const domain = domains.find(d => d.id === strategy.domainId);

      if (domain) {
        name = generatePhonotacticName(rng, domain);
        strategyUsed = 'phonotactic';
      } else if (domains.length > 0) {
        // Use any available domain
        name = generatePhonotacticName(rng, domains[0]);
        strategyUsed = 'phonotactic';
      } else {
        name = generateFallbackName(lexemes, rng, i);
        strategyUsed = 'fallback';
      }
    } else {
      name = generateFallbackName(lexemes, rng, i);
      strategyUsed = 'fallback';
    }

    strategyUsage[strategyUsed] = (strategyUsage[strategyUsed] || 0) + 1;
    names.push(name);
  }

  return { names, strategyUsage };
}

/**
 * Pre-load Markov models referenced in grammars
 */
async function preloadMarkovModels(grammars) {
  const modelIds = new Set();

  // Scan all grammar rules for markov: references
  for (const grammar of grammars) {
    for (const productions of Object.values(grammar.rules || {})) {
      for (const production of productions) {
        for (const token of production) {
          if (token.includes('markov:')) {
            // Extract model ID (handle suffixes like markov:norse^'s)
            const match = token.match(/markov:([a-z]+)/);
            if (match) {
              modelIds.add(match[1]);
            }
          }
        }
      }
    }
  }

  // Load all referenced models
  const models = new Map();
  await Promise.all(
    Array.from(modelIds).map(async (id) => {
      const model = await loadMarkovModel(id);
      if (model) {
        models.set(id, model);
      }
    })
  );

  return models;
}

/**
 * Expand a grammar rule to generate a name
 *
 * Grammar format: { id, start, rules: { symbol: [["token1", "token2"], [...]] } }
 * Token types:
 *   - slot:lexeme_id   → pick from lexeme list
 *   - domain:domain_id → generate phonotactic name from domain
 *   - markov:model_id  → generate from Markov chain
 *   - context:key      → resolve from context object (empty string if missing)
 *   - other            → literal text or rule reference
 *
 * @returns {{ name: string, usedMarkov: boolean }}
 */
function expandGrammar(grammar, lexemeLists, domains, markovModels, rng, userContext = {}) {
  const startSymbol = grammar.start || 'name';
  const rules = grammar.rules || {};
  const expansionContext = { usedMarkov: false, userContext };

  const name = expandSymbol(startSymbol, rules, lexemeLists, domains, markovModels, rng, expansionContext, 0);
  return { name, usedMarkov: expansionContext.usedMarkov };
}

function expandSymbol(symbol, rules, lexemeLists, domains, markovModels, rng, context, depth) {
  if (depth > 10) {
    return symbol; // Prevent infinite recursion
  }

  const productions = rules[symbol];
  if (!productions || productions.length === 0) {
    // No rule for this symbol - treat as literal/slot
    return resolveToken(symbol, lexemeLists, domains, markovModels, rng, context, depth);
  }

  // Pick random production
  const production = pickRandom(rng, productions);

  // Expand each token in the production
  const parts = production.map(token => {
    // Check if token contains multiple references separated by hyphens
    if (token.includes('-') && (token.includes('slot:') || token.includes('domain:') || token.includes('markov:') || token.includes('context:'))) {
      const subParts = token.split('-');
      return subParts.map(part => {
        // Check if this part is a rule reference
        if (rules[part.trim()]) {
          return expandSymbol(part.trim(), rules, lexemeLists, domains, markovModels, rng, context, depth + 1);
        }
        return resolveToken(part.trim(), lexemeLists, domains, markovModels, rng, context, depth);
      }).join('-');
    }
    // Check if token is a rule reference (non-terminal)
    if (rules[token]) {
      return expandSymbol(token, rules, lexemeLists, domains, markovModels, rng, context, depth + 1);
    }
    return resolveToken(token, lexemeLists, domains, markovModels, rng, context, depth);
  });

  return parts.join(' ').trim();
}

function resolveToken(token, lexemeLists, domains, markovModels, rng, context, depth = 0) {
  // Check for ^ terminator suffix (e.g., "domain:tech^'s" → resolve domain, append "'s")
  let suffix = '';
  let baseToken = token;
  const caretIndex = token.indexOf('^');
  if (caretIndex !== -1) {
    baseToken = token.substring(0, caretIndex);
    suffix = token.substring(caretIndex + 1);
  }

  // Handle slot:listId references (lexeme lists)
  if (baseToken.startsWith('slot:')) {
    const listId = baseToken.substring(5);
    const list = lexemeLists.find(l => l.id === listId);
    if (list && list.entries.length > 0) {
      return pickRandom(rng, list.entries) + suffix;
    }
    return listId + suffix; // Return the ID if list not found
  }

  // Handle domain:domainId references (phonotactic generation)
  if (baseToken.startsWith('domain:')) {
    const domainId = baseToken.substring(7);
    const domain = domains.find(d => d.id === domainId);
    if (domain) {
      return generatePhonotacticName(rng, domain) + suffix;
    }
    return domainId + suffix; // Return the ID if domain not found
  }

  // Handle markov:modelId references
  if (baseToken.startsWith('markov:')) {
    const modelId = baseToken.substring(7);
    const model = markovModels.get(modelId);

    if (model) {
      context.usedMarkov = true;
      return generateFromMarkov(model, rng) + suffix;
    }

    // Fallback to phonotactic if model not loaded
    console.warn(`Markov model '${modelId}' not available, falling back to phonotactic`);
    if (domains.length > 0) {
      return generatePhonotacticName(rng, domains[0]) + suffix;
    }
    return modelId + suffix;
  }

  // Handle context:key references (user-provided context values)
  if (baseToken.startsWith('context:')) {
    const key = baseToken.substring(8);
    const userContext = context.userContext || {};
    // Return the context value or empty string if not found
    const value = userContext[key];
    return (value !== undefined && value !== null ? String(value) : '') + suffix;
  }

  // Return literal as-is
  return token;
}

/**
 * Generate a fallback name from available lexeme lists
 */
function generateFallbackName(lexemes, rng, index) {
  const lexemeLists = Object.values(lexemes).filter(l => l.entries?.length > 0);

  if (lexemeLists.length === 0) {
    return `Name-${index + 1}`;
  }

  const parts = [];
  const numParts = Math.floor(rng() * 2) + 1; // 1-2 parts

  for (let i = 0; i < numParts; i++) {
    const list = pickRandom(rng, lexemeLists);
    if (list.entries.length > 0) {
      parts.push(pickRandom(rng, list.entries));
    }
  }

  if (parts.length === 0) {
    return `Name-${index + 1}`;
  }

  // Capitalize first letter
  const name = parts.join('-');
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * Generate names directly from a domain (without profile)
 */
export function generateNamesFromDomain(domain, count = 10, seed) {
  const rng = createRNG(seed || `domain-${Date.now()}`);
  const names = [];

  for (let i = 0; i < count; i++) {
    names.push(generatePhonotacticName(rng, domain));
  }

  return names;
}
