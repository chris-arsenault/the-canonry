/**
 * UI Configuration Types
 *
 * Optional UI hints carried alongside canonical schema data.
 */

/**
 * UI configuration for domain visualization
 */
export interface DomainUIConfig {
  /** Icon/emoji for the world (e.g., '🐧') */
  worldIcon?: string;
  /** Ordered list of prominence levels (lowest to highest) */
  prominenceLevels?: string[];
  /** Colors for prominence levels (keyed by level name) */
  prominenceColors?: Record<string, string>;
}
