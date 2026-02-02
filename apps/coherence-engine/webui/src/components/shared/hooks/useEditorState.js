/**
 * useEditorState - Hook for common editor state management
 *
 * Provides standard CRUD operations for list-based editors:
 * - Selection tracking (selectedIndex, selectedItem)
 * - Item update/toggle/delete/add handlers
 *
 * @param {Array} items - Array of items being edited
 * @param {Function} onChange - Callback when items array changes
 * @param {Object} options - Optional configuration
 * @param {string} options.idField - Field name for item ID (default: 'id')
 * @param {string} options.nameField - Field name for item name (default: 'name')
 * @param {Function} options.createItem - Factory function to create new items
 *
 * @returns {Object} Editor state and handlers
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
import { clearStoredValue, loadStoredValue, saveStoredValue } from '../../../utils/persistence';

export function useEditorState(items, onChange, options = {}) {
  const {
    idField = 'id',
    nameField = 'name',
    createItem,
    persistKey,
  } = options;

  const [selectedId, setSelectedId] = useState(() => {
    const stored = loadStoredValue(persistKey);
    return typeof stored === 'string' ? stored : null;
  });

  useEffect(() => {
    const stored = loadStoredValue(persistKey);
    setSelectedId(typeof stored === 'string' ? stored : null);
  }, [persistKey]);

  const resolvedIndex = selectedId
    ? items.findIndex((item) => item[idField] === selectedId)
    : -1;
  const selectedIndex = resolvedIndex >= 0 ? resolvedIndex : null;

  // Derive selected item from index
  const selectedItem = selectedIndex !== null && selectedIndex < items.length
    ? items[selectedIndex]
    : null;

  useEffect(() => {
    if (!persistKey) return;
    if (selectedId) {
      saveStoredValue(persistKey, selectedId);
    } else {
      clearStoredValue(persistKey);
    }
  }, [persistKey, selectedId]);

  useEffect(() => {
    if (selectedId && selectedIndex === null) {
      setSelectedId(null);
    }
  }, [selectedId, selectedIndex]);

  // Update the currently selected item
  const handleItemChange = useCallback((updated) => {
    if (selectedIndex !== null && selectedIndex < items.length) {
      const newItems = [...items];
      newItems[selectedIndex] = updated;
      onChange(newItems);
    }
  }, [items, onChange, selectedIndex]);

  // Toggle the enabled state of an item
  const handleToggle = useCallback((item) => {
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
      const itemName = selectedItem[nameField] || selectedItem[idField];
      if (confirm(`Delete "${itemName}"?`)) {
        const newItems = [...items];
        newItems.splice(selectedIndex, 1);
        onChange(newItems);
        setSelectedId(null);
      }
    }
  }, [items, onChange, selectedIndex, selectedItem, idField, nameField]);

  // Add a new item (using createItem factory if provided)
  const handleAdd = useCallback((newItem) => {
    const itemToAdd = newItem || (createItem ? createItem() : { [idField]: `item_${Date.now()}` });
    onChange([...items, itemToAdd]);
    setSelectedId(itemToAdd[idField] || null);
  }, [items, onChange, createItem, idField]);

  // Select an item by index
  const handleSelect = useCallback((index) => {
    const item = items[index];
    setSelectedId(item ? item[idField] : null);
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
