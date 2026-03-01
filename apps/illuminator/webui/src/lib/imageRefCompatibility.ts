/**
 * Image Ref Compatibility Analysis
 *
 * Analyzes whether image refs from a previous chronicle version can be reused
 * in a new version based on anchor text presence and context similarity.
 */

import type {
  ChronicleImageRefs,
  ImageRefCompatibility,
  ImageRefCompatibilityAnalysis,
  ImageRefSelection,
} from "./chronicleTypes";

/**
 * Normalize text for comparison (lowercase, collapse whitespace).
 */
function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Check if anchor text exists in content.
 */
function findAnchorInContent(anchorText: string, content: string): boolean {
  const normalizedAnchor = normalizeText(anchorText);
  const normalizedContent = normalizeText(content);
  return normalizedContent.includes(normalizedAnchor);
}

/**
 * Get surrounding context (N characters before and after anchor).
 */
function getAnchorContext(
  anchorText: string,
  content: string,
  contextSize: number = 200
): string | null {
  const normalizedAnchor = normalizeText(anchorText);
  const normalizedContent = normalizeText(content);
  const index = normalizedContent.indexOf(normalizedAnchor);
  if (index === -1) return null;

  const start = Math.max(0, index - contextSize);
  const end = Math.min(normalizedContent.length, index + anchorText.length + contextSize);
  return normalizedContent.slice(start, end);
}

/**
 * Calculate Jaccard similarity between two sets of words.
 */
function jaccardSimilarity(text1: string, text2: string): number {
  const words1 = new Set(normalizeText(text1).split(/\s+/).filter(Boolean));
  const words2 = new Set(normalizeText(text2).split(/\s+/).filter(Boolean));

  if (words1.size === 0 && words2.size === 0) return 1;
  if (words1.size === 0 || words2.size === 0) return 0;

  let intersection = 0;
  for (const word of words1) {
    if (words2.has(word)) intersection++;
  }

  const union = words1.size + words2.size - intersection;
  return intersection / union;
}

/**
 * Analyze compatibility of a single image ref with new content.
 */
function analyzeImageRef(
  ref: ChronicleImageRef,
  oldContent: string,
  newContent: string
): ImageRefCompatibility {
  const anchorFound = findAnchorInContent(ref.anchorText, newContent);

  if (!anchorFound) {
    return {
      refId: ref.refId,
      anchorFound: false,
      contextSimilarity: 0,
      recommendation: "regenerate",
      reason: `Anchor text "${ref.anchorText.slice(0, 50)}..." not found in new content`,
    };
  }

  // Compare context around anchor in old vs new content
  const oldContext = getAnchorContext(ref.anchorText, oldContent);
  const newContext = getAnchorContext(ref.anchorText, newContent);

  if (!oldContext || !newContext) {
    return {
      refId: ref.refId,
      anchorFound: true,
      contextSimilarity: 0.5,
      recommendation: "manual_review",
      reason: "Anchor found but unable to extract context for comparison",
    };
  }

  const contextSimilarity = jaccardSimilarity(oldContext, newContext);

  // High similarity (>0.7) - likely safe to reuse
  if (contextSimilarity >= 0.7) {
    return {
      refId: ref.refId,
      anchorFound: true,
      contextSimilarity,
      recommendation: "reuse",
      reason: `Context is ${Math.round(contextSimilarity * 100)}% similar - safe to reuse`,
    };
  }

  // Medium similarity (0.4-0.7) - needs review
  if (contextSimilarity >= 0.4) {
    return {
      refId: ref.refId,
      anchorFound: true,
      contextSimilarity,
      recommendation: "manual_review",
      reason: `Context is ${Math.round(contextSimilarity * 100)}% similar - review recommended`,
    };
  }

  // Low similarity (<0.4) - regenerate
  return {
    refId: ref.refId,
    anchorFound: true,
    contextSimilarity,
    recommendation: "regenerate",
    reason: `Context changed significantly (${Math.round(contextSimilarity * 100)}% similar)`,
  };
}

/**
 * Analyze all image refs for compatibility with new content.
 */
export function analyzeImageRefCompatibility(
  imageRefs: ChronicleImageRefs,
  oldContent: string,
  newContent: string,
  sourceVersionId: string,
  targetVersionId: string
): ImageRefCompatibilityAnalysis {
  const refResults = imageRefs.refs.map((ref) => analyzeImageRef(ref, oldContent, newContent));

  const summary = {
    reusable: refResults.filter((r) => r.recommendation === "reuse").length,
    needsRegeneration: refResults.filter((r) => r.recommendation === "regenerate").length,
    needsReview: refResults.filter((r) => r.recommendation === "manual_review").length,
  };

  return {
    sourceVersionId,
    targetVersionId,
    refs: refResults,
    summary,
  };
}

/**
 * Create default selections based on compatibility analysis.
 */
export function createDefaultSelections(
  analysis: ImageRefCompatibilityAnalysis
): ImageRefSelection[] {
  return analysis.refs.map((ref) => ({
    refId: ref.refId,
    action: ref.recommendation === "regenerate" ? "regenerate" : "reuse",
  }));
}
