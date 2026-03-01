/**
 * Shared assembly helpers for narrative pipelines.
 */

import type {
  AssemblyResult,
  ChronicleGenerationContext,
  ChroniclePlan,
  ChronicleSection,
} from "../../chronicleTypes";

/**
 * Check for sections missing generated content and return an error message if any.
 */
function findMissingSections(sections: ChronicleSection[]): string | null {
  const missing = sections.filter((s: ChronicleSection) => !s.generatedContent);
  if (missing.length === 0) return null;
  const names = missing.map((s: ChronicleSection) => s.name).join(", ");
  return `Missing content for ${missing.length} section(s): ${names}`;
}

/**
 * Join section content with optional titles and separators.
 */
function joinSections(
  sections: ChronicleSection[],
  options: { includeTitle: boolean; includeSectionTitles: boolean; title: string }
): string {
  const parts: string[] = [];

  if (options.includeTitle) {
    parts.push(`# ${options.title}\n\n`);
  }

  for (let i = 0; i < sections.length; i += 1) {
    const section: ChronicleSection = sections[i];

    if (i > 0) {
      parts.push("\n\n---\n\n");
    }

    if (options.includeSectionTitles && section.name) {
      parts.push(`## ${section.name}\n\n`);
    }

    parts.push(section.generatedContent || "");
  }

  return parts.join("");
}

export function assembleSections(
  plan: ChroniclePlan,
  _context: ChronicleGenerationContext,
  options: {
    includeTitle?: boolean;
    includeSectionTitles?: boolean;
  } = {}
): AssemblyResult {
  const { includeTitle = true, includeSectionTitles = false } = options;

  try {
    const missingError = findMissingSections(plan.sections);
    if (missingError) {
      return { success: false, error: missingError };
    }

    const content = joinSections(plan.sections, {
      includeTitle,
      includeSectionTitles,
      title: plan.title,
    });

    return { success: true, content };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error during assembly",
    };
  }
}
