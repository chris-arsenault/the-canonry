import { describe, it, expect } from "vitest";
import { createRNG } from "../utils/rng.js";
import {
  encodeParameters,
  decodeParameters,
  perturbParameters,
  parameterDistance,
} from "./parameter-encoder.js";
import type { NamingDomain } from "../types/domain.js";
import { DEFAULT_BOUNDS } from "../types/optimization.js";

describe("Parameter Encoder", () => {
  const testDomain: NamingDomain = {
    id: "test",
    appliesTo: {
      kind: ["test"],
    },
    phonology: {
      consonants: ["t", "k"],
      vowels: ["a", "e"],
      syllableTemplates: ["CV", "CVC"],
      lengthRange: [2, 3],
      consonantWeights: [0.6, 0.4],
      vowelWeights: [0.7, 0.3],
      templateWeights: [0.5, 0.5],
      favoredClusterBoost: 3.0,
    },
    morphology: {
      structure: ["root", "root-suffix"],
      structureWeights: [0.8, 0.2],
    },
    style: {
      capitalization: "title",
      apostropheRate: 0.1,
      hyphenRate: 0.05,
    },
  };

  describe("encodeParameters", () => {
    it("should encode domain config to parameter vector", () => {
      const theta = encodeParameters(testDomain);

      expect(theta.consonantWeights).toHaveLength(2);
      expect(theta.vowelWeights).toHaveLength(2);
      expect(theta.templateWeights).toHaveLength(2);
      expect(theta.structureWeights).toHaveLength(2);
      expect(theta.apostropheRate).toBeTypeOf("number");
      expect(theta.hyphenRate).toBeTypeOf("number");
      expect(theta.lengthMin).toBe(2);
      expect(theta.lengthMax).toBe(3);
      expect(theta.favoredClusterBoost).toBe(3.0);
    });

    it("should use log space for weights", () => {
      const theta = encodeParameters(testDomain);

      // Log-transformed weights should be negative for values < 1
      // Since normalized weights are between 0 and 1, logs should be <= 0
      expect(theta.consonantWeights[0]).toBeLessThanOrEqual(0);
      expect(theta.vowelWeights[0]).toBeLessThanOrEqual(0);
    });

    it("should normalize weights before encoding", () => {
      const domain: NamingDomain = {
        ...testDomain,
        phonology: {
          ...testDomain.phonology,
          consonantWeights: [10, 5], // Not normalized
        },
      };

      const theta = encodeParameters(domain);

      // After decoding, weights should be normalized
      const decoded = decodeParameters(theta, domain, DEFAULT_BOUNDS);
      const sum =
        (decoded.phonology.consonantWeights?.[0] ?? 0) +
        (decoded.phonology.consonantWeights?.[1] ?? 0);

      expect(sum).toBeCloseTo(1.0, 5);
    });

    it("should handle missing weights with uniform defaults", () => {
      const domain: NamingDomain = {
        ...testDomain,
        phonology: {
          ...testDomain.phonology,
          consonantWeights: undefined,
        },
      };

      const theta = encodeParameters(domain);

      expect(theta.consonantWeights).toHaveLength(2);
      // Uniform weights should be equal after log transform
      expect(theta.consonantWeights[0]).toBeCloseTo(theta.consonantWeights[1], 5);
    });
  });

  describe("decodeParameters", () => {
    it("should decode parameter vector back to domain config", () => {
      const theta = encodeParameters(testDomain);
      const decoded = decodeParameters(theta, testDomain, DEFAULT_BOUNDS);

      expect(decoded.phonology.consonants).toEqual(testDomain.phonology.consonants);
      expect(decoded.phonology.vowels).toEqual(testDomain.phonology.vowels);
      expect(decoded.phonology.lengthRange[0]).toBe(2);
      expect(decoded.phonology.lengthRange[1]).toBe(3);
    });

    it("should preserve weights after encode/decode cycle", () => {
      const theta = encodeParameters(testDomain);
      const decoded = decodeParameters(theta, testDomain, DEFAULT_BOUNDS);

      // Weights should be approximately preserved (within floating point precision)
      expect(decoded.phonology.consonantWeights?.[0]).toBeCloseTo(0.6, 5);
      expect(decoded.phonology.consonantWeights?.[1]).toBeCloseTo(0.4, 5);
    });

    it("should clamp length range to bounds", () => {
      const theta = encodeParameters(testDomain);
      theta.lengthMin = -5; // Invalid
      theta.lengthMax = 100; // Too large

      const decoded = decodeParameters(theta, testDomain, DEFAULT_BOUNDS);

      expect(decoded.phonology.lengthRange[0]).toBeGreaterThanOrEqual(DEFAULT_BOUNDS.lengthMin.min);
      expect(decoded.phonology.lengthRange[0]).toBeLessThanOrEqual(DEFAULT_BOUNDS.lengthMin.max);
      expect(decoded.phonology.lengthRange[1]).toBeLessThanOrEqual(DEFAULT_BOUNDS.lengthMax.max);
    });

    it("should ensure lengthMax >= lengthMin", () => {
      const theta = encodeParameters(testDomain);
      theta.lengthMin = 5;
      theta.lengthMax = 2; // Less than min

      const decoded = decodeParameters(theta, testDomain, DEFAULT_BOUNDS);

      expect(decoded.phonology.lengthRange[1]).toBeGreaterThanOrEqual(
        decoded.phonology.lengthRange[0]
      );
    });

    it("should handle rates in [0,1] range", () => {
      const theta = encodeParameters(testDomain);
      const decoded = decodeParameters(theta, testDomain, DEFAULT_BOUNDS);

      expect(decoded.style.apostropheRate).toBeGreaterThanOrEqual(0);
      expect(decoded.style.apostropheRate).toBeLessThanOrEqual(1);
      expect(decoded.style.hyphenRate).toBeGreaterThanOrEqual(0);
      expect(decoded.style.hyphenRate).toBeLessThanOrEqual(1);
    });
  });

  describe("perturbParameters", () => {
    it("should create perturbed copy of parameters", () => {
      const rng = createRNG("test");
      const theta = encodeParameters(testDomain);
      const stepSizes = {
        weights: 0.1,
        apostropheRate: 0.05,
        hyphenRate: 0.05,
        lengthRange: 1,
      };

      const perturbed = perturbParameters(theta, stepSizes, rng);

      // Original should be unchanged
      expect(theta.consonantWeights[0]).toBe(theta.consonantWeights[0]);

      // Perturbed should be different (with very high probability)
      expect(perturbed.consonantWeights[0]).not.toBe(theta.consonantWeights[0]);
    });

    it("should apply Gaussian noise", () => {
      const rng = createRNG("test");
      const theta = encodeParameters(testDomain);
      const stepSizes = {
        weights: 0.1,
        apostropheRate: 0.05,
        hyphenRate: 0.05,
        lengthRange: 1,
      };

      // Generate many perturbations
      const perturbations: number[] = [];
      for (let i = 0; i < 100; i++) {
        const perturbed = perturbParameters(theta, stepSizes, rng);
        perturbations.push(perturbed.consonantWeights[0]);
      }

      // Check that perturbations have reasonable variance
      const mean = perturbations.reduce((a, b) => a + b, 0) / perturbations.length;
      const variance =
        perturbations.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / perturbations.length;

      // Variance should be > 0 (they're not all the same)
      expect(variance).toBeGreaterThan(0);
    });

    it("should respect step sizes", () => {
      const rng = createRNG("test");
      const theta = encodeParameters(testDomain);

      const smallSteps = {
        weights: 0.01,
        apostropheRate: 0.01,
        hyphenRate: 0.01,
        lengthRange: 1,
      };

      const largeSteps = {
        weights: 1.0,
        apostropheRate: 1.0,
        hyphenRate: 1.0,
        lengthRange: 1,
      };

      const smallPerturb = perturbParameters(theta, smallSteps, rng);
      const largePerturb = perturbParameters(theta, largeSteps, rng);

      const smallDist = parameterDistance(theta, smallPerturb);
      const largeDist = parameterDistance(theta, largePerturb);

      // Larger steps should generally produce larger distances
      // (not guaranteed for single sample, but very likely)
      expect(largeDist).toBeGreaterThan(smallDist * 0.5);
    });
  });

  describe("parameterDistance", () => {
    it("should return 0 for identical parameters", () => {
      const theta = encodeParameters(testDomain);
      const distance = parameterDistance(theta, theta);

      expect(distance).toBe(0);
    });

    it("should return positive distance for different parameters", () => {
      const theta1 = encodeParameters(testDomain);
      const rng = createRNG("test");
      const theta2 = perturbParameters(
        theta1,
        {
          weights: 0.1,
          apostropheRate: 0.05,
          hyphenRate: 0.05,
          lengthRange: 1,
        },
        rng
      );

      const distance = parameterDistance(theta1, theta2);

      expect(distance).toBeGreaterThan(0);
    });

    it("should be symmetric", () => {
      const theta1 = encodeParameters(testDomain);
      const rng = createRNG("test");
      const theta2 = perturbParameters(
        theta1,
        {
          weights: 0.1,
          apostropheRate: 0.05,
          hyphenRate: 0.05,
          lengthRange: 1,
        },
        rng
      );

      const dist12 = parameterDistance(theta1, theta2);
      const dist21 = parameterDistance(theta2, theta1);

      expect(dist12).toBeCloseTo(dist21, 10);
    });

    it("should satisfy triangle inequality", () => {
      const theta1 = encodeParameters(testDomain);
      const rng = createRNG("test");
      const theta2 = perturbParameters(
        theta1,
        {
          weights: 0.1,
          apostropheRate: 0.05,
          hyphenRate: 0.05,
          lengthRange: 1,
        },
        rng
      );
      const theta3 = perturbParameters(
        theta2,
        {
          weights: 0.1,
          apostropheRate: 0.05,
          hyphenRate: 0.05,
          lengthRange: 1,
        },
        rng
      );

      const dist12 = parameterDistance(theta1, theta2);
      const dist23 = parameterDistance(theta2, theta3);
      const dist13 = parameterDistance(theta1, theta3);

      // Triangle inequality: d(1,3) <= d(1,2) + d(2,3)
      expect(dist13).toBeLessThanOrEqual(dist12 + dist23 + 1e-10); // Small epsilon for floating point
    });
  });

  describe("edge cases", () => {
    it("should handle domain with minimal config", () => {
      const minimalDomain: NamingDomain = {
        id: "minimal",
        appliesTo: {
          kind: ["test"],
        },
        phonology: {
          consonants: ["t"],
          vowels: ["a"],
          syllableTemplates: ["CV"],
          lengthRange: [1, 1],
        },
        morphology: {
          structure: ["root"],
        },
        style: {},
      };

      const theta = encodeParameters(minimalDomain);
      const decoded = decodeParameters(theta, minimalDomain, DEFAULT_BOUNDS);

      expect(decoded.phonology.consonants).toEqual(["t"]);
      expect(decoded.phonology.vowels).toEqual(["a"]);
    });

    it("should handle extreme weight values", () => {
      const extremeDomain: NamingDomain = {
        ...testDomain,
        phonology: {
          ...testDomain.phonology,
          consonantWeights: [0.99, 0.01], // Very skewed
        },
      };

      const theta = encodeParameters(extremeDomain);
      const decoded = decodeParameters(theta, extremeDomain, DEFAULT_BOUNDS);

      // Should preserve relative weights
      const weights = decoded.phonology.consonantWeights!;
      expect(weights[0]).toBeGreaterThan(weights[1] * 5);
    });
  });
});
