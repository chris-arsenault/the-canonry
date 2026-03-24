/**
 * FinalizeEditor — TipTap WYSIWYG editor for finalized chronicle pages.
 *
 * Loads content from either an existing finalized page or fresh render
 * from the source chronicle. Auto-saves to the finalizedPages table.
 */

import React, { useEffect, useCallback, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import TextStyle from "@tiptap/extension-text-style";
import {
  getFinalizedPage,
  putFinalizedPage,
} from "../../lib/db/finalizedPageRepository";
import type { ChronicleRecord } from "../../lib/chronicleTypes";
import { renderChronicleToHtml } from "../../lib/preprint/chronicleToHtml";
import "./FinalizeEditor.css";

interface FinalizeEditorProps {
  chronicle: ChronicleRecord;
  simulationRunId: string;
  entityImageMap: Map<string, string>;
}

export default function FinalizeEditor({
  chronicle,
  simulationRunId,
  entityImageMap,
}: Readonly<FinalizeEditorProps>) {
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");
  const [initialized, setInitialized] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const chronicleIdRef = useRef(chronicle.chronicleId);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
      }),
      Image.configure({
        HTMLAttributes: { class: "chronicle-image" },
        allowBase64: false,
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      TextStyle,
    ],
    content: "<p>Loading...</p>",
    editorProps: {
      attributes: {
        class: "finalize-editor-content",
      },
    },
    onUpdate: () => {
      setSaveStatus("unsaved");
    },
  });

  // Load initial content
  useEffect(() => {
    if (!editor) return;
    let cancelled = false;

    async function load() {
      // Check for existing finalized page first
      const existing = await getFinalizedPage(simulationRunId, chronicle.chronicleId);
      if (cancelled) return;

      if (existing) {
        editor!.commands.setContent(existing.htmlContent);
      } else {
        // Fresh render from source chronicle
        const html = renderChronicleToHtml(chronicle, entityImageMap);
        editor!.commands.setContent(html);
      }
      setInitialized(true);
    }

    chronicleIdRef.current = chronicle.chronicleId;
    setInitialized(false);
    void load();
    return () => { cancelled = true; };
  }, [editor, chronicle.chronicleId, simulationRunId, entityImageMap, chronicle]);

  // Auto-save debounced
  const save = useCallback(async () => {
    if (!editor || !initialized) return;
    setSaveStatus("saving");
    await putFinalizedPage({
      pageId: chronicle.chronicleId,
      simulationRunId,
      sourceChronicleId: chronicle.chronicleId,
      title: chronicle.title,
      htmlContent: editor.getHTML(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    // Only update status if we're still on the same chronicle
    if (chronicleIdRef.current === chronicle.chronicleId) {
      setSaveStatus("saved");
    }
  }, [editor, initialized, chronicle.chronicleId, chronicle.title, simulationRunId]);

  useEffect(() => {
    if (saveStatus !== "unsaved") return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => void save(), 1000);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [saveStatus, save]);

  // Reset to fresh render from source chronicle
  const handleReset = useCallback(() => {
    if (!editor) return;
    const html = renderChronicleToHtml(chronicle, entityImageMap);
    editor.commands.setContent(html);
    setSaveStatus("unsaved");
  }, [editor, chronicle, entityImageMap]);

  if (!editor) return null;

  return (
    <div className="finalize-editor">
      <div className="finalize-toolbar">
        <ToolbarGroup>
          <ToolbarButton
            active={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
            title="Bold"
          >B</ToolbarButton>
          <ToolbarButton
            active={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            title="Italic"
          ><em>I</em></ToolbarButton>
        </ToolbarGroup>

        <ToolbarGroup>
          <ToolbarButton
            active={editor.isActive("heading", { level: 2 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            title="Heading 2"
          >H2</ToolbarButton>
          <ToolbarButton
            active={editor.isActive("heading", { level: 3 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            title="Heading 3"
          >H3</ToolbarButton>
          <ToolbarButton
            active={editor.isActive("paragraph")}
            onClick={() => editor.chain().focus().setParagraph().run()}
            title="Paragraph"
          >&#x00B6;</ToolbarButton>
        </ToolbarGroup>

        <ToolbarGroup>
          <ToolbarButton
            active={editor.isActive({ textAlign: "left" })}
            onClick={() => editor.chain().focus().setTextAlign("left").run()}
            title="Align left"
          >&#x2190;</ToolbarButton>
          <ToolbarButton
            active={editor.isActive({ textAlign: "center" })}
            onClick={() => editor.chain().focus().setTextAlign("center").run()}
            title="Align center"
          >&#x2194;</ToolbarButton>
          <ToolbarButton
            active={editor.isActive({ textAlign: "justify" })}
            onClick={() => editor.chain().focus().setTextAlign("justify").run()}
            title="Justify"
          >&#x2550;</ToolbarButton>
        </ToolbarGroup>

        <ToolbarGroup>
          <ToolbarButton
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            title="Horizontal rule"
          >&#x2500;</ToolbarButton>
          <ToolbarButton
            active={editor.isActive("blockquote")}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            title="Block quote"
          >&#x201C;</ToolbarButton>
        </ToolbarGroup>

        <div className="finalize-toolbar-spacer" />

        <button className="finalize-reset-btn" onClick={handleReset} title="Reset to generated content (discards all edits)">
          Reset
        </button>

        <span className={`finalize-save-status finalize-save-${saveStatus}`}>
          {saveStatus === "saved" ? "Saved" : saveStatus === "saving" ? "Saving..." : "Unsaved"}
        </span>
      </div>

      <EditorContent editor={editor} />
    </div>
  );
}

function ToolbarGroup({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className="finalize-toolbar-group">{children}</div>;
}

function ToolbarButton({
  active,
  onClick,
  title,
  children,
}: Readonly<{
  active?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}>) {
  return (
    <button
      className={`finalize-toolbar-btn${active ? " finalize-toolbar-btn-active" : ""}`}
      onClick={onClick}
      title={title}
      type="button"
    >
      {children}
    </button>
  );
}
