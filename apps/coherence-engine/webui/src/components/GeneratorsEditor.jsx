/**
 * GeneratorsEditor v2 - Visual builder with tabbed modal
 *
 * This file re-exports from the modular generators/ folder structure.
 * See generators/index.js for the main implementation.
 *
 * Tabs:
 * - Overview: Name, ID, enabled state, summary
 * - Applicability: Visual nested rule builder
 * - Target: Configure the primary target selection ($target)
 * - Variables: Define intermediate entity selections
 * - Creation: Visual entity creation cards
 * - Relationships: Relationship editor
 * - Effects: Pressure modifications and archives
 */

export { default } from './generators';
export * from './generators';
