/**
 * FinalizeEditor — TipTap WYSIWYG editor for finalized chronicle pages.
 *
 * Uses the shared chronicle-renderer pipeline to produce the initial content,
 * then serializes to HTML via renderToHtml. Auto-saves edits to finalizedPages.
 */

import React, { useEffect, useCallback, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import { buildChronicleRender, type EntityImageSource } from "@the-canonry/chronicle-renderer";
import {
  getFinalizedPage,
  putFinalizedPage,
} from "../../lib/db/finalizedPageRepository";
import { renderToHtml } from "../../lib/preprint/renderToHtml";
import type { ChronicleRecord } from "../../lib/chronicleTypes";
import "./FinalizeEditor.css";

interface FinalizeEditorProps {
  chronicle: ChronicleRecord;
  simulationRunId: string;
  entities: EntityImageSource[];
}

export default function FinalizeEditor({
  chronicle,
  simulationRunId,
  entities,
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

  /** Render chronicle through the shared pipeline → HTML */
  const renderFresh = useCallback(async (): Promise<string> => {
    const content = chronicle.finalContent || chronicle.assembledContent || "";
    const render = buildChronicleRender({
      content,
      imageRefs: chronicle.imageRefs as { refs: import("@the-canonry/chronicle-renderer").ChronicleImageRef[] } | null,
      entities,
      historianNotes: chronicle.historianNotes,
      coverImageId: chronicle.coverImage?.status === "complete" ? chronicle.coverImage?.generatedImageId : null,
    });
    return renderToHtml(render);
  }, [chronicle, entities]);

  // Load content: existing finalized page, or fresh render
  useEffect(() => {
    if (!editor) return;
    let cancelled = false;

    async function load() {
      const existing = await getFinalizedPage(simulationRunId, chronicle.chronicleId);
      if (cancelled) return;

      if (existing) {
        editor!.commands.setContent(existing.htmlContent);
      } else {
        const html = await renderFresh();
        if (cancelled) return;
        editor!.commands.setContent(html);
      }
      setInitialized(true);
    }

    chronicleIdRef.current = chronicle.chronicleId;
    setInitialized(false);
    void load();
    return () => { cancelled = true; };
  }, [editor, chronicle.chronicleId, simulationRunId, renderFresh]);

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

  // Reset: re-render from source chronicle through the shared pipeline
  const handleReset = useCallback(async () => {
    if (!editor) return;
    const html = await renderFresh();
    editor.commands.setContent(html);
    setSaveStatus("unsaved");
  }, [editor, renderFresh]);

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

        <button className="finalize-reset-btn" onClick={() => void handleReset()} title="Re-render from source chronicle (discards all edits)">
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
