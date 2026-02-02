# Chronicle Wizard UX Redesign Plan

## Overview

The Chronicle Wizard has 5 steps. Step 1 (Style) is fine. Steps 2-4 need significant UX improvements to help users make informed selections.

**Core Problem:** Users lack the context needed to make good decisions. The current UI relies on flat lists, tiny cryptic badges, and checkbox fatigue.

---

## Step 2: Entry Point — "Story Potential Radar"

### Current Pain Points

1. **Flat list** - all entities look identical, hard to scan
2. **"X links" badge** - doesn't convey narrative potential
3. **No category filtering** - must type to search
4. **No relationship preview** - can't see what you're getting into
5. **No indication of event involvement** or temporal depth

### Proposed Design

```
┌─────────────────────────────────────────────────────────────┐
│  Select Entry Point                                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────┐   ┌─────────────────────────────┐ │
│  │ Filter by Kind       │   │                             │ │
│  │ ┌──────┐ ┌────────┐  │   │      ●──────●               │ │
│  │ │Person│ │Faction │  │   │     /  RADAR \              │ │
│  │ └──────┘ └────────┘  │   │    ●    ▲     ●             │ │
│  │ ┌──────┐ ┌────────┐  │   │     \  /│\   /              │ │
│  │ │Place │ │Artifact│  │   │      \/─┼─\/                │ │
│  │ └──────┘ └────────┘  │   │        ●                    │ │
│  ├──────────────────────┤   │  "High story potential"     │ │
│  │ ● Aldric Thornwood   │   └─────────────────────────────┘ │
│  │   person · merchant  │                                    │
│  │   ████████░░ 42 links│   ┌─────────────────────────────┐ │
│  │   ⬤⬤⬤⬤○ story score │   │  1-HOP CONSTELLATION        │ │
│  ├──────────────────────┤   │       ●faction              │ │
│  │ ○ The Iron Council   │   │      ╱                      │ │
│  │   faction · merchant │   │  ●──★──●                    │ │
│  │   ███████░░░ 38 links│   │  person (entry) artifact    │ │
│  │   ⬤⬤⬤○○ story score │   │      ╲                      │ │
│  └──────────────────────┘   │       ●place                │ │
│                             └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Non-Standard Element: Radar Chart

A **5-axis spider/radar chart** showing:

| Axis | Metric | Data Source |
|------|--------|-------------|
| **Connections** | Total relationship count | `relationships.filter(r => r.src === id \|\| r.dst === id).length` |
| **Temporal Span** | Number of eras with activity | `events.filter(e => involves(e, id)).map(e => e.era)` unique count |
| **Role Diversity** | Unique entity kinds connected | `getConnectedEntities(id).map(e => e.kind)` unique count |
| **Event Involvement** | Events featuring this entity | `events.filter(e => involves(e, id)).length` |
| **Prominence** | Entity prominence level | `entity.prominence` mapped to 0-1 |

### Implementation Tasks

1. **Create `StoryPotentialRadar` component**
   - SVG-based radar chart (5 vertices)
   - Accepts normalized 0-1 values for each axis
   - Hover shows axis labels and values
   - Responsive sizing (fits ~200x200px panel)

2. **Create `MiniConstellation` component**
   - Shows entry point (★) at center
   - 1-hop neighbors as dots around it
   - Color-coded by entity category
   - Simple force layout or circular arrangement

3. **Add `computeStoryPotential()` function**
   - Input: entityId, relationships, events, entities
   - Output: `{ connections, temporalSpan, roleDiversity, eventInvolvement, prominence }`
   - Also compute composite "story score" (weighted average)

4. **Replace text search with filter chips**
   - Extract unique entity kinds from candidate list
   - Render as toggle-able chips
   - Multiple selection = OR filter

5. **Update entity list items**
   - Add horizontal bar for connection count (visual weight)
   - Add story score indicator (⬤⬤⬤○○ or similar)
   - Remove "X links" text badge

6. **Add detail panel (right side)**
   - Shows radar chart for selected/hovered entity
   - Shows mini constellation
   - Shows top 3 events involving this entity

### File Changes

| File | Changes |
|------|---------|
| `steps/EntryPointStep.tsx` | Major refactor - add radar, constellation, filter chips |
| `lib/chronicle/storyPotential.ts` | New file - computation functions |
| `components/StoryPotentialRadar.tsx` | New component |
| `components/MiniConstellation.tsx` | New component |
| `components/FilterChips.tsx` | New component (reusable) |

---

## Step 3: Roles — "Ensemble Constellation"

### Current Pain Points

1. **Badge soup** - 7+ tiny badges (★, 1h, 2h, ●●●, ⏰, +cat, +Nrel) requiring hover
2. **No relationship visualization** - can't see how entities connect
3. **Two-column disconnect** - entities and roles feel separate
4. **No ensemble chemistry view** - can't see if cast works together
5. **Primary/Supporting** is just a button with no context

### Proposed Design

```
┌─────────────────────────────────────────────────────────────────┐
│  Build Your Ensemble                              [Auto-fill]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────┐                              ┌────────────┐     │
│  │ PROTAGONIST│     ●Merchant                │ ANTAGONIST │     │
│  │            │    ╱  Guild                  │            │     │
│  │ ⊕ Drop here│   ╱                          │ ⊕ Drop here│     │
│  │            │  ●═══════★═══════●           │            │     │
│  │            │ Rival   Aldric   The Iron    │            │     │
│  │            │ House  (entry)   Council     │            │     │
│  └────────────┘   ╲      │       ╱           └────────────┘     │
│                    ●─────┼──────●                               │
│  ┌────────────┐  Agent   │   Artifact        ┌────────────┐     │
│  │ ALLY       │          │                   │ WITNESS    │     │
│  │            │          ●                   │            │     │
│  │ ⊕ Drop here│      Location                │ ⊕ Drop here│     │
│  │            │                              │            │     │
│  └────────────┘                              └────────────┘     │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Ensemble Health:  ████████░░  4/5 categories               │ │
│  │                   ⚠ Consider adding: artifact              │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Non-Standard Element: Force-Directed Graph with Drag-to-Assign

**Graph Features:**
- Entry point (★) at center
- Candidates as nodes (●) positioned by force simulation
- **Line thickness** = relationship strength
- **Node color** = entity category
- **Node opacity** = era alignment (faded if misaligned)
- **Red glow/ring** = overused (usage count >= 5)

**Interaction:**
- **Drag** node to role drop zone to assign
- **Click** node to see detail card
- **Hover** node to highlight its connections
- After assignment, node moves to role zone but keeps connection lines visible

### Entity Detail Card (on click)

Replace badge soup with readable card:

```
┌─────────────────────────┐
│ Merchant Guild          │
│ faction · merchant      │
├─────────────────────────┤
│ Distance     ●○○ Direct │
│ Chronicles   2 prior    │
│ Link strength ███░ 75%  │
│ Era          ✓ Aligned  │
│ Adds         +1 faction │
│              +2 rel types│
└─────────────────────────┘
```

### Ensemble Health Bar

Single visualization replacing +cat/+rel badges:

- Shows category coverage as segmented bar
- Warns about gaps ("Consider adding: artifact")
- Shows relationship diversity score

### Implementation Tasks

1. **Create `EnsembleConstellation` component**
   - Use D3 force simulation or similar
   - SVG-based with drag support
   - Entry point fixed at center
   - Candidates respond to forces (repel each other, attract to center)

2. **Create `RoleDropZone` component**
   - Positioned around constellation (4 corners or sides)
   - Shows role name, count, description
   - Highlights on drag-over
   - Contains assigned entity badges

3. **Create `EntityDetailCard` component**
   - Pops up on entity click
   - Clean layout for metrics (no badges)
   - Mini bars for quantitative values
   - Icons for boolean values

4. **Create `EnsembleHealthBar` component**
   - Segmented bar showing category coverage
   - Color-coded segments by category
   - Gap warnings below

5. **Implement drag-and-drop**
   - Use react-dnd or native drag events
   - Visual feedback during drag
   - Animate node to role zone on drop

6. **Refactor metric display**
   - Remove all inline badges from list view
   - Move metrics to detail card only
   - Graph encodes metrics visually (thickness, color, opacity)

### File Changes

| File | Changes |
|------|---------|
| `steps/RoleAssignmentStep.tsx` | Major refactor - replace two-column with constellation |
| `components/EnsembleConstellation.tsx` | New component - force graph |
| `components/RoleDropZone.tsx` | New component |
| `components/EntityDetailCard.tsx` | New component |
| `components/EnsembleHealthBar.tsx` | New component |

### Dependencies

- Consider adding `d3-force` for force simulation (or implement simple version)
- May need `react-dnd` for drag-drop (or use native HTML5 drag)

---

## Step 4: Events — "Narrative Arc Timeline"

### Current Pain Points

1. **Checkbox fatigue** - long lists of checkboxes
2. **No timeline visualization** - events as flat list
3. **Era badges require reading** - "✓ Era" vs "⚠ EraName"
4. **No narrative arc visibility** - can't see story structure
5. **Relationships as separate list** - disconnected from events
6. **Truncated descriptions** - context is hidden

### Proposed Design

```
┌─────────────────────────────────────────────────────────────────┐
│  Compose Narrative Arc                            [Auto-fill]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Narrative Intensity                                            │
│  ▁▂▃▅▇█▇▅▃▂▁▂▄▆█▆▄▂▁  ← sparkline shows story pacing           │
│                                                                  │
│  Era: Foundation  │  Era: Expansion         │  Era: Decline     │
│  ═════════════════╪══════════════════════════╪══════════════════│
│      ┌───┐        │  ┌───┐   ┌───┐          │                   │
│      │ ● │        │  │ █ │   │ ▓ │          │   ┌───┐           │
│      │   │ ┌───┐  │  │   │   │   │  ┌───┐   │   │ ░ │           │
│  ────┴───┴─┴───┴──┼──┴───┴───┴───┴──┴───┴───┼───┴───┴────────── │
│   10    20   30   │   50      70     90     │  120     150      │
│                   │                          │                   │
│  ┌────────────────────────────────────────┐                     │
│  │ ◄═══════════ SELECTION BRUSH ═════════►│ ← drag handles     │
│  └────────────────────────────────────────┘                     │
│                                                                  │
│  Selected: 8 events (ticks 20-90)  │  ⚠ Spans 2 eras            │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│  Relationships                              12/15 selected      │
│                                                                  │
│  Aldric ═══════► Iron Council  alliance   ☑                     │
│  Aldric ────────► Rival House  rivalry    ☑                     │
│  Council ═══════► Artifact     owns       ☐                     │
│                                                                  │
│  ↑ line thickness = strength                                    │
└─────────────────────────────────────────────────────────────────┘
```

### Non-Standard Element: Timeline with Range Brush

**Timeline Features:**
- Horizontal axis = tick (time)
- **Era swim lanes** - colored bands for each era
- **Event cards** positioned by tick
  - Height = significance (tall = important)
  - Fill pattern = involvement level:
    - █ solid = involves entry point
    - ▓ hatched = involves cast member
    - ░ light = peripheral
- Click individual events to toggle
- **Range brush** - drag handles to select time window

**Narrative Intensity Sparkline:**
- Shows event density/significance over time
- Helps identify dramatic structure
- Peaks suggest climax points

### Relationship Visualization

Replace checkbox list with mini arc diagram or edge list:
- Line thickness = strength
- Click to toggle
- Grouped by relationship kind

### Implementation Tasks

1. **Create `NarrativeTimeline` component**
   - SVG-based horizontal timeline
   - Era bands as background rectangles
   - Event cards positioned by tick
   - Click to select/deselect individual events

2. **Create `TimelineBrush` component**
   - Draggable selection range
   - Left/right handles to resize
   - Selects all events within range
   - Can be combined with individual clicks

3. **Create `IntensitySparkline` component**
   - Small area chart above timeline
   - X = tick, Y = cumulative significance in window
   - Helps visualize pacing

4. **Create `RelationshipArcDiagram` component**
   - Alternative to checkbox list
   - Arcs connecting entity names
   - Thickness = strength
   - Click arc to toggle

5. **Compute timeline data**
   - Bucket events into era ranges
   - Compute tick range for timeline extent
   - Compute intensity curve (rolling sum of significance)

6. **Event card tooltip**
   - On hover, show full headline and description
   - Show participants
   - No truncation needed

### File Changes

| File | Changes |
|------|---------|
| `steps/EventResolutionStep.tsx` | Major refactor - replace lists with timeline |
| `components/NarrativeTimeline.tsx` | New component |
| `components/TimelineBrush.tsx` | New component |
| `components/IntensitySparkline.tsx` | New component |
| `components/RelationshipArcDiagram.tsx` | New component (optional) |
| `lib/chronicle/timelineUtils.ts` | New file - timeline computations |

---

## Implementation Order

### Phase 1: Entry Point Step (Moderate Complexity)

1. `computeStoryPotential()` function
2. `FilterChips` component
3. `StoryPotentialRadar` component
4. `MiniConstellation` component
5. Integrate into `EntryPointStep`

**Estimated new components:** 4
**Estimated new utilities:** 1

### Phase 2: Events Step (High Value, Moderate Complexity)

1. `timelineUtils.ts` computations
2. `NarrativeTimeline` component
3. `TimelineBrush` component
4. `IntensitySparkline` component
5. Integrate into `EventResolutionStep`
6. (Optional) `RelationshipArcDiagram`

**Estimated new components:** 3-4
**Estimated new utilities:** 1

### Phase 3: Roles Step (Highest Complexity)

1. `EnsembleConstellation` with force simulation
2. `RoleDropZone` component
3. `EntityDetailCard` component
4. `EnsembleHealthBar` component
5. Drag-and-drop integration
6. Integrate into `RoleAssignmentStep`

**Estimated new components:** 4
**Estimated new utilities:** 0 (uses existing metrics)

---

## Technical Considerations

### SVG vs Canvas

- **Recommend SVG** for all visualizations
- Easier interaction handling (click, hover, drag)
- Better for accessibility
- Sufficient performance for expected data sizes (<100 entities, <200 events)

### Force Simulation

Options for the constellation graph:
1. **D3-force** - robust, well-documented, ~15kb
2. **Custom simple simulation** - lighter, may be sufficient
3. **Static circular layout** - fallback if force is too complex

Recommend starting with static circular layout, upgrade to force if time permits.

### Drag and Drop

Options:
1. **react-dnd** - full-featured, ~30kb
2. **@dnd-kit** - modern, modular, ~20kb
3. **Native HTML5 drag** - no dependency, more manual work

Recommend native HTML5 drag for simplicity, upgrade if needed.

### State Management

Current `WizardContext` should be sufficient. New visualizations are primarily view-layer changes reading existing state.

---

## Fallback Simplifications

If full implementation is too complex, simplified versions:

### Entry Point (Simplified)
- Keep list, add filter chips
- Add story score bar (skip radar)
- Skip mini constellation

### Roles (Simplified)
- Keep two-column layout
- Replace badges with detail card on click
- Add ensemble health bar at bottom
- Skip force graph and drag-drop

### Events (Simplified)
- Add era-colored left border to each event row
- Add sparkline above the list
- Skip timeline visualization and brush
- Keep checkboxes

---

## Summary Table

| Step | Non-Standard Element | Complexity | Priority |
|------|---------------------|------------|----------|
| Entry Point | Radar chart + mini constellation | Medium | 2 |
| Roles | Force graph + drag-to-assign | High | 3 |
| Events | Timeline + range brush | Medium-High | 1 |

Recommend implementing Events first - highest user value, timeline is more intuitive than checkbox lists, and complexity is manageable.
