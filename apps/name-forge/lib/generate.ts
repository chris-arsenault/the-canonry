/**
 * Name Generation Engine
 *
 * Single entrypoint for all name generation in name-forge.
 * Extracted from webui/src/lib/browser-generator.js to provide
 * a reusable lib that works in browser and Node.js.
 */

import { createRNG, pickRandom } from "./utils/rng.js";
import { applyCapitalization } from "./utils/helpers.js";
import { generatePhonotacticName } from "./phonotactic-pipeline.js";
import { preloadModels } from "./markov-loader.js";
import { applyDerivation, isDerivationType, type DerivationType } from "./derivation.js";
import type { NamingDomain } from "./types/domain.js";
import type {
  Culture,
  Grammar,
  LexemeList,
  Profile,
  StrategyGroup,
  Strategy,
  GenerateRequest,
  GenerateResult,
  NameDebugInfo,
  GroupMatchDebug,
} from "./types/project.js";
import type { MarkovModel } from "./markov.js";

// ============================================================================
// Generation Context (internal)
// ============================================================================

interface GenerationContext {
  rng: () => number;
  domains: NamingDomain[];
  grammars: Grammar[];
  lexemeLists: LexemeList[];
  markovModels: Map<string, MarkovModel>;
  userContext: Record<string, string>;
}

interface GrammarExpansionContext {
  usedMarkov: boolean;
  userContext: Record<string, string>;
}

// ============================================================================
// Profile Selection
// ============================================================================

/**
 * Select the appropriate profile for the given entity kind.
 *
 * Selection order:
 * 1. If profileId specified, use that exact profile
 * 2. Find first profile with matching entityKind (concrete match)
 * 3. Fall back to profile marked isDefault: true
 * 4. Return null if no match (caller should throw error)
 */
function selectProfile(
  profiles: Profile[],
  profileId?: string,
  kind?: string
): Profile | null {
  if (!profiles || profiles.length === 0) {
    return null;
  }

  // 1. If profileId specified, use that
  if (profileId) {
    return profiles.find((p) => p.id === profileId) || null;
  }

  // 2. Find first profile with matching entityKind
  if (kind) {
    const kindMatch = profiles.find(
      (p) => p.entityKinds && p.entityKinds.includes(kind)
    );
    if (kindMatch) {
      return kindMatch;
    }
  }

  // 3. Fall back to profile marked isDefault
  const defaultProfile = profiles.find((p) => p.isDefault);
  if (defaultProfile) {
    return defaultProfile;
  }

  // 4. Legacy behavior: if only one profile exists and has no entityKinds, use it
  if (profiles.length === 1 && !profiles[0].entityKinds?.length) {
    return profiles[0];
  }

  return null;
}

// ============================================================================
// Main Generation Function
// ============================================================================

/**
 * Generate names using a culture's configuration.
 *
 * Automatically preloads any Markov models referenced in grammars.
 *
 * @param culture - The culture containing domains, grammars, lexemes, profiles
 * @param request - Generation parameters
 * @returns Generated names and strategy usage statistics
 */
export async function generate(
  culture: Culture,
  request: GenerateRequest
): Promise<GenerateResult> {
  const {
    profileId,
    kind,
    subtype,
    prominence,
    tags = [],
    context = {},
    count = 10,
    seed,
  } = request;

  // Find the profile using selection logic:
  // 1. If profileId specified, use that
  // 2. Otherwise, find first profile matching entityKind
  // 3. Fall back to profile marked isDefault
  // 4. Error if no match
  const profile = selectProfile(culture.profiles, profileId, kind);

  if (!profile) {
    const availableProfiles = culture.profiles.map(p =>
      `${p.id}${p.entityKinds?.length ? ` (${p.entityKinds.join(', ')})` : ''}${p.isDefault ? ' [default]' : ''}`
    ).join(', ');
    throw new Error(
      `No matching profile for entityKind "${kind || '(none)'}" in culture ${culture.id}. ` +
      `Available profiles: ${availableProfiles || 'none'}. ` +
      `Add entityKinds to a profile or mark one as isDefault.`
    );
  }

  // Preload any Markov models referenced in grammars
  const markovModels = await preloadModels(culture.grammars || []);

  // Build generation context
  const rng = createRNG(seed || `gen-${Date.now()}`);
  const genContext: GenerationContext = {
    rng,
    domains: culture.domains,
    grammars: culture.grammars,
    lexemeLists: Object.values(culture.lexemeLists),
    markovModels,
    userContext: context,
  };

  // Find matching strategy group with debug info
  const { matchingGroup, debugInfo: groupDebugInfo, usedFallback } = findMatchingGroup(
    profile.strategyGroups,
    kind,
    subtype,
    prominence,
    tags
  );

  const names: string[] = [];
  const debugInfo: NameDebugInfo[] = [];
  const strategyUsage: Record<string, number> = {
    grammar: 0,
    phonotactic: 0,
    markov: 0,
    fallback: 0,
  };

  // Generate names
  for (let i = 0; i < count; i++) {
    const result = generateSingleName(
      matchingGroup,
      genContext,
      i
    );
    names.push(result.name);
    strategyUsage[result.strategyType] = (strategyUsage[result.strategyType] || 0) + 1;

    // Build debug info for this name
    debugInfo.push({
      groupUsed: matchingGroup?.name || "(fallback)",
      strategyUsed: result.strategyDesc,
      strategyType: result.strategyType,
      grammarId: result.grammarId,
      domainId: result.domainId,
      groupMatching: groupDebugInfo,
    });
  }

  return { names, strategyUsage, debugInfo };
}

/**
 * Generate a single name for a specific entity.
 * Convenience function for lore-weave integration.
 *
 * @param culture - The culture to use
 * @param request - Generation parameters (count is ignored, always returns 1)
 * @returns The generated name
 */
export async function generateOne(
  culture: Culture,
  request: Omit<GenerateRequest, "count">
): Promise<string> {
  const result = await generate(culture, { ...request, count: 1 });
  return result.names[0];
}

// ============================================================================
// Strategy Group Selection
// ============================================================================

interface GroupMatchResult {
  matchingGroup: StrategyGroup | null;
  debugInfo: GroupMatchDebug[];
  usedFallback: boolean;
}

/**
 * Check why a group matches or doesn't match
 */
function checkGroupMatch(
  group: StrategyGroup,
  kind?: string,
  subtype?: string,
  prominence?: string,
  tags?: string[]
): { matched: boolean; reason?: string } {
  const conditions = group.conditions;
  if (!conditions) {
    return { matched: true, reason: "No conditions (matches all)" };
  }

  // Check entityKinds
  if (conditions.entityKinds && conditions.entityKinds.length > 0) {
    if (!kind) {
      return { matched: false, reason: `Requires entityKind in [${conditions.entityKinds.join(", ")}] but none provided` };
    }
    if (!conditions.entityKinds.includes(kind)) {
      return { matched: false, reason: `entityKind "${kind}" not in [${conditions.entityKinds.join(", ")}]` };
    }
  }

  // Check subtypes
  if (conditions.subtypes && conditions.subtypes.length > 0) {
    if (!subtype) {
      return { matched: false, reason: `Requires subtype in [${conditions.subtypes.join(", ")}] but none provided` };
    }
    if (!conditions.subtypes.includes(subtype)) {
      return { matched: false, reason: `subtype "${subtype}" not in [${conditions.subtypes.join(", ")}]` };
    }
  }

  // Check prominence
  if (conditions.prominence && conditions.prominence.length > 0) {
    if (!prominence) {
      return { matched: false, reason: `Requires prominence in [${conditions.prominence.join(", ")}] but none provided` };
    }
    if (!conditions.prominence.includes(prominence)) {
      return { matched: false, reason: `prominence "${prominence}" not in [${conditions.prominence.join(", ")}]` };
    }
  }

  // Check tags
  if (conditions.tags && conditions.tags.length > 0) {
    if (conditions.tagMatchAll) {
      const missingTags = conditions.tags.filter((t) => !tags?.includes(t));
      if (missingTags.length > 0) {
        return { matched: false, reason: `Missing required tags: [${missingTags.join(", ")}]` };
      }
    } else {
      if (!conditions.tags.some((t) => tags?.includes(t))) {
        return { matched: false, reason: `No matching tags from [${conditions.tags.join(", ")}]` };
      }
    }
  }

  return { matched: true };
}

/**
 * Find the best matching strategy group based on entity attributes.
 * Returns debug info for all groups.
 */
function findMatchingGroup(
  groups: StrategyGroup[],
  kind?: string,
  subtype?: string,
  prominence?: string,
  tags?: string[]
): GroupMatchResult {
  const debugInfo: GroupMatchDebug[] = [];

  if (!groups || groups.length === 0) {
    return { matchingGroup: null, debugInfo, usedFallback: true };
  }

  // Check each group and build debug info
  const matchingGroups: StrategyGroup[] = [];
  for (const group of groups) {
    const { matched, reason } = checkGroupMatch(group, kind, subtype, prominence, tags);
    debugInfo.push({
      groupName: group.name || "(unnamed)",
      matched,
      reason,
      priority: group.priority,
    });
    if (matched) {
      matchingGroups.push(group);
    }
  }

  if (matchingGroups.length === 0) {
    // Fall back to first group (usually the default)
    debugInfo[0] = {
      ...debugInfo[0],
      reason: (debugInfo[0].reason || "") + " [FALLBACK - used because no groups matched]",
    };
    return { matchingGroup: groups[0], debugInfo, usedFallback: true };
  }

  // Sort by priority (higher number = higher priority, selected first)
  // When priorities are equal, prefer groups WITH conditions over groups WITHOUT
  matchingGroups.sort((a, b) => {
    const priorityDiff = (b.priority || 0) - (a.priority || 0);
    if (priorityDiff !== 0) return priorityDiff;

    // Equal priority: prefer groups with conditions (more specific)
    const aHasConditions = a.conditions && Object.keys(a.conditions).some(
      k => a.conditions![k as keyof typeof a.conditions] &&
           (Array.isArray(a.conditions![k as keyof typeof a.conditions])
             ? (a.conditions![k as keyof typeof a.conditions] as unknown[]).length > 0
             : true)
    );
    const bHasConditions = b.conditions && Object.keys(b.conditions).some(
      k => b.conditions![k as keyof typeof b.conditions] &&
           (Array.isArray(b.conditions![k as keyof typeof b.conditions])
             ? (b.conditions![k as keyof typeof b.conditions] as unknown[]).length > 0
             : true)
    );

    if (aHasConditions && !bHasConditions) return -1; // a is more specific
    if (bHasConditions && !aHasConditions) return 1;  // b is more specific
    return 0;
  });
  const selected = matchingGroups[0];

  // Mark the selected group in debug info
  const selectedIdx = debugInfo.findIndex((d) => d.groupName === (selected.name || "(unnamed)"));
  if (selectedIdx >= 0) {
    debugInfo[selectedIdx] = {
      ...debugInfo[selectedIdx],
      reason: (debugInfo[selectedIdx].reason || "Matched") + " [SELECTED]",
    };
  }

  return { matchingGroup: selected, debugInfo, usedFallback: false };
}

// ============================================================================
// Single Name Generation
// ============================================================================

interface SingleNameResult {
  name: string;
  strategyType: string;
  strategyDesc: string;
  grammarId?: string;
  domainId?: string;
}

/**
 * Generate a single name using the strategy group.
 */
function generateSingleName(
  group: StrategyGroup | null,
  ctx: GenerationContext,
  index: number
): SingleNameResult {
  if (!group || !group.strategies || group.strategies.length === 0) {
    return {
      name: generateFallbackName(ctx.lexemeLists, ctx.rng, index),
      strategyType: "fallback",
      strategyDesc: "No strategies in group",
    };
  }

  // Pick a strategy based on weights
  const strategy = pickWeightedStrategy(group.strategies, ctx.rng);

  if (strategy.type === "grammar" && strategy.grammarId) {
    const grammar = ctx.grammars.find((g) => g.id === strategy.grammarId);
    if (grammar) {
      const result = expandGrammar(grammar, ctx);
      return {
        name: result.name,
        strategyType: result.usedMarkov ? "markov" : "grammar",
        strategyDesc: `grammar:${strategy.grammarId}`,
        grammarId: strategy.grammarId,
      };
    }
    // Grammar not found
    return {
      name: generateFallbackName(ctx.lexemeLists, ctx.rng, index),
      strategyType: "fallback",
      strategyDesc: `grammar:${strategy.grammarId} NOT FOUND`,
      grammarId: strategy.grammarId,
    };
  }

  if (strategy.type === "phonotactic" && strategy.domainId) {
    const domain = ctx.domains.find((d) => d.id === strategy.domainId);
    if (domain) {
      return {
        name: generatePhonotacticName(ctx.rng, domain),
        strategyType: "phonotactic",
        strategyDesc: `phonotactic:${strategy.domainId}`,
        domainId: strategy.domainId,
      };
    }
    // Domain not found, fall back to any available domain
    if (ctx.domains.length > 0) {
      return {
        name: generatePhonotacticName(ctx.rng, ctx.domains[0]),
        strategyType: "phonotactic",
        strategyDesc: `phonotactic:${strategy.domainId} NOT FOUND, used ${ctx.domains[0].id}`,
        domainId: ctx.domains[0].id,
      };
    }
    // No domains at all
    return {
      name: generateFallbackName(ctx.lexemeLists, ctx.rng, index),
      strategyType: "fallback",
      strategyDesc: `phonotactic:${strategy.domainId} NOT FOUND, no domains available`,
      domainId: strategy.domainId,
    };
  }

  return {
    name: generateFallbackName(ctx.lexemeLists, ctx.rng, index),
    strategyType: "fallback",
    strategyDesc: `Unknown strategy type: ${strategy.type}`,
  };
}

/**
 * Pick a strategy using weighted random selection.
 */
function pickWeightedStrategy(
  strategies: Strategy[],
  rng: () => number
): Strategy {
  if (strategies.length === 1) return strategies[0];

  const totalWeight = strategies.reduce((sum, s) => sum + (s.weight || 0), 0);
  if (totalWeight === 0) return strategies[0];

  let roll = rng() * totalWeight;
  for (const strategy of strategies) {
    roll -= strategy.weight || 0;
    if (roll <= 0) return strategy;
  }

  return strategies[strategies.length - 1];
}

// ============================================================================
// Grammar Expansion
// ============================================================================

/**
 * Expand a grammar rule to generate a name.
 *
 * Token types:
 * - slot:listId     → pick from lexeme list
 * - domain:domainId → generate phonotactic name
 * - markov:modelId  → generate from Markov chain
 * - context:key     → use context value
 * - symbol          → expand another rule
 * - literal         → use as-is
 * - ^suffix         → append suffix (e.g., "domain:tech^'s")
 */
function expandGrammar(
  grammar: Grammar,
  ctx: GenerationContext
): { name: string; usedMarkov: boolean } {
  const startSymbol = grammar.start || "name";
  const rules = grammar.rules || {};
  const expansionCtx: GrammarExpansionContext = {
    usedMarkov: false,
    userContext: ctx.userContext,
  };

  let name = expandSymbol(startSymbol, rules, ctx, expansionCtx, 0);

  // Apply grammar-level capitalization if specified
  if (grammar.capitalization) {
    name = applyCapitalization(name, grammar.capitalization);
  }

  // Apply token-level capitalization AFTER grammar-level (so ~ overrides grammar)
  name = applyTokenCapitalizationMarkers(name);

  return { name, usedMarkov: expansionCtx.usedMarkov };
}

/**
 * Check if a production uses context: references that aren't available.
 */
function productionNeedsMissingContext(
  production: string[],
  userContext: Record<string, string>
): boolean {
  for (const token of production) {
    // Check direct context: reference
    if (token.includes("context:")) {
      // Extract context key (handle modifiers like ~poss)
      const match = token.match(/context:([a-zA-Z_]+)/);
      if (match) {
        const key = match[1];
        const value = userContext[key];
        if (value === undefined || value === null || value === "") {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Recursively expand a grammar symbol.
 */
function expandSymbol(
  symbol: string,
  rules: Record<string, string[][]>,
  ctx: GenerationContext,
  expansionCtx: GrammarExpansionContext,
  depth: number
): string {
  if (depth > 10) {
    return symbol; // Prevent infinite recursion
  }

  const productions = rules[symbol];
  if (!productions || productions.length === 0) {
    // No rule for this symbol - treat as terminal/slot
    return resolveToken(symbol, rules, ctx, expansionCtx, depth);
  }

  // Filter out productions that need context values we don't have
  const viableProductions = productions.filter(
    (p) => !productionNeedsMissingContext(p, expansionCtx.userContext)
  );

  // Use viable productions if any, otherwise fall back to all (will produce empty tokens)
  const candidateProductions =
    viableProductions.length > 0 ? viableProductions : productions;

  // Pick random production from candidates
  const production = pickRandom(ctx.rng, candidateProductions);

  // Expand each token in the production
  const parts = production.map((token) => {
    // Check if token contains multiple references separated by hyphens
    if (
      token.includes("-") &&
      (token.includes("slot:") ||
        token.includes("domain:") ||
        token.includes("markov:") ||
        token.includes("context:"))
    ) {
      const subParts = token.split("-");
      return subParts
        .map((part) => {
          const trimmed = part.trim();
          if (rules[trimmed]) {
            return expandSymbol(trimmed, rules, ctx, expansionCtx, depth + 1);
          }
          return resolveToken(trimmed, rules, ctx, expansionCtx, depth);
        })
        .join("-");
    }

    // Check if token is a rule reference (non-terminal)
    if (rules[token]) {
      return expandSymbol(token, rules, ctx, expansionCtx, depth + 1);
    }

    return resolveToken(token, rules, ctx, expansionCtx, depth);
  });

  return parts.join(" ").trim();
}

/**
 * Resolve a terminal token to its value.
 *
 * Supports ^ for joining patterns without spaces:
 * - "domain:tech^'s" → <domain>'s (suffix)
 * - "^'slot:foo" → '<slot> (prefix)
 * - "domain:x^'^slot:y" → <domain>'<slot> (chained)
 *
 * Supports ~ for per-token capitalization:
 * - "domain:x~cap" → Capitalized
 * - "domain:x~lower" → lowercase
 * - "domain:x~upper" → UPPERCASE
 * - "domain:x~title" → Title Case
 */
function resolveToken(
  token: string,
  rules: Record<string, string[][]>,
  ctx: GenerationContext,
  expansionCtx: GrammarExpansionContext,
  depth: number
): string {
  // If no ^, resolve as simple token (may still have ~ modifier)
  if (!token.includes("^")) {
    return resolveSimpleToken(token, ctx, expansionCtx);
  }

  // Split by ^ and resolve each segment
  const segments = token.split("^");
  const results: string[] = [];

  for (const segment of segments) {
    if (!segment) continue; // Skip empty segments (e.g., from leading ^)

    // Check if segment contains a pattern prefix
    const resolved = resolveSegmentWithPrefix(segment, ctx, expansionCtx);
    results.push(resolved);
  }

  return results.join("");
}

/**
 * Pattern prefixes that indicate a resolvable token.
 */
const PATTERN_PREFIXES = ["slot:", "domain:", "markov:", "context:"];

/**
 * Capitalization modifiers: ~cap, ~lower, ~upper, ~title
 */
type TokenCapitalization = "cap" | "lower" | "upper" | "title";

const CAPITALIZATION_MODIFIERS: Record<string, TokenCapitalization> = {
  "cap": "cap",
  "lower": "lower",
  "upper": "upper",
  "title": "title",
  // Short aliases
  "c": "cap",
  "l": "lower",
  "u": "upper",
  "t": "title",
};

/**
 * Derivation modifiers: ~er, ~est, ~ing, ~ed, ~poss, ~comp
 *
 * These apply morphological transformations:
 * - ~er: agentive (hunt → hunter, rend → render)
 * - ~est: superlative (deep → deepest, dark → darkest)
 * - ~comp: comparative (dark → darker, swift → swifter)
 * - ~ing: gerund/present participle (burn → burning, forge → forging)
 * - ~ed: past/passive (curse → cursed, hunt → hunted)
 * - ~poss: possessive (storm → storm's, blood → blood's)
 */
const DERIVATION_MODIFIERS = new Set(["er", "est", "ing", "ed", "poss", "comp"]);

/**
 * Truncation modifiers: ~chopL, ~chopR, ~chop
 *
 * These remove 1-3 characters from words to create truncated/whispered names:
 * - ~chopL: remove 1-3 chars from left/start (silent → ent, lent, ilent)
 * - ~chopR: remove 1-3 chars from right/end (shadow → shado, shad, sha)
 * - ~chop: randomly choose left or right truncation
 */
type TruncationType = "chopL" | "chopR" | "chop";
const TRUNCATION_MODIFIERS = new Set<string>(["chopL", "chopR", "chop"]);

function isTruncationType(s: string): s is TruncationType {
  return TRUNCATION_MODIFIERS.has(s);
}

/**
 * Apply truncation to a string, removing 1-3 characters from start or end.
 * Ensures at least 2 characters remain.
 */
function applyTruncation(str: string, type: TruncationType, rng: () => number): string {
  if (str.length <= 3) return str; // Don't truncate very short strings

  const maxChop = Math.min(3, str.length - 2); // Keep at least 2 chars
  const chopAmount = 1 + Math.floor(rng() * maxChop);

  switch (type) {
    case "chopL":
      return str.slice(chopAmount);
    case "chopR":
      return str.slice(0, -chopAmount);
    case "chop":
      return rng() > 0.5
        ? str.slice(chopAmount)
        : str.slice(0, -chopAmount);
    default:
      return str;
  }
}

/**
 * Marker format for deferred token capitalization.
 * Using Unicode private use area characters to avoid conflicts.
 */
const CAP_MARKER_START = "\uE000"; // Start marker
const CAP_MARKER_SEP = "\uE001";   // Separator between modifier and text
const CAP_MARKER_END = "\uE002";   // End marker

/**
 * Wrap text in a capitalization marker for deferred processing.
 * E.g., wrapCapitalizationMarker("aurelia", "cap") → "\uE000cap\uE001aurelia\uE002"
 */
function wrapCapitalizationMarker(text: string, modifier: TokenCapitalization): string {
  return `${CAP_MARKER_START}${modifier}${CAP_MARKER_SEP}${text}${CAP_MARKER_END}`;
}

/**
 * Process all capitalization markers in a string.
 * Applied AFTER grammar-level capitalization so ~ modifiers override.
 */
function applyTokenCapitalizationMarkers(str: string): string {
  const markerRegex = new RegExp(
    `${CAP_MARKER_START}(cap|lower|upper|title)${CAP_MARKER_SEP}([^${CAP_MARKER_END}]*)${CAP_MARKER_END}`,
    'g'
  );

  return str.replace(markerRegex, (_, modifier: TokenCapitalization, text: string) => {
    return applyTokenCapitalization(text, modifier);
  });
}

/**
 * Apply token-level capitalization
 */
function applyTokenCapitalization(str: string, modifier: TokenCapitalization): string {
  switch (modifier) {
    case "cap":
      return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    case "lower":
      return str.toLowerCase();
    case "upper":
      return str.toUpperCase();
    case "title":
      return str.split(/(\s+)/).map(part =>
        /^\s+$/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
      ).join("");
    default:
      return str;
  }
}

/**
 * Parsed modifiers from a token pattern.
 * Supports chaining: "slot:foo~er~chopL~cap" → derivation: "er", truncation: "chopL", capitalization: "cap"
 */
interface ParsedModifiers {
  pattern: string;
  derivation: DerivationType | null;
  truncation: TruncationType | null;
  capitalization: TokenCapitalization | null;
}

/**
 * Parse and remove all modifiers from a pattern.
 * Modifiers are processed right-to-left, supporting chains like "slot:foo~er~chopL~cap".
 *
 * E.g., "slot:foo~cap" → { pattern: "slot:foo", derivation: null, truncation: null, capitalization: "cap" }
 * E.g., "slot:foo~er~cap" → { pattern: "slot:foo", derivation: "er", truncation: null, capitalization: "cap" }
 * E.g., "slot:foo~chopL~cap" → { pattern: "slot:foo", derivation: null, truncation: "chopL", capitalization: "cap" }
 */
function parseModifiers(pattern: string): ParsedModifiers {
  let derivation: DerivationType | null = null;
  let truncation: TruncationType | null = null;
  let capitalization: TokenCapitalization | null = null;
  let remaining = pattern;

  // Parse modifiers from right to left
  while (true) {
    const tildeIndex = remaining.lastIndexOf("~");
    if (tildeIndex === -1) break;

    const modifierStr = remaining.substring(tildeIndex + 1);
    const capMod = CAPITALIZATION_MODIFIERS[modifierStr];
    const isDerivMod = DERIVATION_MODIFIERS.has(modifierStr);
    const isTruncMod = TRUNCATION_MODIFIERS.has(modifierStr);

    if (capMod && !capitalization) {
      capitalization = capMod;
      remaining = remaining.substring(0, tildeIndex);
    } else if (isTruncMod && isTruncationType(modifierStr) && !truncation) {
      truncation = modifierStr;
      remaining = remaining.substring(0, tildeIndex);
    } else if (isDerivMod && isDerivationType(modifierStr) && !derivation) {
      derivation = modifierStr;
      remaining = remaining.substring(0, tildeIndex);
    } else {
      // Unknown modifier or already have one of this type - stop parsing
      break;
    }
  }

  return { pattern: remaining, derivation, truncation, capitalization };
}

/**
 * Parse and remove capitalization modifier from a pattern (legacy wrapper).
 * E.g., "slot:foo~cap" → { pattern: "slot:foo", modifier: "cap" }
 * @deprecated Use parseModifiers instead
 */
function parseCapitalizationModifier(pattern: string): { pattern: string; modifier: TokenCapitalization | null } {
  const { pattern: p, capitalization } = parseModifiers(pattern);
  return { pattern: p, modifier: capitalization };
}

/**
 * Resolve a segment that may have a literal prefix before a pattern.
 * E.g., "'slot:foo~cap" → "'" + resolve(slot:foo) with capitalization
 */
function resolveSegmentWithPrefix(
  segment: string,
  ctx: GenerationContext,
  expansionCtx: GrammarExpansionContext
): string {
  // Find the earliest pattern prefix in the segment
  let earliestIndex = -1;

  for (const prefix of PATTERN_PREFIXES) {
    const idx = segment.indexOf(prefix);
    if (idx !== -1 && (earliestIndex === -1 || idx < earliestIndex)) {
      earliestIndex = idx;
    }
  }

  // No pattern found - it's a pure literal
  if (earliestIndex === -1) {
    return segment;
  }

  // Extract literal prefix and pattern (with possible ~ modifier)
  const literalPrefix = segment.substring(0, earliestIndex);
  const patternWithModifier = segment.substring(earliestIndex);

  return literalPrefix + resolveSimpleToken(patternWithModifier, ctx, expansionCtx);
}

/**
 * Resolve a simple token (no ^ handling, but handles ~ modifiers).
 *
 * Supports derivation, truncation, and capitalization modifiers:
 * - "slot:core~er" → apply agentive (hunt → hunter)
 * - "slot:core~er~cap" → apply agentive then capitalize (hunt → Hunter)
 * - "slot:core~chopL" → truncate left (silent → ent)
 * - "slot:core~chopL~cap" → truncate then capitalize (silent → Ent)
 */
function resolveSimpleToken(
  token: string,
  ctx: GenerationContext,
  expansionCtx: GrammarExpansionContext
): string {
  // Parse all modifiers (derivation + truncation + capitalization)
  const { pattern, derivation, truncation, capitalization } = parseModifiers(token);

  let result: string;

  // Handle slot:listId references (lexeme lists)
  if (pattern.startsWith("slot:")) {
    const listId = pattern.substring(5);
    const list = ctx.lexemeLists.find((l) => l.id === listId);
    if (list && list.entries.length > 0) {
      result = pickRandom(ctx.rng, list.entries);
    } else {
      result = listId; // Return the ID if list not found
    }
  }
  // Handle domain:domainId references (phonotactic generation)
  else if (pattern.startsWith("domain:")) {
    const domainId = pattern.substring(7);
    const domain = ctx.domains.find((d) => d.id === domainId);
    if (domain) {
      result = generatePhonotacticName(ctx.rng, domain);
    } else {
      result = domainId; // Return the ID if domain not found
    }
  }
  // Handle markov:modelId references
  else if (pattern.startsWith("markov:")) {
    const modelId = pattern.substring(7);
    const model = ctx.markovModels.get(modelId);

    if (model) {
      expansionCtx.usedMarkov = true;
      result = generateFromMarkovModel(model, ctx.rng);
    } else if (ctx.domains.length > 0) {
      // Fallback to phonotactic if model not available
      result = generatePhonotacticName(ctx.rng, ctx.domains[0]);
    } else {
      result = modelId;
    }
  }
  // Handle context:key references (user-provided context values)
  else if (pattern.startsWith("context:")) {
    const key = pattern.substring(8);
    const value = expansionCtx.userContext[key];
    if (value !== undefined && value !== null && value !== "") {
      result = String(value);
    } else {
      // Context key missing - return empty and skip derivation/capitalization
      return "";
    }
  }
  // Return literal as-is
  else {
    result = token; // Use original token for literals (preserves ~ if not a modifier)
  }

  // Apply derivation first (e.g., hunt → hunter)
  if (derivation) {
    result = applyDerivation(result, derivation);
  }

  // Apply truncation second (e.g., silent → ent)
  if (truncation) {
    result = applyTruncation(result, truncation, ctx.rng);
  }

  // Wrap in capitalization marker if specified (applied later, after grammar-level)
  if (capitalization) {
    result = wrapCapitalizationMarker(result, capitalization);
  }

  return result;
}

// ============================================================================
// Markov Generation
// ============================================================================

/**
 * Generate a name from a Markov model.
 */
function generateFromMarkovModel(
  model: MarkovModel,
  rng: () => number,
  options: { minLength?: number; maxLength?: number } = {}
): string {
  const { minLength = 3, maxLength = 12 } = options;

  // Pick start state using weighted random
  let state = weightedRandom(model.startStates, rng);
  let result = "";

  for (let i = 0; i < maxLength + model.order; i++) {
    const nextProbs = model.transitions[state];
    if (!nextProbs) break;

    const next = weightedRandom(nextProbs, rng);
    if (next === "$") {
      // END token
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
 * Weighted random selection from a probability distribution.
 */
function weightedRandom(
  probs: Record<string, number>,
  rng: () => number
): string {
  const r = rng();
  let sum = 0;
  for (const [item, prob] of Object.entries(probs)) {
    sum += prob;
    if (r <= sum) return item;
  }
  return Object.keys(probs)[0];
}

// ============================================================================
// Fallback Generation
// ============================================================================

/**
 * Generate a fallback name when no strategy works.
 */
function generateFallbackName(
  lexemeLists: LexemeList[],
  rng: () => number,
  index: number
): string {
  const nonEmptyLists = lexemeLists.filter((l) => l.entries?.length > 0);

  if (nonEmptyLists.length === 0) {
    return `Name-${index + 1}`;
  }

  const parts: string[] = [];
  const numParts = Math.floor(rng() * 2) + 1; // 1-2 parts

  for (let i = 0; i < numParts; i++) {
    const list = pickRandom(rng, nonEmptyLists);
    if (list.entries.length > 0) {
      parts.push(pickRandom(rng, list.entries));
    }
  }

  if (parts.length === 0) {
    return `Name-${index + 1}`;
  }

  // Capitalize first letter
  const name = parts.join("-");
  return name.charAt(0).toUpperCase() + name.slice(1);
}

// ============================================================================
// Utility: Generate from Domain Directly
// ============================================================================

/**
 * Generate names directly from a domain (without profile).
 * Useful for testing domains in isolation.
 */
export function generateFromDomain(
  domain: NamingDomain,
  count: number = 10,
  seed?: string
): string[] {
  const rng = createRNG(seed || `domain-${Date.now()}`);
  const names: string[] = [];

  for (let i = 0; i < count; i++) {
    names.push(generatePhonotacticName(rng, domain));
  }

  return names;
}

// ============================================================================
// Test Domain (for validation/optimizer)
// ============================================================================

export interface TestDomainResult {
  samples: string[];
  uniqueCount: number;
  avgLength: number;
  minLength: number;
  maxLength: number;
}

/**
 * Test a domain by generating samples and computing statistics.
 * Used by validation metrics.
 */
export function testDomain(
  domain: NamingDomain,
  sampleSize: number = 100,
  seed?: string
): TestDomainResult {
  const samples = generateFromDomain(domain, sampleSize, seed);
  const uniqueSet = new Set(samples);

  const lengths = samples.map((s) => s.length);
  const totalLength = lengths.reduce((a, b) => a + b, 0);

  return {
    samples,
    uniqueCount: uniqueSet.size,
    avgLength: totalLength / samples.length,
    minLength: Math.min(...lengths),
    maxLength: Math.max(...lengths),
  };
}

// ============================================================================
// Preview Grammar (for live UI preview)
// ============================================================================

export interface PreviewGrammarOptions {
  grammar: Grammar;
  domains: NamingDomain[];
  lexemeLists: LexemeList[];
  count?: number;
  seed?: string;
}

/**
 * Preview a grammar by generating sample names.
 * Used by the UI to show live preview of grammar output.
 *
 * @returns Array of generated names (may contain duplicates if grammar is simple)
 */
export async function previewGrammar(
  options: PreviewGrammarOptions
): Promise<string[]> {
  const { grammar, domains, lexemeLists, count = 8, seed } = options;

  if (!grammar || !grammar.rules || Object.keys(grammar.rules).length === 0) {
    return [];
  }

  // Preload Markov models if the grammar uses them
  const markovModels = await preloadModels([grammar]);

  const rng = createRNG(seed || `preview-${Date.now()}`);
  const ctx: GenerationContext = {
    rng,
    domains: domains || [],
    grammars: [grammar],
    lexemeLists: lexemeLists || [],
    markovModels,
    userContext: {},
  };

  const names: string[] = [];
  for (let i = 0; i < count; i++) {
    try {
      const result = expandGrammar(grammar, ctx);
      names.push(result.name);
    } catch {
      // Grammar might have unresolved references - skip
    }
  }

  return names;
}
