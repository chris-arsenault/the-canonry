import { z } from "zod";
import {
  PhonologyProfileSchema,
  MorphologyProfileSchema,
  StyleRulesSchema,
  AppliesToSchema,
  NamingDomainSchema,
  DomainCollectionSchema,
  GenerationRequestSchema,
  ValidationConfigSchema,
  OptimizationConfigSchema,
} from "./schema.js";

/**
 * TypeScript types derived from Zod schemas
 */

export type PhonologyProfile = z.infer<typeof PhonologyProfileSchema>;
export type MorphologyProfile = z.infer<typeof MorphologyProfileSchema>;
export type StyleRules = z.infer<typeof StyleRulesSchema>;
export type AppliesTo = z.infer<typeof AppliesToSchema>;
export type NamingDomain = z.infer<typeof NamingDomainSchema>;
export type DomainCollection = z.infer<typeof DomainCollectionSchema>;
export type GenerationRequest = z.infer<typeof GenerationRequestSchema>;
export type ValidationConfig = z.infer<typeof ValidationConfigSchema>;
export type OptimizationConfig = z.infer<typeof OptimizationConfigSchema>;

/**
 * Generation Context
 * Passed to generation functions for access to RNG, domains, and KG
 */
export interface GenerationContext {
  /** Seeded random number generator */
  rng: () => number;
  /** Currently selected domain */
  domain: NamingDomain;
  /** Optional knowledge graph for derivative names (Phase 4) */
  kg?: KnowledgeGraph;
}

/**
 * Generation Result
 * Output from name generation
 */
export interface GenerationResult {
  /** Generated name */
  name: string;
  /** Domain used for generation */
  domainId: string;
  /** Debug info: which phonemes/morphemes were used */
  debug?: {
    syllables?: string[];
    structure?: string;
    phonology?: string;
    morphology?: string;
    style?: string;
  };
}

/**
 * Knowledge Graph Interface (Mock for Phase 1, refined in Phase 4)
 */
export interface KnowledgeGraph {
  /** Get all entities */
  getEntities(): HardState[];
  /** Get entity by ID */
  getEntity(id: string): HardState | undefined;
  /** Find entities matching criteria */
  findEntities(criteria: Partial<HardState>): HardState[];
  /** Get relationships for an entity */
  getRelationships(entityId: string): Relationship[];
}

/**
 * HardState - Entity node type from main world-gen system
 */
export type Prominence =
  | "forgotten"
  | "marginal"
  | "recognized"
  | "renowned"
  | "mythic";

export interface HardState {
  id: string;
  kind: "npc" | "location" | "faction" | "rule" | "ability";
  subtype: string;
  name: string;
  description: string;
  status: string;
  prominence: Prominence;
  tags: string[];
  links: Relationship[];
  createdAt: number;
  updatedAt: number;
}

/**
 * Relationship - Edge type from main world-gen system
 */
export interface Relationship {
  kind: string;
  src: string;
  dst: string;
}

/**
 * Domain Matching Score
 * Used by domain selector to rank domain matches
 */
export interface DomainMatch {
  domain: NamingDomain;
  score: number;
  reason: string;
}
