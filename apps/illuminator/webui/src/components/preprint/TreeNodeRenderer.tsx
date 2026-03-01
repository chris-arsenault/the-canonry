/**
 * TreeNodeRenderer — Custom node display for the content tree.
 *
 * Shows type icon, name (editable for folders), word count, and completion status.
 */

import type { NodeRendererProps } from "react-arborist";
import type { ContentTreeNode } from "../../lib/preprint/prePrintTypes";
import React from "react";
const TYPE_ICONS: Record<string, string> = {
  folder: "\u{1F4C1}",
  entity: "{}",
  chronicle: "\u2016",
  static_page: "[]",
  era_narrative: "\u25C6"
};
const TYPE_LABELS: Record<string, string> = {
  folder: "Folder",
  entity: "Entity",
  chronicle: "Chronicle",
  static_page: "Page",
  era_narrative: "Era Narrative"
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
  dragHandle
}: Readonly<NodeRendererProps<TreeNodeData>>) {
  const data = node.data;
  const meta = data.meta;
  const isFolder = data.type === "folder";
  return <div className={`preprint-tree-node ${node.isSelected ? "selected" : ""} ${isFolder ? "folder" : "content"}`} ref={dragHandle} onClick={() => node.isInternal && node.toggle()} role="button" tabIndex={0} onKeyDown={e => {
    if (e.key === "Enter" || e.key === " ") e.currentTarget.click();
  }} style={style}>
      <span className="preprint-tree-node-icon" title={TYPE_LABELS[data.type] || data.type}>
        {(() => {
        if (isFolder) return node.isOpen ? "\u{1F4C2}" : "\u{1F4C1}";
        return TYPE_ICONS[data.type] || "?";
      })()}
      </span>

      {node.isEditing ? <input type="text" className="preprint-tree-node-edit" defaultValue={data.name}
    // eslint-disable-next-line jsx-a11y/no-autofocus
    autoFocus onBlur={() => node.reset()} onKeyDown={e => {
      if (e.key === "Enter") node.submit((e.target as HTMLInputElement).value);
      if (e.key === "Escape") node.reset();
    }} /> : <span className="preprint-tree-node-name" title={data.name}>
          {data.name}
        </span>}

      {!isFolder && meta && <span className="preprint-tree-node-meta">
          {meta.wordCount !== undefined && <span className="preprint-tree-node-wc" title="Word count">
              {meta.wordCount.toLocaleString()}w
            </span>}
          {meta.imageCount !== undefined && meta.imageCount > 0 && <span className="preprint-tree-node-ic" title="Images">
              \u25A3 {meta.imageCount}
            </span>}
          <span className="preprint-tree-node-status" title={(() => {
        if (meta.hasDescription && meta.hasImage) return "Complete";
        if (meta.hasDescription) return "Missing image";
        return "Missing content";
      })()} style={{
        '--tree-status-color': (() => {
          if (meta.hasDescription && meta.hasImage) return "#22c55e";
          if (meta.hasDescription) return "#f59e0b";
          return "#ef4444";
        })()
      } as React.CSSProperties}>
            {(() => {
          if (meta.hasDescription && meta.hasImage) return "\u25CF";
          if (meta.hasDescription) return "\u25D2";
          return "\u25CB";
        })()}
          </span>
        </span>}
    </div>;
}
