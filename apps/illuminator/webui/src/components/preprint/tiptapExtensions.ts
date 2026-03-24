/**
 * Custom TipTap extensions for the finalize editor.
 *
 * - ChronicleImage: extends Image with size, justification, and data-image-id
 * - HistorianNote: custom block node for annotation asides
 */

import { Node, mergeAttributes } from "@tiptap/core";
import Image from "@tiptap/extension-image";

/**
 * Extended Image node with chronicle layout attributes.
 * Preserves size (small/medium/large/full-width), justification (left/right),
 * and data-image-id for image-store reference.
 */
export const ChronicleImage = Image.extend({
  name: "image",

  addAttributes() {
    return {
      ...this.parent?.(),
      "data-image-id": { default: null },
      "data-ref-id": { default: null },
      class: { default: null },
    };
  },
});

/**
 * Historian annotation block node.
 * Renders as <aside> with note type, text content, and styling attributes.
 */
export const HistorianNote = Node.create({
  name: "historianNote",
  group: "block",
  content: "inline*",
  defining: true,

  addAttributes() {
    return {
      "data-note-id": { default: null },
      "data-note-type": { default: "commentary" },
      style: { default: null },
      class: { default: "historian-note" },
    };
  },

  parseHTML() {
    return [
      { tag: "aside.historian-note" },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["aside", mergeAttributes(HTMLAttributes), 0];
  },
});

/**
 * Note label inline node — the type/icon label inside a historian note.
 */
export const NoteLabel = Node.create({
  name: "noteLabel",
  group: "inline",
  inline: true,
  content: "inline*",

  addAttributes() {
    return {
      style: { default: null },
      class: { default: "note-label" },
    };
  },

  parseHTML() {
    return [
      { tag: "span.note-label" },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes), 0];
  },
});
