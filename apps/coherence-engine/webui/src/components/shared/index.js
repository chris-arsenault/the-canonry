/**
 * Shared components for all editor modules
 *
 * Re-exports from @penguin-tales/shared-components package.
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

  // Utils
  getElementValidation,
} from '@penguin-tales/shared-components';
