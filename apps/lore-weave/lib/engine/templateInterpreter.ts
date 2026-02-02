/**
 * Template Interpreter
 *
 * Executes declarative templates without custom TypeScript code.
 * Templates are pure JSON data; this interpreter provides the execution logic.
 */

import type { HardState, Relationship } from '../core/worldTypes';
import type { WorldRuntime } from '../runtime/worldRuntime';
import type { TemplateResult, PlacementDebug } from './types';
import { pickRandom } from '../utils';
import type { Point } from '../coordinates/types';
// Rules library imports - unified source for filters, conditions, mutations
import {
  selectEntities as rulesSelectEntities,
  selectVariableEntities as rulesSelectVariableEntities,
  resolveSingleVariable,
  describeSelectionFilter as rulesDescribeSelectionFilter,
  evaluateGraphPath as sharedEvaluateGraphPath,
  evaluateCondition as rulesEvaluateCondition,
  applySelectionFilters,
  applyMutation,
  createRuleContext,
  prominenceThreshold,
} from '../rules';
import type { EntityResolver, SelectionTrace, Condition, Mutation, RuleContext } from '../rules';
// Narration is generated in growthSystem AFTER entities have names
// import { interpolate, createGeneratorContext } from '../narrative/narrationTemplate';

import type {
  DeclarativeTemplate,
  ApplicabilityRule,
  SelectionRule,
  SelectionFilter,
  SaturationLimit,
  CreationRule,
  RelationshipRule,
  StateUpdateRule,
  VariableDefinition,
  SubtypeSpec,
  SubtypeCondition,
  CultureSpec,
  DescriptionSpec,
  PlacementSpec,
  PlacementAnchor,
  PlacementSpacing,
  PlacementRegionPolicy,
  CountRange,
  RelationshipCondition,
  GraphPathAssertion,
  ExecutionContext as IExecutionContext,
  TemplateVariants,
  TemplateVariant,
  VariantCondition,
  VariantEffects
} from './declarativeTypes';

// =============================================================================
// SELECTION DIAGNOSIS TYPE
// =============================================================================

/**
 * Diagnostic information about why selection returned no targets.
 */
export interface SelectionDiagnosis {
  strategy: string;
  targetKind: string;
  filterSteps: Array<{
    description: string;
    remaining: number;
  }>;
}

/**
 * Diagnostic information about why a required variable failed to resolve.
 */
export interface VariableDiagnosis {
  name: string;
  fromType: 'graph' | 'related' | 'path';
  kind?: string;
  relationshipKind?: string;
  relatedTo?: string;
  filterSteps: Array<{
    description: string;
    remaining: number;
  }>;
}

// =============================================================================
// EXECUTION CONTEXT
// =============================================================================

/**
 * Context maintained during template execution.
 * Holds resolved variables and provides utility methods.
 * Implements EntityResolver for use with shared selection filters.
 */
class ExecutionContext implements IExecutionContext, EntityResolver {
  graphView: WorldRuntime;
  variables: Map<string, HardState | HardState[] | undefined> = new Map();
  target?: HardState;
  pathSets: Map<string, Set<string>> = new Map();
  /** Current template being executed (for error context) */
  templateId?: string;

  constructor(graphView: WorldRuntime) {
    this.graphView = graphView;
  }

  set(name: string, value: HardState | HardState[] | undefined): void {
    this.variables.set(name, value);
  }

  get(name: string): HardState | HardState[] | undefined {
    return this.variables.get(name);
  }

  setPathSet(name: string, ids: Set<string>): void {
    this.pathSets.set(name, ids);
  }

  getPathSet(name: string): Set<string> | undefined {
    return this.pathSets.get(name);
  }

  /** EntityResolver interface */
  getGraphView(): WorldRuntime {
    return this.graphView;
  }

  /**
   * Resolve an entity reference to an actual entity.
   * Supports:
   *   - "$target" -> the selected target
   *   - "$varName" -> resolved variable
   *   - "$varName.property" -> property access (for .name, .id, etc.)
   */
  resolveEntity(ref: string): HardState | undefined {
    if (!ref.startsWith('$')) {
      // Literal entity ID
      return this.graphView.getEntity(ref);
    }

    const parts = ref.slice(1).split('.');
    const varName = parts[0];

    if (varName === 'target') {
      return this.target;
    }

    if (varName === 'self') {
      // $self is handled specially in filter evaluation
      return undefined;
    }

    const value = this.variables.get('$' + varName);
    if (Array.isArray(value)) {
      return value[0];  // Return first if array
    }
    return value;
  }

  /**
   * Resolve a string reference that might contain variable substitutions.
   * Supports fallback syntax: "{$location.name|unknown location}" or "$location.name|unknown location"
   */
  resolveString(ref: string): string {
    if (!ref.includes('$')) {
      return ref;
    }

    let result = ref;

    // Handle fallback syntax: {$var.prop|fallback} or $var.prop|fallback
    // This regex finds patterns like {$location.name|the frozen depths} or $location.name|fallback
    const fallbackPattern = /\{?\$(\w+)\.(\w+)\|([^}]+)\}?/g;
    let fallbackMatch;
    while ((fallbackMatch = fallbackPattern.exec(ref)) !== null) {
      const [fullMatch, varPart, propPart, fallback] = fallbackMatch;
      const entity = varPart === 'target' ? this.target : this.resolveEntity('$' + varPart);
      if (entity && propPart in entity) {
        result = result.replace(fullMatch, String((entity as unknown as Record<string, unknown>)[propPart]));
      } else {
        // Use the fallback value - no warning needed since fallback was provided
        result = result.replace(fullMatch, fallback);
      }
    }

    // Handle property access WITHOUT fallback like "$target.name"
    const match = result.match(/\$(\w+)\.(\w+)/g);
    if (match) {
      for (const m of match) {
        const [varPart, propPart] = m.slice(1).split('.');
        const entity = varPart === 'target' ? this.target : this.resolveEntity('$' + varPart);
        if (entity && propPart in entity) {
          result = result.replace(m, String((entity as unknown as Record<string, unknown>)[propPart]));
        } else {
          // Warn: unresolved variable reference without fallback
          const templateCtx = this.templateId ? ` in template "${this.templateId}"` : '';
          console.warn(`[Template] Unresolved variable ${m}${templateCtx}. Add fallback like {${m.slice(1)}|default} or define ${varPart} in variables.`);
        }
      }
    }

    return result;
  }
}

// =============================================================================
// APPLICABILITY RULE TO CONDITION CONVERTER
// =============================================================================

// Converter functions removed - ApplicabilityRule is now an alias for Condition,
// and StateUpdateRule is now an alias for Mutation from the rules/ library.

// =============================================================================
// TEMPLATE INTERPRETER
// =============================================================================

/**
 * Interprets and executes declarative templates.
 */
export class TemplateInterpreter {
  constructor() {}

  /**
   * Check if a template can be applied.
   *
   * A template can apply when:
   *   1. All explicit applicability rules pass
   *   2. AND the selection returns at least one valid target
   *   3. AND all required variables can be resolved
   *
   * This means graph_path rules only need to be in selection, not duplicated
   * in applicability.
   */
  canApply(template: DeclarativeTemplate, graphView: WorldRuntime): boolean {
    const context = new ExecutionContext(graphView);

    // First check explicit applicability rules (pressure, era, counts, etc.)
    if (!this.evaluateApplicability(template.applicability, context)) {
      return false;
    }

    // Then check if any target can satisfy required variables
    const targets = this.findTargets(template, graphView);
    return targets.length > 0;
  }

  /**
   * Diagnose why a template can't apply.
   * Returns detailed information about which checks failed.
   */
  diagnoseCanApply(template: DeclarativeTemplate, graphView: WorldRuntime): {
    canApply: boolean;
    applicabilityPassed: boolean;
    failedRules: string[];
    selectionCount: number;
    selectionStrategy: string;
    selectionDiagnosis?: SelectionDiagnosis;
    requiredVariablesPassed: boolean;
    failedVariables: string[];
    failedVariableDiagnoses: VariableDiagnosis[];
  } {
    const context = new ExecutionContext(graphView);
    const failedRules: string[] = [];

    // Check each applicability rule individually
    const rules = template.applicability || [];
    for (const rule of rules) {
      if (!this.evaluateApplicabilityRule(rule, context)) {
        failedRules.push(this.describeRuleFailure(rule, context));
      }
    }

    const applicabilityPassed = failedRules.length === 0;

    // Check selection if applicability passed
    let selectionCount = 0;
    let selectionStrategy = 'none';
    let selectionDiagnosis: SelectionDiagnosis | undefined;
    let targets: HardState[] = [];
    if (applicabilityPassed && template.selection) {
      targets = this.executeSelection(template.selection, context);
      selectionCount = targets.length;
      selectionStrategy = template.selection.strategy || 'random';

      // If no targets found, get detailed diagnosis
      if (selectionCount === 0) {
        selectionDiagnosis = this.diagnoseSelection(template.selection, context);
      }
    }

    // Check required variables if selection passed
    const failedVariables: string[] = [];
    const failedVariableDiagnoses: VariableDiagnosis[] = [];
    let requiredVariablesPassed = true;
    if (applicabilityPassed && selectionCount > 0 && template.variables) {
      const requiredVariables = this.getRequiredVariableEntries(template);
      if (requiredVariables.length > 0) {
        const hasValidTarget = targets.some((target) =>
          this.targetResolvesRequiredVariables(requiredVariables, graphView, target)
        );
        if (!hasValidTarget) {
          requiredVariablesPassed = false;
          context.target = targets[0];
          context.set('$target', targets[0]);

          for (const [name, def] of requiredVariables) {
            const resolved = this.resolveVariable(def, context);
            if (!resolved || (Array.isArray(resolved) && resolved.length === 0)) {
              failedVariables.push(name);
              failedVariableDiagnoses.push(this.diagnoseVariable(name, def, context));
            } else {
              // Store for subsequent variable resolution
              context.set(name, resolved);
            }
          }
        }
      }
    }

    return {
      canApply: applicabilityPassed && selectionCount > 0 && requiredVariablesPassed,
      applicabilityPassed,
      failedRules,
      selectionCount,
      selectionStrategy,
      selectionDiagnosis,
      requiredVariablesPassed,
      failedVariables,
      failedVariableDiagnoses
    };
  }

  /**
   * Diagnose why selection returned no targets.
   * Tracks entity counts through each filtering step.
   */
  private diagnoseSelection(rule: SelectionRule, context: ExecutionContext): SelectionDiagnosis {
    const trace: SelectionTrace = { steps: [] };
    const ruleCtx = createRuleContext(context.graphView, context, context.target);
    rulesSelectEntities(rule, ruleCtx, trace);

    return {
      strategy: rule.strategy,
      targetKind: rule.kind ?? rule.kinds?.join('/') ?? 'unknown',
      filterSteps: trace.steps,
    };
  }

  /**
   * Diagnose why a variable failed to resolve.
   * Tracks entity counts through each filtering step.
   */
  private diagnoseVariable(
    name: string,
    def: VariableDefinition,
    context: ExecutionContext
  ): VariableDiagnosis {
    const { select } = def;
    const trace: SelectionTrace = { steps: [] };
    const ruleCtx = createRuleContext(context.graphView, context, context.target);
    rulesSelectVariableEntities(select, ruleCtx, trace);

    const fromSpec = select.from;
    const isFromGraph = !fromSpec || fromSpec === 'graph';
    const isFromPath = fromSpec && typeof fromSpec === 'object' && 'path' in fromSpec;
    const isFromRelated = fromSpec && typeof fromSpec === 'object' && 'relatedTo' in fromSpec;

    return {
      name,
      fromType: isFromGraph ? 'graph' : isFromPath ? 'path' : 'related',
      kind: select.kind,
      relationshipKind: isFromRelated ? fromSpec.relationshipKind : undefined,
      relatedTo: isFromRelated ? fromSpec.relatedTo : undefined,
      filterSteps: trace.steps,
    };
  }

  /**
   * Describe a selection filter for diagnostic output.
   */
  private describeSelectionFilter(filter: SelectionFilter): string {
    return rulesDescribeSelectionFilter(filter);
  }

  /**
   * Describe why a specific applicability rule failed.
   */
  private describeRuleFailure(rule: ApplicabilityRule, context: ExecutionContext): string {
    const ruleCtx = createRuleContext(context.graphView, context, context.target);
    const result = rulesEvaluateCondition(rule, ruleCtx);
    return result.diagnostic;
  }

  /**
   * Find valid targets for a template.
   */
  findTargets(template: DeclarativeTemplate, graphView: WorldRuntime): HardState[] {
    const context = new ExecutionContext(graphView);
    const targets = this.executeSelection(template.selection, context);
    return this.filterTargetsByRequiredVariables(template, graphView, targets);
  }

  private getRequiredVariableEntries(
    template: DeclarativeTemplate
  ): Array<[string, VariableDefinition]> {
    if (!template.variables) return [];
    return Object.entries(template.variables).filter(([, def]) => def.required);
  }

  private filterTargetsByRequiredVariables(
    template: DeclarativeTemplate,
    graphView: WorldRuntime,
    targets: HardState[]
  ): HardState[] {
    const requiredVariables = this.getRequiredVariableEntries(template);
    if (requiredVariables.length === 0) return targets;

    return targets.filter((target) =>
      this.targetResolvesRequiredVariables(requiredVariables, graphView, target)
    );
  }

  private targetResolvesRequiredVariables(
    requiredVariables: Array<[string, VariableDefinition]>,
    graphView: WorldRuntime,
    target: HardState
  ): boolean {
    const context = new ExecutionContext(graphView);
    context.target = target;
    context.set('$target', target);

    for (const [name, def] of requiredVariables) {
      const resolved = this.resolveVariable(def, context);
      if (!resolved || (Array.isArray(resolved) && resolved.length === 0)) {
        return false;
      }
      context.set(name, resolved);
    }

    return true;
  }

  /**
   * Execute a template and return the result.
   */
  async expand(
    template: DeclarativeTemplate,
    graphView: WorldRuntime,
    target?: HardState
  ): Promise<TemplateResult> {
    const context = new ExecutionContext(graphView);
    context.templateId = template.id;
    context.target = target;
    context.set('$target', target);

    // Resolve variables
    const unresolvedVariables: Array<{
      name: string;
      required: boolean;
      diagnosis: VariableDiagnosis;
    }> = [];
    if (template.variables) {
      for (const [name, def] of Object.entries(template.variables)) {
        const resolved = this.resolveVariable(def, context);
        if (!resolved || (Array.isArray(resolved) && resolved.length === 0)) {
          const diagnosticContext = new ExecutionContext(graphView);
          diagnosticContext.templateId = template.id;
          diagnosticContext.target = context.target;
          for (const [key, value] of context.variables.entries()) {
            diagnosticContext.set(key, value);
          }
          unresolvedVariables.push({
            name,
            required: Boolean(def.required),
            diagnosis: this.diagnoseVariable(name, def, diagnosticContext)
          });
        }
        context.set(name, resolved);
      }
    }

    // Execute creation rules
    const entities: Partial<HardState>[] = [];
    const entityRefs: Map<string, string[]> = new Map();  // Track created entity placeholders
    const entityRefToIndex: Record<string, number> = {};  // Map entityRef to entities array index
    const placementStrategies: string[] = [];  // For debugging
    const derivedTagsList: Record<string, string | boolean>[] = [];  // Tags from placement
    const placementDebugList: PlacementDebug[] = [];  // Detailed placement debug info

    for (const rule of template.creation) {
      const startIndex = entities.length;
      const created = await this.executeCreation(rule, context, startIndex, template.name);
      // Map entityRef to the index of first created entity (if any were created)
      if (created.entities.length > 0) {
        entityRefToIndex[rule.entityRef] = startIndex;
      }
      entities.push(...created.entities);
      entityRefs.set(rule.entityRef, created.placeholders);
      placementStrategies.push(...created.placementStrategies);
      derivedTagsList.push(...created.derivedTagsList);
      placementDebugList.push(...created.placementDebugList);
    }

    // Execute relationship rules
    const relationships: Relationship[] = [];
    for (const rule of template.relationships) {
      const rels = this.executeRelationship(rule, context, entityRefs);
      relationships.push(...rels);
    }

    // Execute state updates
    for (const rule of template.stateUpdates) {
      this.executeStateUpdate(rule, context);
    }

    // Apply variant effects based on world state
    const matchingVariants = this.getMatchingVariants(template.variants, context);
    for (const variant of matchingVariants) {
      this.applyVariantEffects(variant.apply, entities, entityRefs, relationships, context);
    }

    // Export resolved variables for narration generation in growthSystem
    // Narration is generated AFTER entities have names assigned
    const resolvedVariables: Record<string, HardState | HardState[] | undefined> = {};
    for (const [key, value] of context.variables.entries()) {
      resolvedVariables[key] = value;
    }

    if (unresolvedVariables.length > 0) {
      const unresolvedLabel = unresolvedVariables
        .map((variable) => `${variable.name} (${variable.required ? 'required' : 'optional'})`)
        .join(', ');
      context.graphView.log('debug', `${template.id} executed with unresolved variables: ${unresolvedLabel}`, {
        category: 'templates',
        templateId: template.id,
        templateName: template.name,
        targetId: target?.id,
        targetKind: target?.kind,
        targetSubtype: target?.subtype,
        unresolvedVariables
      });
    }

    return {
      entities,
      relationships,
      description: `${template.name} executed`,
      placementStrategies,
      derivedTagsList,
      placementDebugList,
      resolvedVariables,
      entityRefToIndex,
    };
  }

  // ===========================================================================
  // STEP 1: APPLICABILITY
  // ===========================================================================

  private evaluateApplicability(rules: ApplicabilityRule[] | undefined, context: ExecutionContext): boolean {
    // No rules means always applicable
    if (!rules || rules.length === 0) return true;
    // All rules must pass (AND logic)
    return rules.every(rule => this.evaluateApplicabilityRule(rule, context));
  }

  private evaluateApplicabilityRule(rule: ApplicabilityRule, context: ExecutionContext): boolean {
    // ApplicabilityRule is now an alias for Condition from rules/
    // Pass directly to evaluateCondition

    // Create RuleContext from ExecutionContext
    const ruleCtx = createRuleContext(context.graphView, context, context.target);

    // Evaluate using rules library
    const result = rulesEvaluateCondition(rule, ruleCtx);
    return result.passed;
  }

  /**
   * Evaluate a graph path filter for entity selection.
   */
  private evaluateGraphPathForEntity(
    entity: HardState,
    assertion: GraphPathAssertion,
    context: ExecutionContext
  ): boolean {
    // Create a fresh resolver for path evaluation to avoid polluting the main context's path sets
    const pathContext = new ExecutionContext(context.graphView);
    pathContext.target = context.target;
    pathContext.variables = context.variables;
    // Delegate to shared graph path implementation
    return sharedEvaluateGraphPath(entity, assertion, pathContext, {
      filterEvaluator: (entities, filters, resolver, options) =>
        applySelectionFilters(entities, filters, resolver, options)
    });
  }

  // ===========================================================================
  // STEP 2: SELECTION
  // ===========================================================================

  private executeSelection(rule: SelectionRule, context: ExecutionContext): HardState[] {
    const ruleCtx = createRuleContext(context.graphView, context, context.target);
    return rulesSelectEntities(rule, ruleCtx);
  }

  // Selection filtering and saturation limits are handled by the rules library.

  // ===========================================================================
  // STEP 3: CREATION
  // ===========================================================================

  private async executeCreation(
    rule: CreationRule,
    context: ExecutionContext,
    startIndex: number,
    templateName: string
  ): Promise<{
    entities: Partial<HardState>[];
    placeholders: string[];
    placementStrategies: string[];
    derivedTagsList: Record<string, string | boolean>[];
    placementDebugList: PlacementDebug[];
  }> {
    const entities: Partial<HardState>[] = [];
    const placeholders: string[] = [];
    const placementStrategies: string[] = [];
    const derivedTagsList: Record<string, string | boolean>[] = [];
    const placementDebugList: PlacementDebug[] = [];

    // Check createChance - if specified, roll to see if this entity should be created
    if (rule.createChance !== undefined && rule.createChance < 1.0) {
      const roll = Math.random();
      if (roll > rule.createChance) {
        // Creation skipped due to chance roll
        return { entities, placeholders, placementStrategies, derivedTagsList, placementDebugList };
      }
    }

    // Determine count
    const count = this.resolveCount(rule.count);

    for (let i = 0; i < count; i++) {
      const placeholder = `will-be-assigned-${startIndex + i}`;
      placeholders.push(placeholder);

      // Resolve subtype
      const subtype = this.resolveSubtype(rule.subtype, context, rule.kind);

      // Resolve culture
      if (!rule.culture) {
        throw new Error(
          `Creation rule for kind "${rule.kind}" is missing culture spec.`
        );
      }
      const culture = this.resolveCulture(rule.culture, context);

      if (!rule.status) {
        throw new Error(
          `Creation rule for kind "${rule.kind}" is missing status.`
        );
      }
      if (!rule.prominence) {
        throw new Error(
          `Creation rule for kind "${rule.kind}" is missing prominence.`
        );
      }

      // Resolve narrative hint
      const narrativeHint = this.resolveDescription(rule.description, context);

      // Resolve placement
      let placementResult;
      try {
        placementResult = await this.resolvePlacement(rule.placement, context, culture, placeholder, rule.kind);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(
          `${message} (template "${templateName}", entityRef "${rule.entityRef}", kind "${rule.kind}")`
        );
      }

      // Merge template tags with derived tags from placement (derived tags take precedence)
      const derivedTags = placementResult.derivedTags || {};
      const mergedTags = { ...(rule.tags || {}), ...derivedTags };

      // Build naming context from internal rules, including region info for context:region support
      const namingContext = this.buildNamingContext(
        context,
        rule.kind,
        placementResult.regionId,
        placementResult.debug?.emergentRegionCreated?.label
      );

      // Convert prominence label to numeric value (midpoint of range)
      const prominenceValue = prominenceThreshold(rule.prominence) + 0.5;

      const entity: Partial<HardState> & { namingContext?: Record<string, string> } = {
        kind: rule.kind,
        subtype,
        status: rule.status,
        prominence: prominenceValue,
        culture,
        narrativeHint,
        tags: mergedTags,
        coordinates: placementResult.coordinates,
        regionId: placementResult.regionId,
        allRegionIds: placementResult.allRegionIds,
        namingContext
      };

      entities.push(entity);
      placementStrategies.push(placementResult.strategy);
      derivedTagsList.push(derivedTags);

      // Collect placement debug info
      placementDebugList.push({
        anchorType: placementResult.debug?.anchorType || rule.placement.anchor.type,
        anchorEntity: placementResult.debug?.anchorEntity,
        anchorCulture: placementResult.debug?.anchorCulture,
        resolvedVia: placementResult.debug?.resolvedVia || placementResult.strategy,
        seedRegionsAvailable: placementResult.debug?.seedRegionsAvailable,
        emergentRegionCreated: placementResult.debug?.emergentRegionCreated,
        regionId: placementResult.regionId,
        allRegionIds: placementResult.allRegionIds
      });
    }

    return { entities, placeholders, placementStrategies, derivedTagsList, placementDebugList };
  }

  private resolveCount(count: number | CountRange | undefined): number {
    if (!count) return 1;
    if (typeof count === 'number') return count;
    return count.min + Math.floor(Math.random() * (count.max - count.min + 1));
  }

  private resolveSubtype(spec: SubtypeSpec, context: ExecutionContext, entityKind: string): string {
    if (typeof spec === 'string') {
      return spec;
    }

    if ('inherit' in spec) {
      const refEntity = context.resolveEntity(spec.inherit);
      if (refEntity && (!spec.chance || Math.random() < spec.chance)) {
        return refEntity.subtype;
      }
      throw new Error(
        `Subtype inheritance failed for kind "${entityKind}".`
      );
    }

    if ('fromPressure' in spec) {
      const { graphView } = context;
      let maxPressure = -1;
      const entries = Object.entries(spec.fromPressure);
      if (entries.length === 0) {
        throw new Error(`Subtype fromPressure map is empty for kind "${entityKind}".`);
      }
      let selectedSubtype = entries[0][1];

      for (const [pressureId, subtype] of entries) {
        const value = graphView.getPressure(pressureId) || 0;
        if (value > maxPressure) {
          maxPressure = value;
          selectedSubtype = subtype;
        }
      }
      return selectedSubtype;
    }

    if ('random' in spec) {
      if (!spec.random.length) {
        throw new Error(`Subtype random list is empty for kind "${entityKind}".`);
      }
      return pickRandom(spec.random);
    }

    if ('conditional' in spec) {
      const { when, otherwise } = spec.conditional;
      for (const { condition, then: thenSubtype } of when) {
        if (this.evaluateSubtypeCondition(condition, context)) {
          return thenSubtype;
        }
      }
      return otherwise;
    }

    throw new Error(`Invalid subtype spec for kind "${entityKind}": ${JSON.stringify(spec)}.`);
  }

  private evaluateSubtypeCondition(condition: SubtypeCondition, context: ExecutionContext): boolean {
    switch (condition.type) {
      case 'target_subtype': {
        const target = context.resolveEntity('$target');
        return target?.subtype === condition.equals;
      }
      case 'pressure_check': {
        const pressure = context.graphView.getPressure(condition.pressureId) || 0;
        const minOk = condition.min === undefined || pressure >= condition.min;
        const maxOk = condition.max === undefined || pressure <= condition.max;
        return minOk && maxOk;
      }
      default:
        throw new Error(`Unknown subtype condition type: ${JSON.stringify(condition)}`);
    }
  }

  private resolveCulture(spec: CultureSpec, context: ExecutionContext): string {
    if (typeof spec === 'string') {
      throw new Error(`Invalid culture spec: "${spec}". Use { fixed: "${spec}" } or { inherit: "entity_ref" }`);
    }

    if ('inherit' in spec) {
      const refEntity = context.resolveEntity(spec.inherit);
      if (!refEntity) {
        throw new Error(`Culture inherit reference "${spec.inherit}" could not be resolved.`);
      }
      if (!refEntity.culture) {
        throw new Error(`Entity "${refEntity.id}" has no culture to inherit.`);
      }
      const resolvedCulture = refEntity.culture;
      // Debug: ensure we're not returning the raw variable reference
      if (resolvedCulture.startsWith('$')) {
        console.warn(`[resolveCulture] BUG: Resolved culture is a variable reference: ${resolvedCulture}. RefEntity: ${refEntity?.id}, spec.inherit: ${spec.inherit}`);
      }
      return resolvedCulture;
    }

    if ('fixed' in spec) {
      return spec.fixed;
    }

    throw new Error(`Invalid culture spec: ${JSON.stringify(spec)}. Must have 'inherit' or 'fixed' property.`);
  }

  private resolveDescription(spec: DescriptionSpec | undefined, context: ExecutionContext): string {
    if (!spec) return '';
    if (typeof spec === 'string') return spec;

    let result = spec.template;
    for (const [key, ref] of Object.entries(spec.replacements)) {
      const value = context.resolveString(ref);
      result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
    }
    return result;
  }

  /**
   * Build naming context for name generation.
   * Resolves entity refs to their names for use in context: slots.
   * Also automatically includes $selected and $target if available.
   * If regionId is provided, looks up the region label and adds it as "region".
   */
  private buildNamingContext(
    context: ExecutionContext,
    entityKind?: string,
    regionId?: string | null,
    emergentRegionLabel?: string
  ): Record<string, string> | undefined {
    const result: Record<string, string> = {};

    // Auto-include common refs if they exist
    const autoRefs = ['$selected', '$target'];
    for (const ref of autoRefs) {
      const entity = context.resolveEntity(ref);
      if (entity?.name) {
        // Strip $ prefix for context key: $selected -> selected
        const key = ref.startsWith('$') ? ref.slice(1) : ref;
        result[key] = entity.name;
      }
    }

    // Add region label if available
    // First check for emergent region (newly created), then look up existing region
    if (emergentRegionLabel) {
      result['region'] = emergentRegionLabel;
    } else if (regionId && entityKind) {
      const region = context.graphView.getRegion(entityKind, regionId);
      if (region?.label) {
        result['region'] = region.label;
      }
    }

    // Return undefined if empty to avoid unnecessary object
    return Object.keys(result).length > 0 ? result : undefined;
  }

  /**
   * Derive strategy name from placement anchor type.
   */
  private getStrategyFromAnchor(anchor: PlacementAnchor): string {
    switch (anchor.type) {
      case 'entity':
        return 'near_entity';
      case 'culture':
        return 'within_culture';
      case 'refs_centroid':
        return 'near_centroid';
      case 'bounds':
        return 'within_bounds';
      case 'sparse':
        return anchor.preferPeriphery ? 'sparse_periphery' : 'sparse_area';
      default:
        return 'unknown';
    }
  }

  /**
   * Resolve placement to coordinates.
   */
  private async resolvePlacement(
    spec: PlacementSpec,
    context: ExecutionContext,
    culture: string,
    _placeholder: string,
    entityKind: string
  ): Promise<{
    coordinates: Point;
    strategy: string;
    derivedTags?: Record<string, string | boolean>;
    regionId?: string | null;
    allRegionIds?: string[];
    debug?: {
      anchorType: string;
      anchorEntity?: { id: string; name: string; kind: string };
      anchorCulture?: string;
      resolvedVia: string;
      seedRegionsAvailable?: string[];
      emergentRegionCreated?: { id: string; label: string };
    };
  }> {
    const { graphView } = context;

    // Collect anchor entities for placement
    const anchorEntities: HardState[] = [];
    const avoidEntities: HardState[] = [];

    // Clone spec to allow modification of anchor.id for culture type
    let resolvedSpec = spec;

    if (spec.anchor.type === 'entity') {
      const ref = context.resolveEntity(spec.anchor.ref);
      if (ref) anchorEntities.push(ref);
    } else if (spec.anchor.type === 'culture') {
      // Resolve culture anchor id: if it's a variable reference like "$target",
      // resolve to the entity's culture
      const anchorWithId = spec.anchor as { type: 'culture'; id?: string };
      if (anchorWithId.id?.startsWith('$')) {
        const refEntity = context.resolveEntity(anchorWithId.id);
        const resolvedCultureId = refEntity?.culture || culture;
        // Clone the spec with resolved culture id
        resolvedSpec = {
          ...spec,
          anchor: { ...spec.anchor, id: resolvedCultureId }
        };
      }
    } else if (spec.anchor.type === 'refs_centroid') {
      for (const refId of spec.anchor.refs) {
        const ref = context.resolveEntity(refId);
        if (ref) anchorEntities.push(ref);
      }
    }

    (spec.spacing?.avoidRefs || []).forEach(refId => {
      const ref = context.resolveEntity(refId);
      if (ref) avoidEntities.push(ref);
    });

    const placementResult = await graphView.placeWithPlacementOptions(
      entityKind,
      culture,
      resolvedSpec,
      anchorEntities,
      avoidEntities
    );

    if (placementResult) {
      return {
        coordinates: placementResult.coordinates,
        strategy: this.getStrategyFromAnchor(spec.anchor),
        derivedTags: placementResult.derivedTags,
        regionId: placementResult.regionId,
        allRegionIds: placementResult.allRegionIds,
        debug: placementResult.debug
      };
    }

    throw new Error(
      `resolvePlacement: could not resolve placement for "${entityKind}" using anchor "${spec.anchor.type}".`
    );
  }

  // ===========================================================================
  // STEP 4: RELATIONSHIPS
  // ===========================================================================

  private executeRelationship(
    rule: RelationshipRule,
    context: ExecutionContext,
    entityRefs: Map<string, string[]>
  ): Relationship[] {
    const relationships: Relationship[] = [];

    // Check condition
    if (rule.condition && !this.evaluateRelationshipCondition(rule.condition, context)) {
      return relationships;
    }

    // Resolve src and dst
    const srcIds = this.resolveRelationshipEntity(rule.src, context, entityRefs);
    const dstIds = this.resolveRelationshipEntity(rule.dst, context, entityRefs);

    for (const srcId of srcIds) {
      for (const dstId of dstIds) {
        if (srcId === dstId) continue;

        // Note: distance is computed from coordinates when relationship is added to graph
        const rel: Relationship = {
          kind: rule.kind,
          src: srcId,
          dst: dstId,
          strength: rule.strength
          // distance computed from coordinates, not set here
        };

        if (rule.catalyzedBy) {
          const catalyst = context.resolveEntity(rule.catalyzedBy);
          if (catalyst) {
            rel.catalyzedBy = catalyst.id;
          }
        }

        relationships.push(rel);

        if (rule.bidirectional) {
          relationships.push({
            kind: rule.kind,
            src: dstId,
            dst: srcId,
            strength: rule.strength,
            catalyzedBy: rel.catalyzedBy
          });
        }
      }
    }

    return relationships;
  }

  private resolveRelationshipEntity(
    ref: string,
    context: ExecutionContext,
    entityRefs: Map<string, string[]>
  ): string[] {
    // Check if it's a reference to created entities
    if (entityRefs.has(ref)) {
      return entityRefs.get(ref)!;
    }

    // Resolve as entity reference
    const entity = context.resolveEntity(ref);
    if (entity) {
      return [entity.id];
    }

    // It might be a placeholder
    if (ref.startsWith('will-be-assigned-')) {
      return [ref];
    }

    return [];
  }

  private evaluateRelationshipCondition(
    condition: RelationshipCondition,
    context: ExecutionContext
  ): boolean {
    const ruleCtx = createRuleContext(context.graphView, context, context.target);
    const result = rulesEvaluateCondition(condition, ruleCtx);
    return result.passed;
  }

  // ===========================================================================
  // STEP 5: STATE UPDATES
  // ===========================================================================

  private executeStateUpdate(rule: StateUpdateRule, context: ExecutionContext): void {
    // StateUpdateRule is now an alias for Mutation from rules/
    // Pass directly to applyMutation

    // Create RuleContext from ExecutionContext
    const ruleCtx = createRuleContext(context.graphView, context, context.target);

    // Apply using rules library
    applyMutation(rule, ruleCtx);
  }

  // ===========================================================================
  // STEP 6: VARIANT EVALUATION
  // ===========================================================================

  /**
   * Get all matching variants based on current world state.
   */
  private getMatchingVariants(
    variants: TemplateVariants | undefined,
    context: ExecutionContext
  ): TemplateVariant[] {
    if (!variants || !variants.options || variants.options.length === 0) {
      return [];
    }

    const matching: TemplateVariant[] = [];

    for (const variant of variants.options) {
      if (this.evaluateVariantCondition(variant.when, context)) {
        matching.push(variant);
        if (variants.selection === 'first_match') {
          break;
        }
      }
    }

    return matching;
  }

  /**
   * Evaluate a variant condition.
   */
  private evaluateVariantCondition(condition: VariantCondition, context: ExecutionContext): boolean {
    const ruleCtx = createRuleContext(context.graphView, context, context.target);
    const result = rulesEvaluateCondition(condition, ruleCtx);
    return result.passed;
  }

  /**
   * Apply variant effects to entities, relationships, and state updates.
   */
  private applyVariantEffects(
    effects: VariantEffects,
    entities: Partial<HardState>[],
    entityRefs: Map<string, string[]>,
    relationships: Relationship[],
    context: ExecutionContext
  ): void {
    // Apply subtype overrides
    if (effects.subtype) {
      for (const [entityRef, newSubtype] of Object.entries(effects.subtype)) {
        const placeholders = entityRefs.get(entityRef);
        if (placeholders) {
          // Find the entity indices matching these placeholders
          for (let i = 0; i < entities.length; i++) {
            // Entities are created in order, match by index to placeholder
            const placeholder = `will-be-assigned-${i}`;
            if (placeholders.includes(placeholder)) {
              entities[i].subtype = newSubtype;
            }
          }
        }
      }
    }

    // Apply additional tags
    if (effects.tags) {
      for (const [entityRef, tagMap] of Object.entries(effects.tags)) {
        const placeholders = entityRefs.get(entityRef);
        if (placeholders) {
          for (let i = 0; i < entities.length; i++) {
            const placeholder = `will-be-assigned-${i}`;
            if (placeholders.includes(placeholder)) {
              entities[i].tags = { ...(entities[i].tags || {}), ...tagMap };
            }
          }
        }
      }
    }

    // Apply additional relationships
    if (effects.relationships) {
      for (const rule of effects.relationships) {
        const rels = this.executeRelationship(rule, context, entityRefs);
        relationships.push(...rels);
      }
    }

    // Apply additional state updates
    if (effects.stateUpdates) {
      for (const rule of effects.stateUpdates) {
        this.executeStateUpdate(rule, context);
      }
    }
  }

  // ===========================================================================
  // VARIABLE RESOLUTION
  // ===========================================================================

  private resolveVariable(
    def: VariableDefinition,
    context: ExecutionContext
  ): HardState | HardState[] | undefined {
    const ruleCtx = createRuleContext(context.graphView, context, context.target);
    return resolveSingleVariable(def.select, ruleCtx);
  }
}

// =============================================================================
// ADAPTER: Convert DeclarativeTemplate to GrowthTemplate
// =============================================================================

import type { GrowthTemplate } from './types';

/**
 * Creates a GrowthTemplate from a DeclarativeTemplate.
 * This allows declarative templates to be used with the existing WorldEngine.
 */
export function createTemplateFromDeclarative(
  template: DeclarativeTemplate,
  interpreter: TemplateInterpreter
): GrowthTemplate {
  return {
    id: template.id,
    name: template.name,

    canApply: (graphView: WorldRuntime) => {
      return interpreter.canApply(template, graphView);
    },

    findTargets: (graphView: WorldRuntime) => {
      return interpreter.findTargets(template, graphView);
    },

    expand: async (graphView: WorldRuntime, target?: HardState) => {
      return interpreter.expand(template, graphView, target);
    }
  };
}
