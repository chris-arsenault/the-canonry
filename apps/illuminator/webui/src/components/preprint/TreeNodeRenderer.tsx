/**
 * TreeNodeRenderer — Custom node display for the content tree.
 *
 * Shows type icon, name (editable for folders), word count, and completion status.
 */

import type { NodeRendererProps } from 'react-arborist';
import type { ContentTreeNode } from '../../lib/preprint/prePrintTypes';

const TYPE_ICONS: Record<string, string> = {
  folder: '\u{1F4C1}',
  entity: '{}',
  chronicle: '\u2016',
  static_page: '[]',
};

const TYPE_LABELS: Record<string, string> = {
  folder: 'Folder',
  entity: 'Entity',
  chronicle: 'Chronicle',
  static_page: 'Page',
};

interface NodeMeta {
  wordCount?: number;
  imageCount?: number;
  hasDescription?: boolean;
  hasImage?: boolean;
}

export interface TreeNodeData extends ContentTreeNode {
  meta?: NodeMeta;
}

export default function TreeNodeRenderer({
  node,
  style,
  dragHandle,
}: NodeRendererProps<TreeNodeData>) {
  const data = node.data;
  const meta = data.meta;
  const isFolder = data.type === 'folder';

  return (
    <div
      className={`preprint-tree-node ${node.isSelected ? 'selected' : ''} ${isFolder ? 'folder' : 'content'}`}
      style={style}
      ref={dragHandle}
      onClick={() => node.isInternal && node.toggle()}
    >
      <span className="preprint-tree-node-icon" title={TYPE_LABELS[data.type] || data.type}>
        {isFolder ? (node.isOpen ? '\u{1F4C2}' : '\u{1F4C1}') : TYPE_ICONS[data.type] || '?'}
      </span>

      {node.isEditing ? (
        <input
          type="text"
          className="preprint-tree-node-edit"
          defaultValue={data.name}
          autoFocus
          onBlur={() => node.reset()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') node.submit((e.target as HTMLInputElement).value);
            if (e.key === 'Escape') node.reset();
          }}
        />
      ) : (
        <span className="preprint-tree-node-name" title={data.name}>
          {data.name}
        </span>
      )}

      {!isFolder && meta && (
        <span className="preprint-tree-node-meta">
          {meta.wordCount !== undefined && (
            <span className="preprint-tree-node-wc" title="Word count">
              {meta.wordCount.toLocaleString()}w
            </span>
          )}
          {meta.imageCount !== undefined && meta.imageCount > 0 && (
            <span className="preprint-tree-node-ic" title="Images">
              \u25A3 {meta.imageCount}
            </span>
          )}
          <span
            className="preprint-tree-node-status"
            title={
              meta.hasDescription && meta.hasImage
                ? 'Complete'
                : meta.hasDescription
                  ? 'Missing image'
                  : 'Missing content'
            }
            style={{
              color:
                meta.hasDescription && meta.hasImage
                  ? '#22c55e'
                  : meta.hasDescription
                    ? '#f59e0b'
                    : '#ef4444',
            }}
          >
            {meta.hasDescription && meta.hasImage ? '\u25CF' : meta.hasDescription ? '\u25D2' : '\u25CB'}
          </span>
        </span>
      )}
    </div>
  );
}
