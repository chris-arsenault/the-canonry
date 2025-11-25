/**
 * World Gen Naming - Domain-aware procedural name generation
 *
 * Main library exports for programmatic use
 */

// Types and schemas
export * from "./types/domain.js";
export * from "./types/schema.js";
export * from "./types/kg.js";
export * from "./types/profile.js"; // Phase 4: Profile system
export * from "./types/integration.js"; // KG integration interface

// Core generation
export * from "./lib/generator.js";
export * from "./lib/phonology.js";
export * from "./lib/morphology.js";
export * from "./lib/style.js";
export * from "./lib/domain-selector.js";

// Phase 4: Profile-based generation
export * from "./lib/profile-executor.js";

// Utilities
export * from "./utils/rng.js";
export * from "./utils/helpers.js";
