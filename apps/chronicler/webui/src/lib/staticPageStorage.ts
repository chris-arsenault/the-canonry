/**
 * Static Page Storage Module (Read-only for Chronicler)
 *
 * Reads static pages from the illuminator Dexie database.
 * Pages are created/edited in Illuminator, but displayed here in Chronicler.
 */

import { openIlluminatorDb } from './illuminatorDbReader';

const STATIC_PAGE_STORE_NAME = 'staticPages';

// ============================================================================
// Types (same as Illuminator)
// ============================================================================

export type StaticPageStatus = 'draft' | 'published';

export interface StaticPage {
  pageId: string;
  projectId: string;

  // Content
  title: string;
  slug: string;
  content: string;
  summary?: string;

  // Metadata
  status: StaticPageStatus;
  createdAt: number;
  updatedAt: number;

  // Computed
  linkedEntityIds: string[];
  wordCount: number;
}

// ============================================================================
// Read-only Storage Operations
// ============================================================================

/**
 * Get a single static page by ID
 */
export async function getStaticPage(pageId: string): Promise<StaticPage | undefined> {
  const db = await openIlluminatorDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STATIC_PAGE_STORE_NAME, 'readonly');
      const req = tx.objectStore(STATIC_PAGE_STORE_NAME).get(pageId);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('Failed to get static page'));
    });
  } finally {
    db.close();
  }
}

/**
 * Get published static pages for a project (main read function for Chronicler)
 */
export async function getPublishedStaticPagesForProject(projectId: string): Promise<StaticPage[]> {
  const db = await openIlluminatorDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STATIC_PAGE_STORE_NAME, 'readonly');
      const store = tx.objectStore(STATIC_PAGE_STORE_NAME);
      const index = store.index('projectId');
      const req = index.getAll(projectId);
      req.onsuccess = () => {
        const pages = (req.result as StaticPage[])
          .filter((page) => page.status === 'published')
          .sort((a, b) => b.updatedAt - a.updatedAt);
        resolve(pages);
      };
      req.onerror = () => reject(req.error || new Error('Failed to get static pages for project'));
    });
  } finally {
    db.close();
  }
}
