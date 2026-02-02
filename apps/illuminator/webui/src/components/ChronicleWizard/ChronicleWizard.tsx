/**
 * ChronicleWizard - Modal wizard for creating chronicles
 *
 * Guides the user through:
 * 1. Narrative style selection
 * 2. Entry point (graph anchor) selection
 * 3. Entity role assignment
 * 4. Event/relationship resolution
 * 5. Pipeline selection and generation
 */

import { useEffect, useCallback, useMemo, useRef } from 'react';
import type { NarrativeStyle, EntityKindDefinition } from '@canonry/world-schema';
import type { EntityContext, RelationshipContext, NarrativeEventContext, EraTemporalInfo, ChronicleTemporalContext, NarrativeLens } from '../../lib/chronicleTypes';
import { WizardProvider, useWizard, WizardStep, ChronicleSeed } from './WizardContext';
import StyleStep from './steps/StyleStep';
import EntryPointStep from './steps/EntryPointStep';
import RoleAssignmentStep from './steps/RoleAssignmentStep';
import EventResolutionStep from './steps/EventResolutionStep';
import GenerateStep from './steps/GenerateStep';

// =============================================================================
// Types
// =============================================================================

export interface ChronicleWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (config: WizardGenerateConfig) => void;
  simulationRunId: string;

  // Data from parent
  narrativeStyles: NarrativeStyle[];
  entities: EntityContext[];
  relationships: RelationshipContext[];
  events: NarrativeEventContext[];
  /** Entity kind definitions for category mapping */
  entityKinds: EntityKindDefinition[];
  /** Era definitions with tick ranges for temporal alignment (optional) */
  eras?: EraTemporalInfo[];

  // Optional seed to restore previous chronicle settings (same structure as ChronicleRecord)
  initialSeed?: ChronicleSeed;
}

export interface WizardGenerateConfig {
  narrativeStyleId: string;
  narrativeStyle: NarrativeStyle;
  entryPointId: string;
  entryPointName: string;
  entryPointKind: string;
  roleAssignments: Array<{
    role: string;
    entityId: string;
    entityName: string;
    entityKind: string;
    isPrimary: boolean;
  }>;
  selectedEventIds: string[];
  selectedRelationshipIds: string[];
  /** Optional narrative lens entity (contextual frame) */
  lens?: NarrativeLens;
  /** Temporal context computed from selected events and eras */
  temporalContext: ChronicleTemporalContext | null;
  /** Optional temperature override (if not set, uses narrative style default) */
  temperatureOverride?: number;
}

// =============================================================================
// Step Labels
// =============================================================================

const STEP_LABELS: Record<WizardStep, string> = {
  1: 'Style',
  2: 'Entry Point',
  3: 'Roles',
  4: 'Events',
  5: 'Generate',
};

// =============================================================================
// Inner Wizard (has access to context)
// =============================================================================

interface InnerWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (config: WizardGenerateConfig) => void;
  narrativeStyles: NarrativeStyle[];
  entities: EntityContext[];
  relationships: RelationshipContext[];
  events: NarrativeEventContext[];
  initialSeed?: ChronicleSeed;
  simulationRunId: string;
}

function InnerWizard({
  isOpen,
  onClose,
  onGenerate,
  narrativeStyles,
  entities,
  relationships,
  events,
  initialSeed,
}: InnerWizardProps) {
  const { state, nextStep, prevStep, reset, goToStep, initFromSeed, temporalContext, autoFillEventsAndRelationships } = useWizard();
  const mouseDownOnOverlay = useRef(false);

  const handleOverlayMouseDown = (e: React.MouseEvent) => {
    mouseDownOnOverlay.current = e.target === e.currentTarget;
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (mouseDownOnOverlay.current && e.target === e.currentTarget) {
      handleClose();
    }
  };

  // Initialize from seed when opening with one
  useEffect(() => {
    if (isOpen && initialSeed) {
      const style = initialSeed.narrativeStyle || narrativeStyles.find(s => s.id === initialSeed.narrativeStyleId);
      const entryPoint = entities.find(e => e.id === initialSeed.entrypointId);

      if (style && entryPoint) {
        initFromSeed(initialSeed, style, entryPoint, entities, relationships, events);
      }
    }
  }, [isOpen, initialSeed, narrativeStyles, entities, relationships, events, initFromSeed]);

  // Close handler with reset
  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  // Close on escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleClose]);

  // Check if current step is valid for navigation
  const canProceed = useMemo(() => {
    switch (state.step) {
      case 1:
        return state.narrativeStyleId !== null;
      case 2:
        return state.entryPointId !== null;
      case 3:
        // At least one role assignment
        return state.roleAssignments.length > 0;
      case 4:
        // Always can proceed (events/relationships are optional)
        return true;
      case 5:
        return true;
      default:
        return false;
    }
  }, [state]);

  // Handle generate
  const handleGenerate = useCallback(() => {
    if (!state.narrativeStyleId || !state.narrativeStyle || !state.entryPoint) return;

    const config: WizardGenerateConfig = {
      narrativeStyleId: state.narrativeStyleId,
      narrativeStyle: state.narrativeStyle,
      entryPointId: state.entryPoint.id,
      entryPointName: state.entryPoint.name,
      entryPointKind: state.entryPoint.kind,
      roleAssignments: state.roleAssignments,
      selectedEventIds: Array.from(state.selectedEventIds),
      selectedRelationshipIds: Array.from(state.selectedRelationshipIds),
      lens: state.lens || undefined,
      temporalContext,
      temperatureOverride: state.temperatureOverride ?? undefined,
    };

    onGenerate(config);
    handleClose();
  }, [state, onGenerate, handleClose, temporalContext]);

  // Handle next with auto-skip for accept defaults
  const handleNext = useCallback(() => {
    if (state.step === 2 && state.acceptDefaults && state.roleAssignments.length > 0) {
      // Skip step 3 (roles) and step 4 (events) when accepting defaults
      autoFillEventsAndRelationships();
      goToStep(5);
    } else if (state.step === 3 && state.acceptDefaults) {
      // Skip step 4 when accepting defaults
      autoFillEventsAndRelationships();
      goToStep(5);
    } else {
      nextStep();
    }
  }, [state.step, state.acceptDefaults, state.roleAssignments.length, nextStep, goToStep, autoFillEventsAndRelationships]);

  if (!isOpen) return null;

  // Render current step
  const renderStep = () => {
    switch (state.step) {
      case 1:
        return <StyleStep styles={narrativeStyles} />;
      case 2:
        return (
          <EntryPointStep
            entities={entities}
            relationships={relationships}
            events={events}
          />
        );
      case 3:
        return <RoleAssignmentStep />;
      case 4:
        return <EventResolutionStep />;
      case 5:
        return <GenerateStep onGenerate={handleGenerate} />;
      default:
        return null;
    }
  };

  return (
    <div className="illuminator-modal-overlay" onMouseDown={handleOverlayMouseDown} onClick={handleOverlayClick}>
      <div
        className="illuminator-modal"
        style={{ maxWidth: '800px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Header */}
        <div className="illuminator-modal-header">
          <h3>New Chronicle</h3>
          <button onClick={handleClose} className="illuminator-modal-close">&times;</button>
        </div>

        {/* Step Indicator */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '8px',
          padding: '16px',
          borderBottom: '1px solid var(--border-color)',
          background: 'var(--bg-tertiary)',
        }}>
          {([1, 2, 3, 4, 5] as WizardStep[]).map((step) => {
            const isActive = state.step === step;
            const isCompleted = state.step > step;
            const isClickable = isCompleted || step === state.step;

            return (
              <div
                key={step}
                onClick={() => isClickable && goToStep(step)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '16px',
                  fontSize: '12px',
                  fontWeight: isActive ? 600 : 400,
                  cursor: isClickable ? 'pointer' : 'default',
                  background: isActive
                    ? 'var(--accent-color)'
                    : isCompleted
                    ? 'var(--success)'
                    : 'var(--bg-secondary)',
                  color: isActive || isCompleted ? 'white' : 'var(--text-muted)',
                  opacity: isClickable ? 1 : 0.5,
                  transition: 'all 0.2s ease',
                }}
              >
                <span style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: isActive || isCompleted ? 'rgba(255,255,255,0.2)' : 'var(--border-color)',
                  fontSize: '10px',
                }}>
                  {isCompleted ? '✓' : step}
                </span>
                <span>{STEP_LABELS[step]}</span>
              </div>
            );
          })}
        </div>

        {/* Body */}
        <div className="illuminator-modal-body" style={{
          flex: 1,
          overflow: 'auto',
          padding: '20px',
        }}>
          {renderStep()}
        </div>

        {/* Footer */}
        <div className="illuminator-modal-footer" style={{
          padding: '16px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
        }}>
          <button onClick={handleClose} className="illuminator-btn">
            Cancel
          </button>

          <div style={{ display: 'flex', gap: '8px' }}>
            {state.step > 1 && (
              <button onClick={prevStep} className="illuminator-btn">
                Back
              </button>
            )}
            {state.step < 5 ? (
              <button
                onClick={handleNext}
                disabled={!canProceed}
                className="illuminator-btn illuminator-btn-primary"
              >
                Next
              </button>
            ) : (
              <button
                onClick={handleGenerate}
                className="illuminator-btn illuminator-btn-primary"
              >
                Generate Chronicle
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Main Component (wraps with provider)
// =============================================================================

export default function ChronicleWizard(props: ChronicleWizardProps) {
  if (!props.isOpen) return null;

  return (
    <WizardProvider
      entityKinds={props.entityKinds}
      eras={props.eras ?? []}
      simulationRunId={props.simulationRunId}
    >
      <InnerWizard {...props} />
    </WizardProvider>
  );
}
