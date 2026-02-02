/**
 * Shared Components for Canonry MFEs
 *
 * Re-exports UI components, form components, hooks, and utilities
 * that can be shared across all micro-frontends.
 *
 * CSS styles are available via: import '@penguin-tales/shared-components/styles'
 */

// Canonry-specific components
export { default as TagSelector } from './TagSelector.jsx';

// Badge components
export { ToolUsageBadges } from './components/badges';
export { DetailUsageBadges } from './components/badges';

// Schema usage utilities
export {
  computeUsageMap,
  computeSchemaUsage,
  getElementValidation,
  getUsageSummary,
  computeTagUsage,
  getEntityKindUsageSummary,
  getRelationshipKindUsageSummary,
} from './utils/schemaUsageMap';


// Form components
export { ReferenceDropdown } from './components/ReferenceDropdown';
export { ChipSelect } from './components/ChipSelect';
export { SearchableDropdown } from './components/SearchableDropdown';
export { LevelSelector, STRENGTH_LEVELS, PROMINENCE_LEVELS } from './components/LevelSelector';
export { NumberInput } from './components/NumberInput';
export { LocalTextArea } from './components/LocalTextArea';

// Matrix components
export { CoverageMatrix } from './components/CoverageMatrix';

// UI components
export { EnableToggle } from './components/EnableToggle';
export { IconButton } from './components/IconButton';
export { InfoBox } from './components/InfoBox';
export { SectionHeader } from './components/SectionHeader';
export { EmptyState } from './components/EmptyState';
export { CategorySection } from './components/CategorySection';
export { AddCard } from './components/AddCard';
export { AddItemButton } from './components/AddItemButton';
export { ModalShell } from './components/ModalShell';
export { ItemRow } from './components/ItemRow';
export { PressureChangesEditor } from './components/PressureChangesEditor';
export { ExpandableCard } from './components/ExpandableCard';
export { FormGroup, FormRow } from './components/FormGroup';

// Validation display
export { ErrorBadge, OrphanBadge, TabValidationBadge } from './components/ValidationBadge';
export { EraBadges } from './components/EraBadges';

// Hooks
export { useLocalInputState } from './components/hooks/useLocalInputState';
export { useEditorState } from './components/hooks/useEditorState';

// Constants
export * from './constants';
