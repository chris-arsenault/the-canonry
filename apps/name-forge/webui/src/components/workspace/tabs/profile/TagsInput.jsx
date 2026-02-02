import React from 'react';

/**
 * Tags input with auto-split on space/comma
 * Note: Consider using TagSelector from shared-components in future
 */
export default function TagsInput({ value, onChange, placeholder }) {
  const tags = Array.isArray(value) ? value : [];

  const handleKeyDown = (e) => {
    if (e.key === ' ' || e.key === ',' || e.key === 'Enter') {
      e.preventDefault();
      const input = e.target.value.trim();
      if (input && !tags.includes(input)) {
        onChange([...tags, input]);
      }
      e.target.value = '';
    } else if (e.key === 'Backspace' && e.target.value === '' && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  };

  const handleRemove = (tag) => {
    onChange(tags.filter(t => t !== tag));
  };

  return (
    <div className="tags-input-container">
      {tags.map(tag => (
        <span key={tag} className="tag-chip">
          {tag}
          <button
            type="button"
            onClick={() => handleRemove(tag)}
            className="tag-remove-btn"
          >
            x
          </button>
        </span>
      ))}
      <input
        type="text"
        onKeyDown={handleKeyDown}
        placeholder={tags.length === 0 ? placeholder : ''}
        className="tags-input"
      />
    </div>
  );
}
