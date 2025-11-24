You’re basically asking: “How do I avoid hand-crafting 500 word lists and 100 templates, but still keep control and flavor?”

You can get ~90% of the way there with three ingredients:

1. LLM as a **style-aware generator** (dev-time only)
2. Corpora + classic NLP as a **pattern/lexeme miner**
3. Light scripts as **filters/curators**

Below is a concrete setup.

---

## 1. Lexeme lists: how to get them without hand-typing

### 1.1 LLM-seeded lexeme lists (low effort, high control)

For each culture + slot type, you already have:

* style spec: “Argonian marshy reptile people, verbs describing movement and stealth”
* mechanical spec: “third-person singular English verb”, “abstract noun”, etc.

You write a generic dev-time prompt template like:

> “You are generating lexeme sets for a name generator.
> Culture: ARGONIAN – marshy reptilian, slightly spooky.
> Slot type: VERB_3SG – third-person singular English verbs.
> Usage: first word in names like ‘Walks-in-Shadows’.
> Output: JSON with an array of 50 verbs, all 3sg, all stylistically on-theme. No duplicates.”

Then you hit:

* `VERB_3SG`, `OBJECT_SHADOWY`, `OBJECT_NATURAL`, `BATTLE_ADJ`, `LAW_TOPIC`, etc.

Store the result directly as `lexemeLists/argonian/verb_3sg.json`.

You can automate this:

* have a small schema:

  ```ts
  interface LexemeSlotSpec {
    id: string;             // "argo_verbs_3sg"
    cultureId: string;      // "argonian"
    pos: string;            // "verb_3sg"
    style: string;          // freeform text
    desiredCount: number;   // 30, 50, etc.
  }
  ```

* a script loops over all specs, calls the LLM once per spec, and saves JSON.

You still skim the results, but you aren’t hand-typing.

### 1.2 Corpora-mined lexemes (for realism and volume)

If you want less “LLM hallucination” and more grounded style:

1. Gather a text corpus matching the vibe:

    * legal texts for law slots
    * epic fantasy for elven spells
    * war histories for battle names
    * etc.

2. Run a simple CPU NLP pipeline:

    * tokenize
    * POS-tag
    * (optional) lemmatize

3. Filter by POS + heuristics:

    * VERB_3SG: tokens tagged `VBZ`, frequency between `[min, max]`
    * NOUN_ABSTRACT: `NN` / `NNS` with high type/token ratio and not concrete (you can approximate with a predefined stop list or 1 LLM pass)
    * ADJECTIVE_BATTLE: `JJ` around “battle”, “war”, etc.

4. Rank by frequency and cut a top-N list.

This gives you grounded lexemes. You can then:

* union them with LLM-generated ones
* dedupe
* run a cheap style filter (see 1.3)

### 1.3 Automatic quality filtering

Before you ever manually look:

* Remove entries:

    * outside allowed length range
    * with forbidden characters
    * that appear in a global “banned words” list
* Optional LLM pass as a cheap judge:

    * “Given the culture/style description and this list, remove any words that feel out of place or modern/earth-coded.”

This turns LLM into a critiquer instead of sole author.

---

## 2. Template composition: not all by hand either

Templates are *much* sparser than lexemes. You don’t need many: 5–15 per type/culture is usually enough.

You can get them via:

### 2.1 LLM-generated template sets

Same trick as lexemes, but targeting patterns:

> “For Argonian phrase-names like ‘Walks-in-Shadows’, design 10 naming templates.
> Represent each template as a JSON object with:
>
> * id
> * template string using slots in {{UPPERCASE}}
> * slot definitions (name + brief description)
    >   Use only slots VERB_3SG, PREPOSITION, OBJECT_NOUN, NATURAL_NOUN, ABSTRACT_NOUN.
    >   Don’t fill slots with actual words, just define patterns.”

Output example:

```json
[
  {
    "id": "phrase_basic",
    "template": "{{VERB_3SG}}-{{PREPOSITION}}-{{OBJECT_NOUN}}",
    "slots": {
      "VERB_3SG": "verb describing motion or posture",
      "PREPOSITION": "short preposition like in, from, under",
      "OBJECT_NOUN": "dark or watery noun"
    }
  },
  {
    "id": "phrase_double_object",
    "template": "{{VERB_3SG}}-{{PREPOSITION}}-{{OBJECT_NOUN}}-and-{{OBJECT_NOUN_2}}",
    "slots": {
      "VERB_3SG": "as above",
      "PREPOSITION": "as above",
      "OBJECT_NOUN": "noun 1",
      "OBJECT_NOUN_2": "noun 2, contrasting with noun 1"
    }
  }
]
```

You then map slot names to your actual `SlotConfig`s manually or semi-automatically (“slot name starting with VERB_ → lexeme list id X”).

You can have a script that:

* reads template specs from LLM
* resolves each slot to a slot type (phonotactic / lexemeList / entityName) via lookups
* warns if a slot has no known list.

### 2.2 Corpus-mined templates

For certain styles (laws, battles, bureaucratic stuff) corpora mining works well:

Process:

1. Collect sentences containing keywords:

    * “Battle of”, “Siege of”, “The War of”
    * “Act”, “Resolution”, “Treaty”, etc.

2. Run dependency parsing or just regex heuristics:

    * e.g. detect patterns: `"Battle of <ProperNoun>"`, `"<Ordinal> <Noun> Act"`, `"The <Adj> <Noun> War"`

3. Generalize to templates:

    * “Battle of {{PROPER_NOUN}}”
    * “The {{ORDINAL}} {{ABSTRACT_NOUN}} Act”
    * “The {{ADJ}} War of {{PLACE}}”

4. Map placeholders to slot types:

    * `{{PROPER_NOUN}}` → subGenerator from location/person profile
    * `{{ORDINAL}}` → lexeme list `ordinals`
    * `{{ABSTRACT_NOUN}}` → lexeme list `law_topics`
    * `{{PLACE}}` → entityName from `location.synthetic`

Again, everything after mining is config.

---

## 3. Minimizing manual work without losing control

If you want this to be genuinely scalable:

### 3.1 Define a small meta-schema

Have one authoritative schema for both lexemes and templates:

```ts
interface LexemeSlotSpec {
  id: string;             // "elf_battle_adj"
  cultureId: string;
  pos: string;            // "adj", "verb_3sg", etc.
  style: string;          // natural language style notes
  targetCount: number;
  sourceMode: "llm" | "corpus" | "mixed";
}

interface TemplateSpec {
  id: string;             // "elf_battle"
  cultureId: string;
  type: string;           // "battle", "spell", etc.
  style: string;          // “formal, Latinate, empire”
  slotHints: string[];    // ["ORDINAL", "ABSTRACT_NOUN", "PLACE"]
  sourceMode: "llm" | "corpus" | "mixed";
}
```

Write **one generator script** that:

* iterates LexemeSlotSpec → generates or mines lexeme lists
* iterates TemplateSpec → generates or mines templates

Your manual job becomes:

* tweak specs (style, targetCount, slotHints)
* spot-check outputs.

### 3.2 Use LLM as critic/optimizer, not just generator

For templates especially, you can run an iterative loop:

1. Ask LLM for a batch of templates.
2. Generate e.g. 50 sample names using them + your lexemes.
3. Feed sample names back and ask:

    * “Which templates are too similar / boring?”
    * “Propose replacements to increase variety.”

That lets you converge toward a good template set with minimal hand editing.

---

## 4. Safety checks and “does this actually help my generator?”

After you’ve auto-generated lexemes & templates, you can wire them straight into your existing **validation framework**:

* generate names using new lexemes/templates
* check:

    * capacity (collisions)
    * diffuseness (nearest-neighbor distances)
    * semiotic separation between types/cultures

If a lexeme/template set produces:

* too many near-duplicates → your lexeme lists are too narrow or templates too rigid
* domain confusion → templates/lexemes between cultures aren’t distinct enough

You then:

* either auto-regenerate the weakest list/template via LLM, or
* adjust your LexemeSlotSpec / TemplateSpec (style, allowed POS) and rerun generation.

---

Bottom line:

* **Lexemes**: LLM + corpus + simple NLP → you never hand-type more than a few seeds and filters.
* **Templates**: LLM + pattern mining from corpora → you author specs, not strings.
* Your validation engine then tells you whether those auto-generated bits actually work for the names you care about.

If you want, I can next sketch a concrete TypeScript “builder” module that:

* takes `LexemeSlotSpec` / `TemplateSpec`
* assumes “results already fetched from LLM/corpus”
* assembles them into the `NamingProfile` / `SlotConfig` shapes we talked about, so Codex just plugs new data in.
