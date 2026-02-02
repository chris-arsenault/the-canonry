/**
 * WizardContext - Shared state management for the Chronicle Wizard
 *
 * Provides state and actions for all wizard steps.
 */

import { createContext, useContext, useReducer, ReactNode, useMemo, useCallback } from 'react';
import type { NarrativeStyle, EntityKindDefinition, EntityCategory, StoryNarrativeStyle, DocumentNarrativeStyle, RoleDefinition } from '@canonry/world-schema';

/** Get roles from either story or document style */
function getRoles(style: NarrativeStyle | null): RoleDefinition[] {
  if (!style) return [];
  if (style.format === 'story') {
    return (style as StoryNarrativeStyle).roles || [];
  }
  // Document styles have roles directly on the style object
  const docStyle = style as DocumentNarrativeStyle;
  return docStyle.roles || [];
}
import type {
  ChronicleRoleAssignment,
  NarrativeLens,
  EntityContext,
  RelationshipContext,
  NarrativeEventContext,
  EraTemporalInfo,
  ChronicleTemporalContext,
} from '../../lib/chronicleTypes';
import {
  buildWizardSelectionContext,
  suggestRoleAssignments,
  computeAllEntityMetrics,
  computeAllEventMetrics,
  computeTemporalContext,
  computeFocalEra,
  suggestEventSelection,
  getRelevantRelationships,
  getRelevantEvents,
  buildKindToCategoryMap,
  type EntitySelectionMetrics,
  type EventSelectionMetrics,
} from '../../lib/chronicle/selectionWizard';

// =============================================================================
// Types
// =============================================================================

export type WizardStep = 1 | 2 | 3 | 4 | 5;

/**
 * Chronicle seed data for initializing wizard from existing record.
 * Uses the same field names as ChronicleRecord to avoid duplication.
 */
export interface ChronicleSeed {
  narrativeStyleId: string;
  narrativeStyle?: NarrativeStyle;
  entrypointId?: string; // Same field name as ChronicleRecord
  roleAssignments: ChronicleRoleAssignment[];
  lens?: NarrativeLens;
  selectedEventIds: string[];
  selectedRelationshipIds: string[];
}

export interface WizardState {
  step: WizardStep;

  // Step 1: Style selection
  narrativeStyleId: string | null;
  narrativeStyle: NarrativeStyle | null;
  acceptDefaults: boolean;

  // Step 2: Entry point selection
  entryPointId: string | null;
  entryPoint: EntityContext | null;
  /** Include era relationships in 2-hop neighborhood calculation */
  includeErasInNeighborhood: boolean;

  // Step 3: Role assignment
  candidates: EntityContext[];
  /** Distance map from entry point (preserves paths through non-candidate entities) */
  candidateDistances: Map<string, number>;
  roleAssignments: ChronicleRoleAssignment[];
  /** Optional narrative lens - contextual frame entity */
  lens: NarrativeLens | null;

  // Step 4: Event/relationship resolution
  candidateEvents: NarrativeEventContext[];
  candidateRelationships: RelationshipContext[];
  selectedEventIds: Set<string>;
  selectedRelationshipIds: Set<string>;
  /** Manual override for focal era (null = auto-detect) */
  focalEraOverride: string | null;

  // Step 5: Generation settings
  temperatureOverride: number | null;

  // Validation
  isValid: boolean;
  validationErrors: string[];
}

type WizardAction =
  | { type: 'SET_STEP'; step: WizardStep }
  | { type: 'SELECT_STYLE'; style: NarrativeStyle; acceptDefaults: boolean }
  | { type: 'SET_ACCEPT_DEFAULTS'; acceptDefaults: boolean }
  | { type: 'SELECT_ENTRY_POINT'; entity: EntityContext }
  | { type: 'CLEAR_ENTRY_POINT' }
  | { type: 'SET_INCLUDE_ERAS_IN_NEIGHBORHOOD'; include: boolean }
  | { type: 'SET_CANDIDATES'; candidates: EntityContext[]; relationships: RelationshipContext[]; events: NarrativeEventContext[]; distances: Map<string, number> }
  | { type: 'SET_ROLE_ASSIGNMENTS'; assignments: ChronicleRoleAssignment[] }
  | { type: 'ADD_ROLE_ASSIGNMENT'; assignment: ChronicleRoleAssignment }
  | { type: 'REMOVE_ROLE_ASSIGNMENT'; entityId: string; role: string }
  | { type: 'TOGGLE_PRIMARY'; entityId: string; role: string }
  | { type: 'SET_LENS'; lens: NarrativeLens }
  | { type: 'CLEAR_LENS' }
  | { type: 'TOGGLE_EVENT'; eventId: string }
  | { type: 'TOGGLE_RELATIONSHIP'; relationshipId: string }
  | { type: 'SELECT_ALL_EVENTS'; eventIds: string[] }
  | { type: 'DESELECT_ALL_EVENTS' }
  | { type: 'SELECT_ALL_RELATIONSHIPS'; relationshipIds: string[] }
  | { type: 'DESELECT_ALL_RELATIONSHIPS' }
  | { type: 'SET_FOCAL_ERA_OVERRIDE'; eraId: string | null }
  | { type: 'SET_TEMPERATURE_OVERRIDE'; temperature: number | null }
  | { type: 'RESET' }
  | { type: 'INIT_FROM_SEED'; seed: ChronicleSeed; style: NarrativeStyle; entryPoint: EntityContext; candidates: EntityContext[]; relationships: RelationshipContext[]; events: NarrativeEventContext[] };

// =============================================================================
// Initial State
// =============================================================================

const initialState: WizardState = {
  step: 1,
  narrativeStyleId: null,
  narrativeStyle: null,
  acceptDefaults: false,
  entryPointId: null,
  entryPoint: null,
  includeErasInNeighborhood: false,
  candidates: [],
  candidateDistances: new Map(),
  roleAssignments: [],
  lens: null,
  candidateEvents: [],
  candidateRelationships: [],
  selectedEventIds: new Set(),
  selectedRelationshipIds: new Set(),
  focalEraOverride: null,
  temperatureOverride: null,
  isValid: false,
  validationErrors: [],
};

// =============================================================================
// Reducer
// =============================================================================

function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, step: action.step };

    case 'SELECT_STYLE':
      return {
        ...state,
        narrativeStyleId: action.style.id,
        narrativeStyle: action.style,
        acceptDefaults: action.acceptDefaults,
        // Reset downstream selections when style changes
        entryPointId: null,
        entryPoint: null,
        candidates: [],
        candidateDistances: new Map(),
        roleAssignments: [],
        lens: null,
        candidateEvents: [],
        candidateRelationships: [],
        selectedEventIds: new Set(),
        selectedRelationshipIds: new Set(),
      };

    case 'SET_ACCEPT_DEFAULTS':
      return {
        ...state,
        acceptDefaults: action.acceptDefaults,
      };

    case 'SELECT_ENTRY_POINT':
      return {
        ...state,
        entryPointId: action.entity.id,
        entryPoint: action.entity,
        // Reset downstream selections when entry point changes
        candidates: [],
        candidateDistances: new Map(),
        roleAssignments: [],
        lens: null,
        candidateEvents: [],
        candidateRelationships: [],
        selectedEventIds: new Set(),
        selectedRelationshipIds: new Set(),
      };

    case 'CLEAR_ENTRY_POINT':
      return {
        ...state,
        entryPointId: null,
        entryPoint: null,
        candidates: [],
        candidateDistances: new Map(),
        roleAssignments: [],
        lens: null,
        candidateEvents: [],
        candidateRelationships: [],
        selectedEventIds: new Set(),
        selectedRelationshipIds: new Set(),
      };

    case 'SET_INCLUDE_ERAS_IN_NEIGHBORHOOD':
      return {
        ...state,
        includeErasInNeighborhood: action.include,
        // Clear candidates when this changes - will need to re-select entry point
        candidates: [],
        candidateDistances: new Map(),
        roleAssignments: [],
        lens: null,
        candidateEvents: [],
        candidateRelationships: [],
        selectedEventIds: new Set(),
        selectedRelationshipIds: new Set(),
      };

    case 'SET_CANDIDATES':
      return {
        ...state,
        candidates: action.candidates,
        candidateDistances: action.distances,
        candidateRelationships: action.relationships,
        candidateEvents: action.events,
      };

    case 'SET_ROLE_ASSIGNMENTS':
      return {
        ...state,
        roleAssignments: action.assignments,
      };

    case 'ADD_ROLE_ASSIGNMENT':
      // Prevent duplicates
      if (state.roleAssignments.some(
        a => a.entityId === action.assignment.entityId && a.role === action.assignment.role
      )) {
        return state;
      }
      return {
        ...state,
        roleAssignments: [...state.roleAssignments, action.assignment],
      };

    case 'REMOVE_ROLE_ASSIGNMENT':
      return {
        ...state,
        roleAssignments: state.roleAssignments.filter(
          a => !(a.entityId === action.entityId && a.role === action.role)
        ),
      };

    case 'TOGGLE_PRIMARY': {
      return {
        ...state,
        roleAssignments: state.roleAssignments.map(a =>
          a.entityId === action.entityId && a.role === action.role
            ? { ...a, isPrimary: !a.isPrimary }
            : a
        ),
      };
    }

    case 'SET_LENS':
      return { ...state, lens: action.lens };

    case 'CLEAR_LENS':
      return { ...state, lens: null };

    case 'TOGGLE_EVENT': {
      const newSet = new Set(state.selectedEventIds);
      if (newSet.has(action.eventId)) {
        newSet.delete(action.eventId);
      } else {
        newSet.add(action.eventId);
      }
      return { ...state, selectedEventIds: newSet };
    }

    case 'TOGGLE_RELATIONSHIP': {
      const newSet = new Set(state.selectedRelationshipIds);
      if (newSet.has(action.relationshipId)) {
        newSet.delete(action.relationshipId);
      } else {
        newSet.add(action.relationshipId);
      }
      return { ...state, selectedRelationshipIds: newSet };
    }

    case 'SELECT_ALL_EVENTS':
      return {
        ...state,
        selectedEventIds: new Set(action.eventIds),
      };

    case 'DESELECT_ALL_EVENTS':
      return { ...state, selectedEventIds: new Set() };

    case 'SELECT_ALL_RELATIONSHIPS':
      return {
        ...state,
        selectedRelationshipIds: new Set(action.relationshipIds),
      };

    case 'DESELECT_ALL_RELATIONSHIPS':
      return { ...state, selectedRelationshipIds: new Set() };

    case 'SET_FOCAL_ERA_OVERRIDE':
      return { ...state, focalEraOverride: action.eraId };

    case 'SET_TEMPERATURE_OVERRIDE':
      return { ...state, temperatureOverride: action.temperature };

    case 'RESET':
      return initialState;

    case 'INIT_FROM_SEED':
      return {
        ...initialState,
        step: 5, // Go directly to generate step for review
        narrativeStyleId: action.seed.narrativeStyleId,
        narrativeStyle: action.style,
        acceptDefaults: false,
        entryPointId: action.seed.entrypointId ?? null,
        entryPoint: action.entryPoint,
        candidates: action.candidates,
        roleAssignments: action.seed.roleAssignments,
        lens: action.seed.lens || null,
        candidateEvents: action.events,
        candidateRelationships: action.relationships,
        selectedEventIds: new Set(action.seed.selectedEventIds),
        selectedRelationshipIds: new Set(action.seed.selectedRelationshipIds),
        isValid: true,
        validationErrors: [],
      };

    default:
      return state;
  }
}

// =============================================================================
// Context
// =============================================================================

interface WizardContextValue {
  state: WizardState;
  dispatch: React.Dispatch<WizardAction>;
  /** Current simulation run for usage stats */
  simulationRunId: string;

  /**
   * Mapping from entity kinds to their categories.
   * Used by step components to check if entities match primary/supporting subject categories.
   */
  kindToCategory: Map<string, EntityCategory>;

  // Navigation
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (step: WizardStep) => void;

  // Step 1 actions
  selectStyle: (style: NarrativeStyle, acceptDefaults: boolean) => void;
  setAcceptDefaults: (acceptDefaults: boolean) => void;

  // Step 2 actions
  selectEntryPoint: (entity: EntityContext, allEntities: EntityContext[], allRelationships: RelationshipContext[], allEvents: NarrativeEventContext[]) => void;
  clearEntryPoint: () => void;
  setIncludeErasInNeighborhood: (include: boolean) => void;

  // Step 3 actions
  autoFillRoles: (metricsMap?: Map<string, EntitySelectionMetrics>) => void;
  addRoleAssignment: (assignment: ChronicleRoleAssignment) => void;
  removeRoleAssignment: (entityId: string, role: string) => void;
  togglePrimary: (entityId: string, role: string) => void;
  setLens: (lens: NarrativeLens) => void;
  clearLens: () => void;

  // Metrics computation helpers
  computeMetrics: (usageStats: Map<string, { usageCount: number }>) => Map<string, EntitySelectionMetrics>;
  computeEventMetricsForSelection: () => Map<string, EventSelectionMetrics>;

  // Temporal context
  temporalContext: ChronicleTemporalContext | null;
  /** The era detected from event distribution (before any override) */
  detectedFocalEra: EraTemporalInfo | null;
  eras: EraTemporalInfo[];
  /** Set manual override for focal era (null to clear and use auto-detection) */
  setFocalEraOverride: (eraId: string | null) => void;
  setTemperatureOverride: (temperature: number | null) => void;

  // Step 4 actions
  autoFillEvents: (preferFocalEra?: boolean) => void;
  /** Auto-select all relevant events and relationships (used when skipping step 4) */
  autoFillEventsAndRelationships: () => void;
  toggleEvent: (eventId: string) => void;
  toggleRelationship: (relationshipId: string) => void;
  selectAllEvents: (eventIds: string[]) => void;
  deselectAllEvents: () => void;
  selectAllRelationships: (relationshipIds: string[]) => void;
  deselectAllRelationships: () => void;

  // Reset / Initialize
  reset: () => void;
  initFromSeed: (
    seed: ChronicleSeed,
    style: NarrativeStyle,
    entryPoint: EntityContext,
    allEntities: EntityContext[],
    allRelationships: RelationshipContext[],
    allEvents: NarrativeEventContext[]
  ) => void;
}

const WizardContext = createContext<WizardContextValue | null>(null);

// =============================================================================
// Provider
// =============================================================================

interface WizardProviderProps {
  children: ReactNode;
  /** Entity kind definitions from the domain schema, used for category mapping */
  entityKinds: EntityKindDefinition[];
  /** Era definitions with tick ranges for temporal alignment (optional - temporal features disabled if not provided) */
  eras?: EraTemporalInfo[];
  /** Simulation run id for usage stats */
  simulationRunId: string;
}

export function WizardProvider({ children, entityKinds, eras = [], simulationRunId }: WizardProviderProps) {
  const [state, dispatch] = useReducer(wizardReducer, initialState);

  // Build kind-to-category mapping
  const kindToCategory = useMemo(
    () => buildKindToCategoryMap(entityKinds),
    [entityKinds]
  );

  // Compute ALL relevant events (unlimited) for focal era computation
  // This includes all events involving assigned entities, not just top 20
  const allRelevantEvents = useMemo(() => {
    const events = getRelevantEvents(
      state.roleAssignments,
      state.candidateEvents,
      state.narrativeStyle?.eventRules,
      { skipLimit: true }
    );
    return events;
  }, [state.roleAssignments, state.candidateEvents, state.narrativeStyle?.eventRules]);

  // Compute detected focal era from ALL relevant events (not just top 20)
  const detectedFocalEra = useMemo<EraTemporalInfo | null>(() => {
    if (eras.length === 0) return null;
    return computeFocalEra(allRelevantEvents, eras) || null;
  }, [eras, allRelevantEvents]);

  // Compute effective focal era (respecting override)
  const effectiveFocalEraId = useMemo(() => {
    return state.focalEraOverride || detectedFocalEra?.id || eras[0]?.id || '';
  }, [state.focalEraOverride, detectedFocalEra, eras]);

  // Compute temporal context from selected events, but align focal era to the dropdown choice
  const temporalContext = useMemo<ChronicleTemporalContext | null>(() => {
    if (eras.length === 0) return null;

    // Get selected events for temporal computation
    const selectedEvents = state.candidateEvents.filter(
      e => state.selectedEventIds.has(e.id)
    );

    return computeTemporalContext(
      selectedEvents,
      eras,
      state.entryPoint || undefined,
      effectiveFocalEraId
    );
  }, [eras, state.candidateEvents, state.selectedEventIds, state.entryPoint, effectiveFocalEraId]);

  // Navigation
  const nextStep = useCallback(() => {
    if (state.step < 5) {
      dispatch({ type: 'SET_STEP', step: (state.step + 1) as WizardStep });
    }
  }, [state.step]);

  const prevStep = useCallback(() => {
    if (state.step > 1) {
      dispatch({ type: 'SET_STEP', step: (state.step - 1) as WizardStep });
    }
  }, [state.step]);

  const goToStep = useCallback((step: WizardStep) => {
    dispatch({ type: 'SET_STEP', step });
  }, []);

  // Step 1: Style selection
  const selectStyle = useCallback((style: NarrativeStyle, acceptDefaults: boolean) => {
    dispatch({ type: 'SELECT_STYLE', style, acceptDefaults });
  }, []);

  const setAcceptDefaults = useCallback((acceptDefaults: boolean) => {
    dispatch({ type: 'SET_ACCEPT_DEFAULTS', acceptDefaults });
  }, []);

  // Step 2: Entry point selection
  const selectEntryPoint = useCallback((
    entity: EntityContext,
    allEntities: EntityContext[],
    allRelationships: RelationshipContext[],
    allEvents: NarrativeEventContext[]
  ) => {
    dispatch({ type: 'SELECT_ENTRY_POINT', entity });

    // Build selection context for this entry point
    if (state.narrativeStyle) {
      const selectionContext = buildWizardSelectionContext(
        entity,
        allEntities,
        allRelationships,
        allEvents,
        state.narrativeStyle,
        { includeErasInNeighborhood: state.includeErasInNeighborhood }
      );

      dispatch({
        type: 'SET_CANDIDATES',
        candidates: selectionContext.candidates,
        relationships: selectionContext.candidateRelationships,
        events: selectionContext.candidateEvents,
        distances: selectionContext.distances,
      });

      // Auto-fill if accept defaults is checked
      if (state.acceptDefaults) {
        const roles = getRoles(state.narrativeStyle);
        const suggested = suggestRoleAssignments(
          selectionContext.candidates,
          roles,
          entity.id,
          undefined, // entityRules removed
          selectionContext.candidateRelationships,
          kindToCategory
        );
        dispatch({ type: 'SET_ROLE_ASSIGNMENTS', assignments: suggested });
      }
    }
  }, [state.narrativeStyle, state.acceptDefaults, state.includeErasInNeighborhood, kindToCategory]);

  // Clear entry point
  const clearEntryPoint = useCallback(() => {
    dispatch({ type: 'CLEAR_ENTRY_POINT' });
  }, []);

  // Set include eras in neighborhood option
  const setIncludeErasInNeighborhood = useCallback((include: boolean) => {
    dispatch({ type: 'SET_INCLUDE_ERAS_IN_NEIGHBORHOOD', include });
  }, []);

  // Compute metrics helper - uses stored distances from original graph construction
  const computeMetrics = useCallback((usageStats: Map<string, { usageCount: number }>) => {
    if (!state.entryPoint) return new Map<string, EntitySelectionMetrics>();

    return computeAllEntityMetrics(
      state.candidates,
      state.entryPoint.id,
      state.candidateRelationships,
      state.candidateDistances,
      usageStats,
      state.roleAssignments,
      kindToCategory
    );
  }, [state.entryPoint, state.candidates, state.candidateRelationships, state.candidateDistances, state.roleAssignments, kindToCategory]);

  // Compute event metrics for selection
  const computeEventMetricsForSelection = useCallback(() => {
    if (!state.entryPoint || eras.length === 0) {
      return new Map<string, EventSelectionMetrics>();
    }

    // Get assigned entity IDs
    const assignedEntityIds = new Set(state.roleAssignments.map(a => a.entityId));

    return computeAllEventMetrics(
      state.candidateEvents,
      state.entryPoint.id,
      state.entryPoint.createdAt,
      effectiveFocalEraId,
      eras,
      assignedEntityIds
    );
  }, [state.entryPoint, state.candidateEvents, state.roleAssignments, eras, effectiveFocalEraId]);

  // Auto-fill events based on temporal alignment
  const autoFillEvents = useCallback((preferFocalEra: boolean = true) => {
    const metricsMap = computeEventMetricsForSelection();

    // Get relevant events (those involving assigned entities)
    const relevantEvents = getRelevantEvents(
      state.roleAssignments,
      state.candidateEvents,
      state.narrativeStyle?.eventRules
    );

    const suggestedEventIds = suggestEventSelection(
      relevantEvents,
      metricsMap,
      8, // maxEvents
      preferFocalEra
    );

    dispatch({ type: 'SELECT_ALL_EVENTS', eventIds: suggestedEventIds });
  }, [computeEventMetricsForSelection, state.roleAssignments, state.candidateEvents, state.narrativeStyle]);

  // Auto-fill all events and relationships (used when skipping step 4 with defaults)
  const autoFillEventsAndRelationships = useCallback(() => {
    // Get all relevant relationships
    const relevantRelationships = getRelevantRelationships(
      state.roleAssignments,
      state.candidateRelationships
    );
    const relationshipIds = relevantRelationships.map(
      r => `${r.src}:${r.dst}:${r.kind}`
    );

    // Get all relevant events
    const relevantEvents = getRelevantEvents(
      state.roleAssignments,
      state.candidateEvents,
      state.narrativeStyle?.eventRules
    );
    const eventIds = relevantEvents.map(e => e.id);

    // Select all
    dispatch({ type: 'SELECT_ALL_RELATIONSHIPS', relationshipIds });
    dispatch({ type: 'SELECT_ALL_EVENTS', eventIds });
  }, [state.roleAssignments, state.candidateRelationships, state.candidateEvents, state.narrativeStyle]);

  // Step 3: Auto-fill roles
  const autoFillRoles = useCallback((metricsMap?: Map<string, EntitySelectionMetrics>) => {
    if (!state.narrativeStyle || !state.entryPoint) return;

    const roles = getRoles(state.narrativeStyle);
    const suggested = suggestRoleAssignments(
      state.candidates,
      roles,
      state.entryPoint.id,
      undefined, // entityRules removed
      state.candidateRelationships,
      kindToCategory,
      metricsMap
    );
    dispatch({ type: 'SET_ROLE_ASSIGNMENTS', assignments: suggested });
  }, [state.narrativeStyle, state.entryPoint, state.candidates, state.candidateRelationships, kindToCategory]);

  const addRoleAssignment = useCallback((assignment: ChronicleRoleAssignment) => {
    dispatch({ type: 'ADD_ROLE_ASSIGNMENT', assignment });
  }, []);

  const removeRoleAssignment = useCallback((entityId: string, role: string) => {
    dispatch({ type: 'REMOVE_ROLE_ASSIGNMENT', entityId, role });
  }, []);

  const togglePrimary = useCallback((entityId: string, role: string) => {
    dispatch({ type: 'TOGGLE_PRIMARY', entityId, role });
  }, []);

  // Lens actions
  const setLens = useCallback((lens: NarrativeLens) => {
    dispatch({ type: 'SET_LENS', lens });
  }, []);

  const clearLens = useCallback(() => {
    dispatch({ type: 'CLEAR_LENS' });
  }, []);

  // Step 4: Event/relationship selection
  const toggleEvent = useCallback((eventId: string) => {
    dispatch({ type: 'TOGGLE_EVENT', eventId });
  }, []);

  const toggleRelationship = useCallback((relationshipId: string) => {
    dispatch({ type: 'TOGGLE_RELATIONSHIP', relationshipId });
  }, []);

  const selectAllEvents = useCallback((eventIds: string[]) => {
    dispatch({ type: 'SELECT_ALL_EVENTS', eventIds });
  }, []);

  const deselectAllEvents = useCallback(() => {
    dispatch({ type: 'DESELECT_ALL_EVENTS' });
  }, []);

  const selectAllRelationships = useCallback((relationshipIds: string[]) => {
    dispatch({ type: 'SELECT_ALL_RELATIONSHIPS', relationshipIds });
  }, []);

  const deselectAllRelationships = useCallback(() => {
    dispatch({ type: 'DESELECT_ALL_RELATIONSHIPS' });
  }, []);

  // Focal era override
  const setFocalEraOverride = useCallback((eraId: string | null) => {
    dispatch({ type: 'SET_FOCAL_ERA_OVERRIDE', eraId });
  }, []);

  // Temperature override
  const setTemperatureOverride = useCallback((temperature: number | null) => {
    dispatch({ type: 'SET_TEMPERATURE_OVERRIDE', temperature });
  }, []);

  // Reset
  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  // Initialize from existing chronicle seed
  const initFromSeed = useCallback((
    seed: ChronicleSeed,
    style: NarrativeStyle,
    entryPoint: EntityContext,
    allEntities: EntityContext[],
    allRelationships: RelationshipContext[],
    allEvents: NarrativeEventContext[]
  ) => {
    // Get relevant candidates/events/relationships based on entry point
    const selectionContext = buildWizardSelectionContext(
      entryPoint,
      allEntities,
      allRelationships,
      allEvents,
      style
    );

    dispatch({
      type: 'INIT_FROM_SEED',
      seed,
      style,
      entryPoint,
      candidates: selectionContext.candidates,
      relationships: selectionContext.candidateRelationships,
      events: selectionContext.candidateEvents,
    });
  }, []);

  const value = useMemo<WizardContextValue>(() => ({
    state,
    dispatch,
    simulationRunId,
    kindToCategory,
    nextStep,
    prevStep,
    goToStep,
    selectStyle,
    setAcceptDefaults,
    selectEntryPoint,
    clearEntryPoint,
    setIncludeErasInNeighborhood,
    autoFillRoles,
    addRoleAssignment,
    removeRoleAssignment,
    togglePrimary,
    setLens,
    clearLens,
    computeMetrics,
    computeEventMetricsForSelection,
    temporalContext,
    detectedFocalEra,
    eras,
    setFocalEraOverride,
    setTemperatureOverride,
    autoFillEvents,
    autoFillEventsAndRelationships,
    toggleEvent,
    toggleRelationship,
    selectAllEvents,
    deselectAllEvents,
    selectAllRelationships,
    deselectAllRelationships,
    reset,
    initFromSeed,
  }), [
    state,
    simulationRunId,
    kindToCategory,
    nextStep,
    prevStep,
    goToStep,
    selectStyle,
    setAcceptDefaults,
    selectEntryPoint,
    clearEntryPoint,
    setIncludeErasInNeighborhood,
    autoFillRoles,
    addRoleAssignment,
    removeRoleAssignment,
    togglePrimary,
    setLens,
    clearLens,
    computeMetrics,
    computeEventMetricsForSelection,
    temporalContext,
    detectedFocalEra,
    eras,
    setFocalEraOverride,
    setTemperatureOverride,
    autoFillEvents,
    autoFillEventsAndRelationships,
    toggleEvent,
    toggleRelationship,
    selectAllEvents,
    deselectAllEvents,
    selectAllRelationships,
    deselectAllRelationships,
    reset,
    initFromSeed,
  ]);

  return (
    <WizardContext.Provider value={value}>
      {children}
    </WizardContext.Provider>
  );
}

// =============================================================================
// Hook
// =============================================================================

export function useWizard(): WizardContextValue {
  const context = useContext(WizardContext);
  if (!context) {
    throw new Error('useWizard must be used within a WizardProvider');
  }
  return context;
}
