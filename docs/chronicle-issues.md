# Chronicle Pipeline — Issues Under Investigation

Ongoing issues identified through chronicle review. Each entry includes the problem, evidence, and current status.

---

## 1. Cast Role Assignments Never Reach PS or Generation Prompt

**Status**: Fix in progress (PS path only)

**Problem**: The wizard collects explicit role assignments (`ChronicleRoleAssignment` — which entity fills which narrative role like dreamer, protagonist, the-seed, etc.). These assignments are used internally to derive focus type (single vs ensemble) and primary/supporting splits, but the actual role→entity mapping is discarded before prompt assembly.

**Evidence**: In the Grandfather Blood export (`chronicle-export-chronicle-of-grandfather-blood-1770611637114.json`):
- PS input entities all show `role: null, narrativeRole: null`
- The generation prompt lists role slots ("Assign characters from below to these roles: dreamer (1), the-seed (1)...") but never says which character the user assigned to which role
- The user's curatorial decisions about cast composition have no effect on output

**Where it breaks**:
- `promptBuilder.ts:buildUnifiedCastSection` — lists role slots and characters separately, never connects them
- PS input entity assembly — role fields are never populated from `ChronicleFocus.roleAssignments`

**Fix approach**: Pass role assignments to PS so entity directives can reflect intended roles. The generation prompt keeps role slots open — the chronicler has freedom to assign roles, but PS guidance will be shaped by the user's intent.

---

## 2. coreTone Conflicts with Narrative Style Guidance

**Status**: Fixed

**Problem**: The world-level `coreTone` ("Dark, war-weary fantasy. History is written by survivors who remember the cost...") was injected raw into the `# Writing Style` section of the generation prompt, directly above the narrative style's own `proseInstructions`. For styles like Dreamscape ("Hallucinatory, fluid, vivid"), the coreTone actively fights the intended voice. It also introduced competing closing line guidance (coreTone's "CLOSING VARIETY" vs Dreamscape's seed-image return).

**Evidence**: Grandfather Blood creative prompt has the full coreTone block (STYLE PRINCIPLES, SYNTACTIC POETRY, BITTER CAMARADERIE, CLOSING VARIETY, AVOID) immediately before `## Prose: Dreamscape` — two incompatible writing directives in the same section.

**Fix**: Removed coreTone from the assembled tone passed to the generation prompt. PS already receives coreTone as input and can incorporate it into its synthesis. The generation prompt now gets only: PS brief + motifs + narrative style proseInstructions.
