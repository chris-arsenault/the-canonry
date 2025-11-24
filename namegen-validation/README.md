# Name Generation Validation

Validation metrics system for testing domain-aware procedural name generation.

## Overview

This package provides three categories of validation metrics:

1. **Capacity** - Can the domain generate enough unique names?
   - Collision rate analysis
   - Shannon entropy calculation
   - Uniqueness percentage

2. **Diffuseness** - Are names within a domain distinct enough?
   - Nearest-neighbor distance analysis
   - Levenshtein distance (normalized)
   - Shape-based similarity detection
   - Percentile statistics (p1, p5, median)

3. **Separation** - Can you distinguish domains by name shape alone?
   - Feature extraction (length, vowel ratio, bigrams, etc.)
   - Inter-domain centroid distances
   - Classifier-based accuracy testing
   - Confusion matrix analysis

## Installation

```bash
npm install
```

## Usage

### CLI

```bash
# Validate capacity for a domain
npm run dev -- capacity --domain ../world-gen-naming/domains/elven.json --sample 1000

# Check diffuseness (intra-domain similarity)
npm run dev -- diffuseness --domain ../world-gen-naming/domains/elven.json --sample 500

# Test separation (inter-domain distinctiveness)
npm run dev -- separation --domains ../world-gen-naming/domains/all-domains.json --sample 200

# Run all validation metrics
npm run dev -- all --domain ../world-gen-naming/domains/elven.json
```

### Library API

```typescript
import { validateCapacity, validateDiffuseness, validateSeparation } from 'namegen-validation';
import { loadDomains } from 'world-gen-naming';

const domains = loadDomains('path/to/domains.json');

// Capacity validation
const capacityReport = validateCapacity(domains[0], {
  sampleSize: 1000,
  seed: 'test-seed'
});

console.log(`Collision rate: ${capacityReport.collisionRate}%`);
console.log(`Entropy: ${capacityReport.entropy} bits/char`);

// Diffuseness validation
const diffusenessReport = validateDiffuseness(domains[0], {
  sampleSize: 500
});

console.log(`p5 nearest-neighbor: ${diffusenessReport.nearestNeighbor.p5}`);

// Separation validation (multi-domain)
const separationReport = validateSeparation(domains, {
  sampleSize: 200
});

console.log(`Classifier accuracy: ${separationReport.classifierAccuracy}%`);
```

## Validation Thresholds

Default thresholds (tunable):

### Capacity
- **Collision rate**: ≤ 5%
- **Entropy**: ≥ 3.0 bits/char

### Diffuseness
- **p5 Levenshtein distance**: ≥ 0.3 (normalized)
- **p5 Shape distance**: ≥ 0.2

### Separation
- **Centroid distance**: ≥ 0.2 (normalized feature space)
- **Classifier accuracy**: ≥ 70%

## Metrics Explained

### Shannon Entropy

Measures information density in generated names. Higher entropy = more variety in character usage.

```
H = -Σ p(c) * log2(p(c))
```

### Levenshtein Distance

Minimum number of single-character edits to transform one string into another, normalized to [0,1].

### Shape Distance

Simplified representation that collapses vowels and consonants to detect phonetic similarity:
- "Aeltharion" → "VCCCVCVC"
- "Fivaa" → "CVCVV"

### Feature Vectors

Names are converted to numeric features for classification:
- Length (chars)
- Syllable count estimate
- Vowel ratio
- Apostrophe/hyphen counts
- Character bigram frequencies
- Ending patterns

## Development

```bash
npm run build         # Compile TypeScript
npm run typecheck     # Type check without building
npm run clean         # Remove build artifacts
```

## Architecture

- **metrics/** - Core validation algorithms
- **analysis/** - Distance calculations, feature extraction, classification
- **reporters/** - Output formatters (JSON, console)
- **types/** - TypeScript definitions and Zod schemas

## License

MIT
