import type {
  BlockNode,
  Diagnostic,
  Value,
  StatementNode,
  AttributeNode,
} from './types.js';

import type { NamingResourceEntry, NamingResourceCollection } from './compile-types.js';
import { NAMING_RESOURCE_BLOCKS } from './compile-types.js';
import { isRecord, setObjectValue, applyLabelField, parseListTokens, mergeListFieldValue } from './compile-utils.js';
import { valueToJson, parseResourceReferenceValue, parseResourceReferenceLabel } from './compile-variables.js';
import { parseSetTokens, mergeSetFieldValue, applySetFieldAttribute } from './compile-sets.js';
import { buildObjectFromStatements } from './compile-objects.js';

export function normalizeForSignature(value: unknown): unknown {
  if (Array.isArray(value)) {
    return (value as unknown[]).map((entry: unknown) => normalizeForSignature(entry));
  }
  if (isRecord(value)) {
    const result: Record<string, unknown> = {};
    const keys = Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort((a, b) => a.localeCompare(b));
    for (const key of keys) {
      result[key] = normalizeForSignature(value[key]);
    }
    return result;
  }
  return value;
}

export function signatureForNamingResource(item: Record<string, unknown>): string {
  const payload = { ...item };
  delete payload.cultureId;
  delete payload.__emitCultureId;
  return JSON.stringify(normalizeForSignature(payload));
}

export function mergeNamingResourceEntries(
  entries: NamingResourceEntry[],
  label: string,
  diagnostics: Diagnostic[]
): NamingResourceEntry[] {
  const merged: NamingResourceEntry[] = [];
  const grouped = new Map<string, Map<string, NamingResourceEntry>>();

  for (const entry of entries) {
    const id = entry.item?.id;
    if (typeof id !== 'string') {
      merged.push(entry);
      continue;
    }
    const signature = signatureForNamingResource(entry.item);
    const bySignature = grouped.get(id) ?? new Map<string, NamingResourceEntry>();
    const existing = bySignature.get(signature);
    if (existing) {
      const cultures = new Set<string>([...existing.cultures, ...entry.cultures]);
      existing.cultures = Array.from(cultures).sort((a, b) => a.localeCompare(b));
      existing.item.cultureId = existing.cultures.length === 1 ? existing.cultures[0] : existing.cultures;
      if (entry.item.__emitCultureId === true) {
        existing.item.__emitCultureId = true;
      }
    } else {
      bySignature.set(signature, {
        ...entry,
        cultures: Array.from(new Set(entry.cultures)).sort((a, b) => a.localeCompare(b))
      });
    }
    grouped.set(id, bySignature);
  }

  for (const [id, bySignature] of grouped.entries()) {
    if (bySignature.size > 1) {
      const spans = Array.from(bySignature.values()).map((entry) => entry.span).filter(Boolean);
      diagnostics.push({
        severity: 'error',
        message: `Duplicate ${label} "${id}" definitions detected; use a single block with culture_id or rename the resource`,
        span: spans[0]
      });
    }
    merged.push(...bySignature.values());
  }

  return merged;
}

export function extractCultureIds(
  item: Record<string, unknown>,
  diagnostics: Diagnostic[],
  span: BlockNode['span'],
  label: string
): string[] | null {
  const raw = item.cultureId;
  if (typeof raw === 'string') {
    return [raw];
  }
  if (Array.isArray(raw) && raw.every((entry) => typeof entry === 'string')) {
    return raw;
  }
  diagnostics.push({
    severity: 'error',
    message: `${label} requires culture_id`,
    span
  });
  return null;
}

export function collectNamingResources(
  blocks: BlockNode[],
  diagnostics: Diagnostic[]
): { blocks: BlockNode[]; resources: NamingResourceCollection } {

export function applyNamingResources(
  config: Record<string, unknown>,
  resources: NamingResourceCollection,
  diagnostics: Diagnostic[]
): void {
  const cultures = Array.isArray(config.cultures) ? config.cultures : [];
  const cultureById = new Map<string, Record<string, unknown>>();
  for (const culture of cultures) {
    if (isRecord(culture) && typeof culture.id === 'string') {
      cultureById.set(culture.id, culture);
    }
  }

  const ensureNaming = (culture: Record<string, unknown>): Record<string, unknown> => {
    if (isRecord(culture.naming)) {
      return culture.naming;
    }
    culture.naming = {};
    return culture.naming as Record<string, unknown>;
  };

  const attachArray = (
    culture: Record<string, unknown>,
    key: 'domains' | 'grammars' | 'profiles' | 'lexemeSpecs',
    entry: Record<string, unknown>,
    label: string,
    span: BlockNode['span']
  ) => {
    const naming = ensureNaming(culture);
    const existing = naming[key];
    let list: Record<string, unknown>[];
    if (existing === undefined) {
      list = [];
      naming[key] = list;
    } else if (Array.isArray(existing)) {
      list = existing as Record<string, unknown>[];
    } else {
      diagnostics.push({
        severity: 'error',
        message: `culture "${String(culture.id)}" naming.${key} must be an array`,
        span
      });
      return;
    }
    const id = entry.id;
    if (typeof id === 'string' && list.some((item) => isRecord(item) && item.id === id)) {
      diagnostics.push({
        severity: 'error',
        message: `Duplicate ${label} "${id}" for culture "${String(culture.id)}"`,
        span
      });
      return;
    }
    list.push(entry);
  };

  const attachLexemeList = (
    culture: Record<string, unknown>,
    entry: Record<string, unknown>,
    span: BlockNode['span'],
    cultureId: string
  ) => {
    const naming = ensureNaming(culture);
    const existing = naming.lexemeLists;
    let lists: Record<string, unknown>;
    if (existing === undefined) {
      lists = {};
      naming.lexemeLists = lists;
    } else if (isRecord(existing)) {
      lists = existing;
    } else {
      diagnostics.push({
        severity: 'error',
        message: `culture "${String(culture.id)}" naming.lexemeLists must be an object`,
        span
      });
      return;
    }
    const id = entry.id;
    if (typeof id !== 'string') {
      diagnostics.push({
        severity: 'error',
        message: 'lexeme_list requires id',
        span
      });
      return;
    }
    if (lists[id]) {
      diagnostics.push({
        severity: 'error',
        message: `Duplicate lexeme_list "${id}" for culture "${String(culture.id)}"`,
        span
      });
      return;
    }
    const payload = { ...entry };
    const emitCultureId = payload.__emitCultureId === true;
    delete payload.__emitCultureId;
    if (emitCultureId) {
      payload.cultureId = cultureId;
    } else {
      delete payload.cultureId;
    }
    lists[id] = payload;
  };

  const applyEntries = (
    entries: NamingResourceEntry[],
    key: 'domains' | 'grammars' | 'profiles' | 'lexemeSpecs',
    label: string,
    options?: { preserveCultureId?: boolean }
  ) => {
    for (const entry of entries) {
      for (const cultureId of entry.cultures) {
        const culture = cultureById.get(cultureId);
        if (!culture) {
          diagnostics.push({
            severity: 'error',
            message: `Unknown culture "${cultureId}" referenced by ${label}`,
            span: entry.span
          });
          continue;
        }
        const payload = { ...entry.item };
        const emitCultureId = payload.__emitCultureId === true;
        delete payload.__emitCultureId;
        if (options?.preserveCultureId || emitCultureId) {
          payload.cultureId = cultureId;
        } else {
          delete payload.cultureId;
        }
        attachArray(culture, key, payload, label, entry.span);
      }
    }
  };

  applyEntries(resources.domains, 'domains', 'domain');
  applyEntries(resources.grammars, 'grammars', 'grammar');
  applyEntries(resources.profiles, 'profiles', 'profile');
  applyEntries(resources.lexemeSpecs, 'lexemeSpecs', 'lexeme_spec', { preserveCultureId: true });

  for (const entry of resources.lexemeLists) {
    for (const cultureId of entry.cultures) {
      const culture = cultureById.get(cultureId);
      if (!culture) {
        diagnostics.push({
          severity: 'error',
          message: `Unknown culture "${cultureId}" referenced by lexeme_list`,
          span: entry.span
        });
        continue;
      }
      const payload = { ...entry.item };
      delete payload.cultureId;
      attachLexemeList(culture, payload, entry.span, cultureId);
    }
  }

  for (const culture of cultures) {
    if (!isRecord(culture)) continue;
    if (!isRecord(culture.naming)) continue;
    if (culture.naming.lexemeSpecs === undefined) {
      culture.naming.lexemeSpecs = [];
    }
  }
}

export function buildNamingDomain(block: BlockNode, diagnostics: Diagnostic[]): Record<string, unknown> | null {
  const domain: Record<string, unknown> = {};

  for (const stmt of block.body) {
    if (stmt.type === 'attribute') {
      if (stmt.key === 'culture_id') {
        const ref = parseResourceReferenceValue(stmt.value, diagnostics, block, 'culture', {
          allowArray: true,
          allowedTypes: ['culture']
        });
        if (ref !== null) {
          domain.cultureId = ref;
          domain.__emitCultureId = true;
        }
        continue;
      }
      if (stmt.key === 'culture') {
        const ref = parseResourceReferenceValue(stmt.value, diagnostics, block, 'culture', {
          allowArray: true,
          allowedTypes: ['culture']
        });
        if (ref !== null) {
          domain.cultureId = ref;
        }
        continue;
      }
      const value = valueToJson(stmt.value, diagnostics, block);
      if (stmt.key === 'phonology' && isRecord(value)) {
        domain.phonology = value;
        continue;
      }
      if (stmt.key === 'morphology' && isRecord(value)) {
        domain.morphology = value;
        continue;
      }
      if (stmt.key === 'style' && isRecord(value)) {
        domain.style = value;
        continue;
      }
      setObjectValue(domain, stmt.key, value);
      continue;
    }
    if (stmt.type === 'block') {
      if (stmt.name === 'culture') {
        diagnostics.push({
          severity: 'error',
          message: 'culture reference must use "<name>.id" (no nested culture blocks)',
          span: stmt.span
        });
        continue;
      }
      if (stmt.name === 'phonology') {
        domain.phonology = buildPhonologyFromStatements(stmt.body, diagnostics, stmt);
        continue;
      }
      if (stmt.name === 'morphology') {
        domain.morphology = buildMorphologyFromStatements(stmt.body, diagnostics, stmt);
        continue;
      }
      if (stmt.name === 'style') {
        domain.style = buildStyleRulesFromStatements(stmt.body, diagnostics, stmt);
        continue;
      }
      const child = buildObjectFromStatements(stmt.body, diagnostics, stmt);
      setObjectValue(domain, stmt.name, child);
    }
  }

  if (!applyLabelField(domain, 'id', block.labels[0], diagnostics, block)) return null;
  return domain;
}

export function buildPhonologyFromStatements(
  statements: StatementNode[],
  diagnostics: Diagnostic[],
  parent: BlockNode
): Record<string, unknown> {
  const phonology: Record<string, unknown> = {};
  const consonantWeights: number[] = [];
  const vowelWeights: number[] = [];
  const templateWeights: number[] = [];
  let sawConsonantWeights = false;
  let sawVowelWeights = false;
  let sawTemplateWeights = false;

  for (const stmt of statements) {
    if (stmt.type !== 'attribute') {
      diagnostics.push({
        severity: 'error',
        message: 'phonology block only supports attributes',
        span: stmt.span
      });
      continue;
    }
    const value = valueToJson(stmt.value, diagnostics, parent);
    if (stmt.key === 'length' && Array.isArray(value) && value.length >= 2) {
      phonology.lengthRange = [value[0], value[1]];
      continue;
    }
    if (stmt.key === 'templates') {
      phonology.syllableTemplates = value;
      continue;
    }
    if (stmt.key === 'favored_clusters') {
      if (isObjectValue(stmt.value)) {
        diagnostics.push({
          severity: 'error',
          message: 'favored_clusters does not support object literals',
          span: stmt.span
        });
        continue;
      }
      const raw = valueToJson(stmt.value, diagnostics, parent);
      const tokens = Array.isArray(raw) ? raw : [raw];
      if (tokens.length === 1 && isRecord(tokens[0])) {
        diagnostics.push({
          severity: 'error',
          message: 'favored_clusters does not support object values',
          span: stmt.span
        });
        continue;
      }
      const parsed = parseSetTokens(tokens, diagnostics, stmt.span);
      if (!parsed) continue;
      mergeSetFieldValue(phonology, 'favoredClusters', parsed, diagnostics, stmt.span);
      continue;
    }
    if (stmt.key === 'forbidden_clusters') {
      if (isObjectValue(stmt.value)) {
        diagnostics.push({
          severity: 'error',
          message: 'forbidden_clusters does not support object literals',
          span: stmt.span
        });
        continue;
      }
      const raw = valueToJson(stmt.value, diagnostics, parent);
      const tokens = Array.isArray(raw) ? raw : [raw];
      if (tokens.length === 1 && isRecord(tokens[0])) {
        diagnostics.push({
          severity: 'error',
          message: 'forbidden_clusters does not support object values',
          span: stmt.span
        });
        continue;
      }
      const parsed = parseSetTokens(tokens, diagnostics, stmt.span);
      if (!parsed) continue;
      mergeSetFieldValue(phonology, 'forbiddenClusters', parsed, diagnostics, stmt.span);
      continue;
    }
    if (stmt.key === 'favored_cluster_boost') {
      phonology.favoredClusterBoost = value;
      continue;
    }
    if (stmt.key === 'consonant_weights' || stmt.key === 'vowel_weights' || stmt.key === 'template_weights') {
      diagnostics.push({
        severity: 'error',
        message: `${stmt.key} is not supported; use ${stmt.key.replace('_weights', '_weight')} entries`,
        span: stmt.span
      });
      continue;
    }
    if (stmt.key === 'consonant_weight') {
      if (typeof value !== 'number') {
        diagnostics.push({
          severity: 'error',
          message: 'consonant_weight requires a numeric value',
          span: stmt.span
        });
        continue;
      }
      sawConsonantWeights = true;
      consonantWeights.push(value);
      continue;
    }
    if (stmt.key === 'vowel_weight') {
      if (typeof value !== 'number') {
        diagnostics.push({
          severity: 'error',
          message: 'vowel_weight requires a numeric value',
          span: stmt.span
        });
        continue;
      }
      sawVowelWeights = true;
      vowelWeights.push(value);
      continue;
    }
    if (stmt.key === 'template_weight') {
      if (typeof value !== 'number') {
        diagnostics.push({
          severity: 'error',
          message: 'template_weight requires a numeric value',
          span: stmt.span
        });
        continue;
      }
      sawTemplateWeights = true;
      templateWeights.push(value);
      continue;
    }
    if (stmt.key === 'max_cluster') {
      phonology.maxConsonantCluster = value;
      continue;
    }
    if (stmt.key === 'min_vowel_spacing') {
      phonology.minVowelSpacing = value;
      continue;
    }
    if (stmt.key === 'sonority') {
      phonology.sonorityRanks = value;
      continue;
    }
    setObjectValue(phonology, stmt.key, value);
  }

  if (sawConsonantWeights) {
    phonology.consonantWeights = consonantWeights;
  }
  if (sawVowelWeights) {
    phonology.vowelWeights = vowelWeights;
  }
  if (sawTemplateWeights) {
    phonology.templateWeights = templateWeights;
  }

  return phonology;
}

export function buildMorphologyFromStatements(
  statements: StatementNode[],
  diagnostics: Diagnostic[],
  parent: BlockNode
): Record<string, unknown> {
  const morphology: Record<string, unknown> = {};
  const prefixWeights: number[] = [];
  const suffixWeights: number[] = [];
  const structureWeights: number[] = [];
  let sawPrefixWeights = false;
  let sawSuffixWeights = false;
  let sawStructureWeights = false;

  for (const stmt of statements) {
    if (stmt.type !== 'attribute') {
      diagnostics.push({
        severity: 'error',
        message: 'morphology block only supports attributes',
        span: stmt.span
      });
      continue;
    }
    const value = valueToJson(stmt.value, diagnostics, parent);
    if (stmt.key === 'word_roots') {
      if (isRecord(value)) {
        diagnostics.push({
          severity: 'error',
          message: 'word_roots only supports identifiers or strings',
          span: stmt.span
        });
        continue;
      }
      const tokens = Array.isArray(value) ? value : [value];
      if (tokens.length === 1 && isRecord(tokens[0])) {
        diagnostics.push({
          severity: 'error',
          message: 'word_roots only supports identifiers or strings',
          span: stmt.span
        });
        continue;
      }
      const parsed = parseListTokens(tokens, diagnostics, stmt.span, 'word_roots');
      if (!parsed) continue;
      mergeListFieldValue(morphology, 'wordRoots', parsed, diagnostics, stmt.span);
      continue;
    }
    if (stmt.key === 'prefixes' || stmt.key === 'suffixes' || stmt.key === 'infixes' || stmt.key === 'honorifics' || stmt.key === 'structure') {
      if (isRecord(value)) {
        diagnostics.push({
          severity: 'error',
          message: `${stmt.key} only supports identifiers or strings`,
          span: stmt.span
        });
        continue;
      }
      const tokens = Array.isArray(value) ? value : [value];
      if (tokens.length === 1 && isRecord(tokens[0])) {
        diagnostics.push({
          severity: 'error',
          message: `${stmt.key} only supports identifiers or strings`,
          span: stmt.span
        });
        continue;
      }
      const parsed = parseListTokens(tokens, diagnostics, stmt.span, stmt.key);
      if (!parsed) continue;
      mergeListFieldValue(morphology, stmt.key, parsed, diagnostics, stmt.span);
      continue;
    }
    if (stmt.key === 'prefix_weights' || stmt.key === 'suffix_weights' || stmt.key === 'structure_weights') {
      diagnostics.push({
        severity: 'error',
        message: `${stmt.key} is not supported; use ${stmt.key.replace('_weights', '_weight')} entries`,
        span: stmt.span
      });
      continue;
    }
    if (stmt.key === 'prefix_weight') {
      if (typeof value !== 'number') {
        diagnostics.push({
          severity: 'error',
          message: 'prefix_weight requires a numeric value',
          span: stmt.span
        });
        continue;
      }
      sawPrefixWeights = true;
      prefixWeights.push(value);
      continue;
    }
    if (stmt.key === 'suffix_weight') {
      if (typeof value !== 'number') {
        diagnostics.push({
          severity: 'error',
          message: 'suffix_weight requires a numeric value',
          span: stmt.span
        });
        continue;
      }
      sawSuffixWeights = true;
      suffixWeights.push(value);
      continue;
    }
    if (stmt.key === 'structure_weight') {
      if (typeof value !== 'number') {
        diagnostics.push({
          severity: 'error',
          message: 'structure_weight requires a numeric value',
          span: stmt.span
        });
        continue;
      }
      sawStructureWeights = true;
      structureWeights.push(value);
      continue;
    }
    setObjectValue(morphology, stmt.key, value);
  }

  if (sawPrefixWeights) {
    morphology.prefixWeights = prefixWeights;
  }
  if (sawSuffixWeights) {
    morphology.suffixWeights = suffixWeights;
  }
  if (sawStructureWeights) {
    morphology.structureWeights = structureWeights;
  }

  return morphology;
}

export function buildStyleRulesFromStatements(
  statements: StatementNode[],
  diagnostics: Diagnostic[],
  parent: BlockNode
): Record<string, unknown> {
  const style: Record<string, unknown> = {};

  for (const stmt of statements) {
    if (stmt.type !== 'attribute') {
      diagnostics.push({
        severity: 'error',
        message: 'style block only supports attributes',
        span: stmt.span
      });
      continue;
    }
    const value = valueToJson(stmt.value, diagnostics, parent);
    if (stmt.key === 'apostrophe_rate') {
      style.apostropheRate = value;
      continue;
    }
    if (stmt.key === 'hyphen_rate') {
      style.hyphenRate = value;
      continue;
    }
    if (stmt.key === 'preferred_endings') {
      if (isRecord(value)) {
        diagnostics.push({
          severity: 'error',
          message: 'preferred_endings only supports identifiers or strings',
          span: stmt.span
        });
        continue;
      }
      const tokens = Array.isArray(value) ? value : [value];
      if (tokens.length === 1 && isRecord(tokens[0])) {
        diagnostics.push({
          severity: 'error',
          message: 'preferred_endings only supports identifiers or strings',
          span: stmt.span
        });
        continue;
      }
      const parsed = parseListTokens(tokens, diagnostics, stmt.span, 'preferred_endings');
      if (!parsed) continue;
      mergeListFieldValue(style, 'preferredEndings', parsed, diagnostics, stmt.span);
      continue;
    }
    if (stmt.key === 'preferred_ending_boost') {
      style.preferredEndingBoost = value;
      continue;
    }
    if (stmt.key === 'rhythm_bias') {
      style.rhythmBias = value;
      continue;
    }
    if (stmt.key === 'target_length') {
      style.targetLength = value;
      continue;
    }
    if (stmt.key === 'length_tolerance') {
      style.lengthTolerance = value;
      continue;
    }
    setObjectValue(style, stmt.key, value);
  }

  return style;
}

export function buildLexemeList(block: BlockNode, diagnostics: Diagnostic[]): Record<string, unknown> | null {
  const list: Record<string, unknown> = {};
  const entries: string[] = [];
  let seenEntries = false;

  for (const stmt of block.body) {
    if (stmt.type !== 'attribute') {
      diagnostics.push({
        severity: 'error',
        message: 'lexeme_list only supports attributes',
        span: stmt.span
      });
      continue;
    }
    if (stmt.key === 'culture_id') {
      const ref = parseResourceReferenceValue(stmt.value, diagnostics, block, 'culture', {
        allowArray: true,
        allowedTypes: ['culture']
      });
      if (ref !== null) {
        list.cultureId = ref;
        list.__emitCultureId = true;
      }
      continue;
    }
    if (stmt.key === 'culture') {
      const ref = parseResourceReferenceValue(stmt.value, diagnostics, block, 'culture', {
        allowArray: true,
        allowedTypes: ['culture']
      });
      if (ref !== null) {
        list.cultureId = ref;
      }
      continue;
    }
    if (stmt.key === 'entry') {
      const value = valueToJson(stmt.value, diagnostics, block);
      seenEntries = true;
      if (typeof value === 'string') {
        entries.push(value);
      } else if (Array.isArray(value)) {
        for (const entry of value) {
          if (typeof entry !== 'string') {
            diagnostics.push({
              severity: 'error',
              message: 'entry values must be strings',
              span: stmt.span
            });
            return null;
          }
          entries.push(entry);
        }
      } else {
        diagnostics.push({
          severity: 'error',
          message: 'entry values must be strings',
          span: stmt.span
        });
        return null;
      }
      continue;
    }
    const value = valueToJson(stmt.value, diagnostics, block);
    if (stmt.key === 'entries') {
      seenEntries = true;
      if (!Array.isArray(value)) {
        diagnostics.push({
          severity: 'error',
          message: 'entries must be a list of strings',
          span: stmt.span
        });
        return null;
      }
      for (const entry of value) {
        if (typeof entry !== 'string') {
          diagnostics.push({
            severity: 'error',
            message: 'entries must be a list of strings',
            span: stmt.span
          });
          return null;
        }
        entries.push(entry);
      }
      continue;
    }
    setObjectValue(list, stmt.key, value);
  }

  if (!applyLabelField(list, 'id', block.labels[0], diagnostics, block)) return null;
  if (seenEntries) list.entries = entries;
  return list;
}

export function buildLexemeSpec(block: BlockNode, diagnostics: Diagnostic[]): Record<string, unknown> | null {
  const spec: Record<string, unknown> = {};

  for (const stmt of block.body) {
    if (stmt.type === 'attribute') {
      if (stmt.key === 'culture_id') {
        const ref = parseResourceReferenceValue(stmt.value, diagnostics, block, 'culture', {
          allowArray: true,
          allowedTypes: ['culture']
        });
        if (ref !== null) {
          spec.cultureId = ref;
          spec.__emitCultureId = true;
        }
        continue;
      }
      if (stmt.key === 'culture') {
        const ref = parseResourceReferenceValue(stmt.value, diagnostics, block, 'culture', {
          allowArray: true,
          allowedTypes: ['culture']
        });
        if (ref !== null) {
          spec.cultureId = ref;
        }
        continue;
      }
      const value = valueToJson(stmt.value, diagnostics, block);
      if (stmt.key === 'target') {
        spec.targetCount = value;
        continue;
      }
      if (stmt.key === 'quality' && Array.isArray(value) && value.length >= 2) {
        const arr = value as unknown[];
        spec.qualityFilter = { minLength: arr[0], maxLength: arr[1] };
        continue;
      }
      if (stmt.key === 'max_words') {
        spec.maxWords = value;
        continue;
      }
      if (stmt.key === 'word_style') {
        spec.wordStyle = value;
        continue;
      }
      setObjectValue(spec, stmt.key, value);
      continue;
    }

    if (stmt.type === 'block') {
      if (stmt.name === 'word_style') {
        spec.wordStyle = buildObjectFromStatements(stmt.body, diagnostics, stmt);
        continue;
      }
      const child = buildObjectFromStatements(stmt.body, diagnostics, stmt);
      setObjectValue(spec, stmt.name, child);
      continue;
    }

    diagnostics.push({
      severity: 'error',
      message: 'lexeme_spec only supports attributes or blocks',
      span: stmt.span
    });
  }

  if (!applyLabelField(spec, 'id', block.labels[0], diagnostics, block)) return null;
  return spec;
}

export function buildGrammarFromBlock(block: BlockNode, diagnostics: Diagnostic[]): Record<string, unknown> | null {
  const grammar: Record<string, unknown> = {};
  const rules: Record<string, string[][]> = {};
  let seenRules = false;

  for (const stmt of block.body) {
    if (stmt.type !== 'attribute') {
      diagnostics.push({
        severity: 'error',
        message: 'grammar only supports attributes',
        span: stmt.span
      });
      continue;
    }
    if (stmt.key === 'culture_id') {
      const ref = parseResourceReferenceValue(stmt.value, diagnostics, block, 'culture', {
        allowArray: true,
        allowedTypes: ['culture']
      });
      if (ref !== null) {
        grammar.cultureId = ref;
        grammar.__emitCultureId = true;
      }
      continue;
    }
    if (stmt.key === 'culture') {
      const ref = parseResourceReferenceValue(stmt.value, diagnostics, block, 'culture', {
        allowArray: true,
        allowedTypes: ['culture']
      });
      if (ref !== null) {
        grammar.cultureId = ref;
      }
      continue;
    }
    if (stmt.key === 'rule') {
      const raw = valueToJson(stmt.value, diagnostics, block);
      if (!Array.isArray(raw) || raw.length < 2) {
        diagnostics.push({
          severity: 'error',
          message: 'rule requires name and tokens',
          span: stmt.span
        });
        return null;
      }
      const rawArr = raw as unknown[];
      const name: unknown = rawArr[0];
      const rest: unknown[] = rawArr.slice(1);
      if (typeof name !== 'string') {
        diagnostics.push({
          severity: 'error',
          message: 'rule name must be a string',
          span: stmt.span
        });
        return null;
      }
      let tokens: unknown[] = rest;
      if (rest.length === 1 && Array.isArray(rest[0])) {
        tokens = rest[0] as unknown[];
      }
      const parsed: string[] = [];
      for (const token of tokens) {
        if (typeof token !== 'string') {
          diagnostics.push({
            severity: 'error',
            message: 'rule tokens must be strings',
            span: stmt.span
          });
          return null;
        }
        parsed.push(token);
      }
      if (!rules[name]) rules[name] = [];
      rules[name].push(parsed);
      seenRules = true;
      continue;
    }
    const value = valueToJson(stmt.value, diagnostics, block);
    if (stmt.key === 'rules') {
      if (value === 'none') {
        seenRules = true;
        continue;
      }
      if (isRecord(value)) {
        Object.assign(rules, value);
        seenRules = true;
        continue;
      }
    }
    setObjectValue(grammar, stmt.key, value);
  }

  if (!applyLabelField(grammar, 'id', block.labels[0], diagnostics, block)) return null;
  if (seenRules) grammar.rules = rules;
  return grammar;
}

export function _buildNamingFromStatements(
  statements: StatementNode[],
  diagnostics: Diagnostic[],
  parent: BlockNode
): Record<string, unknown> {
  const naming: Record<string, unknown> = {};
  const domains: Record<string, unknown>[] = [];
  const grammars: Record<string, unknown>[] = [];
  const profiles: Record<string, unknown>[] = [];
  const lexemeSpecs: Record<string, unknown>[] = [];
  const lexemeLists: Record<string, unknown> = {};
  let seenDomains = false;
  let seenGrammars = false;
  let seenProfiles = false;
  let seenLexemeSpecs = false;
  let seenLexemeLists = false;

  for (const stmt of statements) {
    if (stmt.type === 'attribute') {
      const value = valueToJson(stmt.value, diagnostics, parent);
      if (stmt.key === 'domains' && Array.isArray(value)) {
        seenDomains = true;
        domains.push(...(value as Record<string, unknown>[]));
        continue;
      }
      if (stmt.key === 'grammars' && Array.isArray(value)) {
        seenGrammars = true;
        grammars.push(...(value as Record<string, unknown>[]));
        continue;
      }
      if (stmt.key === 'profiles' && Array.isArray(value)) {
        seenProfiles = true;
        profiles.push(...(value as Record<string, unknown>[]));
        continue;
      }
      if (stmt.key === 'lexemeSpecs' && Array.isArray(value)) {
        seenLexemeSpecs = true;
        lexemeSpecs.push(...(value as Record<string, unknown>[]));
        continue;
      }
      if (stmt.key === 'lexemeLists' && isRecord(value)) {
        seenLexemeLists = true;
        Object.assign(lexemeLists, value);
        continue;
      }
      setObjectValue(naming, stmt.key, value);
      continue;
    }

    if (stmt.type === 'block') {
      if (stmt.name === 'domain') {
        seenDomains = true;
        const domain = buildNamingDomain(stmt, diagnostics);
        if (!domain) continue;
        domains.push(domain);
        continue;
      }
      if (stmt.name === 'lexeme_list' || stmt.name === 'lexeme') {
        seenLexemeLists = true;
        const lexeme = buildLexemeList(stmt, diagnostics);
        if (!lexeme) continue;
        if (lexemeLists[lexeme.id as string]) {
          diagnostics.push({
            severity: 'error',
            message: `Duplicate lexeme list "${String(lexeme.id)}"`,
            span: stmt.span
          });
          continue;
        }
        lexemeLists[lexeme.id as string] = lexeme;
        continue;
      }
      if (stmt.name === 'lexeme_spec') {
        seenLexemeSpecs = true;
        const spec = buildLexemeSpec(stmt, diagnostics);
        if (!spec) continue;
        lexemeSpecs.push(spec);
        continue;
      }
      if (stmt.name === 'grammar') {
        seenGrammars = true;
        const grammar = buildGrammarFromBlock(stmt, diagnostics);
        if (!grammar) continue;
        grammars.push(grammar);
        continue;
      }
      if (stmt.name === 'profile') {
        seenProfiles = true;
        const profile = buildNamingProfile(stmt, diagnostics);
        if (profile) profiles.push(profile);
        continue;
      }
      const child = buildObjectFromStatements(stmt.body, diagnostics, stmt);
      if (stmt.labels.length > 0) {
        const existingId = child.id;
        if (existingId === undefined) {
          child.id = stmt.labels[0];
        } else if (typeof existingId !== 'string') {
          diagnostics.push({
            severity: 'error',
            message: 'block id must be a string',
            span: stmt.span
          });
        } else if (existingId !== stmt.labels[0]) {
          diagnostics.push({
            severity: 'error',
            message: `block id mismatch: label "${stmt.labels[0]}" vs id "${existingId}"`,
            span: stmt.span
          });
        }
      }
      if (stmt.labels.length > 1) {
        const existingName = child.name;
        if (existingName === undefined) {
          child.name = stmt.labels[1];
        } else if (typeof existingName !== 'string') {
          diagnostics.push({
            severity: 'error',
            message: 'block name must be a string',
            span: stmt.span
          });
        } else if (existingName !== stmt.labels[1]) {
          diagnostics.push({
            severity: 'error',
            message: `block name mismatch: label "${stmt.labels[1]}" vs name "${existingName}"`,
            span: stmt.span
          });
        }
      }
      setObjectValue(naming, stmt.name, child);
    }
  }

  if (seenDomains) naming.domains = domains;
  if (seenGrammars) naming.grammars = grammars;
  if (seenProfiles) naming.profiles = profiles;
  if (seenLexemeSpecs) naming.lexemeSpecs = lexemeSpecs;
  if (seenLexemeLists) naming.lexemeLists = lexemeLists;

  return naming;
}

export function buildNamingProfile(block: BlockNode, diagnostics: Diagnostic[]): Record<string, unknown> | null {
  const profile: Record<string, unknown> = {};
  const strategyGroups: Record<string, unknown>[] = [];
  let seenStrategyGroups = false;

  for (const stmt of block.body) {
    if (stmt.type === 'attribute') {
      if (stmt.key === 'culture_id') {
        const ref = parseResourceReferenceValue(stmt.value, diagnostics, block, 'culture', {
          allowArray: true,
          allowedTypes: ['culture']
        });
        if (ref !== null) {
          profile.cultureId = ref;
          profile.__emitCultureId = true;
        }
        continue;
      }
      if (stmt.key === 'culture') {
        const ref = parseResourceReferenceValue(stmt.value, diagnostics, block, 'culture', {
          allowArray: true,
          allowedTypes: ['culture']
        });
        if (ref !== null) {
          profile.cultureId = ref;
        }
        continue;
      }
      const value = valueToJson(stmt.value, diagnostics, block);
      if (stmt.key === 'strategyGroups' && Array.isArray(value)) {
        seenStrategyGroups = true;
        strategyGroups.push(...(value as Record<string, unknown>[]));
        continue;
      }
      if (applySetFieldAttribute(stmt, profile, diagnostics, block)) {
        continue;
      }
      setObjectValue(profile, stmt.key, value);
      continue;
    }

    if (stmt.type === 'block') {
      if (stmt.name === 'strategy_group' || stmt.name === 'strategyGroup') {
        seenStrategyGroups = true;
        const group = buildStrategyGroup(stmt, diagnostics);
        if (group) strategyGroups.push(group);
        continue;
      }
      const child = buildObjectFromStatements(stmt.body, diagnostics, stmt);
      if (stmt.labels.length > 0) {
        const existingId = child.id;
        if (existingId === undefined) {
          child.id = stmt.labels[0];
        } else if (typeof existingId !== 'string') {
          diagnostics.push({
            severity: 'error',
            message: 'block id must be a string',
            span: stmt.span
          });
        } else if (existingId !== stmt.labels[0]) {
          diagnostics.push({
            severity: 'error',
            message: `block id mismatch: label "${stmt.labels[0]}" vs id "${existingId}"`,
            span: stmt.span
          });
        }
      }
      if (stmt.labels.length > 1) {
        const existingName = child.name;
        if (existingName === undefined) {
          child.name = stmt.labels[1];
        } else if (typeof existingName !== 'string') {
          diagnostics.push({
            severity: 'error',
            message: 'block name must be a string',
            span: stmt.span
          });
        } else if (existingName !== stmt.labels[1]) {
          diagnostics.push({
            severity: 'error',
            message: `block name mismatch: label "${stmt.labels[1]}" vs name "${existingName}"`,
            span: stmt.span
          });
        }
      }
      setObjectValue(profile, stmt.name, child);
    }
  }

  if (block.labels[0]) {
    if (!applyLabelField(profile, 'id', block.labels[0], diagnostics, block)) return null;
  }
  if (block.labels[1]) {
    if (!applyLabelField(profile, 'name', block.labels[1], diagnostics, block)) return null;
  }
  if (seenStrategyGroups) {
    profile.strategyGroups = strategyGroups;
  }

  return profile;
}

export function buildStrategyGroup(block: BlockNode, diagnostics: Diagnostic[]): Record<string, unknown> | null {
  const group: Record<string, unknown> = {};
  const strategies: Record<string, unknown>[] = [];
  let seenStrategies = false;

  for (const stmt of block.body) {
    if (stmt.type === 'attribute') {
      if (stmt.key === 'strategy' && stmt.labels && stmt.labels.length > 0) {
        seenStrategies = true;
        const strategy = buildStrategyFromAttribute(stmt, diagnostics, block);
        if (strategy) strategies.push(strategy);
        continue;
      }
      const value = valueToJson(stmt.value, diagnostics, block);
      if (stmt.key === 'conditions') {
        if (value === 'none') {
          group.conditions = null;
        } else {
          group.conditions = value;
        }
        continue;
      }
      setObjectValue(group, stmt.key, value);
      continue;
    }

    if (stmt.type === 'block') {
      if (stmt.name === 'conditions') {
        group.conditions = buildObjectFromStatements(stmt.body, diagnostics, stmt);
        continue;
      }
      if (stmt.name === 'strategy') {
        seenStrategies = true;
        const strategy = buildStrategyFromBlock(stmt, diagnostics);
        if (strategy) strategies.push(strategy);
        continue;
      }
      diagnostics.push({
        severity: 'error',
        message: `Unsupported strategy group block "${stmt.name}"`,
        span: stmt.span
      });
    }
  }

  if (block.labels[0]) {
    if (!applyLabelField(group, 'name', block.labels[0], diagnostics, block)) return null;
  }
  if (seenStrategies) {
    group.strategies = strategies;
  }
  if (isRecord(group.conditions)) {
    const prominence = group.conditions.prominence;
    if (prominence === 'none') {
      group.conditions.prominence = [];
    } else if (typeof prominence === 'string') {
      group.conditions.prominence = [prominence];
    }
  }

  return group;
}

export function buildStrategyFromAttribute(
  stmt: AttributeNode,
  diagnostics: Diagnostic[],
  parent: BlockNode
): Record<string, unknown> | null {
  const strategy: Record<string, unknown> = {};
  const typeLabel = stmt.labels?.[0];
  const idLabel = stmt.labels?.[1];
  if (!typeLabel || typeof typeLabel !== 'string') {
    diagnostics.push({
      severity: 'error',
      message: 'strategy requires a type label',
      span: stmt.span
    });
    return null;
  }

  const value = valueToJson(stmt.value, diagnostics, parent);
  if (isRecord(value)) {
    Object.assign(strategy, value);
  }

  strategy.type = typeLabel;
  if (typeLabel === 'grammar') {
    const resolved = parseResourceReferenceLabel(idLabel, diagnostics, stmt.span, 'grammar', ['grammar']);
    if (!resolved) return null;
    strategy.grammarId = resolved;
  } else if (typeLabel === 'phonotactic') {
    const resolved = parseResourceReferenceLabel(idLabel, diagnostics, stmt.span, 'domain', ['domain']);
    if (!resolved) return null;
    strategy.domainId = resolved;
  }

  if (strategy.weight === undefined) {
    diagnostics.push({
      severity: 'error',
      message: 'strategy requires explicit weight',
      span: stmt.span
    });
    return null;
  }

  return strategy;
}

export function buildStrategyFromBlock(block: BlockNode, diagnostics: Diagnostic[]): Record<string, unknown> | null {
  const strategy = buildObjectFromStatements(block.body, diagnostics, block);
  const typeLabel = block.labels[0];
  const idLabel = block.labels[1];

  if (!typeLabel) {
    diagnostics.push({
      severity: 'error',
      message: 'strategy requires a type label',
      span: block.span
    });
    return null;
  }

  strategy.type = typeLabel;
  if (typeLabel === 'grammar') {
    const resolved = parseResourceReferenceLabel(idLabel, diagnostics, block.span, 'grammar', ['grammar']);
    if (!resolved) return null;
    strategy.grammarId = resolved;
  } else if (typeLabel === 'phonotactic') {
    const resolved = parseResourceReferenceLabel(idLabel, diagnostics, block.span, 'domain', ['domain']);
    if (!resolved) return null;
    strategy.domainId = resolved;
  }

  if (strategy.weight === undefined) {
    diagnostics.push({
      severity: 'error',
      message: 'strategy requires explicit weight',
      span: block.span
    });
    return null;
  }

  return strategy;
}

