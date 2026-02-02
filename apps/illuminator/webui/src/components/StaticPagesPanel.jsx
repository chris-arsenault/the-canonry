/**
 * StaticPagesPanel - Main panel for the Pages tab
 *
 * Shows a list of static pages on the left and the editor on the right.
 * Manages page CRUD operations via staticPageStorage.
 */

import { useState, useEffect, useCallback } from 'react';
import StaticPageEditor from './StaticPageEditor';
import {
  getStaticPagesForProject,
  createStaticPage,
  updateStaticPage,
  deleteStaticPage,
} from '../lib/db/staticPageRepository';

export default function StaticPagesPanel({ projectId, entities }) {
  const [pages, setPages] = useState([]);
  const [selectedPageId, setSelectedPageId] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load pages on mount and when projectId changes
  useEffect(() => {
    if (!projectId) {
      setPages([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    setLoading(true);
    getStaticPagesForProject(projectId)
      .then((loadedPages) => {
        if (cancelled) return;
        setPages(loadedPages);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load static pages:', err);
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const selectedPage = pages.find((p) => p.pageId === selectedPageId);

  const handleCreatePage = useCallback(async () => {
    if (!projectId) return;

    try {
      const newPage = await createStaticPage({
        projectId,
        title: 'Untitled Page',
        content: '# Untitled Page\n\nStart writing here...',
      });
      setPages((prev) => [newPage, ...prev]);
      setSelectedPageId(newPage.pageId);
    } catch (err) {
      console.error('Failed to create page:', err);
    }
  }, [projectId]);

  const handleSavePage = useCallback(
    async (updates) => {
      if (!selectedPageId) return;

      try {
        const updated = await updateStaticPage(selectedPageId, updates);
        setPages((prev) =>
          prev.map((p) => (p.pageId === selectedPageId ? updated : p))
        );
      } catch (err) {
        console.error('Failed to save page:', err);
      }
    },
    [selectedPageId]
  );

  const handleDeletePage = useCallback(async () => {
    if (!selectedPageId) return;
    if (!confirm('Are you sure you want to delete this page?')) return;

    try {
      await deleteStaticPage(selectedPageId);
      setPages((prev) => prev.filter((p) => p.pageId !== selectedPageId));
      setSelectedPageId(null);
    } catch (err) {
      console.error('Failed to delete page:', err);
    }
  }, [selectedPageId]);

  const handlePublishToggle = useCallback(
    async (newStatus) => {
      if (!selectedPageId) return;

      try {
        const updated = await updateStaticPage(selectedPageId, { status: newStatus });
        setPages((prev) =>
          prev.map((p) => (p.pageId === selectedPageId ? updated : p))
        );
      } catch (err) {
        console.error('Failed to update page status:', err);
      }
    },
    [selectedPageId]
  );

  if (loading) {
    return (
      <div className="static-pages-panel">
        <div className="static-pages-loading">Loading pages...</div>
      </div>
    );
  }

  return (
    <div className="static-pages-panel">
      {/* Left sidebar: page list */}
      <div className="static-pages-sidebar">
        <div className="static-pages-sidebar-header">
          <h3>Static Pages</h3>
          <button className="static-page-button primary" onClick={handleCreatePage}>
            + New Page
          </button>
        </div>

        <div className="static-pages-list">
          {pages.length === 0 ? (
            <div className="static-pages-empty">
              <p>No pages yet.</p>
              <p>Create a page to add custom content like culture overviews or lore articles.</p>
            </div>
          ) : (
            pages.map((page) => (
              <button
                key={page.pageId}
                className={`static-pages-list-item ${selectedPageId === page.pageId ? 'selected' : ''}`}
                onClick={() => setSelectedPageId(page.pageId)}
              >
                <span className="static-pages-list-title">{page.title}</span>
                <span className="static-pages-list-meta">
                  <span className={`static-pages-status-dot ${page.status}`} />
                  {page.wordCount} words
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right area: editor */}
      <div className="static-pages-editor-area">
        <StaticPageEditor
          page={selectedPage}
          entities={entities}
          projectId={projectId}
          onSave={handleSavePage}
          onDelete={handleDeletePage}
          onPublishToggle={handlePublishToggle}
        />
      </div>
    </div>
  );
}
