/**
 * Dynamic Weight Calculator Service
 *
 * Adjusts template weights based on population deviation from targets.
 * Implements homeostatic control by suppressing template weights when entity populations
 * are above target and boosting weights when below target.
 */

import { GrowthTemplate } from '../engine/types';
import { PopulationMetrics } from '../statistics/populationTracker';

export interface TemplateCreationInfo {
  entityKinds: Array<{ kind: string; subtype: string }>;
}

export interface WeightAdjustment {
  templateId: string;
  baseWeight: number;
  adjustedWeight: number;
  adjustmentFactor: number;
  reason: string;
}

export class DynamicWeightCalculator {
  private deviationThreshold: number = 0.2;  // 20% deviation triggers adjustment
  private maxSuppressionFactor: number = 0.8;  // Can suppress down to 20% of base
  private maxBoostFactor: number = 2.0;        // Can boost up to 200% of base

  /**
   * Calculate adjusted weight for a template based on population metrics
   */
  calculateWeight(
    template: GrowthTemplate,
    baseWeight: number,
    metrics: PopulationMetrics,
    creationInfo?: TemplateCreationInfo
  ): WeightAdjustment {
    if (baseWeight === 0) {
      return {
        templateId: template.id,
        baseWeight,
        adjustedWeight: 0,
        adjustmentFactor: 0,
        reason: 'Template disabled by era'
      };
    }

    // Check if template produces any tracked entities
    if (!creationInfo || creationInfo.entityKinds.length === 0) {
      return {
        templateId: template.id,
        baseWeight,
        adjustedWeight: baseWeight,
        adjustmentFactor: 1.0,
        reason: 'No tracked entity output'
      };
    }

    // Calculate adjustment factor based on all produced entity types
    let cumulativeAdjustment = 1.0;
    const reasons: string[] = [];

    creationInfo.entityKinds.forEach(entityKind => {
      const key = `${entityKind.kind}:${entityKind.subtype}`;
      const metric = metrics.entities.get(key);

      if (!metric || metric.target === 0) {
        return; // Skip entity types with no target
      }

      const deviation = metric.deviation;

      if (deviation > this.deviationThreshold) {
        // Over target → suppress creation
        const suppressionStrength = Math.min(deviation, this.maxSuppressionFactor);
        const suppressionFactor = 1 - suppressionStrength;
        cumulativeAdjustment *= suppressionFactor;
        reasons.push(
          `${key} over target by ${(deviation * 100).toFixed(0)}% (${metric.count}/${metric.target}), suppressing by ${((1 - suppressionFactor) * 100).toFixed(0)}%`
        );
      } else if (deviation < -this.deviationThreshold) {
        // Under target → boost creation
        const boostStrength = Math.min(Math.abs(deviation), this.maxBoostFactor - 1);
        const boostFactor = 1 + boostStrength;
        cumulativeAdjustment *= boostFactor;
        reasons.push(
          `${key} under target by ${(Math.abs(deviation) * 100).toFixed(0)}% (${metric.count}/${metric.target}), boosting by ${((boostFactor - 1) * 100).toFixed(0)}%`
        );
      }
    });

    const adjustedWeight = baseWeight * cumulativeAdjustment;

    return {
      templateId: template.id,
      baseWeight,
      adjustedWeight,
      adjustmentFactor: cumulativeAdjustment,
      reason: reasons.length > 0 ? reasons.join('; ') : 'No adjustment needed'
    };
  }

  /**
   * Calculate weights for all templates
   * @param creationInfoMap Map of template ID -> creation info extracted from declarative templates
   */
  calculateAllWeights(
    templates: GrowthTemplate[],
    baseWeights: Map<string, number>,
    metrics: PopulationMetrics,
    creationInfoMap?: Map<string, TemplateCreationInfo>
  ): Map<string, WeightAdjustment> {
    const adjustments = new Map<string, WeightAdjustment>();

    templates.forEach(template => {
      const baseWeight = baseWeights.get(template.id) || 0;
      const creationInfo = creationInfoMap?.get(template.id);
      const adjustment = this.calculateWeight(template, baseWeight, metrics, creationInfo);
      adjustments.set(template.id, adjustment);
    });

    return adjustments;
  }

  /**
   * Get templates that are being suppressed
   */
  getSuppressedTemplates(adjustments: Map<string, WeightAdjustment>): WeightAdjustment[] {
    return Array.from(adjustments.values())
      .filter(adj => adj.adjustmentFactor < 1.0 && adj.baseWeight > 0);
  }

  /**
   * Get templates that are being boosted
   */
  getBoostedTemplates(adjustments: Map<string, WeightAdjustment>): WeightAdjustment[] {
    return Array.from(adjustments.values())
      .filter(adj => adj.adjustmentFactor > 1.0);
  }

  /**
   * Configure adjustment parameters
   */
  configure(options: {
    deviationThreshold?: number;
    maxSuppressionFactor?: number;
    maxBoostFactor?: number;
  }): void {
    if (options.deviationThreshold !== undefined) {
      this.deviationThreshold = options.deviationThreshold;
    }
    if (options.maxSuppressionFactor !== undefined) {
      this.maxSuppressionFactor = options.maxSuppressionFactor;
    }
    if (options.maxBoostFactor !== undefined) {
      this.maxBoostFactor = options.maxBoostFactor;
    }
  }
}
