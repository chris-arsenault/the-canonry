/**
 * Shared components for all editor modules
 *
 * Re-exports from @the-canonry/shared-components package.
 * CSS styles are imported via main.jsx from the package.
 */

export {
  // Form components
  ReferenceDropdown,
  ChipSelect,
  SearchableDropdown,
  LevelSelector,
  STRENGTH_LEVELS,
  PROMINENCE_LEVELS,
  NumberInput,
  LocalTextArea,

  // UI components
  EnableToggle,
  IconButton,
  InfoBox,
  SectionHeader,
  EmptyState,
  CategorySection,
  AddCard,
  AddItemButton,
  ModalShell,
  ItemRow,
  PressureChangesEditor,

  // Validation display
  ErrorBadge,
  OrphanBadge,
  TabValidationBadge,
  EraBadges,

  // Hooks
  useLocalInputState,
  useEditorState,
  useExpandSingle,
  useExpandSet,
  useExpandBoolean,
  expandableProps,

  // Utils
  getElementValidation,
} from "@the-canonry/shared-components";
