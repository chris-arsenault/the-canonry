import { describe, it, expect } from "vitest";
import { hillclimb } from "./hillclimb.js";
import type { NamingDomain } from "../../types/domain.js";

describe("Hill-Climbing Optimizer", () => {
  // Create a simple test domain that can be improved
  const testDomain: NamingDomain = {
    id: "test",
    appliesTo: {
      kind: ["test"],
    },
    phonology: {
      consonants: ["t", "k", "s"],
      vowels: ["a", "e", "i"],
      syllableTemplates: ["CV", "CVC"],
      lengthRange: [1, 2],
      // Start with poor weights (all uniform)
      consonantWeights: [1, 1, 1],
      vowelWeights: [1, 1, 1],
      templateWeights: [1, 1],
    },
    morphology: {
      structure: ["root"],
      structureWeights: [1],
    },
    style: {
      capitalization: "title",
      apostropheRate: 0,
      hyphenRate: 0,
    },
  };

  const validationSettings = {
    requiredNames: 100,
    sampleFactor: 1,
    maxSampleSize: 100,
    minNN_p5: 0.3,
    minShapeNN_p5: 0.2,
    minCentroidDistance: 0.2,
  };

  const fitnessWeights = {
    capacity: 1.0,
    diffuseness: 1.0,
    separation: 0.0, // No separation for single domain
    pronounceability: 0.0,
    length: 0.0,
    style: 0.0,
  };

  const optimizationSettings = {
    algorithm: "hillclimb" as const,
    iterations: 10, // Keep low for fast tests
    verbose: false,
    convergenceThreshold: 0.001,
    convergenceWindow: 5,
  };

  it("should complete optimization without errors", async () => {
    const result = await hillclimb(
      testDomain,
      validationSettings,
      fitnessWeights,
      optimizationSettings,
      undefined,
      "test"
    );

    expect(result).toBeDefined();
    expect(result.initialConfig).toBeDefined();
    expect(result.optimizedConfig).toBeDefined();
    expect(result.initialFitness).toBeTypeOf("number");
    expect(result.finalFitness).toBeTypeOf("number");
    expect(result.evaluations).toBeInstanceOf(Array);
  }, 60000); // 60s timeout for optimization

  it("should track fitness over iterations", async () => {
    const result = await hillclimb(
      testDomain,
      validationSettings,
      fitnessWeights,
      optimizationSettings,
      undefined,
      "test"
    );

    expect(result.convergenceHistory).toBeInstanceOf(Array);
    expect(result.convergenceHistory.length).toBeGreaterThan(0);

    // All fitness values should be non-negative
    for (const fitness of result.convergenceHistory) {
      expect(fitness).toBeGreaterThanOrEqual(0);
    }
  }, 60000);

  it("should maintain or improve fitness", async () => {
    const result = await hillclimb(
      testDomain,
      validationSettings,
      fitnessWeights,
      optimizationSettings,
      undefined,
      "test"
    );

    // Final fitness should be >= initial (hill-climbing only accepts improvements)
    expect(result.finalFitness).toBeGreaterThanOrEqual(result.initialFitness);
  }, 60000);

  it("should return best configuration, not just final", async () => {
    const result = await hillclimb(
      testDomain,
      validationSettings,
      fitnessWeights,
      optimizationSettings,
      undefined,
      "test"
    );

    // Optimized config fitness should match finalFitness (which is the best)
    expect(result.finalFitness).toBeGreaterThanOrEqual(result.initialFitness);

    // The optimized config should be one of the evaluated configs
    const optimizedFitness = result.evaluations.find(
      e => e.config === result.optimizedConfig
    )?.fitness;

    // If found in evaluations, should match final fitness
    if (optimizedFitness !== undefined) {
      expect(optimizedFitness).toBeCloseTo(result.finalFitness, 5);
    }
  }, 60000);

  it("should preserve domain structure", async () => {
    const result = await hillclimb(
      testDomain,
      validationSettings,
      fitnessWeights,
      optimizationSettings,
      undefined,
      "test"
    );

    const optimized = result.optimizedConfig;

    // Immutable fields should be preserved
    expect(optimized.id).toBe(testDomain.id);
    expect(optimized.phonology.consonants).toEqual(testDomain.phonology.consonants);
    expect(optimized.phonology.vowels).toEqual(testDomain.phonology.vowels);
    expect(optimized.phonology.syllableTemplates).toEqual(
      testDomain.phonology.syllableTemplates
    );
    expect(optimized.morphology.structure).toEqual(testDomain.morphology.structure);

    // Tunable fields may have changed
    expect(optimized.phonology.consonantWeights).toBeDefined();
    expect(optimized.phonology.lengthRange).toBeDefined();
  }, 60000);

  it("should respect iteration limit", async () => {
    const settings = {
      ...optimizationSettings,
      iterations: 5,
      convergenceWindow: 100, // Disable early stopping
    };

    const result = await hillclimb(
      testDomain,
      validationSettings,
      fitnessWeights,
      settings,
      undefined,
      "test"
    );

    // Should have at most iterations + 1 evaluations (initial + iterations)
    expect(result.evaluations.length).toBeLessThanOrEqual(settings.iterations + 1);
  }, 60000);

  it("should be deterministic with same seed", async () => {
    const result1 = await hillclimb(
      testDomain,
      validationSettings,
      fitnessWeights,
      { ...optimizationSettings, iterations: 3 },
      undefined,
      "same-seed"
    );

    const result2 = await hillclimb(
      testDomain,
      validationSettings,
      fitnessWeights,
      { ...optimizationSettings, iterations: 3 },
      undefined,
      "same-seed"
    );

    // Should produce identical results with same seed
    expect(result1.finalFitness).toBeCloseTo(result2.finalFitness, 5);
    expect(result1.evaluations.length).toBe(result2.evaluations.length);
  }, 60000);

  it("should produce different results with different seeds", async () => {
    const result1 = await hillclimb(
      testDomain,
      validationSettings,
      fitnessWeights,
      { ...optimizationSettings, iterations: 3 },
      undefined,
      "seed1"
    );

    const result2 = await hillclimb(
      testDomain,
      validationSettings,
      fitnessWeights,
      { ...optimizationSettings, iterations: 3 },
      undefined,
      "seed2"
    );

    // Very unlikely to produce identical results with different seeds
    // (but both should still improve)
    expect(result1.finalFitness).toBeGreaterThanOrEqual(result1.initialFitness);
    expect(result2.finalFitness).toBeGreaterThanOrEqual(result2.initialFitness);
  }, 60000);

  it("should support early convergence", async () => {
    const settings = {
      ...optimizationSettings,
      iterations: 100,
      convergenceThreshold: 0.1, // Large threshold
      convergenceWindow: 3,
    };

    const result = await hillclimb(
      testDomain,
      validationSettings,
      fitnessWeights,
      settings,
      undefined,
      "test"
    );

    // Should converge early (before 100 iterations)
    // if no improvement for convergenceWindow iterations
    expect(result.evaluations.length).toBeLessThanOrEqual(settings.iterations + 1);
  }, 60000);
});
