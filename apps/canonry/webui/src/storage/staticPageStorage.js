/**
 * Static Page Storage for Canonry
 *
 * Reads/writes static pages in the illuminator Dexie database.
 * Used for project export/import and reload defaults functionality.
 */

import { openIlluminatorDb } from '../lib/illuminatorDbReader';

// ============================================================================
// Database Configuration
// ============================================================================

const STATIC_PAGE_STORE_NAME = 'staticPages';

// ============================================================================
// Utility Functions
// ============================================================================

function generatePageId() {
  return `static_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 100);
}

function extractEntityLinks(content) {
  const regex = /\[\[([^\]]+)\]\]/g;
  const matches = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    const entityName = match[1].trim();
    if (entityName && !matches.includes(entityName)) {
      matches.push(entityName);
    }
  }
  return matches;
}

function countWords(content) {
  const plainText = content
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/[#*_~`>]/g, '')
    .replace(/\n+/g, ' ')
    .trim();
  if (!plainText) return 0;
  return plainText.split(/\s+/).length;
}

// ============================================================================
// Storage Operations
// ============================================================================

/**
 * Get all static pages for a project (both draft and published)
 */
export async function getStaticPagesForProject(projectId) {
  const db = await openIlluminatorDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STATIC_PAGE_STORE_NAME, 'readonly');
      const store = tx.objectStore(STATIC_PAGE_STORE_NAME);
      const index = store.index('projectId');
      const req = index.getAll(projectId);
      req.onsuccess = () => {
        const pages = req.result || [];
        pages.sort((a, b) => b.updatedAt - a.updatedAt);
        resolve(pages);
      };
      req.onerror = () => reject(req.error || new Error('Failed to get static pages for project'));
    });
  } finally {
    db.close();
  }
}

/**
 * Import static pages into a project (used during project import)
 * This replaces all existing pages for the project.
 *
 * @param {string} projectId - The project ID to import pages into
 * @param {Array} pages - Array of page objects to import
 * @param {Object} options - Import options
 * @param {boolean} options.preserveIds - If true, use page IDs from import data
 */
export async function importStaticPages(projectId, pages, options = {}) {
  if (!Array.isArray(pages) || pages.length === 0) {
    return 0;
  }

  const db = await openIlluminatorDb();
  const now = Date.now();

  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STATIC_PAGE_STORE_NAME, 'readwrite');
      const store = tx.objectStore(STATIC_PAGE_STORE_NAME);

      let importedCount = 0;

      for (const pageData of pages) {
        const page = {
          pageId: options.preserveIds && pageData.pageId ? pageData.pageId : generatePageId(),
          projectId,
          title: pageData.title || 'Untitled',
          slug: pageData.slug || generateSlug(pageData.title || 'untitled'),
          content: pageData.content || '',
          summary: pageData.summary,
          status: pageData.status || 'draft',
          createdAt: pageData.createdAt || now,
          updatedAt: pageData.updatedAt || now,
          linkedEntityIds: extractEntityLinks(pageData.content || ''),
          wordCount: countWords(pageData.content || ''),
        };

        store.put(page);
        importedCount++;
      }

      tx.oncomplete = () => resolve(importedCount);
      tx.onerror = () => reject(tx.error || new Error('Failed to import static pages'));
    });
  } finally {
    db.close();
  }
}

/**
 * Delete all static pages for a project
 */
export async function deleteStaticPagesForProject(projectId) {
  const pages = await getStaticPagesForProject(projectId);
  if (pages.length === 0) return 0;

  const db = await openIlluminatorDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STATIC_PAGE_STORE_NAME, 'readwrite');
      const store = tx.objectStore(STATIC_PAGE_STORE_NAME);

      for (const page of pages) {
        store.delete(page.pageId);
      }

      tx.oncomplete = () => resolve(pages.length);
      tx.onerror = () => reject(tx.error || new Error('Failed to delete static pages for project'));
    });
  } finally {
    db.close();
  }
}

/**
 * Load seed pages from staticPages.json and import them
 * Used when reloading defaults
 */
export async function loadAndImportSeedPages(projectId, seedPagesUrl) {
  const url = seedPagesUrl || `${import.meta.env.BASE_URL}default-project/staticPages.json`;

  let seedPages;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.log('No seed pages file found');
      return 0;
    }
    seedPages = await response.json();
  } catch (err) {
    console.log('Failed to load seed pages:', err);
    return 0;
  }

  if (!Array.isArray(seedPages) || seedPages.length === 0) {
    return 0;
  }

  // Convert seed pages to import format
  const pagesToImport = seedPages.map((seed) => ({
    title: seed.title,
    slug: seed.slug,
    content: seed.content,
    summary: seed.summary,
    status: seed.status || 'published',
  }));

  // Clear existing pages and import fresh
  await deleteStaticPagesForProject(projectId);
  return importStaticPages(projectId, pagesToImport);
}
