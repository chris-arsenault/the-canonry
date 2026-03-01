/**
 * Fuzzy Anchor Matching
 *
 * Resolves an LLM-produced anchor phrase to a verbatim substring in a target
 * text. LLMs frequently paraphrase rather than quoting exactly, so this module
 * treats the phrase as a location hint and extracts a real substring.
 *
 * Algorithm:
 * 1. Exact match (case-insensitive) — return the matched span as-is.
 * 2. Fuzzy locate — slide a word-window across the text, score by content-word
 *    overlap, find the best-matching region.
 * 3. Extract — from the best region, return a verbatim span of similar length
 *    that is unique within the text.
 *
 * Shared by chronicle backref anchors and image ref anchors.
 */

const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "in",
  "on",
  "at",
  "to",
  "for",
  "of",
  "with",
  "by",
  "from",
  "as",
  "is",
  "was",
  "are",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "shall",
  "can",
  "not",
  "no",
  "nor",
  "so",
  "yet",
  "both",
  "each",
  "its",
  "it",
  "this",
  "that",
  "these",
  "those",
  "he",
  "she",
  "they",
  "we",
  "you",
  "her",
  "his",
  "their",
  "our",
  "your",
  "who",
  "which",
  "what",
  "when",
  "where",
  "how",
]);

/** Normalize a word for comparison: lowercase, strip leading/trailing punctuation */
function normalize(word: string): string {
  // eslint-disable-next-line sonarjs/slow-regex -- single word, no ReDoS risk
  return word.toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, "");
}

/** Extract content words (non-stop, non-empty after normalization) */
function contentWords(text: string): string[] {
  return text
    .split(/\s+/)
    .map(normalize)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

/** Split text into words preserving positions */
interface WordPos {
  word: string;
  normalized: string;
  start: number;
  end: number;
}

function wordPositions(text: string): WordPos[] {
  const result: WordPos[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    result.push({
      word: m[0],
      normalized: normalize(m[0]),
      start: m.index,
      end: m.index + m[0].length,
    });
  }
  return result;
}

export interface FuzzyAnchorResult {
  /** The verbatim substring from the target text */
  phrase: string;
  /** Character index where the phrase starts in the text */
  index: number;
  /** How the match was found */
  method: "exact" | "fuzzy";
}

/**
 * Resolve an LLM-produced anchor phrase to a verbatim substring in the text.
 *
 * Returns null if no reasonable match is found.
 */
function tryExactMatch(anchorPhrase: string, text: string): FuzzyAnchorResult | null {
  const exactIdx = text.toLowerCase().indexOf(anchorPhrase.toLowerCase());
  if (exactIdx < 0) return null;
  return {
    phrase: text.slice(exactIdx, exactIdx + anchorPhrase.length),
    index: exactIdx,
    method: "exact",
  };
}

function findBestCenter(
  words: WordPos[],
  phraseWordSet: Set<string>,
  halfWindow: number
): { bestScore: number; bestCenter: number } {
  let bestScore = 0;
  let bestCenter = -1;

  for (let i = 0; i < words.length; i++) {
    let score = 0;
    const start = Math.max(0, i - halfWindow);
    const end = Math.min(words.length, i + halfWindow + 1);
    for (let j = start; j < end; j++) {
      if (phraseWordSet.has(words[j].normalized)) {
        score++;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestCenter = i;
    }
  }

  return { bestScore, bestCenter };
}

function isSentenceTerminator(ch: string): boolean {
  return ch === "." || ch === "!" || ch === "?";
}

function findSentenceStart(text: string, centerCharStart: number, fallback: number): number {
  for (let c = centerCharStart - 1; c >= Math.max(0, fallback - 200); c--) {
    if (c === 0) return 0;
    const ch = text[c];
    if (isSentenceTerminator(ch) && c + 1 < text.length && /\s/.test(text[c + 1])) {
      return c + 2;
    }
  }
  return fallback;
}

function findSentenceEnd(text: string, centerCharEnd: number, fallback: number): number {
  for (let c = centerCharEnd; c < Math.min(text.length, fallback + 200); c++) {
    if (isSentenceTerminator(text[c])) return c + 1;
  }
  return fallback;
}

function snapToSentence(text: string, candidate: string, charStart: number, charEnd: number, centerCharStart: number, centerCharEnd: number): string {
  const sentenceStart = findSentenceStart(text, centerCharStart, charStart);
  const sentenceEnd = findSentenceEnd(text, centerCharEnd, charEnd);
  const sentence = text.slice(sentenceStart, sentenceEnd).trim();
  if (sentence.length > 0 && sentence.length <= 300) return sentence;
  return candidate;
}

function ensureUnique(text: string, candidate: string, centerCharStart: number, anchorWordCount: number): string {
  if (candidate.length === 0) return candidate;
  const firstOccurrence = text.indexOf(candidate);
  const secondOccurrence = text.indexOf(candidate, firstOccurrence + 1);
  if (secondOccurrence < 0) return candidate;
  const uniqueCandidate = findUniqueSpan(text, centerCharStart, anchorWordCount);
  return uniqueCandidate ?? candidate;
}

export function resolveAnchorPhrase(anchorPhrase: string, text: string): FuzzyAnchorResult | null {
  if (!anchorPhrase || !text) return null;

  const exact = tryExactMatch(anchorPhrase, text);
  if (exact) return exact;

  const phraseContentWords = contentWords(anchorPhrase);
  if (phraseContentWords.length === 0) return null;

  const phraseWordSet = new Set(phraseContentWords);
  const words = wordPositions(text);
  if (words.length === 0) return null;

  const anchorWordCount = anchorPhrase.split(/\s+/).length;
  const halfWindow = Math.floor(Math.max(anchorWordCount, 4) / 2);

  const { bestScore, bestCenter } = findBestCenter(words, phraseWordSet, halfWindow);

  if (bestScore < Math.max(1, Math.ceil(phraseContentWords.length * 0.4))) return null;

  const spanStart = Math.max(0, bestCenter - halfWindow);
  const spanEnd = Math.min(words.length - 1, bestCenter + halfWindow);
  const charStart = words[spanStart].start;
  const charEnd = words[spanEnd].end;

  let candidate = text.slice(charStart, charEnd);
  const centerCharStart = words[bestCenter].start;
  const centerCharEnd = words[bestCenter].end;

  candidate = snapToSentence(text, candidate, charStart, charEnd, centerCharStart, centerCharEnd);
  candidate = ensureUnique(text, candidate, centerCharStart, anchorWordCount);

  if (!candidate || candidate.length < 3) return null;

  const finalIdx = text.indexOf(candidate);
  if (finalIdx < 0) return null;

  return { phrase: candidate, index: finalIdx, method: "fuzzy" };
}

/**
 * Extract ~wordCount words centered around a character index, snapped to word
 * boundaries. Used as a proportional-index fallback when fuzzy anchor matching
 * fails after a copy edit.
 */
export function extractWordsAroundIndex(
  text: string,
  index: number,
  wordCount: number
): string | null {
  if (!text || index < 0 || index >= text.length) return null;

  const words = wordPositions(text);
  if (words.length === 0) return null;

  // Find the word closest to the target index
  let centerIdx = 0;
  for (let i = 0; i < words.length; i++) {
    if (words[i].start <= index && words[i].end >= index) {
      centerIdx = i;
      break;
    }
    if (words[i].start > index) {
      centerIdx = Math.max(0, i - 1);
      break;
    }
    centerIdx = i; // last word if index is past end
  }

  const half = Math.floor(wordCount / 2);
  const start = Math.max(0, centerIdx - half);
  const end = Math.min(words.length - 1, start + wordCount - 1);
  const candidate = text.slice(words[start].start, words[end].end);

  return candidate && candidate.length >= 3 ? candidate : null;
}

/**
 * Try to find a unique span of ~wordCount words centered at the given
 * character position in the text.
 */
function findUniqueSpan(text: string, centerChar: number, targetWords: number): string | null {
  const words = wordPositions(text);
  // Find the word closest to centerChar
  let centerIdx = 0;
  for (let i = 0; i < words.length; i++) {
    if (words[i].start <= centerChar && words[i].end >= centerChar) {
      centerIdx = i;
      break;
    }
    if (words[i].start > centerChar) {
      centerIdx = Math.max(0, i - 1);
      break;
    }
  }

  // Try expanding word count until unique
  for (let size = targetWords; size <= targetWords + 6; size++) {
    const half = Math.floor(size / 2);
    const start = Math.max(0, centerIdx - half);
    const end = Math.min(words.length - 1, centerIdx + half);
    const candidate = text.slice(words[start].start, words[end].end);
    if (!candidate) continue;

    const first = text.indexOf(candidate);
    const second = text.indexOf(candidate, first + 1);
    if (second < 0) return candidate; // unique
  }

  return null;
}
