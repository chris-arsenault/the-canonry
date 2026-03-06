<!-- drift-generated -->
# Cosmographer Editor CSS Pattern

Shared CSS for cosmographer editor components lives at:
```
apps/cosmographer/webui/src/styles/cosmographer-editor.css
```

## Usage

### 1. Import in your component CSS

```css
@import "../../styles/cosmographer-editor.css";

/* Component-specific rules only */
.mycomp-special-layout {
  display: grid;
  gap: 8px;
}
```

### 2. Use `cosmo-*` classes in JSX for shared elements

```jsx
<div className="cosmo-editor-container">
  <div className="cosmo-editor-header">
    <div className="cosmo-editor-title">My Editor</div>
    <div className="cosmo-editor-subtitle">Description here.</div>
  </div>

  <div className="cosmo-toolbar">
    <span className="cosmo-count">{items.length} items</span>
    <button className="cosmo-add-btn" onClick={onAdd}>+ Add Item</button>
  </div>

  {items.length === 0 ? (
    <div className="cosmo-empty-state">No items yet.</div>
  ) : (
    /* component-specific list/table/grid layout */
  )}

  {showModal && (
    <div className="cosmo-modal" onClick={closeModal}>
      <div className="cosmo-modal-content" onClick={e => e.stopPropagation()}>
        <div className="cosmo-modal-title">Add Item</div>

        <div className="cosmo-form-group">
          <label className="cosmo-label">Name</label>
          <input className="cosmo-input" value={name} onChange={...} />
        </div>

        <div className="cosmo-form-group">
          <label className="cosmo-label">Type</label>
          <select className="cosmo-select" value={type} onChange={...}>
            <option value="">Select...</option>
          </select>
          <div className="cosmo-hint">Choose the item type</div>
        </div>

        <div className="cosmo-modal-actions">
          <button className="cosmo-cancel-btn" onClick={closeModal}>Cancel</button>
          <button className="cosmo-save-btn" onClick={save}>Save</button>
        </div>
      </div>
    </div>
  )}
</div>
```

### 3. Component-specific overrides

Add a second class alongside a `cosmo-*` class for overrides:

```jsx
{/* Override modal width for wider content */}
<div className="cosmo-modal-content mycomp-wide-modal">
```

```css
.mycomp-wide-modal {
  width: 600px;
}
```

## Available classes

| Class | Purpose |
|-------|---------|
| `cosmo-editor-container` | Page-level container (`max-width: 1000px`) |
| `cosmo-editor-header` | Header wrapper |
| `cosmo-editor-title` | Page title (20px, bold) |
| `cosmo-editor-subtitle` | Subtitle text (13px, muted) |
| `cosmo-toolbar` | Flex row for toolbar (space-between) |
| `cosmo-count` | Item count text |
| `cosmo-actions` | Inline button group |
| `cosmo-add-btn` | Primary action button (blue) |
| `cosmo-save-btn` | Save/confirm button (blue) |
| `cosmo-cancel-btn` | Cancel/dismiss button (subtle) |
| `cosmo-edit-btn` | Small edit button |
| `cosmo-delete-btn` | Small destructive button (red outline) |
| `cosmo-empty-state` | Centered empty-state message |
| `cosmo-modal` | Full-screen modal overlay |
| `cosmo-modal-content` | Modal dialog box |
| `cosmo-modal-title` | Modal heading |
| `cosmo-modal-actions` | Modal button row (flex-end) |
| `cosmo-form-group` | Form field wrapper |
| `cosmo-label` | Form label |
| `cosmo-input` | Text input |
| `cosmo-select` | Select dropdown |
| `cosmo-hint` | Help text below a field |
| `cosmo-arrow` | Directional arrow icon |

## Do NOT

- Define per-component versions of these classes (e.g., `axr-modal`, `re-form-group`). The ESLint rule `local/no-cosmo-editor-drift` will flag this.
- Put component-specific layout rules in the shared file. Keep it for patterns used by 2+ editors.
