/**
 * Static Page Repository — Dexie-backed static page storage
 */

import { db } from './illuminatorDb';
import type { StaticPage, StaticPageStatus } from '../staticPageTypes';

export type { StaticPage, StaticPageStatus };

export function generatePageId(): string {
  return `static_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 100);
}

export function extractEntityLinks(content: string): string[] {
  const regex = /\[\[([^\]]+)\]\]/g;
  const matches: string[] = [];
  let match;

  while ((match = regex.exec(content)) !== null) {
    const entityName = match[1].trim();
    if (entityName && !matches.includes(entityName)) {
      matches.push(entityName);
    }
  }

  return matches;
}

export function countWords(content: string): number {
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

export async function createStaticPage(input: CreateStaticPageInput): Promise<StaticPage> {
  const now = Date.now();
  const content = input.content ?? '';

  const page: StaticPage = {
    pageId: generatePageId(),
    projectId: input.projectId,
    title: input.title,
    slug: generateSlug(input.title),
    content,
    summary: input.summary,
    status: input.status ?? 'draft',
    createdAt: now,
    updatedAt: now,
    linkedEntityIds: extractEntityLinks(content),
    wordCount: countWords(content),
  };

  await db.staticPages.put(page);
  return page;
}

export async function updateStaticPage(
  pageId: string,
  updates: UpdateStaticPageInput
): Promise<StaticPage> {
  const page = await db.staticPages.get(pageId);
  if (!page) throw new Error(`Static page ${pageId} not found`);

  if (updates.title !== undefined) {
    page.title = updates.title;
    page.slug = generateSlug(updates.title);
  }
  if (updates.content !== undefined) {
    page.content = updates.content;
    page.linkedEntityIds = extractEntityLinks(updates.content);
    page.wordCount = countWords(updates.content);
  }
  if (updates.summary !== undefined) {
    page.summary = updates.summary;
  }
  if (updates.status !== undefined) {
    page.status = updates.status;
  }
  page.updatedAt = Date.now();

  await db.staticPages.put(page);
  return page;
}

export async function getStaticPage(pageId: string): Promise<StaticPage | undefined> {
  return db.staticPages.get(pageId);
}

export async function getStaticPagesForProject(projectId: string): Promise<StaticPage[]> {
  const pages = await db.staticPages.where('projectId').equals(projectId).toArray();
  pages.sort((a, b) => b.updatedAt - a.updatedAt);
  return pages;
}

export async function getPublishedStaticPagesForProject(projectId: string): Promise<StaticPage[]> {
  const pages = await getStaticPagesForProject(projectId);
  return pages.filter((page) => page.status === 'published');
}

export async function deleteStaticPage(pageId: string): Promise<void> {
  await db.staticPages.delete(pageId);
}

export async function deleteStaticPagesForProject(projectId: string): Promise<number> {
  const pages = await getStaticPagesForProject(projectId);
  if (pages.length === 0) return 0;
  await db.staticPages.bulkDelete(pages.map(p => p.pageId));
  return pages.length;
}
