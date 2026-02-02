/**
 * Re-exports from @penguin-tales/shared-components
 *
 * Use this index to import shared components in Name Forge.
 * This provides a consistent import path and makes it easy to swap
 * components in the future if needed.
 */

export {
  // UI Components
  ModalShell,
  ExpandableCard,
  EmptyState,
  SectionHeader,
  IconButton,
  InfoBox,
  AddItemButton,
  CategorySection,
  ItemRow,

  // Form Components
  FormGroup,
  FormRow,
  ChipSelect,
  SearchableDropdown,
  ReferenceDropdown,
  LevelSelector,
  EnableToggle,

  // Specialized Components
  TagSelector,
  AddCard,
  PressureChangesEditor,

  // Badges
  ErrorBadge,
  OrphanBadge,
  TabValidationBadge,
  EraBadges,
  ToolUsageBadges,
  DetailUsageBadges,

  // Hooks
  useLocalInputState,
  useEditorState,

  // Constants
  STRENGTH_LEVELS,
  PROMINENCE_LEVELS,

  // Utilities
  computeUsageMap,
  computeSchemaUsage,
  getElementValidation,
  getUsageSummary,
  computeTagUsage,
  getEntityKindUsageSummary,
  getRelationshipKindUsageSummary,
} from '@penguin-tales/shared-components';
