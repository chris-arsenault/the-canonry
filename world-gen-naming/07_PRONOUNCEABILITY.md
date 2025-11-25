There are **known, academically established** algorithms and heuristics for measuring *pronounceability* / *phonotactic well-formedness* / *wordlikeness*. These appear in NLP, psycholinguistics, and computational linguistics. Below is the curated list of **actual proven methods**, not vague heuristics.

All of these can run offline and most are CPU-only.

---

# 1. **Sonority Sequencing Principle (SSP) Scoring**

**Field:** phonology
**What it measures:** does a word follow natural sonority rises/falls?

Assign each phoneme/N-gram a **sonority rank**:

```
(lowest) stops < fricatives < nasals < liquids < glides < vowels (highest)
```

Scan each syllable:

* legal onset: rising sonority
* nucleus: highest
* coda: falling sonority

You compute a “sonority violation count”:

```
violations += number of decreasing steps in onset + number of rising steps in coda
```

**Zero or low violations → highly pronounceable**
Widely used in phonotactic modeling across languages.

**Pros:** extremely fast, easy to implement
**Cons:** language dependent (but you can define ranks for your conlangs/cultures)

---

# 2. **Phonotactic N-gram Probability (phoneme N-grams)**

**Field:** computational linguistics
**What it measures:** probability of phoneme sequences.

Convert the name to a phoneme (or pseudo-phoneme) stream. Train:

* unigram, bigram, trigram phoneme models
* or CV/VC pattern models

Compute:

```
P(name) = product of P(phoneme_i | phoneme_{i-1}, phoneme_{i-2})
```

Or take `log(P)`.

Low probability events → less pronounceable.
This is a core method used in:

* speech recognition
* wordlikeness/nonce-word generation research
* conlang phonotactic modeling

**Pros:** empirically strong, tunable per culture
**Cons:** requires domain-specific phoneme inventory and training corpus (real or synthetic)

---

# 3. **Maximum Onset Principle (MOP) Compliance**

**Field:** phonology
**What it measures:** how well syllable breaks align with universal onset-maximizing rules.

Algorithm:

1. Attempt to syllabify a name using:

    * maximal onsets
    * legal cluster tables
2. Count failures:

    * illegal onset clusters
    * illegal coda clusters
    * ambiguous syllabification

Score = inverse of violation count.

**Pros:** robust indicator of naturalness
**Cons:** you must supply allowed onset/coda clusters per culture (easy in your framework)

---

# 4. **Positional Segment Frequency Models**

**Field:** psycholinguistics
**What it measures:** how common each phoneme is in each position.

Given a position-specific frequency table:

```
Initial_C  = freq distribution of consonants in initial position
Medial_C   = freq distribution in medial 
Final_C    = freq distribution in final
Same for vowels
```

Compute:

```
score = average positional probability across phonemes
```

Used heavily in pronounceability scoring for:

* CAPTCHA systems
* password strength with pronounceability
* brand-name generators

---

# 5. **Weighted Orthographic N-gram Models**

**Field:** NLP
**What it measures:** letter-level pronounceability approximations.

If you don’t want to enforce phonemes:

1. Build letter N-gram probability distributions:

    * bigram, trigram, mixed (character-level)
2. Compute likelihood of the string.

Used historically in:

* “wordlikeness” scoring in Wade & Church (1997)
* Brand name generation (e.g., Namelix-style generators)

**Pros:** dead simple, surprisingly effective
**Cons:** conflates orthography with phonology

---

# 6. **Harmonic Grammar / Weighted Constraint Violation**

**Field:** linguistics (Optimality Theory, Harmonic Grammar)

You define a set of constraints:

* *No complex codas*
* *Onset required*
* *No voiced stop + nasal onset*
* *Vowel length harmony*
* *No identical syllable repetition*

Each has a weight. Pronounceability is:

```
harmony = - Σ (constraintViolation × weight)
```

This is academically proven and extremely flexible for fantasy cultures.

**Pros:** gold standard for conlang-level modeling
**Cons:** requires designing constraints per culture

---

# 7. **Graph-based Pronounceability (Consonant/Vowel Alternation Index)**

**Field:** graph theory applied to phonology

Define:

* transition graph of allowed C→V, V→C, C→C transitions
* compute path legality and penalties

A name is pronounceable if its transitions are mostly allowed.

Fast, scalable, works well for invented languages.

---

# 8. **Syllable Template Matching**

Check if the string can be decomposed into allowed templates:

* CV, CVC, CVV, CCV, etc.

Compute:

```
score = (# templates matched) / (name length)
penalty = (# illegal clusters) * weight
```

This is the core method used by many procedural name generators.

---

# 9. **Dictionary-based Wordlikeness Score (Coltheart’s N / Neighbors)**

**Field:** psycholinguistics

Compute how many “neighbors” exist in a dictionary or pseudo-dictionary:

* one-letter replacement → match?
* insertion → match?
* deletion → match?

Names with too many near neighbors → usually more pronounceable.

This is surprisingly predictive.

You don’t need a real dictionary — generated corpora per culture works.

---

# 10. **Pronounceability via Grapheme-to-Phoneme (G2P) Success**

If a G2P model (even a tiny rule-based one) can reliably infer phonemes:

* name is easy to pronounce
* if G2P is ambiguous or fails → name likely unpronounceable

You don’t need a neural G2P — use a rule-based model you encode per culture.

---

# 11. **Stress Pattern Legality**

Cultures/languages have preferred stress patterns:

* trochaic (STRONG-weak)
* iambic (weak-STRONG)
* etc.

Score how well the name supports an assignable stress pattern.

Important for Elvish, Orkish, Dwarvish, etc.

---

# Which ones should YOU implement?

For your use case (offline, controllable, culture-specific), the **optimal mix** is:

### **A) Sonority sequencing score**

Simple, fast, culture-tunable.

### **B) Phonotactic N-gram probability**

Works for ALL invented phonotactic domains.

### **C) Template legality score (syllable-level)**

Because your namegen already uses templates.

### **D) Harmonic Grammar light version**

Perfect for fantasy/nonhuman cultures.
You can encode a few culture-specific constraints cleanly.

You do NOT need neural pronounceability models.

---

# Example: Combined pronounceability score

You can define:

```
pronounceability =
  w1*(1 - normalizedSonorityViolations) +
  w2*(normalizedPhonotacticProbability) +
  w3*(templateLegality) +
  w4*(1 - harmonicPenalty)
```

All components normalized 0–1.

This gives you a mature, academically grounded pronounceability score.

---

If you want, I can design:

* a TypeScript module with all pronounceability algorithms
* scoring weights per culture
* phoneme inventories for elves, orcs, argonians, dwarves, angels, voidborn
* a unified pronounceability API your validation loop can call.
