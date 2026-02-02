/**
 * StyleStep - Step 1: Narrative style selection
 *
 * Shows a grid of available narrative styles with role previews.
 */

import { useState, useMemo, useEffect } from 'react';
import type { NarrativeStyle, StoryNarrativeStyle, DocumentNarrativeStyle, RoleDefinition } from '@canonry/world-schema';
import { useWizard } from '../WizardContext';
import { getNarrativeStyleUsageStats } from '../../../lib/db/chronicleRepository';

/** Get roles from either story or document style */
function getRoles(style: NarrativeStyle): RoleDefinition[] {
  if (style.format === 'story') {
    return (style as StoryNarrativeStyle).roles || [];
  }
  // Document styles have roles directly on the style object
  const docStyle = style as DocumentNarrativeStyle;
  return docStyle.roles || [];
}

interface StyleStepProps {
  styles: NarrativeStyle[];
}

export default function StyleStep({ styles }: StyleStepProps) {
  const { state, selectStyle, setAcceptDefaults, simulationRunId } = useWizard();
  const [searchText, setSearchText] = useState('');
  const [formatFilter, setFormatFilter] = useState<'all' | 'story' | 'document'>('all');
  const [styleUsage, setStyleUsage] = useState<Map<string, { usageCount: number }>>(new Map());
  const [usageLoading, setUsageLoading] = useState(false);

  useEffect(() => {
    if (!simulationRunId) {
      setStyleUsage(new Map());
      setUsageLoading(false);
      return;
    }

    let isActive = true;
    setUsageLoading(true);

    getNarrativeStyleUsageStats(simulationRunId)
      .then((stats) => {
        if (isActive) setStyleUsage(stats);
      })
      .catch((err) => {
        console.error('[Chronicle Wizard] Failed to load narrative style usage stats:', err);
        if (isActive) setStyleUsage(new Map());
      })
      .finally(() => {
        if (isActive) setUsageLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [simulationRunId]);

  // Filter styles
  const filteredStyles = useMemo(() => {
    return styles.filter(style => {
      // Format filter
      if (formatFilter !== 'all' && style.format !== formatFilter) {
        return false;
      }
      // Search filter
      if (searchText.trim()) {
        const search = searchText.toLowerCase();
        return (
          style.name.toLowerCase().includes(search) ||
          style.description.toLowerCase().includes(search) ||
          style.tags?.some(tag => tag.toLowerCase().includes(search))
        );
      }
      return true;
    });
  }, [styles, formatFilter, searchText]);

  // Group by format
  const storyStyles = filteredStyles.filter(s => s.format === 'story');
  const documentStyles = filteredStyles.filter(s => s.format === 'document');

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <h4 style={{ margin: '0 0 8px 0' }}>Select Narrative Style</h4>
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '13px' }}>
          Choose a style that defines the structure and roles for your chronicle.
        </p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <input
          type="text"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="Search styles..."
          className="illuminator-input"
          style={{ width: '200px' }}
        />
        <select
          value={formatFilter}
          onChange={(e) => setFormatFilter(e.target.value as 'all' | 'story' | 'document')}
          className="illuminator-select"
        >
          <option value="all">All Formats</option>
          <option value="story">Stories</option>
          <option value="document">Documents</option>
        </select>

        {/* Accept Defaults Checkbox */}
        <label style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginLeft: 'auto',
          fontSize: '13px',
          cursor: 'pointer',
        }}>
          <input
            type="checkbox"
            checked={state.acceptDefaults}
            onChange={(e) => setAcceptDefaults(e.target.checked)}
          />
          Accept defaults for quick generation
        </label>
      </div>

      {/* Styles Grid */}
      <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
        {formatFilter === 'all' || formatFilter === 'story' ? (
          <>
            {storyStyles.length > 0 && formatFilter === 'all' && (
              <h5 style={{ margin: '0 0 12px 0', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>
                Story Styles ({storyStyles.length})
              </h5>
            )}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
              gap: '12px',
              marginBottom: '20px',
            }}>
              {storyStyles.map(style => (
                <StyleCard
                  key={style.id}
                  style={style}
                  isSelected={state.narrativeStyleId === style.id}
                  usageCount={styleUsage.get(style.id)?.usageCount ?? 0}
                  usageLoading={usageLoading}
                  onSelect={() => selectStyle(style, state.acceptDefaults)}
                />
              ))}
            </div>
          </>
        ) : null}

        {formatFilter === 'all' || formatFilter === 'document' ? (
          <>
            {documentStyles.length > 0 && formatFilter === 'all' && (
              <h5 style={{ margin: '0 0 12px 0', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>
                Document Styles ({documentStyles.length})
              </h5>
            )}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
              gap: '12px',
            }}>
              {documentStyles.map(style => (
                <StyleCard
                  key={style.id}
                  style={style}
                  isSelected={state.narrativeStyleId === style.id}
                  usageCount={styleUsage.get(style.id)?.usageCount ?? 0}
                  usageLoading={usageLoading}
                  onSelect={() => selectStyle(style, state.acceptDefaults)}
                />
              ))}
            </div>
          </>
        ) : null}

        {filteredStyles.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No styles match your search.
          </div>
        )}
      </div>

      {/* Selected Style Details */}
      {state.narrativeStyle && (
        <div style={{
          marginTop: '20px',
          padding: '16px',
          background: 'var(--bg-tertiary)',
          borderRadius: '8px',
          border: '1px solid var(--accent-color)',
        }}>
          <h5 style={{ margin: '0 0 8px 0' }}>
            {state.narrativeStyle.name}
            <span style={{
              marginLeft: '8px',
              padding: '2px 6px',
              background: state.narrativeStyle.format === 'story' ? 'var(--accent-color)' : 'var(--warning)',
              color: 'white',
              borderRadius: '4px',
              fontSize: '10px',
              textTransform: 'uppercase',
            }}>
              {state.narrativeStyle.format}
            </span>
          </h5>
          <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: 'var(--text-muted)' }}>
            {state.narrativeStyle.description}
          </p>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
            {usageLoading ? 'Usage in this run: …' : `Usage in this run: ${styleUsage.get(state.narrativeStyle.id)?.usageCount ?? 0}x`}
          </div>

          {/* Role Requirements */}
          <div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Required Roles:
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
              {getRoles(state.narrativeStyle).map(role => (
                <span
                  key={role.role}
                  style={{
                    padding: '4px 8px',
                    background: 'var(--bg-secondary)',
                    borderRadius: '4px',
                    fontSize: '11px',
                  }}
                  title={role.description}
                >
                  {role.role}
                  <span style={{ color: 'var(--text-muted)', marginLeft: '4px' }}>
                    ({role.count.min}-{role.count.max})
                  </span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Style Card Component
// =============================================================================

interface StyleCardProps {
  style: NarrativeStyle;
  isSelected: boolean;
  usageCount: number;
  usageLoading: boolean;
  onSelect: () => void;
}

function StyleCard({ style, isSelected, usageCount, usageLoading, onSelect }: StyleCardProps) {
  const roles = getRoles(style);
  const roleCount = roles.length;
  const requiredCount = roles.filter(r => r.count.min > 0).length;

  return (
    <div
      onClick={onSelect}
      style={{
        padding: '12px',
        background: 'var(--bg-secondary)',
        borderRadius: '8px',
        border: isSelected ? '2px solid var(--accent-color)' : '2px solid transparent',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '6px', gap: '8px' }}>
        <span style={{ fontWeight: 500, fontSize: '13px', flex: 1 }}>{style.name}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span
            style={{
              fontSize: '9px',
              color: usageCount > 0 ? 'var(--text-secondary)' : 'var(--text-muted)',
              padding: '2px 6px',
              background: 'var(--bg-tertiary)',
              borderRadius: '4px',
              textTransform: 'uppercase',
            }}
            title="Times this style has been used in the current run"
          >
            {usageLoading ? '…' : `${usageCount}x used`}
          </span>
          <span style={{
            padding: '2px 6px',
            background: style.format === 'story' ? 'rgba(99, 102, 241, 0.2)' : 'rgba(245, 158, 11, 0.2)',
            color: style.format === 'story' ? 'var(--accent-color)' : 'var(--warning)',
            borderRadius: '4px',
            fontSize: '9px',
            textTransform: 'uppercase',
          }}>
            {style.format}
          </span>
        </div>
      </div>

      <p style={{
        margin: '0 0 8px 0',
        fontSize: '11px',
        color: 'var(--text-muted)',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }}>
        {style.description}
      </p>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
          {roleCount} roles ({requiredCount} required)
        </span>
        {style.tags?.slice(0, 3).map(tag => (
          <span
            key={tag}
            style={{
              padding: '1px 4px',
              background: 'var(--bg-tertiary)',
              borderRadius: '3px',
              fontSize: '9px',
              color: 'var(--text-muted)',
            }}
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}
