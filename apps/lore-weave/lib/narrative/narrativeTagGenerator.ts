/**
 * Narrative Tag Generator
 *
 * Generates semantic tags for narrative events to enable
 * filtering and categorization in story generation.
 */

import type { NarrativeEventKind, NarrativeEntityRef } from '@canonry/world-schema';
import { getProminenceValue } from './significanceCalculator.js';

export interface TagContext {
  entityKinds: Set<string>;
}

/**
 * State change data for tag generation (subset of legacy NarrativeStateChange)
 */
interface StateChangeData {
  field: string;
  previousValue: unknown;
  newValue: unknown;
}

/** Lookup map: event kind -> additional tags */
const EVENT_KIND_TAGS: Partial<Record<NarrativeEventKind, string[]>> = {
  succession: ['leadership', 'transition'],
  coalescence: ['unification', 'formation'],
  relationship_dissolved: ['dissolution', 'ended'],
  relationship_ended: ['ended', 'loss', 'lifecycle'],
  betrayal: ['treachery', 'broken_trust', 'dramatic'],
  reconciliation: ['peace', 'healing', 'resolution'],
  rivalry_formed: ['conflict', 'enmity', 'tension'],
  alliance_formed: ['cooperation', 'unity', 'pact'],
  leadership_established: ['leadership', 'authority', 'transition'],
  war_started: ['war', 'conflict', 'escalation'],
  war_ended: ['war', 'peace', 'resolution'],
  downfall: ['tragedy', 'decline', 'loss'],
  triumph: ['victory', 'success', 'achievement'],
  power_vacuum: ['leadership', 'crisis', 'uncertainty'],
};

/** Lookup map: subject entity kind -> additional tag */
const ENTITY_KIND_TAGS: Record<string, string> = {
  npc: 'character',
  faction: 'political',
  location: 'geographic',
  era: 'temporal',
};

/** Action keyword patterns and their associated tags */
const ACTION_KEYWORD_TAGS: Array<{ keywords: string[]; tags: string[] }> = [
  { keywords: ['war', 'attack', 'battle'], tags: ['conflict', 'war'] },
  { keywords: ['alliance', 'ally', 'join'], tags: ['cooperation', 'alliance'] },
  { keywords: ['die', 'death', 'kill'], tags: ['death', 'violence'] },
  { keywords: ['discover', 'found', 'reveal'], tags: ['discovery', 'exploration'] },
];

function addStateChangeTags(tags: Set<string>, stateChanges: StateChangeData[]): void {
  for (const change of stateChanges) {
    if (change.field === 'status') {
      const newValue = String(change.newValue);
      if (newValue === 'historical') { tags.add('passing'); tags.add('legacy'); }
      if (newValue === 'dissolved') { tags.add('ended'); tags.add('concluded'); }
    }

    if (change.field === 'prominence') {
      const oldProminence = getProminenceValue(change.previousValue as string | number);
      const newProminence = getProminenceValue(change.newValue as string | number);
      if (newProminence > oldProminence) { tags.add('rise'); tags.add('ascension'); }
      else if (newProminence < oldProminence) { tags.add('fall'); tags.add('decline'); }
    }
  }
}

function addActionTags(tags: Set<string>, action: string): void {
  const actionLower = action.toLowerCase();
  for (const pattern of ACTION_KEYWORD_TAGS) {
    if (pattern.keywords.some(kw => actionLower.includes(kw))) {
      for (const tag of pattern.tags) tags.add(tag);
    }
  }
}

/**
 * Generate narrative tags for an event
 */
export function generateNarrativeTags(
  eventKind: NarrativeEventKind,
  subject: NarrativeEntityRef,
  object: NarrativeEntityRef | undefined,
  stateChanges: StateChangeData[],
  action: string,
  _context: TagContext
): string[] {
  const tags: Set<string> = new Set();

  tags.add(eventKind);

  const kindTags = EVENT_KIND_TAGS[eventKind];
  if (kindTags) {
    for (const tag of kindTags) tags.add(tag);
  }

  addStateChangeTags(tags, stateChanges);

  tags.add(subject.kind);
  const subjectTag = ENTITY_KIND_TAGS[subject.kind];
  if (subjectTag) tags.add(subjectTag);

  if (object) tags.add(`target_${object.kind}`);

  addActionTags(tags, action);

  return Array.from(tags);
}
