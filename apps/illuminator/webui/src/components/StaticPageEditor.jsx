/**
 * StaticPageEditor - Markdown editor for static pages
 *
 * Uses @uiw/react-md-editor for markdown editing with
 * custom toolbar buttons for entity links and images.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import MDEditor from '@uiw/react-md-editor';
import EntityLinkPicker from './EntityLinkPicker';
import ImageRefPicker from './ImageRefPicker';

export default function StaticPageEditor({
  page,
  entities,
  projectId,
  onSave,
  onDelete,
  onPublishToggle,
}) {
  const [title, setTitle] = useState(page?.title || '');
  const [content, setContent] = useState(page?.content || '');
  const [summary, setSummary] = useState(page?.summary || '');
  const [showEntityPicker, setShowEntityPicker] = useState(false);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const saveTimeoutRef = useRef(null);

  // Reset state when page changes
  useEffect(() => {
    setTitle(page?.title || '');
    setContent(page?.content || '');
    setSummary(page?.summary || '');
    setIsDirty(false);
  }, [page?.pageId]);

  // Auto-save on changes (debounced)
  useEffect(() => {
    if (!isDirty || !page) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      onSave({
        title,
        content,
        summary: summary || undefined,
      });
      setIsDirty(false);
    }, 1000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [isDirty, title, content, summary, page, onSave]);

  const handleTitleChange = (e) => {
    setTitle(e.target.value);
    setIsDirty(true);
  };

  const handleContentChange = (value) => {
    setContent(value || '');
    setIsDirty(true);
  };

  const handleSummaryChange = (e) => {
    setSummary(e.target.value);
    setIsDirty(true);
  };

  const handleEntityLinkSelect = useCallback((linkText) => {
    // Insert at cursor or append to content
    setContent((prev) => prev + linkText);
    setIsDirty(true);
  }, []);

  const handleImageSelect = useCallback((imageRef) => {
    // Insert at cursor or append to content
    setContent((prev) => prev + '\n\n' + imageRef + '\n\n');
    setIsDirty(true);
  }, []);

  const handleSaveNow = () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    onSave({
      title,
      content,
      summary: summary || undefined,
    });
    setIsDirty(false);
  };

  if (!page) {
    return (
      <div className="static-page-editor-empty">
        <div className="static-page-editor-empty-icon">&#x1F4DD;</div>
        <div className="static-page-editor-empty-title">Select a page to edit</div>
        <div className="static-page-editor-empty-desc">
          Choose a page from the list or create a new one
        </div>
      </div>
    );
  }

  return (
    <div className="static-page-editor">
      {/* Header with title and actions */}
      <div className="static-page-editor-header">
        <input
          type="text"
          value={title}
          onChange={handleTitleChange}
          placeholder="Page title..."
          className="static-page-title-input"
        />
        <div className="static-page-editor-actions">
          <span
            className={`static-page-status-badge ${page.status}`}
            title={page.status === 'published' ? 'Visible in Chronicler' : 'Draft only'}
          >
            {page.status}
          </span>
          {isDirty && <span className="static-page-dirty-indicator">Unsaved</span>}
          <button className="static-page-button" onClick={handleSaveNow} disabled={!isDirty}>
            Save
          </button>
          <button
            className="static-page-button"
            onClick={() => onPublishToggle(page.status === 'published' ? 'draft' : 'published')}
          >
            {page.status === 'published' ? 'Unpublish' : 'Publish'}
          </button>
          <button className="static-page-button danger" onClick={onDelete}>
            Delete
          </button>
        </div>
      </div>

      {/* Summary input */}
      <div className="static-page-summary-section">
        <label className="static-page-summary-label">
          Summary (shown in page lists):
          <input
            type="text"
            value={summary}
            onChange={handleSummaryChange}
            placeholder="Brief description of this page..."
            className="static-page-summary-input"
          />
        </label>
      </div>

      {/* Custom toolbar */}
      <div className="static-page-toolbar">
        <button
          className="static-page-toolbar-button"
          onClick={() => setShowEntityPicker(true)}
          title="Insert entity link [[Entity Name]]"
        >
          &#x1F517; Entity Link
        </button>
        <button
          className="static-page-toolbar-button"
          onClick={() => setShowImagePicker(true)}
          title="Insert image reference"
        >
          &#x1F5BC; Image
        </button>
        <span className="static-page-toolbar-hint">
          Use <code>[[Entity Name]]</code> to link to entities
        </span>
      </div>

      {/* Markdown editor */}
      <div className="static-page-editor-container" data-color-mode="dark">
        <MDEditor
          value={content}
          onChange={handleContentChange}
          preview="live"
          height={500}
          visibleDragbar={false}
        />
      </div>

      {/* Word count */}
      <div className="static-page-editor-footer">
        <span className="static-page-word-count">
          {page.wordCount || 0} words • {page.linkedEntityIds?.length || 0} entity links
        </span>
        <span className="static-page-updated">
          Last updated: {new Date(page.updatedAt).toLocaleString()}
        </span>
      </div>

      {/* Modals */}
      {showEntityPicker && (
        <EntityLinkPicker
          entities={entities}
          onSelect={handleEntityLinkSelect}
          onClose={() => setShowEntityPicker(false)}
        />
      )}
      {showImagePicker && (
        <ImageRefPicker
          projectId={projectId}
          onSelect={handleImageSelect}
          onClose={() => setShowImagePicker(false)}
        />
      )}
    </div>
  );
}
