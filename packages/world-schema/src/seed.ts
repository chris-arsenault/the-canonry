/**
 * Seed Data Types
 *
 * Seed entities and relationships are the initial state of the world
 * before simulation begins.
 */

import type { WorldEntity, WorldRelationship } from './world.js';
export type { ProminenceLabel, SemanticCoordinates } from './world.js';

/**
 * Seed entities and relationships are initial world state.
 * They use the same canonical shapes as world output.
 */
export type SeedEntity = WorldEntity;
export type SeedRelationship = WorldRelationship;
