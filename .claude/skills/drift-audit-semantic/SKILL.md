---
name: drift-audit-semantic
description: >
  Detect semantic duplication across a codebase — places where the same functional concept
  is implemented independently in multiple locations with different names, APIs, and
  implementations. Unlike structural drift (same library used differently) or behavioral
  drift (same interaction works differently), semantic drift is about the same PURPOSE
  being served by unrelated code that shares no naming or structural similarity.

  Examples: three components that all render "a horizontal bar of action buttons" but are
  named ButtonHeader, ToolBar, and GridComponent. Or three functions that all "load entity
  data from persistence" but are named loadWorldData(), fetchEntities(), and buildStateForSlot().

  Use this skill whenever the user mentions "semantic duplication", "same thing implemented
  multiple times", "consolidation opportunities", "shared component candidates", or describes
  finding functionally identical code under different names. Also trigger for "why do we have
  three ways to do X", "these should be the same component", or "full stack DRY audit".
---

# Semantic Drift Audit Skill

You are performing a **semantic drift audit** — discovering places where the same functional
concept is implemented independently in different parts of the codebase, potentially with
completely different names, APIs, and implementations.

This is the hardest form of drift to detect because it requires understanding what code DOES,
not what it's NAMED. A file called `ButtonHeader` and a file called `GridComponent` might
both be "a horizontal bar of contextual action buttons" — but no naming analysis, import scan,
or structural pattern match will find this equivalence. You have to read the code and understand
its purpose.

**This skill leverages your unique capability as an LLM: semantic understanding of code.**

Your job is discovery and analysis — NOT making architecture decisions. Present findings
and let the user decide what should be consolidated.

## Prerequisites

1. Read the project's package.json and directory structure to understand app/package boundaries
2. Check if `.drift-audit/drift-manifest.json` exists — append semantic findings to it
3. Identify the shared component/utility library — this is where consolidated implementations
   would eventually live
4. Get a rough sense of codebase size per app to calibrate sampling depth

## Core Methodology: Role-Based Clustering

You will discover semantic duplication by **clustering code by functional role, not by name.**

### Phase 1: Role Discovery (Sampling)

Read a diverse sample of 30-50 files across the codebase. For each file, identify its
**functional role** — what purpose does it serve? What problem does it solve?

Aim for diversity: sample from multiple apps, multiple layers (components, hooks, utilities,
stores, workers), and multiple levels of the component tree.

As you read, build a **role taxonomy** — a list of functional roles you observe. Don't start
with a predetermined list. Discover what roles exist in THIS codebase.

Common role categories you might find (but discover them organically):

**UI Roles:**
- Action toolbar / button bar
- Data list with filtering/sorting/selection
- Detail view / inspector panel
- Configuration form / settings panel
- Status indicator / progress display
- Navigation container (tabs, sidebar, breadcrumbs)
- Empty state / placeholder
- Modal workflow (multi-step process in a modal)

**Data Roles:**
- Entity/record loader (fetches data from persistence)
- Schema/config consumer (reads configuration and applies it)
- Worker dispatcher (sends tasks to background workers)
- Queue/batch manager (processes items in order)
- Cache/memoization layer (stores computed results)
- Persistence writer (saves data to IndexedDB/storage)

**Behavioral Roles:**
- Async operation lifecycle (loading → success/error pattern)
- Configuration provider (supplies settings to downstream code)
- Event coordinator (connects triggers to handlers)
- Validation pipeline (validates data before processing)

### Phase 2: Systematic Search

For each role with 2+ implementations discovered in Phase 1, systematically search for
ALL implementations across the codebase. This is where semantic understanding matters most.

**Do NOT rely on naming patterns.** Instead:

1. For each role, formulate what the implementation DOES functionally:
   - "renders a horizontal row of buttons that trigger actions on the current context"
   - "loads a list of entities from IndexedDB and provides them to child components"
   - "wraps an async operation with loading/error/success state management"

2. Search for files that might serve this function using BROAD heuristics:
   - For UI roles: grep for JSX structural markers (button groups, list renderers, panels)
   - For data roles: grep for data access patterns (Dexie calls, fetch, store access)
   - For behavioral roles: grep for lifecycle markers (loading states, error handling, retries)

3. Read candidate files and determine if they serve the same role, even if named differently.

4. Group implementations by role.

**Example:** Searching for "action toolbar" role:
- Don't just grep for "toolbar" or "actionbar"
- Also look for: components that render `<button>` elements in a flex row, components with
  multiple onClick handlers in a header/bar area, components that import icon sets and render
  them as clickable actions
- Read candidates and assess: is this functionally "a bar of action buttons"?

### Phase 3: Divergence Analysis

For each role with multiple implementations, compare them across these dimensions:

**1. Interface divergence (props/parameters):**
- What inputs does each implementation accept?
- Do they accept the same kind of data in different shapes?
- Could they share a common interface with parameterization?

**2. Behavior divergence:**
- Do they handle the same edge cases? (empty data, errors, loading)
- Do they follow the same interaction patterns? (click, hover, keyboard)
- Do they access data through the same paths?

**3. Scope divergence:**
- Is one a superset of another? (one handles 5 cases, another handles 3 of the same 5)
- Are the differences serving genuinely different needs, or are they accidental?

**4. Consolidation potential:**
Rate each cluster:
- **HIGH:** Same purpose, similar complexity, accidental differences. Should be one component.
- **MEDIUM:** Same purpose, different complexity levels. Could be one component with options,
  but some parameterization work needed.
- **LOW:** Same general category but genuinely different needs. Shared base with variants
  might help, but forced consolidation would be over-engineering.

### Phase 4: Generate Output

Write findings to `.drift-audit/drift-manifest.json` as entries with `"type": "semantic"`.

Each entry should include the standard manifest fields plus:

```json
{
  "id": "action-toolbar-pattern",
  "name": "Action Toolbar Implementations",
  "type": "semantic",
  "description": "Horizontal bar of contextual action buttons...",
  "impact": "MEDIUM",
  "total_files": 4,
  "semantic_role": "action-toolbar",
  "variants": [
    {
      "name": "ButtonHeader (illuminator)",
      "description": "Icon-only buttons, 6 actions, uses modalStore",
      "file_count": 1,
      "files": ["apps/illuminator/webui/src/components/ButtonHeader.jsx"],
      "sample_file": "apps/illuminator/webui/src/components/ButtonHeader.jsx"
    }
  ],
  "consolidation_assessment": "High potential. All variants render action buttons in a row. A shared ActionBar({ items: Array<{ icon, label, onClick, disabled }> }) would replace all three. The modalStore coupling in ButtonHeader should be lifted to the caller.",
  "shared_interface_sketch": "ActionBar({ items, orientation?, size?, variant? })",
  "analysis": "...",
  "recommendation": "...",
  "status": "pending"
}
```

Also write human-readable findings to the drift report (append "Semantic Findings" section
to `drift-report.md`, or create `semantic-drift-report.md` if running standalone).

### Phase 5: Present

Walk the user through findings, focusing on:
1. Highest consolidation-potential clusters (the easy wins)
2. Clusters with the most implementations (widest duplication)
3. Infrastructure-level duplication (data loading, worker patterns) — these affect correctness
4. Cases where you're unsure if the role equivalence is real or superficial

## Scope Layers

Audit across three layers to achieve full-stack semantic DRY:

### Layer 1: UI Components
Components that render the same kind of UI element or solve the same UX problem.
Look beyond names — read what they render and how they behave.

### Layer 2: Data & Infrastructure
Functions, hooks, and modules that perform the same data operation or infrastructure task.
This includes:
- Data loading patterns (regardless of what the function is named)
- Persistence patterns (save/update/delete operations)
- Worker communication patterns (message formats, protocols)
- Cache and memoization approaches

### Layer 3: Behavioral Contracts
Cross-cutting concerns implemented differently across features:
- Configuration sourcing (where do settings come from?)
- Persistence timing (when is data saved? auto vs explicit vs ephemeral)
- Progress reporting (how do long operations communicate status?)
- Error recovery (retry, resume, abort — which is available where?)

## What IS semantic drift

- Three components that all render "a toolbar of action buttons" but are named `ButtonHeader`,
  `ToolBar`, and `ActionsRow`
- Two hooks that both "load entities from Dexie and return them with loading state" but one
  is called `useWorldDataLoader` and the other is inline in a component's useEffect
- Four places that "send a task to a web worker and track its progress" with four different
  message formats

## What is NOT semantic drift

- A search filter component and a settings form both use text inputs — they serve different
  purposes. Shared inputs (via a component library) are good, but the containers aren't
  semantically equivalent.
- A simple confirmation dialog and a multi-step wizard both use modals — they serve different
  complexity levels of the same general concept. This might be "same role, different scope"
  which is worth noting but isn't always worth consolidating.
- App-specific business logic that happens to use similar patterns — if the logic itself
  is domain-specific, the similarity is coincidental, not duplication.

## Investigation Heuristics

Since you can't rely on naming, use these structural heuristics to find candidates:

**For UI component roles:**
- Grep for JSX patterns: `<button` clusters, `<li` in maps, `flex` + `gap` + multiple children
- Look at component prop interfaces — similar prop shapes suggest similar purposes
- Check CSS class names — even if component names differ, CSS may reveal intent

**For data roles:**
- Grep for data source access: `db.table`, `useStore`, `fetch(`, `getState()`
- Grep for data transformation: `.map(`, `.filter(`, `.reduce(` on collections
- Look at return types — functions returning `{ data, loading, error }` serve the same role

**For behavioral roles:**
- Grep for lifecycle patterns: `try/catch`, `finally`, `.then(`, `async/await`
- Grep for state machines: status variables with values like 'idle', 'loading', 'error'
- Look at effect dependencies — similar dependency arrays suggest similar triggers

## Re-Audits

If semantic entries already exist in the manifest, compare to previous findings.
Note which clusters have been consolidated and which are new.

## Scope Control

If the user wants to focus on a specific layer (just UI components, just data patterns),
respect that. A targeted audit is perfectly valid.
