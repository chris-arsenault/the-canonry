/**
 * Shared components for all editor modules
 *
 * These components use CSS classes from styles/index.css.
 */

// Form components
export { ReferenceDropdown } from './ReferenceDropdown';
export { ChipSelect } from './ChipSelect';
export { SearchableDropdown } from './SearchableDropdown';
export { LevelSelector, STRENGTH_LEVELS, PROMINENCE_LEVELS } from './LevelSelector';
export { NumberInput } from './NumberInput';
export { LocalTextArea } from './LocalTextArea';

// UI components
export { EnableToggle } from './EnableToggle';
export { IconButton } from './IconButton';
export { InfoBox } from './InfoBox';
export { SectionHeader } from './SectionHeader';
export { EmptyState } from './EmptyState';
export { CategorySection } from './CategorySection';
export { AddCard } from './AddCard';
export { AddItemButton } from './AddItemButton';
export { ModalShell } from './ModalShell';
export { ItemRow } from './ItemRow';
export { PressureChangesEditor } from './PressureChangesEditor';

// Validation display
export { ErrorBadge, OrphanBadge, TabValidationBadge } from './ValidationBadge';
export { EraBadges } from './EraBadges';

// Hooks
export { useLocalInputState } from './hooks/useLocalInputState';
export { useEditorState } from './hooks/useEditorState';

// Utils
export { getElementValidation } from './utils/validation';
