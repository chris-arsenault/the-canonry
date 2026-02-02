/**
 * HistorianConfigEditor - Dedicated tab for configuring the historian persona
 *
 * Defines the scholarly voice that annotates entities and chronicles.
 * Configuration is project-level (one historian per world).
 */

import { useState, useCallback } from 'react';

// ============================================================================
// Tag/Chip Input (reusable for arrays of strings)
// ============================================================================

function TagInput({ value, onChange, placeholder }) {
  const [inputValue, setInputValue] = useState('');

  const addTag = () => {
    const trimmed = inputValue.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
      setInputValue('');
    }
  };

  const removeTag = (index) => {
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div>
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '4px',
        marginBottom: value.length > 0 ? '6px' : 0,
      }}>
        {value.map((tag, i) => (
          <span
            key={i}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 8px',
              background: 'rgba(139, 115, 85, 0.12)',
              border: '1px solid rgba(139, 115, 85, 0.25)',
              borderRadius: '3px',
              fontSize: '11px',
              color: 'var(--text-primary)',
            }}
          >
            {tag}
            <button
              onClick={() => removeTag(i)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '12px',
                padding: 0,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '4px' }}>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addTag();
            }
          }}
          placeholder={placeholder}
          style={{
            flex: 1,
            padding: '4px 8px',
            fontSize: '12px',
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            background: 'var(--bg-tertiary)',
            color: 'var(--text-primary)',
          }}
        />
        <button
          onClick={addTag}
          disabled={!inputValue.trim()}
          style={{
            padding: '4px 10px',
            fontSize: '11px',
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            background: 'var(--bg-tertiary)',
            color: inputValue.trim() ? 'var(--text-primary)' : 'var(--text-muted)',
            cursor: inputValue.trim() ? 'pointer' : 'not-allowed',
          }}
        >
          Add
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// List Editor (for longer text items like private facts, running gags)
// ============================================================================

function ListEditor({ value, onChange, placeholder, itemPlaceholder }) {
  const [inputValue, setInputValue] = useState('');

  const addItem = () => {
    const trimmed = inputValue.trim();
    if (trimmed) {
      onChange([...value, trimmed]);
      setInputValue('');
    }
  };

  const removeItem = (index) => {
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div>
      {value.map((item, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '6px',
            marginBottom: '4px',
            padding: '6px 8px',
            background: 'var(--bg-tertiary)',
            borderRadius: '4px',
            border: '1px solid var(--border-color)',
          }}
        >
          <span style={{
            flex: 1,
            fontSize: '12px',
            color: 'var(--text-primary)',
            lineHeight: '1.5',
          }}>
            {item}
          </span>
          <button
            onClick={() => removeItem(i)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: '14px',
              padding: '0 2px',
              lineHeight: 1,
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: '4px', marginTop: value.length > 0 ? '6px' : 0 }}>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addItem();
            }
          }}
          placeholder={itemPlaceholder || placeholder}
          style={{
            flex: 1,
            padding: '4px 8px',
            fontSize: '12px',
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            background: 'var(--bg-tertiary)',
            color: 'var(--text-primary)',
          }}
        />
        <button
          onClick={addItem}
          disabled={!inputValue.trim()}
          style={{
            padding: '4px 10px',
            fontSize: '11px',
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            background: 'var(--bg-tertiary)',
            color: inputValue.trim() ? 'var(--text-primary)' : 'var(--text-muted)',
            cursor: inputValue.trim() ? 'pointer' : 'not-allowed',
          }}
        >
          Add
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Field Label
// ============================================================================

function FieldLabel({ label, description }) {
  return (
    <div style={{ marginBottom: '4px' }}>
      <div style={{
        fontSize: '11px',
        fontWeight: 600,
        color: 'var(--text-secondary)',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
      }}>
        {label}
      </div>
      {description && (
        <div style={{
          fontSize: '10px',
          color: 'var(--text-muted)',
          marginTop: '1px',
        }}>
          {description}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Editor
// ============================================================================

export default function HistorianConfigEditor({ config, onChange }) {
  const update = useCallback((field, value) => {
    onChange({ ...config, [field]: value });
  }, [config, onChange]);

  const isConfigured = config.name.trim().length > 0 && config.background.trim().length > 0;

  return (
    <div style={{ padding: '16px', maxWidth: '600px' }}>
      {/* Header */}
      <div style={{
        marginBottom: '20px',
        paddingBottom: '12px',
        borderBottom: '1px solid var(--border-color)',
      }}>
        <div style={{
          fontSize: '14px',
          fontWeight: 600,
          color: 'var(--text-primary)',
        }}>
          Historian Persona
        </div>
        <div style={{
          fontSize: '11px',
          color: 'var(--text-muted)',
          marginTop: '4px',
          lineHeight: '1.5',
        }}>
          Define the scholarly voice that annotates your world's entities and chronicles.
          This historian will add margin notes — corrections, observations, asides —
          in a consistent voice across all content. Tone varies per review.
        </div>
        {!isConfigured && (
          <div style={{
            marginTop: '8px',
            padding: '6px 10px',
            background: 'rgba(139, 115, 85, 0.1)',
            border: '1px solid rgba(139, 115, 85, 0.25)',
            borderRadius: '4px',
            fontSize: '11px',
            color: '#8b7355',
          }}>
            Configure at least a name and background to enable historian reviews.
          </div>
        )}
      </div>

      {/* Fields */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Name */}
        <div>
          <FieldLabel
            label="Name & Title"
            description='e.g., "Aldric Fenworth, Third Archivist of the Pale Library"'
          />
          <input
            type="text"
            value={config.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder="Enter the historian's name and title"
            style={{
              width: '100%',
              padding: '6px 10px',
              fontSize: '13px',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              background: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
            }}
          />
        </div>

        {/* Background */}
        <div>
          <FieldLabel
            label="Background"
            description="Credentials, institutional affiliation, era they're writing from"
          />
          <textarea
            value={config.background}
            onChange={(e) => update('background', e.target.value)}
            placeholder="A seasoned archivist who has spent forty years cataloguing the histories of the realm. Has outlived most of the people described in these texts. Still shows up to work."
            style={{
              width: '100%',
              minHeight: '80px',
              padding: '6px 10px',
              fontSize: '12px',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              background: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              resize: 'vertical',
              lineHeight: '1.5',
            }}
          />
        </div>

        {/* Personality Traits */}
        <div>
          <FieldLabel
            label="Personality Traits"
            description="Short phrases that define the historian's character — think weary, not wacky"
          />
          <TagInput
            value={config.personalityTraits}
            onChange={(v) => update('personalityTraits', v)}
            placeholder='e.g., "world-weary", "quietly compassionate"'
          />
        </div>

        {/* Biases */}
        <div>
          <FieldLabel
            label="Biases & Blind Spots"
            description="What they trust, distrust, or have given up arguing about"
          />
          <TagInput
            value={config.biases}
            onChange={(v) => update('biases', v)}
            placeholder='e.g., "distrusts oral histories"'
          />
        </div>

        {/* Stance */}
        <div>
          <FieldLabel
            label="Stance Toward Source Material"
            description="Their overall relationship to the texts they're annotating"
          />
          <textarea
            value={config.stance}
            onChange={(e) => update('stance', e.target.value)}
            placeholder='e.g., "Has read too many of these accounts to be surprised, but still occasionally moved by the human cost of events others reduce to dates and outcomes"'
            style={{
              width: '100%',
              minHeight: '50px',
              padding: '6px 10px',
              fontSize: '12px',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              background: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              resize: 'vertical',
              lineHeight: '1.5',
            }}
          />
        </div>

        {/* Private Facts */}
        <div>
          <FieldLabel
            label="Private Facts"
            description="Things the historian knows that aren't in the canon facts. The historian may reference these in annotations."
          />
          <ListEditor
            value={config.privateFacts}
            onChange={(v) => update('privateFacts', v)}
            placeholder="Add a fact"
            itemPlaceholder='e.g., "The real cause of the Great Fire was arson, not the dragon"'
          />
        </div>

        {/* Running Gags */}
        <div>
          <FieldLabel
            label="Recurring Preoccupations"
            description="Refrains, motifs, or things the historian keeps circling back to — not jokes, but patterns they can't stop noticing"
          />
          <ListEditor
            value={config.runningGags}
            onChange={(v) => update('runningGags', v)}
            placeholder="Add a preoccupation"
            itemPlaceholder='e.g., "The way institutions always outlive the people who built them"'
          />
        </div>
      </div>
    </div>
  );
}
