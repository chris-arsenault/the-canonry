/**
 * useEditorState - Hook for common editor state management
 *
 * Provides standard CRUD operations for list-based editors:
 * - Selection tracking (selectedIndex, selectedItem)
 * - Item update/toggle/delete/add handlers
 *
 * @example
 * const {
 *   selectedIndex, selectedItem,
 *   handleItemChange, handleToggle, handleDelete, handleAdd,
 *   handleSelect, handleClose
 * } = useEditorState(items, onChange, {
 *   createItem: () => ({ id: `item_${Date.now()}`, name: 'New Item' })
 * });
 */

import { useState, useCallback, useEffect } from 'react';

/** A generic record type for items managed by the editor. */
type EditorItem = Record<string, unknown>;

export interface EditorStateOptions {
  /** Field name for item ID (default: 'id') */
  idField?: string;
  /** Field name for item name (default: 'name') */
  nameField?: string;
  /** Factory function to create new items */
  createItem?: () => EditorItem;
  /** localStorage key for persisting the selected item ID */
  persistKey?: string;
}

export interface EditorStateResult {
  selectedIndex: number | null;
  selectedItem: EditorItem | null;
  handleItemChange: (updated: EditorItem) => void;
  handleToggle: (item: EditorItem) => void;
  handleDelete: () => void;
  handleAdd: (newItem?: EditorItem) => void;
  handleSelect: (index: number) => void;
  handleClose: () => void;
}

function loadStored(key: string | undefined): unknown {
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveStored(key: string | undefined, value: unknown): void {
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Best-effort only.
  }
}

function clearStored(key: string | undefined): void {
  if (!key) return;
  try {
    localStorage.removeItem(key);
  } catch {
    // Best-effort only.
  }
}

export function useEditorState(
  items: EditorItem[],
  onChange: (items: EditorItem[]) => void,
  options: EditorStateOptions = {},
): EditorStateResult {
  const {
    idField = 'id',
    nameField = 'name',
    createItem,
    persistKey,
  } = options;

  const [selectedId, setSelectedId] = useState<string | null>(() => {
    const stored = loadStored(persistKey);
    return typeof stored === 'string' ? stored : null;
  });

  // Restore selectedId from storage when persistKey changes
  useEffect(() => {
    const stored = loadStored(persistKey);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restore persisted selection when key changes
    setSelectedId(typeof stored === 'string' ? stored : null);
  }, [persistKey]);

  const resolvedIndex = selectedId ? items.findIndex((item) => item[idField] === selectedId) : -1;
  const selectedIndex = resolvedIndex >= 0 ? resolvedIndex : null;

  // Derive selected item from index
  const selectedItem = selectedIndex !== null && selectedIndex < items.length
    ? items[selectedIndex]
    : null;

  // Persist selectedId to storage
  useEffect(() => {
    if (!persistKey) return;
    if (selectedId) {
      saveStored(persistKey, selectedId);
    } else {
      clearStored(persistKey);
    }
  }, [persistKey, selectedId]);

  // Clear invalid selectedId
  if (selectedId && selectedIndex === null) {
    setSelectedId(null);
  }

  // Update the currently selected item
  const handleItemChange = useCallback((updated: EditorItem) => {
    if (selectedIndex !== null && selectedIndex < items.length) {
      const newItems = [...items];
      newItems[selectedIndex] = updated;
      onChange(newItems);
    }
  }, [items, onChange, selectedIndex]);

  // Toggle the enabled state of an item
  const handleToggle = useCallback((item: EditorItem) => {
    const index = items.findIndex((i) => i[idField] === item[idField]);
    if (index >= 0) {
      const newItems = [...items];
      newItems[index] = { ...item, enabled: item.enabled === false ? true : false };
      onChange(newItems);
    }
  }, [items, onChange, idField]);

  // Delete the currently selected item (with confirmation)
  const handleDelete = useCallback(() => {
    if (selectedIndex !== null && selectedItem) {
      const itemName = (selectedItem[nameField] as string) || (selectedItem[idField] as string);
      if (confirm(`Delete "${itemName}"?`)) {
        const newItems = [...items];
        newItems.splice(selectedIndex, 1);
        onChange(newItems);
        setSelectedId(null);
      }
    }
  }, [items, onChange, selectedIndex, selectedItem, idField, nameField]);

  // Add a new item (using createItem factory if provided)
  const handleAdd = useCallback((newItem?: EditorItem) => {
    const itemToAdd = newItem || (createItem ? createItem() : { [idField]: `item_${Date.now()}` });
    onChange([...items, itemToAdd]);
    setSelectedId((itemToAdd[idField] as string) || null);
  }, [items, onChange, createItem, idField]);

  // Select an item by index
  const handleSelect = useCallback((index: number) => {
    const item = items[index];
    setSelectedId(item ? (item[idField] as string) : null);
  }, [items, idField]);

  // Close the selection (deselect)
  const handleClose = useCallback(() => {
    setSelectedId(null);
  }, []);

  return {
    selectedIndex,
    selectedItem,
    handleItemChange,
    handleToggle,
    handleDelete,
    handleAdd,
    handleSelect,
    handleClose,
  };
}
