/**
 * Shared assembly helpers for narrative pipelines.
 */

import type { AssemblyResult, ChronicleGenerationContext, ChroniclePlan } from '../chronicleTypes';

export function assembleSections(
  plan: ChroniclePlan,
  _context: ChronicleGenerationContext,
  options: {
    includeTitle?: boolean;
    includeSectionTitles?: boolean;
  } = {}
): AssemblyResult {
  const {
    includeTitle = true,
    includeSectionTitles = false,
  } = options;

  try {
    const missingSections = plan.sections.filter((s) => !s.generatedContent);
    if (missingSections.length > 0) {
      return {
        success: false,
        error: `Missing content for ${missingSections.length} section(s): ${missingSections.map((s) => s.name).join(', ')}`,
      };
    }

    const parts: string[] = [];

    if (includeTitle) {
      parts.push(`# ${plan.title}\n\n`);
    }

    for (let i = 0; i < plan.sections.length; i += 1) {
      const section = plan.sections[i];

      if (i > 0) {
        parts.push('\n\n---\n\n');
      }

      if (includeSectionTitles && section.name) {
        parts.push(`## ${section.name}\n\n`);
      }

      parts.push(section.generatedContent || '');
    }

    const content = parts.join('');

    return {
      success: true,
      content,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during assembly',
    };
  }
}
