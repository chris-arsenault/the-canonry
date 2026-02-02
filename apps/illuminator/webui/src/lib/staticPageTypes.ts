/**
 * Static Page Type Definitions
 *
 * Extracted from staticPageStorage.ts — pure type declarations for
 * user-authored static pages and their input structures.
 */

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

  // Computed (extracted from content on save)
  linkedEntityIds: string[];
  wordCount: number;
}

export interface CreateStaticPageInput {
  projectId: string;
  title: string;
  content?: string;
  summary?: string;
  status?: StaticPageStatus;
}

export interface UpdateStaticPageInput {
  title?: string;
  content?: string;
  summary?: string;
  status?: StaticPageStatus;
}
