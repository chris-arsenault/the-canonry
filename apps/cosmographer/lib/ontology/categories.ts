/**
 * Ontology Category System
 *
 * Central registry for all category definitions across domain classes.
 * Categories provide the semantic foundation for plane classification.
 */

import type { CategoryDefinition, CategoryId, DomainClass } from '../types/index.js';

// Import domain-specific categories
import { PHYSICAL_CATEGORIES } from './domains/physical.js';
import { METAPHYSICAL_CATEGORIES } from './domains/metaphysical.js';
import { LEGAL_CATEGORIES } from './domains/legal.js';
import { MAGICAL_CATEGORIES } from './domains/magical.js';
import { SOCIAL_CATEGORIES } from './domains/social.js';

/**
 * All built-in categories indexed by ID.
 */
export const CATEGORY_REGISTRY: Map<CategoryId, CategoryDefinition> = new Map();

/**
 * Categories grouped by domain class.
 */
export const CATEGORIES_BY_DOMAIN: Map<DomainClass, CategoryDefinition[]> = new Map([
  ['spatial', []],
  ['metaphysical', []],
  ['conceptual', []],
  ['hybrid', []]
]);

/**
 * Initialize the category registry with all built-in categories.
 */
function initializeRegistry(): void {
  const allCategories = [
    ...PHYSICAL_CATEGORIES,
    ...METAPHYSICAL_CATEGORIES,
    ...LEGAL_CATEGORIES,
    ...MAGICAL_CATEGORIES,
    ...SOCIAL_CATEGORIES
  ];

  for (const category of allCategories) {
    CATEGORY_REGISTRY.set(category.id, category);

    const domainCategories = CATEGORIES_BY_DOMAIN.get(category.domainClass);
    if (domainCategories) {
      domainCategories.push(category);
    }

    // Hybrid domains include spatial + conceptual
    if (category.domainClass === 'spatial' || category.domainClass === 'conceptual') {
      CATEGORIES_BY_DOMAIN.get('hybrid')?.push(category);
    }
  }
}

// Initialize on module load
initializeRegistry();

/**
 * Get a category by ID.
 */
export function getCategory(id: CategoryId): CategoryDefinition | undefined {
  return CATEGORY_REGISTRY.get(id);
}

/**
 * Get all categories for a domain class.
 */
export function getCategoriesForDomain(domainClass: DomainClass): CategoryDefinition[] {
  return CATEGORIES_BY_DOMAIN.get(domainClass) ?? [];
}

/**
 * Get all category IDs.
 */
export function getAllCategoryIds(): CategoryId[] {
  return Array.from(CATEGORY_REGISTRY.keys());
}

/**
 * Check if a category can be a child of another.
 */
export function canBeChildOf(childId: CategoryId, parentId: CategoryId): boolean {
  const parent = CATEGORY_REGISTRY.get(parentId);
  const child = CATEGORY_REGISTRY.get(childId);

  if (!parent || !child) return false;

  // Check if child is in parent's typical children
  if (parent.typicalChildren.includes(childId)) return true;

  // Check if parent is in child's typical parents
  if (child.typicalParents.includes(parentId)) return true;

  // Check incompatibility
  if (parent.incompatibleWith.includes(childId)) return false;
  if (child.incompatibleWith.includes(parentId)) return false;

  // Default: allow if same domain class or parent is broader
  return parent.domainClass === child.domainClass;
}

/**
 * Get valid children for a category.
 */
export function getValidChildren(categoryId: CategoryId): CategoryId[] {
  const category = CATEGORY_REGISTRY.get(categoryId);
  if (!category) return [];

  const validChildren: CategoryId[] = [];

  for (const [id] of CATEGORY_REGISTRY) {
    if (id === categoryId) continue;
    if (canBeChildOf(id, categoryId)) {
      validChildren.push(id);
    }
  }

  return validChildren;
}

/**
 * Calculate semantic distance between two categories.
 * Lower = more similar.
 */
export function categoryDistance(cat1Id: CategoryId, cat2Id: CategoryId): number {
  if (cat1Id === cat2Id) return 0;

  const cat1 = CATEGORY_REGISTRY.get(cat1Id);
  const cat2 = CATEGORY_REGISTRY.get(cat2Id);

  if (!cat1 || !cat2) return Infinity;

  let distance = 1.0;

  // Same domain class = closer
  if (cat1.domainClass !== cat2.domainClass) {
    distance += 2.0;
  }

  // Typical parent-child relationship = closer
  if (cat1.typicalChildren.includes(cat2Id) || cat2.typicalChildren.includes(cat1Id)) {
    distance -= 0.5;
  }

  // Incompatible = farther
  if (cat1.incompatibleWith.includes(cat2Id)) {
    distance += 3.0;
  }

  // Priority difference affects distance
  distance += Math.abs(cat1.basePriority - cat2.basePriority) * 0.2;

  return Math.max(0, distance);
}

/**
 * Register a custom category from domain.
 */
export function registerCustomCategory(category: CategoryDefinition): void {
  CATEGORY_REGISTRY.set(category.id, category);

  const domainCategories = CATEGORIES_BY_DOMAIN.get(category.domainClass);
  if (domainCategories) {
    domainCategories.push(category);
  }
}
