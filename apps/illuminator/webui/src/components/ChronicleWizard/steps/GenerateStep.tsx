/**
 * GenerateStep - Step 5: Summary and generation confirmation
 *
 * Shows a summary of selections before generating.
 */

import { useWizard } from '../WizardContext';

interface GenerateStepProps {
  onGenerate: () => void;
}

export default function GenerateStep({ onGenerate }: GenerateStepProps) {
  const { state, setLowSampling } = useWizard();

  // Count primary vs supporting roles
  const primaryCount = state.roleAssignments.filter(a => a.isPrimary).length;
  const supportingCount = state.roleAssignments.length - primaryCount;

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <h4 style={{ margin: '0 0 8px 0' }}>Generate Chronicle</h4>
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '13px' }}>
          Review your selections and generate the chronicle.
        </p>
      </div>

      {/* Summary */}
      <div style={{
        padding: '20px',
        background: 'var(--bg-secondary)',
        borderRadius: '12px',
        marginBottom: '24px',
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {/* Style */}
          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
              Narrative Style
            </div>
            <div style={{ fontWeight: 500 }}>
              {state.narrativeStyle?.name}
              <span style={{
                marginLeft: '8px',
                padding: '2px 6px',
                background: state.narrativeStyle?.format === 'story' ? 'var(--accent-color)' : 'var(--warning)',
                color: 'white',
                borderRadius: '4px',
                fontSize: '9px',
                textTransform: 'uppercase',
              }}>
                {state.narrativeStyle?.format}
              </span>
            </div>
          </div>

          {/* Entry Point */}
          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
              Entry Point
            </div>
            <div style={{ fontWeight: 500 }}>
              {state.entryPoint?.name}
              <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: '6px' }}>
                ({state.entryPoint?.kind})
              </span>
            </div>
          </div>

          {/* Ensemble */}
          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
              Ensemble
            </div>
            <div style={{ fontWeight: 500 }}>
              {state.roleAssignments.length} entities
              <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: '6px' }}>
                ({primaryCount} primary, {supportingCount} supporting)
              </span>
            </div>
          </div>

          {/* Events & Relationships */}
          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
              Context
            </div>
            <div style={{ fontWeight: 500 }}>
              {state.selectedEventIds.size} events, {state.selectedRelationshipIds.size} relationships
            </div>
          </div>
        </div>

        {/* Narrative Lens */}
        {state.lens && (
          <div style={{ marginTop: '20px' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
              Narrative Lens
            </div>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 8px',
              background: 'rgba(139, 92, 246, 0.1)',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              borderRadius: '4px',
              fontSize: '11px',
            }}>
              <span style={{ color: 'rgba(139, 92, 246, 0.7)' }}>&#x25C8;</span>
              <span style={{ fontWeight: 500 }}>{state.lens.entityName}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>({state.lens.entityKind})</span>
            </div>
          </div>
        )}

        {/* Role Breakdown */}
        <div style={{ marginTop: '20px' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
            Role Assignments
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {state.roleAssignments.map(assignment => (
              <span
                key={`${assignment.role}-${assignment.entityId}`}
                style={{
                  padding: '4px 8px',
                  background: assignment.isPrimary ? 'var(--accent-color)' : 'var(--bg-tertiary)',
                  color: assignment.isPrimary ? 'white' : 'inherit',
                  borderRadius: '4px',
                  fontSize: '11px',
                }}
              >
                <span style={{ fontWeight: 500 }}>{assignment.role}</span>
                <span style={{
                  marginLeft: '6px',
                  opacity: assignment.isPrimary ? 0.9 : 0.7,
                }}>
                  {assignment.entityName}
                </span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Sampling Control */}
      <div style={{
        padding: '16px 20px',
        background: 'var(--bg-secondary)',
        borderRadius: '12px',
        marginBottom: '24px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
              Sampling
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Normal sampling uses `top_p=1.0`. Low sampling uses `top_p=0.95`.
            </div>
          </div>
          {state.lowSampling === null && (
            <span style={{
              fontSize: '10px',
              color: 'var(--warning)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}>
              Required
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '10px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-primary)' }}>
            <input
              type="radio"
              name="sampling-mode"
              checked={state.lowSampling === false}
              onChange={() => setLowSampling(false)}
            />
            Normal sampling
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-primary)' }}>
            <input
              type="radio"
              name="sampling-mode"
              checked={state.lowSampling === true}
              onChange={() => setLowSampling(true)}
            />
            Low sampling
          </label>
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          Low sampling slightly narrows token choices for steadier phrasing while keeping thinking enabled.
        </div>
        {state.lowSampling === null && (
          <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
            Choose a sampling mode to enable generation.
          </div>
        )}
      </div>

      {/* Info Box */}
      <div style={{
        padding: '12px 16px',
        background: 'var(--bg-tertiary)',
        borderRadius: '8px',
        fontSize: '12px',
        color: 'var(--text-muted)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        <span style={{ fontSize: '16px' }}>💡</span>
        <span>
          Click "Generate Chronicle" to start generation.
          The complete chronicle will be ready in about 30-60 seconds.
        </span>
      </div>
    </div>
  );
}
