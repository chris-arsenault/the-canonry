# Drift Skills — Technical Drift Discovery and Unification Pipeline

Six Claude skills that work together to find, prioritize, fix, and prevent technical
drift in large codebases. Designed for projects that grew organically (vibe-coded,
multi-author, rapid prototyping) and need to move toward intentional, consistent
architecture.

## Design Philosophy

These skills define **methodology, not architecture**. They don't tell you to use
repositories, BaseModals, or any specific pattern. The agent running the skills has
your full codebase context and is far better positioned to identify what patterns
actually exist and which should win. You make the architecture decisions; these skills
give the process structure.

## The Pipeline

```
                              ┌─────────┐
drift-audit          ─┐      │         │
  (structural)        │      │  drift  │ ← orchestrator
drift-audit-ux       ─┼──→   │         │ ← wraps all 5 skills
  (behavioral)        │      │         │
drift-audit-semantic ─┘      └────┬────┘
  (conceptual)                    │
                           ┌──────┴──────┐
                           │             │
                      drift-unify   drift-guard
                        (fix)       (prevent)
```

Three independent audit skills feed into a shared manifest. An orchestrator
coordinates prioritization and sequencing. Two resolution skills fix and prevent drift.

All skills can be run independently or through the orchestrator.

---

## Orchestrator

### `drift` — Full Pipeline Coordinator

Wraps all 5 skills into a coordinated workflow with dependency-aware prioritization
and progress tracking.

**Phase commands (each runs ONLY that phase):**

| Command | What it does |
|---------|-------------|
| `/drift` | Full pipeline: audit → plan → unify → guard |
| `/drift audit` | Run all three audits, compile unified manifest |
| `/drift plan` | Prioritize findings, present ranked attack order for user reordering |
| `/drift unify` | Unify all planned areas autonomously, summary at end |
| `/drift guard` | Generate guards for all unified areas, summary at end |

**Prioritization:** Ranks by impact (HIGH > MED > LOW), then file count, then variant
count. Respects inter-area dependencies (e.g., build config depends on dependency
versions). User approves and can reorder before execution.

**State:** Tracks progress in `.drift-audit/attack-plan.json` with per-area phase
progression: `pending` → `planned` → `unify` → `guard` → `completed`.

---

## Audit Skills (Discovery)

All three audit skills write findings to `.drift-audit/drift-manifest.json` using
the same entry schema. Each tags its entries with a `"type"` field (`"structural"`,
`"behavioral"`, `"semantic"`) so downstream skills consume all findings uniformly.

### `drift-audit` — Structural Drift

Finds inconsistencies in **how tools and conventions are used**: dependency version
mismatches, file naming/extension divergence, import patterns, config format drift,
naming cluster inconsistencies, and code duplication.

**Method:** Runs `scripts/discover.sh` to produce a raw codebase inventory (exports,
imports, naming clusters, file structure, duplication indicators), then the agent reads
source files and interprets the inventory in context to identify actual drift areas.

**Invocation:** `/drift-audit` or "audit my project for technical drift"

### `drift-audit-ux` — Behavioral Drift

Finds inconsistencies in **how similar user interactions actually work**: modal close
behavior (overlay click, Escape key, focus trapping), shared component adoption gaps,
multi-step workflow phase inconsistencies, loading/error/empty state patterns, form
validation timing, keyboard/accessibility support, and notification patterns.

**Method:** Agent-driven. No discovery script — behavioral analysis requires reading
implementation code to understand what happens when a user interacts with a component.
The skill provides a structured checklist of 7 behavioral domains with heuristic
patterns for finding candidate files, and the agent reads and catalogs actual behavior
per file in behavior matrices.

**Domains:**
1. Modal/dialog interaction consistency
2. Shared component adoption
3. Multi-step workflow consistency
4. Loading & error state patterns
5. Form validation & input behavior
6. Keyboard & accessibility patterns
7. Notification & feedback patterns

**Invocation:** `/drift-audit-ux` or "audit UX behavioral drift"

### `drift-audit-semantic` — Semantic Drift

Finds **the same functional concept implemented independently under different names**
with no textual overlap. Three components named `ButtonHeader`, `ToolBar`, and
`GridComponent` that all render "a horizontal bar of contextual action buttons."
Three functions named `loadWorldData()`, `fetchEntities()`, and `buildStateForSlot()`
that all load entity data from persistence. Traditional DRY detection misses these
because they share no naming or structural similarity.

**Method A (preferred):** Deterministic CLI tool at `tools/drift-semantic/`. Parses
ASTs with ts-morph, computes structural fingerprints (JSX hash, hook profile, import
constellation, type signatures, call graph vectors, dependency context), runs ast-grep
pattern matching, scores all unit pairs across 13 signals with adaptive weights, and
clusters similar units. The agent then reads cluster source code and verifies semantic
equivalence. Run: `bash tools/drift-semantic/cli.sh run --project .`

**Method B (fallback):** Agent-driven. Reads a diverse sample of 30-50 files to build
a role taxonomy, then systematically searches for all implementations of each role.

**Scope layers:**
1. UI components (same UI element rendered differently)
2. Data & infrastructure (same data operation under different names)
3. Behavioral contracts (same cross-cutting concern handled inconsistently)

**Invocation:** `/drift-audit-semantic` or "find semantic duplication"

---

## Resolution Skills

### `drift-unify` — Fix

Takes one drift area per session (from any audit type). You tell it which pattern is
canonical; it migrates files in reviewable batches of 5-15, creates shared utilities
as needed, and maintains a running changelog and backlog.

**Output:**
- Refactored source files
- Shared utilities/components/hooks as needed
- `UNIFICATION_LOG.md` — what changed and why
- `DRIFT_BACKLOG.md` — what's left to do
- Pattern documentation for each unified area

**Invocation:** `/drift-unify` or "unify [area], canonical pattern is in [file]"

### `drift-guard` — Prevent

Generates enforcement artifacts derived from the actual canonical patterns — not from
generic templates. ESLint rules, ADRs, review checklists, all specific to your decisions.

**Output:**
- Custom ESLint rules (flat config compatible)
- Architecture Decision Records in `docs/adr/`
- PR review checklist updates
- Pattern usage guides

**Invocation:** `/drift-guard` or "create guardrails for the patterns we unified"

---

## Shared Output Format

All audit skills write to `.drift-audit/drift-manifest.json`:

```json
{
  "areas": [
    {
      "id": "kebab-case-id",
      "name": "Human Readable Name",
      "type": "structural | behavioral | semantic",
      "description": "What this drift is about",
      "impact": "HIGH | MEDIUM | LOW",
      "total_files": 0,
      "variants": [
        {
          "name": "variant-name",
          "description": "How this variant works",
          "file_count": 0,
          "files": ["path/to/file.ts"],
          "sample_file": "path/to/best-example.ts"
        }
      ],
      "analysis": "Tradeoff assessment",
      "recommendation": "Suggested canonical and why",
      "status": "pending | in_progress | completed"
    }
  ]
}
```

Behavioral entries may include a `behavior_matrix` field. Semantic entries may include
`semantic_role`, `consolidation_assessment`, and `shared_interface_sketch` fields.
Downstream skills ignore fields they don't need.

The orchestrator adds `.drift-audit/attack-plan.json` for execution tracking:

```json
{
  "plan": [
    {
      "area_id": "kebab-case-id",
      "rank": 1,
      "depends_on": [],
      "phase": "pending | planned | unify | guard | completed",
      "canonical_variant": "variant-name or null",
      "unify_summary": "what changed or null",
      "guard_artifacts": ["list of created files"]
    }
  ]
}
```

Human-readable findings go in `.drift-audit/drift-report.md` (or type-specific
reports like `behavioral-drift-report.md` when running standalone).

---

## Typical Workflow

### Orchestrated (recommended)

**Full pipeline in one command:**
`/drift` — runs audit → plan → unify → guard with one human checkpoint at plan approval.

**Phase by phase:**
1. `/drift audit` — discover all drift
2. `/drift plan` — review and reorder the attack plan
3. `/drift unify` — resolve planned areas
4. `/drift guard` — lock down unified patterns
5. `/drift plan` — check progress, plan next batch

### Manual (individual skills)

**Session 1a:** `/drift-audit` — structural discovery
**Session 1b:** `/drift-audit-ux` — behavioral discovery
**Session 1c:** `/drift-audit-semantic` — semantic discovery
**Sessions 2-N:** `/drift-unify` — one area per session
**After unification:** `/drift-guard` — create guardrails
**Ongoing:** Re-run audits to check for regression

## Requirements

- **ripgrep (`rg`)** — strongly recommended for discovery speed. Falls back to grep.
- **ESLint flat config** — for drift-guard rule generation.
- **Node.js** — for the semantic drift extractor (ts-morph).
- **Python 3.10+** — for the semantic drift pipeline (numpy, scipy, networkx, click).
- **ast-grep (`sg`)** — optional, adds structural pattern matching signal.
