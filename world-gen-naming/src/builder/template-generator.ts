/**
 * Template Generator (Phase 5)
 *
 * Generates naming templates using LLM based on specifications.
 */

import type {
  TemplateSpec,
  TemplateGenerationResult,
  SlotHint,
} from "../types/builder-spec.js";
import type { LLMClient } from "./llm-client.js";

/**
 * Generate templates using LLM
 */
export async function generateTemplates(
  spec: TemplateSpec,
  llmClient: LLMClient,
  options?: { verbose?: boolean }
): Promise<TemplateGenerationResult> {
  const startTime = Date.now();
  const verbose = options?.verbose ?? false;

  if (verbose) {
    console.log(`\nGenerating templates: ${spec.id}`);
    console.log(`  Culture: ${spec.cultureId}`);
    console.log(`  Type: ${spec.type}`);
    console.log(`  Target count: ${spec.targetCount}`);
  }

  // Build the prompt
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(spec);

  if (verbose) {
    console.log(`  Calling LLM...`);
  }

  // Call LLM
  const { data, tokensUsed, attempts } = await llmClient.generateWithRetries(
    systemPrompt,
    userPrompt,
    validateTemplateResponse,
    3 // Max 3 retries
  );

  if (verbose) {
    console.log(
      `  Received ${data.templates.length} templates (${attempts} attempts, ${tokensUsed} tokens)`
    );
  }

  // Validate templates match spec
  const validated = validateTemplatesAgainstSpec(data.templates, spec);

  if (verbose && validated.invalid.length > 0) {
    console.log(`  Filtered ${validated.invalid.length} invalid templates`);
  }

  const durationMs = Date.now() - startTime;

  return {
    spec,
    templates: validated.valid,
    filtered: validated.invalid.length,
    source: "llm",
    metadata: {
      promptUsed: userPrompt,
      tokensUsed,
      durationMs,
    },
  };
}

/**
 * Build system prompt for template generation
 */
function buildSystemPrompt(): string {
  return `You are a template designer for a fantasy world name generation system.

Your job is to create naming templates that capture cultural and stylistic patterns.

Guidelines:
- Design templates that match the specified culture and entity type
- Use {{SLOT_NAME}} syntax for placeholders (all caps, underscores for spaces)
- Each slot should have a clear purpose
- Templates should be diverse (avoid repetition)
- Keep templates appropriate for a game/fantasy setting
- Don't fill in the slots - only define the pattern

Return your response as a JSON object with this structure:
{
  "templates": [
    {
      "id": "unique_template_id",
      "template": "{{SLOT1}}-{{SLOT2}}-{{SLOT3}}",
      "slots": {
        "SLOT1": {
          "kind": "lexemeList",
          "description": "what this slot represents"
        },
        "SLOT2": {
          "kind": "lexemeList",
          "description": "what this slot represents"
        }
      }
    }
  ],
  "notes": "optional notes about your design choices"
}`;
}

/**
 * Build user prompt for a specific template spec
 */
function buildUserPrompt(spec: TemplateSpec): string {
  let prompt = `Generate naming templates with the following specifications:

**Culture**: ${spec.cultureId}
**Entity Type**: ${spec.type}
**Style**: ${spec.style}
**Target Count**: ${spec.targetCount} templates`;

  if (spec.description) {
    prompt += `\n**Description**: ${spec.description}`;
  }

  // List available slots
  if (spec.slotHints.length > 0) {
    prompt += `\n\n**Available Slots**:`;
    for (const hint of spec.slotHints) {
      prompt += `\n- {{${hint.name}}} (${hint.kind}): ${hint.description}`;
    }
    prompt += `\n\nYou should use these slot names in your templates.`;
  }

  // Add examples if provided
  if (spec.examples && spec.examples.length > 0) {
    prompt += `\n\n**Example templates** (for style reference):`;
    for (const example of spec.examples) {
      prompt += `\n- ${example}`;
    }
  }

  prompt += `\n\nGenerate ${spec.targetCount} diverse naming templates that match these specifications. Return as JSON.`;

  return prompt;
}

/**
 * Validate LLM response for template generation
 */
function validateTemplateResponse(data: unknown): {
  templates: Array<{
    id: string;
    template: string;
    slots: Record<string, { kind: string; description: string }>;
  }>;
  notes?: string;
} {
  if (typeof data !== "object" || data === null) {
    throw new Error("Response must be an object");
  }

  if (!("templates" in data) || !Array.isArray((data as any).templates)) {
    throw new Error("Response must have 'templates' array");
  }

  const templates = (data as any).templates;

  // Validate each template
  for (const template of templates) {
    if (typeof template !== "object" || template === null) {
      throw new Error("Each template must be an object");
    }

    if (typeof template.id !== "string") {
      throw new Error("Each template must have 'id' string");
    }

    if (typeof template.template !== "string") {
      throw new Error("Each template must have 'template' string");
    }

    if (
      typeof template.slots !== "object" ||
      template.slots === null ||
      Array.isArray(template.slots)
    ) {
      throw new Error("Each template must have 'slots' object");
    }

    // Validate slots
    for (const [slotName, slotConfig] of Object.entries(template.slots)) {
      if (typeof slotConfig !== "object" || slotConfig === null) {
        throw new Error(`Slot ${slotName} must be an object`);
      }

      const config = slotConfig as any;

      if (typeof config.kind !== "string") {
        throw new Error(`Slot ${slotName} must have 'kind' string`);
      }

      if (typeof config.description !== "string") {
        throw new Error(`Slot ${slotName} must have 'description' string`);
      }
    }
  }

  return {
    templates,
    notes: (data as any).notes,
  };
}

/**
 * Validate templates against spec
 * Ensures slots used in templates match available slot hints
 */
function validateTemplatesAgainstSpec(
  templates: Array<{
    id: string;
    template: string;
    slots: Record<string, { kind: string; description: string }>;
  }>,
  spec: TemplateSpec
): {
  valid: typeof templates;
  invalid: Array<{ template: typeof templates[0]; reason: string }>;
} {
  const valid: typeof templates = [];
  const invalid: Array<{ template: typeof templates[0]; reason: string }> = [];

  // Build map of available slot names (case-insensitive)
  const availableSlotNames = new Set(
    spec.slotHints.map((h) => h.name.toUpperCase())
  );

  for (const template of templates) {
    // Extract slot names from template string
    const slotPattern = /\{\{(\w+)\}\}/g;
    const slotsInTemplate = new Set<string>();
    let match;

    while ((match = slotPattern.exec(template.template)) !== null) {
      slotsInTemplate.add(match[1].toUpperCase());
    }

    // Check if all slots in template are available
    let isValid = true;
    let reason = "";

    for (const slotName of slotsInTemplate) {
      if (!availableSlotNames.has(slotName)) {
        isValid = false;
        reason = `Uses unavailable slot: ${slotName}`;
        break;
      }
    }

    // Check if template has at least one slot
    if (slotsInTemplate.size === 0) {
      isValid = false;
      reason = "Template has no slots";
    }

    if (isValid) {
      valid.push(template);
    } else {
      invalid.push({ template, reason });
    }
  }

  return { valid, invalid };
}

/**
 * Generate multiple template sets in batch
 */
export async function generateMultipleTemplates(
  specs: TemplateSpec[],
  llmClient: LLMClient,
  options?: { verbose?: boolean; continueOnError?: boolean }
): Promise<{
  results: TemplateGenerationResult[];
  errors: Array<{ spec: TemplateSpec; error: Error }>;
}> {
  const results: TemplateGenerationResult[] = [];
  const errors: Array<{ spec: TemplateSpec; error: Error }> = [];
  const verbose = options?.verbose ?? false;
  const continueOnError = options?.continueOnError ?? true;

  if (verbose) {
    console.log(`\n=== Generating ${specs.length} template sets ===`);
  }

  for (let i = 0; i < specs.length; i++) {
    const spec = specs[i];

    if (verbose) {
      console.log(`\n[${i + 1}/${specs.length}] ${spec.id}`);
    }

    try {
      const result = await generateTemplates(spec, llmClient, options);
      results.push(result);
    } catch (error) {
      errors.push({ spec, error: error as Error });

      if (verbose) {
        console.error(`  ❌ Failed: ${(error as Error).message}`);
      }

      if (!continueOnError) {
        throw error;
      }
    }

    // Small delay between requests to avoid rate limiting
    if (i < specs.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  if (verbose) {
    console.log(`\n=== Summary ===`);
    console.log(`  Successful: ${results.length}`);
    console.log(`  Failed: ${errors.length}`);
    if (errors.length > 0) {
      console.log(`  Errors:`);
      errors.forEach(({ spec, error }) => {
        console.log(`    - ${spec.id}: ${error.message}`);
      });
    }
  }

  return { results, errors };
}
