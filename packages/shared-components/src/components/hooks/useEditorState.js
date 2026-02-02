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

import { useState, useCallback } from 'react';

export function useEditorState(items, onChange, options = {}) {
  const {
    idField = 'id',
    nameField = 'name',
    createItem,
  } = options;

  const [selectedIndex, setSelectedIndex] = useState(null);

  // Derive selected item from index
  const selectedItem = selectedIndex !== null && selectedIndex < items.length
    ? items[selectedIndex]
    : null;

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
        setSelectedIndex(null);
      }
    }
  }, [items, onChange, selectedIndex, selectedItem, idField, nameField]);

  // Add a new item (using createItem factory if provided)
  const handleAdd = useCallback((newItem) => {
    const itemToAdd = newItem || (createItem ? createItem() : { [idField]: `item_${Date.now()}` });
    onChange([...items, itemToAdd]);
    setSelectedIndex(items.length); // Select the new item
  }, [items, onChange, createItem, idField]);

  // Select an item by index
  const handleSelect = useCallback((index) => {
    setSelectedIndex(index);
  }, []);

  // Close the selection (deselect)
  const handleClose = useCallback(() => {
    setSelectedIndex(null);
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
