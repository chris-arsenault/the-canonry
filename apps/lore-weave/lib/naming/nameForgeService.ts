/**
 * Name Forge Service
 *
 * Translation layer between canonry's culture format and name-forge lib.
 * Accepts canonry's cultures[] array with embedded naming configuration
 * and transforms to name-forge's expected format internally.
 */

import {
  generateOne,
  type Culture as NameForgeCulture,
  type NamingDomain,
  type LexemeList,
  type Grammar,
  type Profile,
} from 'name-forge';
import type { CultureDefinition } from '@canonry/world-schema';

// Re-export name-forge types for external use
export type {
  NamingDomain,
  LexemeList,
  Grammar,
  Profile,
  StrategyGroup,
  Strategy,
  GroupConditions,
} from 'name-forge';

// =============================================================================
// CANONRY CULTURE FORMAT (input)
// =============================================================================

/**
 * Naming configuration embedded in canonry culture.
 */
export interface CultureNamingConfig {
  domains: NamingDomain[];
  lexemeLists: Record<string, LexemeList>;
  grammars: Grammar[];
  profiles: Profile[];
}

/**
 * Culture format from canonry (cultures.json).
 * Extends coordinate config with naming data.
 */
export interface Culture {
  id: string;
  name: string;
  description?: string;
  // Coordinate fields (used by CoordinateContext)
  color?: string;
  axisBiases?: Record<string, { x: number; y: number; z: number }>;
  homeRegions?: Record<string, string[]>;
  // Naming configuration (used by NameForgeService)
  naming?: CultureNamingConfig;
}

// =============================================================================
// STATS
// =============================================================================

/**
 * Stats tracking for name generation
 */
export interface NameForgeStats {
  total: number;
  successes: number;
  failures: number;
  // culture -> kind -> { calls, failures }
  byCultureAndKind: Record<string, Record<string, { calls: number; failures: number }>>;
}

// =============================================================================
// NAME FORGE SERVICE
// =============================================================================

/**
 * Name generation service using name-forge lib.
 *
 * Accepts canonry's cultures[] array format and transforms to name-forge's
 * expected format internally. This keeps the canonry format all the way
 * down to this translation layer.
 */
export class NameForgeService {
  private cultures: Record<string, NameForgeCulture>;
  private stats: NameForgeStats;
  private log: (level: 'debug' | 'info' | 'warn' | 'error', message: string, context?: Record<string, unknown>) => void;

  /**
   * Create a NameForgeService from canonry's cultures array.
   *
   * @param cultures - Array of cultures from canonry (cultures.json)
   * @param emitter - Optional emitter for logging (uses console if not provided)
   */
  constructor(
    cultures: CultureDefinition[],
    emitter?: { log: (level: 'debug' | 'info' | 'warn' | 'error', message: string, context?: Record<string, unknown>) => void }
  ) {
    // Set up logging - use emitter if provided, otherwise console
    this.log = emitter
      ? (level, message, context) => emitter.log(level, message, context)
      : (level, message) => {
          if (level === 'error') console.error(message);
          else if (level === 'warn') console.warn(message);
          else console.log(message);
        };

    if (!cultures || cultures.length === 0) {
      throw new Error('NameForgeService: cultures array is empty');
    }

    // Transform canonry format to name-forge format
    this.cultures = {};

    for (const culture of cultures) {
      if (!culture.naming) {
        this.log('warn',
          `[NameForge] Culture '${culture.id}' has no naming configuration, skipping`,
          { cultureId: culture.id }
        );
        continue;
      }

      // Transform to name-forge Culture format
      // The CultureNamingData from world-schema is compatible with name-forge types
      this.cultures[culture.id] = {
        id: culture.id,
        name: culture.name,
        description: culture.description,
        domains: culture.naming.domains as NamingDomain[],
        lexemeLists: culture.naming.lexemeLists as Record<string, LexemeList>,
        grammars: culture.naming.grammars as Grammar[],
        profiles: culture.naming.profiles as Profile[],
      };
    }

    if (Object.keys(this.cultures).length === 0) {
      throw new Error(
        'NameForgeService: no cultures have naming configuration. ' +
        'Each culture needs a "naming" property with domains, grammars, and profiles.'
      );
    }

    // Initialize stats
    this.stats = {
      total: 0,
      successes: 0,
      failures: 0,
      byCultureAndKind: {},
    };
  }

  /**
   * Track a call result
   */
  private trackCall(culture: string, kind: string, success: boolean): void {
    this.stats.total++;
    if (success) {
      this.stats.successes++;
    } else {
      this.stats.failures++;
    }

    if (!this.stats.byCultureAndKind[culture]) {
      this.stats.byCultureAndKind[culture] = {};
    }
    if (!this.stats.byCultureAndKind[culture][kind]) {
      this.stats.byCultureAndKind[culture][kind] = { calls: 0, failures: 0 };
    }
    this.stats.byCultureAndKind[culture][kind].calls++;
    if (!success) {
      this.stats.byCultureAndKind[culture][kind].failures++;
    }
  }

  /**
   * Generate a name for an entity.
   *
   * @param kind - Entity kind (npc, location, etc.)
   * @param subtype - Entity subtype
   * @param prominence - Prominence level
   * @param tags - Entity tags (keys only, for condition matching)
   * @param cultureId - Culture to use for generation
   * @param context - Optional context for context: slots (e.g., { parent: "King Gorban" })
   * @returns Generated name, or 'unnamed' if generation fails
   */
  async generate(
    kind: string,
    subtype: string,
    prominence: string,
    tags: string[],
    cultureId: string,
    context?: Record<string, string>
  ): Promise<string> {
    const culture = this.cultures[cultureId];

    if (!culture) {
      this.log('warn',
        `[NameForge] Culture '${cultureId}' not found. Available: ${Object.keys(this.cultures).join(', ')}`,
        { cultureId, available: Object.keys(this.cultures), kind, subtype }
      );
      this.trackCall(cultureId, kind, false);
      return 'unnamed';
    }

    if (!culture.profiles || culture.profiles.length === 0) {
      this.log('error',
        `[NameForge] Culture '${cultureId}' has no profiles`,
        { cultureId }
      );
      this.trackCall(cultureId, kind, false);
      return 'unnamed';
    }

    try {
      const name = await generateOne(culture, {
        cultureId,
        kind,
        subtype,
        prominence,
        tags,
        context,
        seed: `${Date.now()}-${Math.random()}`,
      });

      if (!name) {
        this.log('warn',
          `[NameForge] Empty name returned for ${kind}:${subtype} (culture: ${cultureId}, tags: [${tags.join(', ')}])`,
          { kind, subtype, cultureId, tags }
        );
        this.trackCall(cultureId, kind, false);
        return 'unnamed';
      }

      this.trackCall(cultureId, kind, true);
      return name;
    } catch (error) {
      this.log('error',
        `[NameForge] Generation failed for ${kind}:${subtype}: ${error instanceof Error ? error.message : error}`,
        { kind, subtype, cultureId, error: error instanceof Error ? error.message : String(error) }
      );
      this.trackCall(cultureId, kind, false);
      return 'unnamed';
    }
  }

  /**
   * Get available culture IDs
   */
  getAvailableCultures(): string[] {
    return Object.keys(this.cultures);
  }

  /**
   * Get name generation statistics
   */
  getStats(): NameForgeStats {
    return { ...this.stats };
  }

  /**
   * Log name generation statistics summary
   */
  printStats(): void {
    const { total, successes, failures, byCultureAndKind } = this.stats;

    if (total === 0) {
      this.log('info', '[NameForge] No calls made');
      return;
    }

    const successRate = ((successes / total) * 100).toFixed(1);

    this.log('info',
      `[NameForge] Stats: ${total} calls (${successes} success, ${failures} failed, ${successRate}% success rate)`,
      { total, successes, failures, successRate, byCultureAndKind }
    );

    if (failures > 0) {
      this.log('warn',
        `[NameForge] ${failures} name generation failures`,
        { failures, byCultureAndKind }
      );
    }
  }
}
