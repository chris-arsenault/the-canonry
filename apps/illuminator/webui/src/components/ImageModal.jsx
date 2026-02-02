/**
 * ImageModal - Full-size image viewer with metadata sidebar
 *
 * Opens when clicking on an image thumbnail to show the full image.
 * Loads images from local IndexedDB storage by imageId.
 * Displays metadata in a collapsible sidebar with expandable prompt sections.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useImageUrl } from '../hooks/useImageUrl';

/**
 * Format a date timestamp for display
 */
function formatDate(timestamp) {
  if (!timestamp) return 'Unknown';
  return new Date(timestamp).toLocaleString();
}

/**
 * Format file size for display
 */
function formatSize(bytes) {
  if (!bytes) return 'Unknown';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Metadata row component
 */
function MetadataRow({ label, value }) {
  if (!value) return null;

  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{
        fontSize: '11px',
        color: 'rgba(255, 255, 255, 0.5)',
        marginBottom: '4px',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
      }}>
        {label}
      </div>
      <div style={{
        fontSize: '13px',
        color: 'rgba(255, 255, 255, 0.9)',
        wordBreak: 'break-word',
      }}>
        {value}
      </div>
    </div>
  );
}

/**
 * Collapsible prompt section
 */
function PromptSection({ title, content, defaultExpanded = false }) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (!content) return null;

  return (
    <div style={{ marginBottom: '12px' }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          width: '100%',
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '4px',
          padding: '8px 10px',
          color: 'rgba(255, 255, 255, 0.8)',
          fontSize: '12px',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{
          fontSize: '10px',
          transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s ease',
        }}>
          ▶
        </span>
        <span style={{ flex: 1 }}>{title}</span>
        <span style={{
          fontSize: '10px',
          color: 'rgba(255, 255, 255, 0.4)',
        }}>
          {content.length} chars
        </span>
      </button>
      {expanded && (
        <div style={{
          marginTop: '8px',
          padding: '10px',
          background: 'rgba(0, 0, 0, 0.3)',
          borderRadius: '4px',
          fontSize: '12px',
          color: 'rgba(255, 255, 255, 0.85)',
          lineHeight: '1.5',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          maxHeight: '200px',
          overflowY: 'auto',
        }}>
          {content}
        </div>
      )}
    </div>
  );
}

/**
 * Metadata sidebar component
 */
function MetadataSidebar({ metadata, isOpen, onToggle }) {
  if (!metadata) return null;

  // Check if Claude refinement was used (original and final prompts differ)
  const wasRefined = metadata.originalPrompt && metadata.finalPrompt &&
    metadata.originalPrompt !== metadata.finalPrompt;

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={onToggle}
        style={{
          position: 'absolute',
          right: isOpen ? '320px' : '0',
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'rgba(0, 0, 0, 0.7)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRight: isOpen ? 'none' : '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '4px 0 0 4px',
          color: 'white',
          padding: '12px 8px',
          cursor: 'pointer',
          fontSize: '12px',
          zIndex: 10,
          transition: 'right 0.2s ease',
        }}
        title={isOpen ? 'Hide metadata' : 'Show metadata'}
      >
        {isOpen ? '>' : '<'}
      </button>

      {/* Sidebar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: isOpen ? '320px' : '0',
          background: 'rgba(0, 0, 0, 0.85)',
          borderLeft: isOpen ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
          overflow: 'hidden',
          transition: 'width 0.2s ease',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          width: '320px',
          height: '100%',
          overflowY: 'auto',
          padding: '60px 20px 20px 20px',
        }}>
          <h4 style={{
            margin: '0 0 20px 0',
            color: 'white',
            fontSize: '14px',
            fontWeight: 500,
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            paddingBottom: '12px',
          }}>
            Image Metadata
          </h4>

          {/* Basic info */}
          <MetadataRow label="Entity" value={metadata.entityName} />
          <MetadataRow label="Kind" value={metadata.entityKind} />
          <MetadataRow label="Culture" value={metadata.entityCulture} />
          <MetadataRow label="Model" value={metadata.model} />
          <MetadataRow label="Generated" value={formatDate(metadata.generatedAt)} />
          <MetadataRow label="File Size" value={formatSize(metadata.size)} />

          {/* Prompts section */}
          {(metadata.originalPrompt || metadata.finalPrompt || metadata.revisedPrompt) && (
            <>
              <div style={{
                borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                margin: '16px 0',
              }} />
              <div style={{
                fontSize: '11px',
                color: 'rgba(255, 255, 255, 0.5)',
                marginBottom: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}>
                Prompts
              </div>

              {wasRefined ? (
                <>
                  <PromptSection
                    title="Original Prompt (Template)"
                    content={metadata.originalPrompt}
                    defaultExpanded={false}
                  />
                  <PromptSection
                    title="Refined Prompt (Claude)"
                    content={metadata.finalPrompt}
                    defaultExpanded={true}
                  />
                </>
              ) : (
                <PromptSection
                  title="Prompt (Sent to Model)"
                  content={metadata.finalPrompt || metadata.originalPrompt}
                  defaultExpanded={true}
                />
              )}

              {metadata.revisedPrompt && (
                <PromptSection
                  title="Revised Prompt (DALL-E)"
                  content={metadata.revisedPrompt}
                  defaultExpanded={false}
                />
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

export default function ImageModal({ isOpen, imageId, title, onClose }) {
  const { url: imageUrl, loading, error, metadata } = useImageUrl(isOpen ? imageId : null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const mouseDownOnOverlay = useRef(false);

  const handleOverlayMouseDown = (e) => {
    mouseDownOnOverlay.current = e.target === e.currentTarget;
  };

  const handleOverlayClick = (e) => {
    if (mouseDownOnOverlay.current && e.target === e.currentTarget) {
      onClose();
    }
  };

  // Close on escape key
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.9)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
      onMouseDown={handleOverlayMouseDown}
      onClick={handleOverlayClick}
    >
      {/* Header with title and close button */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: sidebarOpen && metadata ? '320px' : '0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 24px',
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)',
          transition: 'right 0.2s ease',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: 0, color: 'white', fontSize: '16px' }}>{title}</h3>
        <button
          onClick={onClose}
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '4px',
            color: 'white',
            padding: '8px 16px',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          Close (Esc)
        </button>
      </div>

      {/* Image container - adjusted for sidebar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 1,
          width: '100%',
          padding: '60px 40px 60px 40px',
          paddingRight: sidebarOpen && metadata ? '360px' : '40px',
          transition: 'padding-right 0.2s ease',
        }}
      >
        {loading ? (
          <div
            style={{
              color: 'rgba(255, 255, 255, 0.7)',
              fontSize: '16px',
            }}
          >
            Loading image...
          </div>
        ) : error || !imageUrl ? (
          <div
            style={{
              color: 'rgba(255, 255, 255, 0.5)',
              fontSize: '14px',
              textAlign: 'center',
            }}
          >
            <div style={{ marginBottom: '8px' }}>Image not available</div>
            <div style={{ fontSize: '12px' }}>{error || 'Image not found in storage'}</div>
          </div>
        ) : (
          <img
            src={imageUrl}
            alt={title}
            style={{
              maxWidth: '100%',
              maxHeight: 'calc(100vh - 120px)',
              objectFit: 'contain',
              borderRadius: '8px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          />
        )}
      </div>

      {/* Metadata sidebar */}
      <MetadataSidebar
        metadata={metadata}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />

      {/* Hint at bottom */}
      <div
        style={{
          position: 'absolute',
          bottom: 16,
          left: 0,
          right: sidebarOpen && metadata ? '320px' : '0',
          textAlign: 'center',
          color: 'rgba(255, 255, 255, 0.5)',
          fontSize: '12px',
          transition: 'right 0.2s ease',
        }}
      >
        Click anywhere or press Escape to close
      </div>
    </div>
  );
}
