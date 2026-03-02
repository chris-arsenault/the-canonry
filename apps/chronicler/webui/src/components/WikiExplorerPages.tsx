/**
 * WikiExplorerPages - Static page index and category views for WikiExplorer
 */

import React, { useMemo } from "react";
import type { WikiPage } from "../types/world.ts";
import styles from "./WikiExplorer.module.css";

export function PagesIndex({ pages, onNavigate }: Readonly<{
  pages: WikiPage[]; onNavigate: (pageId: string) => void;
}>) {
  const pagesByNamespace = useMemo(() => {
    const grouped = new Map<string, WikiPage[]>();
    for (const page of pages) {
      const colonIndex = page.title.indexOf(":");
      const namespace = colonIndex > 0 ? page.title.slice(0, colonIndex) : "General";
      if (!grouped.has(namespace)) grouped.set(namespace, []);
      grouped.get(namespace)!.push(page);
    }
    return Array.from(grouped.entries()).sort((a, b) => {
      if (a[0] === "General") return 1;
      if (b[0] === "General") return -1;
      return a[0].localeCompare(b[0]);
    });
  }, [pages]);

  return (
    <div className={styles.pagesIndexContainer}>
      <h1 className={styles.pagesIndexTitle}>Pages</h1>
      <p className={styles.pagesIndexDescription}>
        User-authored pages providing additional world context, cultural overviews, and lore articles.
      </p>
      {pages.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyStateIcon}>📝</div>
          <div className={styles.emptyStateTitle}>No pages yet</div>
          <div className={styles.emptyStateDescription}>Create and publish pages in Illuminator to see them here.</div>
        </div>
      ) : (
        <div className={styles.pageList}>
          {pagesByNamespace.map(([namespace, pagesInNs]) => (
            <div key={namespace} className={styles.namespaceGroup}>
              <h2 className={styles.namespaceTitle}>{namespace}</h2>
              <div className={styles.pageList}>
                {pagesInNs.map((page) => (
                  <button key={page.id} onClick={() => onNavigate(page.id)} className={styles.pageItem}>
                    {page.title}
                    {page.content.summary && <div className={styles.pageItemSummary}>{page.content.summary}</div>}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function PageCategoryIndex({ namespace, pages, onNavigate }: Readonly<{
  namespace: string; pages: WikiPage[]; onNavigate: (pageId: string) => void;
}>) {
  const filteredPages = useMemo(() => {
    return pages.filter((page) => {
      const colonIndex = page.title.indexOf(":");
      const pageNamespace = colonIndex > 0 ? page.title.slice(0, colonIndex) : "General";
      return pageNamespace === namespace;
    });
  }, [pages, namespace]);

  return (
    <div className={styles.pagesIndexContainer}>
      <h1 className={styles.pagesIndexTitle}>{namespace} Pages</h1>
      <p className={styles.pagesIndexDescription}>
        {namespace === "General" ? "Pages without a namespace prefix." : `Pages in the ${namespace} namespace.`}
      </p>
      {filteredPages.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyStateIcon}>📝</div>
          <div className={styles.emptyStateTitle}>No pages in this category</div>
        </div>
      ) : (
        <div className={styles.pageList}>
          {filteredPages.map((page) => (
            <button key={page.id} onClick={() => onNavigate(page.id)} className={styles.pageItem}>
              {page.title}
              {page.content.summary && <div className={styles.pageItemSummary}>{page.content.summary}</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
