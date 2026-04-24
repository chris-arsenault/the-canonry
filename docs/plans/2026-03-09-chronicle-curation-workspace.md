# Chronicle Curation Workspace Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "Curation" tab to Illuminator that consolidates chronicle image selection, display options, and navigation into a single three-rail workspace for rapid chronicle curation. Remove the PageLayoutEditor from the Pre-Print Content Tree where it doesn't belong.

**Architecture:** A new `CurationTab` component renders a three-rail layout: left rail (chronicle navigator grouped by era), center (image contact sheet with inline thumbnail strips), right rail (display option controls with auto-save). Data loads lazily via existing `chronicleStore` and `pageLayoutRepository`. The center rail reuses existing `ChronicleImagePanelCards` for scene/entity image display and adds inline image strips backed by `searchChronicleImages`. The right rail wraps `PageLayoutEditor` constants and repository calls in a streamlined radio-button form.

**Tech Stack:** React, TypeScript, Zustand (`chronicleStore`), IndexedDB/Dexie (`pageLayoutRepository`, `imageRepository`), CSS (BEM-prefixed global classes)

---

## Background

### Current pain points
1. **Chronicle images** are managed in the Chronicle tab → expand a chronicle → Image References panel → modal picker. Too many clicks.
2. **Display options** (layout mode, annotation position, text align, etc.) live in Pre-Print → Content Tree → select node → PageLayoutEditor. Wrong location — these are creative decisions, not pre-print config.
3. **No unified view** — switching between image selection and display options requires tab changes and re-finding the chronicle.

### Approved design: Three-rail layout

| Rail | Width | Purpose |
|------|-------|---------|
| Left | 200px fixed | Chronicle navigator grouped by era, keyboard nav (↑/↓), format icons |
| Center | flex | Image contact sheet: cover image, scene images with thumbnail strips, entity refs |
| Right | 220px fixed | Display option radio groups with auto-save |

### Key existing files

| File | Role |
|------|------|
| `apps/illuminator/webui/src/components/IlluminatorSidebar.jsx` | TABS array — add new tab entry |
| `apps/illuminator/webui/src/components/IlluminatorTabContent.jsx` | TAB_COMPONENTS lookup — add CurationTab |
| `apps/illuminator/webui/src/components/preprint/ContentTreeView.tsx` | PageLayoutEditor render + import — remove both |
| `apps/illuminator/webui/src/components/preprint/PageLayoutEditor.tsx` | Layout override controls — reuse constants |
| `apps/illuminator/webui/src/lib/db/pageLayoutRepository.ts` | CRUD for PageLayoutOverride |
| `apps/illuminator/webui/src/lib/db/chronicleStore.ts` | Chronicle data + nav items + LRU cache |
| `apps/illuminator/webui/src/lib/db/chronicleNav.ts` | ChronicleNavItem type + buildNavItem |
| `apps/illuminator/webui/src/lib/db/imageRepository.ts` | searchChronicleImages + loadImage |
| `apps/illuminator/webui/src/components/ChronicleImagePanelCards.tsx` | EntityImageRefCard + PromptRequestCard |
| `apps/illuminator/webui/src/components/ChronicleImagePanelTypes.ts` | EntityImageRef, PromptRequestRef, StyleInfo types |
| `apps/illuminator/webui/src/components/ImageModal.jsx` | Full-size image modal (reuse) |

---

## Task 1: Remove PageLayoutEditor from ContentTreeView

**Files:**
- Modify: `apps/illuminator/webui/src/components/preprint/ContentTreeView.tsx:29` (import)
- Modify: `apps/illuminator/webui/src/components/preprint/ContentTreeView.tsx:322-328` (JSX)

**Step 1: Remove the import**

In `ContentTreeView.tsx`, delete the import line:
```typescript
import PageLayoutEditor from "./PageLayoutEditor";
```

**Step 2: Remove the JSX render block**

Delete lines 322-328:
```tsx
{selectedNode && selectedNode.type !== "folder" && selectedNode.contentId && (
  <PageLayoutEditor
    pageId={selectedNode.contentId}
    pageName={selectedNode.name}
    simulationRunId={simulationRunId}
  />
)}
```

**Step 3: Verify the dev server shows no errors**

The HMR dev server should hot-reload with no errors. The Pre-Print Content Tree should render without the layout editor section.

**Step 4: Commit**

```bash
git add apps/illuminator/webui/src/components/preprint/ContentTreeView.tsx
git commit -m "refactor: remove PageLayoutEditor from Pre-Print Content Tree

Display options are creative decisions, not pre-print config.
Moving them to the new Curation tab."
```

---

## Task 2: Create the Curation Tab shell and register it

**Files:**
- Create: `apps/illuminator/webui/src/components/CurationTab.tsx`
- Create: `apps/illuminator/webui/src/components/CurationTab.css`
- Modify: `apps/illuminator/webui/src/components/IlluminatorSidebar.jsx:8-26` (TABS array)
- Modify: `apps/illuminator/webui/src/components/IlluminatorTabContent.jsx` (import + TAB_COMPONENTS)

**Step 1: Create `CurationTab.css` with three-rail layout**

```css
/* CurationTab — three-rail chronicle curation workspace */

.cur-workspace {
  display: flex;
  height: 100%;
  overflow: hidden;
}

.cur-left-rail {
  width: 200px;
  min-width: 200px;
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.cur-center-rail {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-md);
}

.cur-right-rail {
  width: 220px;
  min-width: 220px;
  border-left: 1px solid var(--color-border);
  overflow-y: auto;
  padding: var(--spacing-md);
}

.cur-empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}
```

**Step 2: Create `CurationTab.tsx` as an empty shell**

```tsx
import React from "react";
import { useIlluminatorConfigStore } from "../lib/db/illuminatorConfigStore";
import "./CurationTab.css";

export default function CurationTab() {
  const { simulationRunId } = useIlluminatorConfigStore();

  if (!simulationRunId) {
    return <div className="cur-empty-state">No simulation loaded.</div>;
  }

  return (
    <div className="cur-workspace">
      <div className="cur-left-rail">
        <div className="cur-empty-state">Navigator</div>
      </div>
      <div className="cur-center-rail">
        <div className="cur-empty-state">Select a chronicle</div>
      </div>
      <div className="cur-right-rail">
        <div className="cur-empty-state">Display options</div>
      </div>
    </div>
  );
}
```

**Step 3: Register the tab in IlluminatorSidebar.jsx**

In the TABS array, add after the `"chronicle"` entry (line 16):
```javascript
{ id: "curation", label: "Curation" },
```

**Step 4: Register in IlluminatorTabContent.jsx**

Add import near the top:
```javascript
import CurationTab from "./CurationTab";
```

Add to TAB_COMPONENTS object:
```javascript
curation: CurationTab,
```

Note: Unlike other tabs, CurationTab gets its own data from stores — it doesn't receive props from the parent. This is intentional: the curation workspace is self-contained.

**Step 5: Commit**

```bash
git add apps/illuminator/webui/src/components/CurationTab.tsx \
       apps/illuminator/webui/src/components/CurationTab.css \
       apps/illuminator/webui/src/components/IlluminatorSidebar.jsx \
       apps/illuminator/webui/src/components/IlluminatorTabContent.jsx
git commit -m "feat: add Curation tab shell with three-rail layout"
```

---

## Task 3: Build the Left Rail — Chronicle Navigator

**Files:**
- Create: `apps/illuminator/webui/src/components/curation/CurationNavigator.tsx`
- Create: `apps/illuminator/webui/src/components/curation/CurationNavigator.css`
- Modify: `apps/illuminator/webui/src/components/CurationTab.tsx`

**Step 1: Create `CurationNavigator.css`**

```css
/* CurationNavigator — era-grouped chronicle list */

.cnav-list {
  flex: 1;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--color-border) transparent;
}

.cnav-era-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-sm);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-accent);
  cursor: pointer;
  background: none;
  border: none;
  width: 100%;
  text-align: left;
}

.cnav-era-header:hover {
  color: var(--color-accent-light);
}

.cnav-collapse-icon {
  font-size: 8px;
  width: 12px;
  display: inline-flex;
  justify-content: center;
}

.cnav-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  width: 100%;
  padding: var(--spacing-xs) var(--spacing-sm);
  padding-left: var(--spacing-lg);
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  background: none;
  border: none;
  border-radius: var(--radius-sm);
  text-align: left;
  cursor: pointer;
  line-height: 1.4;
  transition: background-color var(--transition-fast);
}

.cnav-item:hover {
  background-color: var(--color-accent-hover);
}

.cnav-item-active {
  background-color: var(--color-accent);
  color: var(--color-bg-primary);
  font-weight: var(--font-weight-medium);
}

.cnav-item-active:hover {
  background-color: var(--color-accent);
}

.cnav-format-icon {
  font-size: var(--font-size-xs);
  opacity: 0.6;
  flex-shrink: 0;
}

.cnav-item-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.cnav-image-count {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.cnav-item-active .cnav-image-count {
  color: var(--color-bg-primary);
  opacity: 0.7;
}
```

**Step 2: Create `CurationNavigator.tsx`**

```tsx
import React, { useMemo, useCallback } from "react";
import { useChronicleStore } from "../../lib/db/chronicleStore";
import type { ChronicleNavItem } from "../../lib/db/chronicleNav";
import "./CurationNavigator.css";

interface EraGroup {
  eraName: string;
  eraOrder: number;
  items: ChronicleNavItem[];
}

interface CurationNavigatorProps {
  selectedChronicleId: string | null;
  onSelectChronicle: (id: string) => void;
}

const FORMAT_ICONS: Record<string, string> = {
  story: "☰",
  document: "▣",
};

export default function CurationNavigator({
  selectedChronicleId,
  onSelectChronicle,
}: Readonly<CurationNavigatorProps>) {
  const navItems = useChronicleStore((s) => s.navItems);
  const navOrder = useChronicleStore((s) => s.navOrder);

  const eraGroups = useMemo((): EraGroup[] => {
    const groups = new Map<string, EraGroup>();
    for (const id of navOrder) {
      const item = navItems[id];
      if (!item) continue;
      const eraName = item.focalEraName || "Unknown Era";
      const eraOrder = item.focalEraOrder ?? item.focalEraStartTick ?? Infinity;
      if (!groups.has(eraName)) {
        groups.set(eraName, { eraName, eraOrder, items: [] });
      }
      groups.get(eraName)!.items.push(item);
    }
    return Array.from(groups.values()).sort((a, b) => a.eraOrder - b.eraOrder);
  }, [navItems, navOrder]);

  const [expandedEras, setExpandedEras] = React.useState<Set<string>>(() => new Set());

  // Auto-expand era containing selected chronicle
  React.useEffect(() => {
    if (!selectedChronicleId) return;
    for (const group of eraGroups) {
      if (group.items.some((item) => item.chronicleId === selectedChronicleId)) {
        setExpandedEras((prev) => {
          if (prev.has(group.eraName)) return prev;
          const next = new Set(prev);
          next.add(group.eraName);
          return next;
        });
        break;
      }
    }
  }, [selectedChronicleId, eraGroups]);

  const toggleEra = useCallback((eraName: string) => {
    setExpandedEras((prev) => {
      const next = new Set(prev);
      if (next.has(eraName)) next.delete(eraName);
      else next.add(eraName);
      return next;
    });
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      e.preventDefault();

      // Flatten visible items
      const visible: string[] = [];
      for (const group of eraGroups) {
        if (expandedEras.has(group.eraName)) {
          for (const item of group.items) visible.push(item.chronicleId);
        }
      }
      if (visible.length === 0) return;

      const currentIdx = selectedChronicleId ? visible.indexOf(selectedChronicleId) : -1;
      const nextIdx =
        e.key === "ArrowDown"
          ? Math.min(currentIdx + 1, visible.length - 1)
          : Math.max(currentIdx - 1, 0);
      onSelectChronicle(visible[nextIdx]);
    },
    [eraGroups, expandedEras, selectedChronicleId, onSelectChronicle]
  );

  return (
    <div className="cnav-list" onKeyDown={handleKeyDown} tabIndex={0}>
      {eraGroups.map((group) => (
        <div key={group.eraName}>
          <button className="cnav-era-header" onClick={() => toggleEra(group.eraName)}>
            <span className="cnav-collapse-icon">
              {expandedEras.has(group.eraName) ? "\u25BC" : "\u25B6"}
            </span>
            {group.eraName}
          </button>
          {expandedEras.has(group.eraName) &&
            group.items.map((item) => (
              <button
                key={item.chronicleId}
                className={`cnav-item ${selectedChronicleId === item.chronicleId ? "cnav-item-active" : ""}`}
                onClick={() => onSelectChronicle(item.chronicleId)}
              >
                <span className="cnav-format-icon">{FORMAT_ICONS[item.format || ""] || ""}</span>
                <span className="cnav-item-name" title={item.name}>
                  {item.name}
                </span>
                {item.imageRefTotalCount > 0 && (
                  <span className="cnav-image-count" title="Images">
                    {item.imageRefCompleteCount}/{item.imageRefTotalCount}
                  </span>
                )}
              </button>
            ))}
        </div>
      ))}
    </div>
  );
}
```

**Step 3: Wire into CurationTab**

Update `CurationTab.tsx` to import and render the navigator in the left rail, replacing the placeholder. Add `selectedChronicleId` state:

```tsx
import React, { useState } from "react";
import { useIlluminatorConfigStore } from "../lib/db/illuminatorConfigStore";
import CurationNavigator from "./curation/CurationNavigator";
import "./CurationTab.css";

export default function CurationTab() {
  const { simulationRunId } = useIlluminatorConfigStore();
  const [selectedChronicleId, setSelectedChronicleId] = useState<string | null>(null);

  if (!simulationRunId) {
    return <div className="cur-empty-state">No simulation loaded.</div>;
  }

  return (
    <div className="cur-workspace">
      <div className="cur-left-rail">
        <CurationNavigator
          selectedChronicleId={selectedChronicleId}
          onSelectChronicle={setSelectedChronicleId}
        />
      </div>
      <div className="cur-center-rail">
        <div className="cur-empty-state">Select a chronicle</div>
      </div>
      <div className="cur-right-rail">
        <div className="cur-empty-state">Display options</div>
      </div>
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add apps/illuminator/webui/src/components/curation/CurationNavigator.tsx \
       apps/illuminator/webui/src/components/curation/CurationNavigator.css \
       apps/illuminator/webui/src/components/CurationTab.tsx
git commit -m "feat: add CurationNavigator with era-grouped chronicle list and keyboard nav"
```

---

## Task 4: Build the Right Rail — Display Options Panel

**Files:**
- Create: `apps/illuminator/webui/src/components/curation/DisplayOptionsPanel.tsx`
- Create: `apps/illuminator/webui/src/components/curation/DisplayOptionsPanel.css`
- Modify: `apps/illuminator/webui/src/components/CurationTab.tsx`

**Step 1: Create `DisplayOptionsPanel.css`**

```css
/* DisplayOptionsPanel — compact radio-group display options */

.dop-panel {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.dop-section-title {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-accent);
  margin-bottom: var(--spacing-xs);
}

.dop-radio-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.dop-radio-label {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: 2px 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  cursor: pointer;
}

.dop-radio-label input[type="radio"] {
  accent-color: var(--color-accent);
  margin: 0;
}

.dop-checkbox-label {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: 2px 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  cursor: pointer;
}

.dop-checkbox-label input[type="checkbox"] {
  accent-color: var(--color-accent);
  margin: 0;
}

.dop-clear-button {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  background: none;
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-sm);
  padding: var(--spacing-xs) var(--spacing-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.dop-clear-button:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.dop-page-name {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: var(--spacing-sm);
}

.dop-no-selection {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  text-align: center;
  padding: var(--spacing-lg) 0;
}
```

**Step 2: Create `DisplayOptionsPanel.tsx`**

This reuses the option constants from `PageLayoutEditor.tsx` directly (import them) but renders as compact radio groups with auto-save on change.

```tsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  getPageLayout,
  putPageLayout,
  deletePageLayout,
} from "../../lib/db/pageLayoutRepository";
import type { PageLayoutOverride } from "../../lib/preprint/prePrintTypes";
import "./DisplayOptionsPanel.css";

// Reuse exact option sets from PageLayoutEditor
const LAYOUT_MODES = [
  { value: "", label: "Auto" },
  { value: "flow", label: "Flow" },
  { value: "margin", label: "Margin" },
  { value: "centered", label: "Centered" },
];

const ANNOTATION_DISPLAY = [
  { value: "", label: "Per-note" },
  { value: "full", label: "Full" },
  { value: "popout", label: "Popout" },
  { value: "disabled", label: "Disabled" },
];

const ANNOTATION_POSITION = [
  { value: "", label: "Default" },
  { value: "sidenote", label: "Sidenote" },
  { value: "inline", label: "Inline" },
  { value: "footnote", label: "Footnote" },
];

const IMAGE_LAYOUT = [
  { value: "", label: "Default" },
  { value: "float", label: "Float" },
  { value: "margin", label: "Margin" },
  { value: "block", label: "Block" },
  { value: "hidden", label: "Hidden" },
];

const CONTENT_WIDTH = [
  { value: "", label: "Standard" },
  { value: "narrow", label: "Narrow" },
  { value: "wide", label: "Wide" },
];

const TEXT_ALIGN = [
  { value: "", label: "Left" },
  { value: "center", label: "Center" },
  { value: "justify", label: "Justify" },
];

interface DisplayOptionsPanelProps {
  chronicleId: string | null;
  chronicleName: string;
  simulationRunId: string;
}

export default function DisplayOptionsPanel({
  chronicleId,
  chronicleName,
  simulationRunId,
}: Readonly<DisplayOptionsPanelProps>) {
  const [override, setOverride] = useState<Partial<PageLayoutOverride>>({});
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Load existing override when chronicle changes
  useEffect(() => {
    if (!chronicleId) {
      setOverride({});
      return;
    }
    let cancelled = false;
    getPageLayout(simulationRunId, chronicleId).then((layout) => {
      if (!cancelled) setOverride(layout || {});
    });
    return () => { cancelled = true; };
  }, [chronicleId, simulationRunId]);

  // Auto-save debounced
  const saveOverride = useCallback(
    (next: Partial<PageLayoutOverride>) => {
      if (!chronicleId) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        putPageLayout({
          simulationRunId,
          pageId: chronicleId,
          ...next,
        } as PageLayoutOverride);
      }, 300);
    },
    [chronicleId, simulationRunId]
  );

  const handleChange = useCallback(
    (field: string, value: string | boolean) => {
      setOverride((prev) => {
        const next = { ...prev, [field]: value };
        saveOverride(next);
        return next;
      });
    },
    [saveOverride]
  );

  const handleClear = useCallback(() => {
    if (!chronicleId) return;
    deletePageLayout(simulationRunId, chronicleId);
    setOverride({});
  }, [chronicleId, simulationRunId]);

  if (!chronicleId) {
    return <div className="dop-no-selection">Select a chronicle to edit display options</div>;
  }

  return (
    <div className="dop-panel">
      <div className="dop-page-name" title={chronicleName}>{chronicleName}</div>

      <RadioGroup label="Layout" field="layoutMode" options={LAYOUT_MODES} value={(override as Record<string, string>).layoutMode || ""} onChange={handleChange} />
      <RadioGroup label="Annotations" field="annotationDisplay" options={ANNOTATION_DISPLAY} value={(override as Record<string, string>).annotationDisplay || ""} onChange={handleChange} />
      <RadioGroup label="Note Position" field="annotationPosition" options={ANNOTATION_POSITION} value={(override as Record<string, string>).annotationPosition || ""} onChange={handleChange} />
      <RadioGroup label="Images" field="imageLayout" options={IMAGE_LAYOUT} value={(override as Record<string, string>).imageLayout || ""} onChange={handleChange} />
      <RadioGroup label="Width" field="contentWidth" options={CONTENT_WIDTH} value={(override as Record<string, string>).contentWidth || ""} onChange={handleChange} />
      <RadioGroup label="Align" field="textAlign" options={TEXT_ALIGN} value={(override as Record<string, string>).textAlign || ""} onChange={handleChange} />

      <label className="dop-checkbox-label">
        <input
          type="checkbox"
          checked={!!(override as Record<string, boolean>).dropcap}
          onChange={(e) => handleChange("dropcap", e.target.checked)}
        />
        Drop cap
      </label>

      <button className="dop-clear-button" onClick={handleClear}>
        Clear all overrides
      </button>
    </div>
  );
}

function RadioGroup({ label, field, options, value, onChange }: Readonly<{
  label: string;
  field: string;
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (field: string, value: string) => void;
}>) {
  return (
    <div>
      <div className="dop-section-title">{label}</div>
      <div className="dop-radio-group">
        {options.map((opt) => (
          <label key={opt.value} className="dop-radio-label">
            <input
              type="radio"
              name={field}
              value={opt.value}
              checked={value === opt.value}
              onChange={() => onChange(field, opt.value)}
            />
            {opt.label}
          </label>
        ))}
      </div>
    </div>
  );
}
```

**Step 3: Wire into CurationTab**

Import and render `DisplayOptionsPanel` in the right rail of `CurationTab.tsx`. Pass the selected chronicle ID and a derived name from the chronicle store's nav items.

**Step 4: Commit**

```bash
git add apps/illuminator/webui/src/components/curation/DisplayOptionsPanel.tsx \
       apps/illuminator/webui/src/components/curation/DisplayOptionsPanel.css \
       apps/illuminator/webui/src/components/CurationTab.tsx
git commit -m "feat: add DisplayOptionsPanel with auto-saving radio groups for layout overrides"
```

---

## Task 5: Build the Center Rail — Image Contact Sheet

This is the largest task. The center rail shows the selected chronicle's images: cover image at top, then scene images with inline thumbnail strips, then entity refs.

**Files:**
- Create: `apps/illuminator/webui/src/components/curation/CurationImageSheet.tsx`
- Create: `apps/illuminator/webui/src/components/curation/CurationImageSheet.css`
- Modify: `apps/illuminator/webui/src/components/CurationTab.tsx`

**Step 1: Create `CurationImageSheet.css`**

```css
/* CurationImageSheet — image contact sheet for chronicle curation */

.cis-sheet {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.cis-chronicle-title {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  font-family: var(--font-family-display);
}

.cis-section-label {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-accent);
  margin-bottom: var(--spacing-xs);
}

/* --- Cover image --- */
.cis-cover-row {
  display: flex;
  gap: var(--spacing-md);
  align-items: flex-start;
}

.cis-cover-thumb {
  width: 120px;
  height: 80px;
  object-fit: cover;
  border-radius: var(--radius-sm);
  cursor: pointer;
  border: 2px solid transparent;
  transition: border-color var(--transition-fast);
}

.cis-cover-thumb:hover {
  border-color: var(--color-accent);
}

.cis-cover-status {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

/* --- Scene image cards --- */
.cis-scene-card {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--spacing-md);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.cis-scene-description {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: 1.5;
}

.cis-scene-meta {
  display: flex;
  gap: var(--spacing-md);
  align-items: center;
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.cis-scene-status {
  padding: 1px 6px;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
}

.cis-scene-status-pending { background: var(--color-warning-bg, #fef3c7); color: var(--color-warning-text, #92400e); }
.cis-scene-status-complete { background: var(--color-success-bg, #d1fae5); color: var(--color-success-text, #065f46); }
.cis-scene-status-generating { background: var(--color-info-bg, #dbeafe); color: var(--color-info-text, #1e40af); }
.cis-scene-status-failed { background: var(--color-error-bg, #fee2e2); color: var(--color-error-text, #991b1b); }

/* --- Thumbnail strip --- */
.cis-thumb-strip {
  display: flex;
  gap: var(--spacing-xs);
  overflow-x: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--color-border) transparent;
  padding: var(--spacing-xs) 0;
}

.cis-thumb {
  width: 64px;
  height: 64px;
  object-fit: cover;
  border-radius: var(--radius-sm);
  cursor: pointer;
  border: 2px solid transparent;
  transition: border-color var(--transition-fast);
  flex-shrink: 0;
}

.cis-thumb:hover {
  border-color: var(--color-accent);
}

.cis-thumb-selected {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 1px var(--color-accent);
}

.cis-thumb-placeholder {
  width: 64px;
  height: 64px;
  border-radius: var(--radius-sm);
  border: 1px dashed var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  flex-shrink: 0;
}

/* --- Inline controls --- */
.cis-inline-controls {
  display: flex;
  gap: var(--spacing-sm);
  align-items: center;
}

.cis-size-select,
.cis-justify-select {
  font-size: var(--font-size-xs);
  padding: 2px 4px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
}

/* --- Entity refs --- */
.cis-entity-refs {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
}

.cis-entity-ref {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
}

.cis-entity-ref-thumb {
  width: 32px;
  height: 32px;
  object-fit: cover;
  border-radius: var(--radius-sm);
}

.cis-no-images {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  text-align: center;
  padding: var(--spacing-xl) 0;
}
```

**Step 2: Create `CurationImageSheet.tsx`**

This component:
1. Subscribes to `chronicleStore` to get the selected chronicle's `ChronicleRecord`
2. Separates `imageRefs` into entity refs and prompt requests (same logic as `ChronicleImagePanel`)
3. For each scene image with `status === "complete"`, calls `searchChronicleImages` to get the thumbnail strip of all generated versions
4. Renders cover image, scene cards with thumbnail strips, and entity ref chips
5. Uses `loadImage` for thumbnails and `ImageModal` for full-size view

```tsx
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useChronicleStore } from "../../lib/db/chronicleStore";
import { searchChronicleImages, loadImage } from "../../lib/db/imageRepository";
import type { ChronicleRecord } from "../../lib/chronicleTypes";
import ImageModal from "../ImageModal";
import "./CurationImageSheet.css";

interface CurationImageSheetProps {
  chronicleId: string;
  projectId: string;
  onUpdateSize?: (refId: string, size: string) => void;
  onUpdateJustification?: (refId: string, justification: string) => void;
  onSelectImage?: (refId: string, imageId: string) => void;
}

interface ThumbUrl {
  imageId: string;
  url: string;
}

export default function CurationImageSheet({
  chronicleId,
  projectId,
  onUpdateSize,
  onUpdateJustification,
  onSelectImage,
}: Readonly<CurationImageSheetProps>) {
  const chronicle = useChronicleStore((s) => s.cache.get(chronicleId)) as ChronicleRecord | undefined;
  const loadChronicle = useChronicleStore((s) => s.loadChronicle);

  // Load chronicle data if not cached
  useEffect(() => {
    if (!chronicle) loadChronicle(chronicleId);
  }, [chronicle, chronicleId, loadChronicle]);

  // Image modal state
  const [modalImage, setModalImage] = useState<{ imageId: string; title: string } | null>(null);

  // Thumbnail URLs keyed by imageRefId → array of thumb urls
  const [thumbsByRef, setThumbsByRef] = useState<Map<string, ThumbUrl[]>>(new Map());

  // Cover image URL
  const [coverUrl, setCoverUrl] = useState<string | null>(null);

  // Separate entity refs and prompt requests
  const { entityRefs, promptRequests } = useMemo(() => {
    const refs = chronicle?.imageRefs?.refs || [];
    return {
      entityRefs: refs.filter((r) => r.type === "entity_ref"),
      promptRequests: refs.filter((r) => r.type === "prompt_request"),
    };
  }, [chronicle]);

  // Load cover image
  useEffect(() => {
    if (!chronicle?.coverImage?.imageId) {
      setCoverUrl(null);
      return;
    }
    let cancelled = false;
    loadImage(chronicle.coverImage.imageId).then((result) => {
      if (!cancelled && result) setCoverUrl(result.url);
    });
    return () => { cancelled = true; };
  }, [chronicle?.coverImage?.imageId]);

  // Load thumbnails for all scene images
  useEffect(() => {
    if (!projectId || !chronicleId) return;
    let cancelled = false;

    searchChronicleImages({ projectId, chronicleId, limit: 100 }).then((result) => {
      if (cancelled) return;
      const byRef = new Map<string, ThumbUrl[]>();

      // Group images by imageRefId and load URLs
      const imagesByRef = new Map<string, Array<{ imageId: string }>>();
      for (const img of result.items) {
        const refId = (img as Record<string, unknown>).imageRefId as string || "__cover_image__";
        if (!imagesByRef.has(refId)) imagesByRef.set(refId, []);
        imagesByRef.get(refId)!.push(img);
      }

      // Load URLs for each image
      const loadPromises: Promise<void>[] = [];
      for (const [refId, images] of imagesByRef) {
        const thumbs: ThumbUrl[] = [];
        byRef.set(refId, thumbs);
        for (const img of images) {
          loadPromises.push(
            loadImage(img.imageId).then((loaded) => {
              if (loaded && !cancelled) {
                thumbs.push({ imageId: loaded.imageId, url: loaded.url });
              }
            })
          );
        }
      }

      Promise.all(loadPromises).then(() => {
        if (!cancelled) setThumbsByRef(new Map(byRef));
      });
    });

    return () => { cancelled = true; };
  }, [projectId, chronicleId]);

  if (!chronicle) {
    return <div className="cis-no-images">Loading...</div>;
  }

  if (!chronicle.imageRefs && !chronicle.coverImage) {
    return <div className="cis-no-images">No image references generated for this chronicle.</div>;
  }

  return (
    <div className="cis-sheet">
      <div className="cis-chronicle-title">{chronicle.title || "Untitled Chronicle"}</div>

      {/* Cover Image */}
      {chronicle.coverImage && (
        <div>
          <div className="cis-section-label">Cover Image</div>
          <div className="cis-cover-row">
            {coverUrl ? (
              <img
                className="cis-cover-thumb"
                src={coverUrl}
                alt="Cover"
                onClick={() => setModalImage({ imageId: chronicle.coverImage!.imageId!, title: "Cover Image" })}
              />
            ) : (
              <div className="cis-thumb-placeholder">No image</div>
            )}
            <div className="cis-cover-status">
              Status: {chronicle.coverImage.status}
            </div>
          </div>
          {/* Cover thumbnail strip */}
          <ThumbnailStrip
            thumbs={thumbsByRef.get("__cover_image__") || []}
            selectedImageId={chronicle.coverImage.imageId}
            onSelect={onSelectImage ? (imgId) => onSelectImage("__cover_image__", imgId) : undefined}
            onImageClick={setModalImage}
          />
        </div>
      )}

      {/* Scene Images */}
      {promptRequests.length > 0 && (
        <div>
          <div className="cis-section-label">Scene Images ({promptRequests.length})</div>
          {promptRequests.map((ref) => (
            <div key={ref.refId} className="cis-scene-card">
              <div className="cis-scene-description">
                {(ref as Record<string, unknown>).sceneDescription as string || "No description"}
              </div>
              <div className="cis-scene-meta">
                <span className={`cis-scene-status cis-scene-status-${(ref as Record<string, unknown>).status || "pending"}`}>
                  {(ref as Record<string, unknown>).status as string || "pending"}
                </span>
                <span>Size: {ref.size || "auto"}</span>
                <span>Justify: {ref.justification || "auto"}</span>
              </div>
              <ThumbnailStrip
                thumbs={thumbsByRef.get(ref.refId) || []}
                selectedImageId={(ref as Record<string, unknown>).generatedImageId as string}
                onSelect={onSelectImage ? (imgId) => onSelectImage(ref.refId, imgId) : undefined}
                onImageClick={setModalImage}
              />
              <div className="cis-inline-controls">
                {onUpdateSize && (
                  <select
                    className="cis-size-select"
                    value={ref.size || ""}
                    onChange={(e) => onUpdateSize(ref.refId, e.target.value)}
                  >
                    <option value="">Auto</option>
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                    <option value="large">Large</option>
                    <option value="full">Full</option>
                  </select>
                )}
                {onUpdateJustification && (
                  <select
                    className="cis-justify-select"
                    value={ref.justification || ""}
                    onChange={(e) => onUpdateJustification(ref.refId, e.target.value)}
                  >
                    <option value="">Auto</option>
                    <option value="left">Left</option>
                    <option value="right">Right</option>
                  </select>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Entity Refs */}
      {entityRefs.length > 0 && (
        <div>
          <div className="cis-section-label">Entity References ({entityRefs.length})</div>
          <div className="cis-entity-refs">
            {entityRefs.map((ref) => (
              <div key={ref.refId} className="cis-entity-ref">
                <span>{(ref as Record<string, unknown>).entityId as string}</span>
                <span>{ref.size || "auto"}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {modalImage && (
        <ImageModal
          isOpen
          imageId={modalImage.imageId}
          title={modalImage.title}
          onClose={() => setModalImage(null)}
        />
      )}
    </div>
  );
}

function ThumbnailStrip({ thumbs, selectedImageId, onSelect, onImageClick }: Readonly<{
  thumbs: ThumbUrl[];
  selectedImageId?: string;
  onSelect?: (imageId: string) => void;
  onImageClick: (info: { imageId: string; title: string }) => void;
}>) {
  if (thumbs.length === 0) return null;
  return (
    <div className="cis-thumb-strip">
      {thumbs.map((thumb) => (
        <img
          key={thumb.imageId}
          className={`cis-thumb ${thumb.imageId === selectedImageId ? "cis-thumb-selected" : ""}`}
          src={thumb.url}
          alt=""
          onClick={() => {
            if (onSelect) onSelect(thumb.imageId);
            else onImageClick({ imageId: thumb.imageId, title: "Image" });
          }}
          onDoubleClick={() => onImageClick({ imageId: thumb.imageId, title: "Image" })}
        />
      ))}
    </div>
  );
}
```

**Step 3: Wire into CurationTab**

Update `CurationTab.tsx` to render `CurationImageSheet` in the center rail when a chronicle is selected. Use `useIlluminatorConfigStore` to get `projectId`.

**Step 4: Commit**

```bash
git add apps/illuminator/webui/src/components/curation/CurationImageSheet.tsx \
       apps/illuminator/webui/src/components/curation/CurationImageSheet.css \
       apps/illuminator/webui/src/components/CurationTab.tsx
git commit -m "feat: add CurationImageSheet with thumbnail strips for chronicle image selection"
```

---

## Task 6: Wire up image selection and size/justification callbacks

The center rail needs to actually persist image selection changes back to the chronicle store.

**Files:**
- Modify: `apps/illuminator/webui/src/components/CurationTab.tsx`
- Modify: `apps/illuminator/webui/src/components/curation/CurationImageSheet.tsx` (if needed)

**Step 1: Add callbacks in CurationTab**

The curation tab needs to:
1. Load the full chronicle record from the store
2. When a thumbnail is clicked, update the `imageRefs` to set `generatedImageId` on the matching ref
3. When size/justification changes, update the ref in the chronicle record

These use the same patterns as `ChronicleImagePanel` — look at how `onSelectExistingImage`, `onUpdateSize`, and `onUpdateJustification` are wired in the `ChroniclePanel`.

Read `apps/illuminator/webui/src/components/chronicle-panel/ChroniclePanel.tsx` to find:
- How `handleSelectExistingImage` works (updates `imageRefs.refs` and saves via repository)
- How `handleUpdateSize` and `handleUpdateJustification` work

Replicate these callbacks in `CurationTab.tsx` and pass them to `CurationImageSheet`.

**Step 2: Commit**

```bash
git add apps/illuminator/webui/src/components/CurationTab.tsx \
       apps/illuminator/webui/src/components/curation/CurationImageSheet.tsx
git commit -m "feat: wire up image selection and size/justification callbacks in curation tab"
```

---

## Task 7: Initialize chronicle store in CurationTab

**Files:**
- Modify: `apps/illuminator/webui/src/components/CurationTab.tsx`

**Step 1: Ensure chronicle store is initialized**

The `chronicleStore` needs `initialize(simulationRunId)` called before nav items populate. Check if the Chronicle tab already handles this — if so, the curation tab may inherit that. If not, add:

```tsx
const initialize = useChronicleStore((s) => s.initialize);
const initialized = useChronicleStore((s) => s.initialized);

useEffect(() => {
  if (simulationRunId && !initialized) {
    initialize(simulationRunId);
  }
}, [simulationRunId, initialized, initialize]);
```

**Step 2: Commit**

```bash
git add apps/illuminator/webui/src/components/CurationTab.tsx
git commit -m "feat: initialize chronicle store in CurationTab on mount"
```

---

## Task 8: Polish and edge cases

**Files:**
- Modify: `apps/illuminator/webui/src/components/CurationTab.tsx`
- Modify: `apps/illuminator/webui/src/components/curation/CurationNavigator.tsx`
- Modify: `apps/illuminator/webui/src/components/CurationTab.css`

**Step 1: Handle loading states**

- Show a loading spinner/message in the center rail while chronicle data loads
- Show "No images" state clearly when a chronicle has no image refs

**Step 2: Handle empty states**

- Left rail: "No chronicles found" when store is empty
- Center rail: "Select a chronicle from the left" when nothing selected
- Right rail: Grayed out / "Select a chronicle" when nothing selected

**Step 3: Ensure tab styling integrates well**

The curation tab needs `height: 100%` on its `.illuminator-content` wrapper. Check if this is already the case from the wrapper in `IlluminatorTabContent.jsx`. If not, add:

```css
.cur-workspace {
  height: calc(100vh - /* header height */);
}
```

Adjust as needed after visual testing.

**Step 4: Commit**

```bash
git add apps/illuminator/webui/src/components/CurationTab.tsx \
       apps/illuminator/webui/src/components/CurationTab.css \
       apps/illuminator/webui/src/components/curation/CurationNavigator.tsx
git commit -m "feat: polish curation workspace loading states and empty states"
```

---

## Summary

| Task | What | Key files |
|------|------|-----------|
| 1 | Remove PageLayoutEditor from ContentTreeView | `ContentTreeView.tsx` |
| 2 | Create CurationTab shell + register in tabs | `CurationTab.tsx`, `CurationTab.css`, `IlluminatorSidebar.jsx`, `IlluminatorTabContent.jsx` |
| 3 | Left rail — CurationNavigator | `curation/CurationNavigator.tsx`, `.css` |
| 4 | Right rail — DisplayOptionsPanel | `curation/DisplayOptionsPanel.tsx`, `.css` |
| 5 | Center rail — CurationImageSheet | `curation/CurationImageSheet.tsx`, `.css` |
| 6 | Wire image selection + size/justification callbacks | `CurationTab.tsx` |
| 7 | Initialize chronicle store | `CurationTab.tsx` |
| 8 | Polish loading/empty states | Multiple |
