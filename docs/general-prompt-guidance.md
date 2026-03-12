# General Prompt Guidance

Reference for writing LLM prompts across the-canonry toolchain. These principles apply to all prompt construction — title generation, metadata classification, narrative generation, and any future LLM-driven pipeline.

## Core Principle: Positive Framing Only

Negative instructions ("never do X", "avoid Y", "don't Z") activate the unwanted pattern in the model's attention. This is the **Pink Elephant Problem** — telling someone "don't think about a pink elephant" puts the pink elephant front and center.

Every constraint must be expressed as what the model *should* do, not what it should avoid.

| Negative (broken) | Positive (works) |
|---|---|
| "Never describe the visual content" | "Title the subtext — the emotional stakes, the narrative tension, the unspoken consequence" |
| "Don't use generic titles" | "Each title should be specific enough that it could only belong to this image's story" |
| "Avoid the pattern [Name] in [Setting]" | "Titles name meaning, not location or identity" |
| "Don't be repetitive across the batch" | *(use structural diversity — see below)* |

## Role and Persona

Vague roles ("you are a helpful assistant") do nothing. Detailed creative sensibility works.

**Effective:** Describe the *specific taste* you want. What does this person care about? What's their aesthetic? What's their decision-making framework?

```
You title artwork for a gallery. Think like a curator writing placards —
the viewer's eyes handle the visual, so the title handles the subtext.
```

**Ineffective:** "You are a creative title generator." (No taste, no framework, no perspective.)

## Structured Thinking Phases

Separate analytical and generative steps. The model produces better creative output when it first builds understanding, then creates from that understanding.

```
Your process:
1. Read the subject, style, and narrative context. Understand what this image is ABOUT.
2. Identify the single most resonant thread — the tension, the irony, the weight.
3. Title that thread.
```

This works because step 1-2 prime the model's attention on the right features before step 3 asks it to generate.

## Batch Creative Diversity

RLHF training compresses output diversity. Verbal instructions to "be diverse" or "vary your style" have weak effect — the model's sampling distribution doesn't shift much from text instructions alone.

**Structural interventions that work:**

- **Smaller batches** — 5-10 items per call rather than 30. Fewer items means less pressure toward a median style.
- **Prompt variation across batches** — rotate framing, emphasis, or perspective cues between batch calls. Even small wording changes shift the attention distribution.
- **Random concept injection** — append a random thematic seed word or phrase per batch ("this batch: weight of memory", "this batch: edges and thresholds"). This biases each batch toward a different conceptual neighborhood.
- **Temperature and sampling** — higher temperature (0.9-1.0) for creative tasks. This is the most direct lever for output diversity.

**What doesn't work:**
- "Make each title unique and different from the others" — the model reads this, nods, and produces the same distribution.
- Long lists of style categories to rotate through — too prescriptive, collapses to alternation rather than genuine variety.

## Examples in Prompts

Examples are powerful signals — too powerful for batch creative work. When the model sees example titles, it treats them as a fill-in-the-blank template. Output collapses toward the syntactic pattern of the examples rather than generating from the described creative process.

**When examples help:** Classification tasks, format specification, structured output. The model needs to know the shape of the answer.

**When examples hurt:** Creative generation where diversity matters. The model needs to think, not pattern-match.

For creative tasks, describe the *thinking process* and *aesthetic criteria* instead. Trust that a capable model can generate from principles when given clear ones.

## Anthropic-Specific Notes

From Anthropic's prompting documentation:

- **"Tell Claude what to do, not what not to do."** — Their own guidance confirms the positive-framing principle.
- **System prompts set persistent context** — use them for role, taste, and process. Use user messages for per-batch specifics (the actual content to process).
- **Prefilling** — for JSON output, prefill the assistant response with `[` to lock the model into array output without needing "respond with JSON only" instructions. (Not yet used in our pipeline but worth considering.)
- **Chain of thought** — for classification tasks, asking the model to reason before answering improves accuracy. For title generation, the structured thinking phases serve this purpose without requiring visible CoT output.

## Applying This to New Prompts

When writing a new LLM prompt for any canonry tool:

1. **Start with the creative sensibility.** Who is this model pretending to be? What do they care about?
2. **Describe the thinking process** in 2-3 numbered steps. Analytical first, then generative.
3. **State constraints as positive directives.** "Titles name meaning" not "titles shouldn't describe visuals."
4. **For batch work, use structural diversity** (small batches, prompt rotation, concept injection, higher temperature) rather than verbal diversity instructions.
5. **Reserve examples for format/structure only.** If you need JSON output, show the JSON shape. If you need creative output, describe the aesthetic.
