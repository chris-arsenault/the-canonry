/**
 * Entity Rename - Grammar-aware replacement adjustment
 *
 * Applies deterministic rules for article deduplication, case echo,
 * mid-sentence lowercasing, a/an agreement, and possessive transfer.
 */

import type { AdjustedReplacement } from "./entityRenameTypes";

function rawCtxBefore(ctx: string): string {
  return ctx.startsWith("...") ? ctx.slice(3) : ctx;
}

function rawCtxAfter(ctx: string): string {
  return ctx.endsWith("...") ? ctx.slice(0, -3) : ctx;
}

function isAtSentenceStart(rawBefore: string): boolean {
  if (rawBefore.length === 0) return true;
  const trimmed = rawBefore.trimEnd();
  if (trimmed.length === 0) return true;
  const last = trimmed[trimmed.length - 1];
  return ".!?:\n".includes(last);
}

interface PrecedingArticle {
  text: string;
  normalized: "the" | "a" | "an";
  length: number;
}

function findPrecedingArticle(rawBefore: string): PrecedingArticle | null {
  const m = rawBefore.match(/(the|an?)\s+$/i);
  if (!m) return null;
  const fullMatch = m[0];
  const norm = m[1].toLowerCase() as "the" | "a" | "an";
  const beforeArticle = rawBefore.slice(0, rawBefore.length - fullMatch.length);
  if (beforeArticle.length > 0) {
    const lastChar = beforeArticle[beforeArticle.length - 1];
    if (/[a-zA-Z0-9]/.test(lastChar)) return null;
  }
  return { text: fullMatch, normalized: norm, length: fullMatch.length };
}

type CasePattern = "allCaps" | "allLower" | "mixed";

function detectCasePattern(text: string): CasePattern {
  const letters = text.replace(/[^a-zA-Z]/g, "");
  if (letters.length === 0) return "mixed";
  if (letters === letters.toUpperCase()) return "allCaps";
  if (letters === letters.toLowerCase()) return "allLower";
  return "mixed";
}

const CONSONANT_SOUND_VOWEL_PREFIXES = [
  "uni", "use", "used", "user", "using", "usual", "usually",
  "unique", "union", "unit", "united", "universal", "university", "euro",
];
const VOWEL_SOUND_CONSONANT_PREFIXES = ["hour", "honest", "honor", "honour", "heir", "herb"];

function startsWithVowelSound(text: string): boolean {
  const trimmed = text.trimStart();
  if (trimmed.length === 0) return false;
  const firstWord = trimmed.split(/\s/)[0].toLowerCase();
  for (const prefix of CONSONANT_SOUND_VOWEL_PREFIXES) {
    if (firstWord.startsWith(prefix)) return false;
  }
  for (const prefix of VOWEL_SOUND_CONSONANT_PREFIXES) {
    if (firstWord.startsWith(prefix)) return true;
  }
  return "aeiou".includes(firstWord[0]);
}

interface GrammarState {
  position: number;
  originalLength: number;
  replacement: string;
}

function applyCaseEcho(state: GrammarState, casePattern: CasePattern): void {
  if (casePattern === "allCaps") {
    state.replacement = state.replacement.toUpperCase();
  } else if (casePattern === "allLower") {
    state.replacement = state.replacement.toLowerCase();
  }
}

function applyArticleDeduplication(
  state: GrammarState, matchPosition: number,
  matchedTextLength: number, precedingArticle: PrecedingArticle | null
): boolean {
  if (!/^the\s/i.test(state.replacement) || !precedingArticle) return false;
  const theMatch = state.replacement.match(/^(the\s+)/i);
  if (!theMatch) return false;
  const withoutThe = state.replacement.slice(theMatch[0].length);
  if (precedingArticle.normalized === "the") {
    state.replacement = withoutThe;
  } else {
    state.position = matchPosition - precedingArticle.length;
    state.originalLength = matchedTextLength + precedingArticle.length;
    const wasCapitalized = /^[A-Z]/.test(precedingArticle.text);
    state.replacement = (wasCapitalized ? "The " : "the ") + withoutThe;
  }
  return true;
}

function applyMidSentenceArticleLowercasing(state: GrammarState): void {
  const articleMatch = state.replacement.match(/^(The|A|An)\b/);
  if (articleMatch) {
    state.replacement = articleMatch[1].toLowerCase() + state.replacement.slice(articleMatch[1].length);
  }
}

function applyAAnAgreement(
  state: GrammarState, matchPosition: number,
  matchedTextLength: number, precedingArticle: PrecedingArticle
): void {
  const needsAn = startsWithVowelSound(state.replacement);
  if (needsAn === (precedingArticle.normalized === "an")) return;
  const correctArticle = needsAn ? "an" : "a";
  const wasCapitalized = /^[A-Z]/.test(precedingArticle.text);
  const casedArticle = wasCapitalized
    ? correctArticle[0].toUpperCase() + correctArticle.slice(1)
    : correctArticle;
  state.position = matchPosition - precedingArticle.length;
  state.originalLength = matchedTextLength + precedingArticle.length;
  state.replacement = casedArticle + " " + state.replacement;
}

function isAlreadyPossessive(text: string): boolean {
  return text.endsWith("'s") || text.endsWith("\u2019s") || text.endsWith("'") || text.endsWith("\u2019");
}

function appendPossessiveSuffix(text: string, apostrophe: string): string {
  const lastChar = text[text.length - 1]?.toLowerCase() ?? "";
  const useBareSuffix = lastChar === "s" || lastChar === "x" || lastChar === "z";
  return text + (useBareSuffix ? apostrophe : apostrophe + "s");
}

function applyPossessiveTransfer(state: GrammarState, rawAfter: string): void {
  const possessiveMatch = rawAfter.match(
    /^(?:'\u0073|\u2019s|'(?=[^a-zA-Z]|$)|\u2019(?=[^a-zA-Z]|$))/
  );
  if (!possessiveMatch) return;
  if (isAlreadyPossessive(state.replacement)) return;
  const possessiveText = possessiveMatch[0];
  state.originalLength += possessiveText.length;
  const apostrophe = possessiveText.includes("\u2019") ? "\u2019" : "'";
  state.replacement = appendPossessiveSuffix(state.replacement, apostrophe);
}

export function adjustReplacementForGrammar(
  contextBefore: string, contextAfter: string,
  matchPosition: number, matchedText: string, replacement: string
): AdjustedReplacement {
  const state: GrammarState = {
    position: matchPosition, originalLength: matchedText.length, replacement,
  };
  const rawBefore = rawCtxBefore(contextBefore);
  const rawAfter = rawCtxAfter(contextAfter);
  const sentenceStart = isAtSentenceStart(rawBefore);
  const casePattern = detectCasePattern(matchedText);
  applyCaseEcho(state, casePattern);
  const precedingArticle = findPrecedingArticle(rawBefore);
  const replacementStartsWithThe = /^the\s/i.test(state.replacement);
  const articleAbsorbed = applyArticleDeduplication(state, matchPosition, matchedText.length, precedingArticle);
  if (!sentenceStart && casePattern !== "allCaps" && !articleAbsorbed) {
    applyMidSentenceArticleLowercasing(state);
  }
  if (precedingArticle && !replacementStartsWithThe && !articleAbsorbed
    && (precedingArticle.normalized === "a" || precedingArticle.normalized === "an")) {
    applyAAnAgreement(state, matchPosition, matchedText.length, precedingArticle);
  }
  applyPossessiveTransfer(state, rawAfter);
  return { position: state.position, originalLength: state.originalLength, replacement: state.replacement };
}
